const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // Adjust for production
  }
});

app.use(express.static('public'));

const rooms = new Map(); // Map<room, { creator: username, users: Set<username> }>
const userSockets = new Map(); // Map<username+room, socketId> to track active connections

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinRoom', ({ username, room }) => {
    console.log('joinRoom:', { username, room }); // Debug log

    const userKey = `${username}:${room}`;

    // If user is already in this room with this username, just confirm
    if (socket.room === room && socket.username === username) {
      socket.emit('joinSuccess', { username, room });
      return;
    }

    // If user was in a different room, leave it first
    if (socket.room && socket.username) {
      const oldRoomData = rooms.get(socket.room);
      if (oldRoomData) {
        oldRoomData.users.delete(socket.username);
        if (oldRoomData.users.size === 0) {
          rooms.delete(socket.room);
        }
        socket.leave(socket.room);
      }
    }

    if (!rooms.has(room)) {
      rooms.set(room, { creator: username, users: new Set() });
    }
    const roomData = rooms.get(room);

    // Check if username is taken by a different active socket
    const existingSocketId = userSockets.get(userKey);
    if (existingSocketId && existingSocketId !== socket.id) {
      socket.emit('joinError', 'Username already taken in this room');
      return;
    }

    socket.join(room);
    const isNewUser = !roomData.users.has(username);
    roomData.users.add(username);
    socket.username = username;
    socket.room = room;
    userSockets.set(userKey, socket.id);

    socket.emit('joinSuccess', { username, room });

    // Only send join notification if this is a truly new user
    if (isNewUser) {
      socket.to(room).emit('systemNotification', `${username} joined the room`);
    }
  });

  socket.on('guess', (data) => {
    console.log('Received guess:', data); // Debug log
    io.to(data.room).emit('guessMade', { username: data.username, guess: data.guess });
  });

  socket.on('draw', (data) => {
    console.log('Received draw:', data); // Debug log
    io.to(data.room).emit('draw', data); // Broadcast to all, including sender for consistency
  });

  socket.on('clear', (data) => {
    console.log('Received clear event for room:', data.room);
    io.to(data.room).emit('clear');
    io.to(data.room).emit('systemNotification', `${socket.username} cleared the canvas`);
  });

  socket.on('getRoomList', () => {
    console.log('Sending room list to:', socket.id); // Debug log
    const roomList = {};
    for (const [room, data] of rooms.entries()) {
      roomList[room] = data.creator;
    }
    socket.emit('roomList', roomList);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.room && socket.username) {
      const userKey = `${socket.username}:${socket.room}`;

      // Add a delay before removing user to handle quick reconnections
      setTimeout(() => {
        // Check if user reconnected with a different socket
        if (userSockets.get(userKey) === socket.id) {
          const roomData = rooms.get(socket.room);
          if (roomData) {
            roomData.users.delete(socket.username);
            userSockets.delete(userKey);

            if (roomData.users.size === 0) {
              rooms.delete(socket.room);
            } else if (roomData.creator === socket.username) {
              // Reassign creator if the creator leaves
              roomData.creator = roomData.users.values().next().value || '';
            }
            socket.to(socket.room).emit('systemNotification', `${socket.username} left the room`);
          }
        }
      }, 1000); // Reduced to 1 second delay

      // Immediately clean up the socket mapping if it matches this socket
      if (userSockets.get(userKey) === socket.id) {
        userSockets.delete(userKey);
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});