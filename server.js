const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
// Load words from JSON file
const fs = require('fs');
const words = JSON.parse(fs.readFileSync('./words.json', 'utf8'));

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  }
});

app.use(express.static('public'));

const rooms = new Map(); // Map<room, { creator: username, users: Set<username>, gameStarted: boolean, userPoints: Map<username, number>, gameTimer: number }>
const userSockets = new Map(); // Map<username+room, socketId> to track active connections

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinRoom', ({ username, room }) => {
    console.log('joinRoom:', { username, room });

    const userKey = `${username}:${room}`;
    if (socket.room === room && socket.username === username) {
      socket.emit('joinSuccess', { username, room });
      return;
    }

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
      rooms.set(room, {
        creator: username,
        painter: username,
        users: new Set(),
        gameStarted: false,
        userPoints: new Map(),
        gameTimer: 90,
        gameWasStartedOnce: false,
        roundsPlayed: new Map(),
        maxRounds: 3
      });
    }
    const roomData = rooms.get(room);

    const existingSocketId = userSockets.get(userKey);
    if (existingSocketId && existingSocketId !== socket.id) {
      socket.emit('joinError', 'Username already taken in this room');
      return;
    }

    socket.join(room);
    const isNewUser = !roomData.users.has(username);
    roomData.users.add(username);
    if (!roomData.userPoints.has(username)) {
      roomData.userPoints.set(username, 0);
    }
    socket.username = username;
    socket.room = room;
    userSockets.set(userKey, socket.id);

    socket.emit('joinSuccess', { username, room });

    if (isNewUser) {
      socket.to(room).emit('systemNotification', `${username} joined the room`);
      const userPointsObj = Object.fromEntries(roomData.userPoints);
      io.to(room).emit('gameState', {
        gameStarted: roomData.gameStarted,
        isCreator: false,
        canStart: roomData.users.size > 1 && !roomData.gameStarted,
        userPoints: userPointsObj,
        gameTimer: roomData.gameTimer,
        painter: roomData.painter,
        gameWasStartedOnce: roomData.gameWasStartedOnce,
        maxRounds: roomData.maxRounds
      });
      const creatorSocket = [...io.sockets.sockets.values()].find(s => s.username === roomData.creator && s.room === room);
      if (creatorSocket) {
        creatorSocket.emit('gameState', {
          gameStarted: roomData.gameStarted,
          isCreator: true,
          canStart: roomData.users.size > 1 && !roomData.gameStarted,
          userPoints: userPointsObj,
          gameTimer: roomData.gameTimer,
          painter: roomData.painter,
          gameWasStartedOnce: roomData.gameWasStartedOnce,
          maxRounds: roomData.maxRounds
        });
      }
    }

    // Send word display to the joining user
    if (roomData.gameStarted && roomData.currentWord) {
      if (socket.username === roomData.painter) {
        socket.emit('wordUpdate', { word: roomData.currentWord, isPainter: true });
      } else {
        const hiddenWord = '_'.repeat(roomData.currentWord.length);
        socket.emit('wordUpdate', { word: hiddenWord, isPainter: false });
      }
    }
  });

  socket.on('selectWord', ({ room, word }) => {
    const roomData = rooms.get(room);
    if (roomData && roomData.painter === socket.username && roomData.gameStarted) {
      roomData.currentWord = word;

      io.to(room).emit('painterStatus', { isPainter: false });

      const painterSocketId = userSockets.get(`${roomData.painter}:${room}`);
      const painterSocket = io.sockets.sockets.get(painterSocketId);
      if (painterSocket) {
        painterSocket.emit('painterStatus', { isPainter: true });
        painterSocket.emit('wordUpdate', { word, isPainter: true });
      }

      const hiddenWord = '_'.repeat(word.length);
      socket.to(room).emit('wordUpdate', { word: hiddenWord, isPainter: false });

      io.to(room).emit('systemNotification', `${socket.username} has chosen a word and started drawing!`);
    }
  });

  socket.on('startGame', ({ room }) => {
    const roomData = rooms.get(room);
    const usersArray = [...roomData.users];
    const drawer = roomData.painter;
    roomData.currentDrawer = drawer;

    const shuffled = [...words].sort(() => 0.5 - Math.random());
    const wordOptions = shuffled.slice(0, 3);
    console.log(`Starting game in room: ${room} with drawer: ${drawer} and words: ${wordOptions}`);

    const drawerSocketId = userSockets.get(`${drawer}:${room}`);
    const drawerSocket = io.sockets.sockets.get(drawerSocketId);
    if (drawerSocket) {
      drawerSocket.emit('wordOptions', wordOptions);
    }

    io.to(room).emit('newRound', { drawer });

    if (roomData && roomData.creator === socket.username && roomData.users.size > 1 && !roomData.gameStarted) {
      roomData.gameStarted = true;
      roomData.gameWasStartedOnce = true;
      roomData.gameTimer = 30;
      io.to(room).emit('gameStarted');
      io.to(room).emit('systemNotification', 'Game has started! You can now draw.');
      console.log(`Game started in room: ${room}`);
      console.log(roomData.users, roomData.creator, '           ', roomData.painter);

      const timerInterval = setInterval(() => {
        roomData.gameTimer--;
        io.to(room).emit('timerUpdate', roomData.gameTimer);

        if (roomData.gameTimer <= 0) {
          clearInterval(timerInterval);
          const currentRounds = roomData.roundsPlayed.get(roomData.painter) || 0;
          roomData.roundsPlayed.set(roomData.painter, currentRounds + 1);

          const allUsersPlayedMaxRounds = Array.from(roomData.users).every(user =>
            (roomData.roundsPlayed.get(user) || 0) >= roomData.maxRounds
          );

          if (allUsersPlayedMaxRounds) {
            roomData.gameStarted = false;
            roomData.gameTimer = 0;
            roomData.currentWord = null;
            io.to(room).emit('gameEndedNoRoundsLeft');
            io.to(room).emit('wordUpdate', { word: '', isPainter: false });
            return;
          }

          roomData.gameStarted = false;
          roomData.gameTimer = 90;
          roomData.currentWord = null;

          const usersArray = Array.from(roomData.users);
          const currentPainterIndex = usersArray.indexOf(roomData.painter);
          const nextPainterIndex = (currentPainterIndex + 1 ) % usersArray.length;
          roomData.painter = usersArray[nextPainterIndex];
          io.to(room).emit('painterUpdate', roomData.painter);
          io.to(room).emit('gameEnded');
          io.to(room).emit('systemNotification', 'Time is up! Game ended.');
          io.to(room).emit('wordUpdate', { word: '', isPainter: false });

          const userPointsObj = Object.fromEntries(roomData.userPoints);
          io.to(room).emit('gameState', {
            gameStarted: false,
            isCreator: false,
            canStart: roomData.users.size > 1,
            userPoints: userPointsObj,
            gameTimer: roomData.gameTimer,
            painter: roomData.painter,
            gameWasStartedOnce: roomData.gameWasStartedOnce,
            maxRounds: roomData.maxRounds
          });

          const creatorSocket = [...io.sockets.sockets.values()].find(s => s.username === roomData.creator && s.room === room);
          if (creatorSocket) {
            creatorSocket.emit('gameState', {
              gameStarted: false,
              isCreator: true,
              canStart: roomData.users.size > 1,
              userPoints: userPointsObj,
              gameTimer: roomData.gameTimer,
              painter: roomData.painter,
              gameWasStartedOnce: roomData.gameWasStartedOnce,
              maxRounds: roomData.maxRounds
            });
          }
        }
      }, 1000);
    }
  });

  socket.on('guess', (data) => {
    console.log('Received guess:', data);

    const roomData = rooms.get(data.room);

    if (data.guess.trim().toLowerCase() === roomData.currentWord?.toLowerCase()) {
      io.to(data.room).emit('systemNotification', `${data.username} guessed the correct word!`);
      roomData.userPoints.set(data.username, (roomData.userPoints.get(data.username) || 0) + 5);
      roomData.gameStarted = false;
      roomData.currentWord = null;
      io.to(data.room).emit('gameEnded');
      io.to(data.room).emit('wordUpdate', { word: '', isPainter: false });

      const userPointsObj = Object.fromEntries(roomData.userPoints);
      io.to(room).emit('gameState', {
        gameStarted: false,
        isCreator: false,
        canStart: roomData.users.size > 1,
        userPoints: userPointsObj,
        gameTimer: roomData.gameTimer,
        gameWasStartedOnce: roomData.gameWasStartedOnce,
        maxRounds: roomData.maxRounds
      });
      return;
    }

    if (roomData && roomData.gameStarted) {
      roomData.userPoints.set(data.username, (roomData.userPoints.get(data.username) || 0) + 1);
      io.to(data.room).emit('guessMade', { username: data.username, guess: data.guess });
      const userPointsObj = Object.fromEntries(roomData.userPoints);
      io.to(data.room).emit('pointsUpdate', userPointsObj);
    }
  });

  socket.on('draw', (data) => {
    const roomData = rooms.get(data.room);
    if (roomData && roomData.gameStarted) {
      io.to(data.room).emit('draw', data);
    }
  });

  socket.on('clear', (data) => {
    console.log('Received clear event for room:', data.room);
    const roomData = rooms.get(data.room);
    if (roomData && roomData.gameStarted) {
      io.to(data.room).emit('clear');
      io.to(data.room).emit('systemNotification', `${socket.username} cleared the canvas`);
    }
  });

  socket.on('getRoomList', () => {
    console.log('Sending room list to:', socket.id);
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
      if (userSockets.get(userKey) === socket.id) {
        const roomData = rooms.get(socket.room);
        if (roomData) {
          roomData.users.delete(socket.username);
          roomData.userPoints.delete(socket.username);
          userSockets.delete(userKey);

          if (roomData.users.size === 1) {
            if (roomData.gameStarted || roomData.gameWasStartedOnce) {
              console.log(`Game ended in room ${socket.room}, because other players left`);
              roomData.gameStarted = false;
              roomData.gameTimer = 0;
              roomData.painter = '';
              roomData.currentWord = null;
              roomData.roundsPlayed.clear();
              io.to(socket.room).emit('gameEndedPlayersLeft');
              io.to(socket.room).emit('wordUpdate', { word: '', isPainter: false });
            }
          }

          if (roomData.users.size === 0) {
            rooms.delete(socket.room);
          } else if (roomData.creator === socket.username) {
            roomData.creator = roomData.users.values().next().value || '';
            roomData.gameStarted = false;
            roomData.gameTimer = 90;
            roomData.painter = '';
            roomData.currentWord = null;
            roomData.roundsPlayed.clear();
            const userPointsObj = Object.fromEntries(roomData.userPoints);
            io.to(socket.room).emit('gameState', {
              gameStarted: false,
              isCreator: false,
              canStart: roomData.users.size > 1,
              userPoints: userPointsObj,
              gameTimer: roomData.gameTimer,
              gameWasStartedOnce: roomData.gameWasStartedOnce,
              maxRounds: roomData.maxRounds
            });
            const newCreatorSocket = [...io.sockets.sockets.values()].find(s => s.username === roomData.creator && s.room === socket.room);
            if (newCreatorSocket) {
              newCreatorSocket.emit('gameState', {
                gameStarted: false,
                isCreator: true,
                canStart: roomData.users.size > 1,
                userPoints: userPointsObj,
                gameTimer: roomData.gameTimer,
                gameWasStartedOnce: roomData.gameWasStartedOnce,
                maxRounds: roomData.maxRounds
              });
            }
          } else {
            const userPointsObj = Object.fromEntries(roomData.userPoints);
            io.to(socket.room).emit('gameState', {
              gameStarted: roomData.gameStarted,
              isCreator: false,
              canStart: roomData.users.size > 1 && !roomData.gameStarted,
              userPoints: userPointsObj,
              gameTimer: roomData.gameTimer,
              painter: roomData.painter,
              gameWasStartedOnce: roomData.gameWasStartedOnce,
              maxRounds: roomData.maxRounds
            });
            const creatorSocket = [...io.sockets.sockets.values()].find(s => s.username === roomData.creator && s.room === socket.room);
            if (creatorSocket) {
              creatorSocket.emit('gameState', {
                gameStarted: roomData.gameStarted,
                isCreator: true,
                canStart: roomData.users.size > 1 && !roomData.gameStarted,
                userPoints: userPointsObj,
                gameTimer: roomData.gameTimer,
                painter: roomData.painter,
                gameWasStartedOnce: roomData.gameWasStartedOnce,
                maxRounds: roomData.maxRounds
              });
            }
          }
          io.to(socket.room).emit('systemNotification', socket.username + ' left the room');
          io.to(socket.room).emit('wordUpdate', { word: '', isPainter: false });
        }
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});