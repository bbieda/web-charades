const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinRoom', (roomName) => {
    socket.join(roomName);
    console.log(`User ${socket.id} joined room ${roomName}`);
    io.to(roomName).emit('message', `User ${socket.id} joined ${roomName}`);
  });

  socket.on('guess', ({ room, guess }) => {
    console.log(`User ${socket.id} guessed "${guess}" in room ${room}`);
    io.to(room).emit('guessMade', { player: socket.id, guess });
  });

  socket.on('draw', (data) => {
    // Emituj do innych w tym samym pokoju (z wyjątkiem nadawcy)
    socket.to(data.room).emit('draw', data);
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
