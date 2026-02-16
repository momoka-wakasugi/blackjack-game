const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const WebSocketHandler = require('./websocket/WebSocketHandler');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../client')));

// Basic route for room selection
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Room-specific routes
app.get('/room/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/game.html'));
});

// Initialize WebSocket handler
const wsHandler = new WebSocketHandler(io);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Blackjack Multiplayer Server running on port ${PORT}`);
  console.log(`Access the game at http://localhost:${PORT}`);
});

module.exports = { app, server, io, wsHandler };