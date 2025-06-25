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

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinRoom', ({ username, room }) => {
    console.log('joinRoom:', { username, room }); // Debug log

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
    if (roomData.users.has(username)) {
      socket.emit('joinError', 'Username already taken in this room');
      return;
    }

    socket.join(room);
    roomData.users.add(username);
    socket.username = username;
    socket.room = room;

    socket.emit('joinSuccess', { username, room });
    socket.to(room).emit('systemNotification', `${username} joined the room`);
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
      const roomData = rooms.get(socket.room);
      if (roomData) {
        roomData.users.delete(socket.username);
        if (roomData.users.size === 0) {
          rooms.delete(socket.room);
        } else if (roomData.creator === socket.username) {
          // Reassign creator if the creator leaves
          roomData.creator = roomData.users.values().next().value || '';
        }
        socket.to(socket.room).emit('systemNotification', `${socket.username} left the room`);
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});