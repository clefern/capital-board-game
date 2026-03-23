// ========================================
// Magnata - Servidor Multiplayer
// ========================================

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './RoomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

const PORT = process.env.PORT || 3000;

// Servir o client (em produção)
const clientPath = path.join(__dirname, '../../client');
app.use(express.static(clientPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Room Manager
const roomManager = new RoomManager(io);

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log(`[+] Jogador conectado: ${socket.id}`);

  // === LOBBY ===
  socket.on('lobby:create', (data, callback) => {
    const result = roomManager.createRoom(socket, data.playerName, data.gameMode);
    callback(result);
  });

  socket.on('lobby:join', (data, callback) => {
    const result = roomManager.joinRoom(socket, data.roomId, data.playerName);
    callback(result);
  });

  socket.on('lobby:leave', () => {
    roomManager.leaveRoom(socket);
  });

  socket.on('lobby:start', () => {
    roomManager.startGame(socket);
  });

  socket.on('lobby:list', (data, callback) => {
    callback({ rooms: roomManager.listRooms() });
  });

  // === GAME ACTIONS ===
  socket.on('game:rollDice', () => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room) room.handleRollDice(socket.id);
  });

  socket.on('game:choosePath', (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room) room.handleChoosePath(socket.id, data.spaceId);
  });

  socket.on('game:action', (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room) room.handleAction(socket.id, data);
  });

  socket.on('game:tradePropose', (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room) room.handleTradePropose(socket.id, data);
  });

  socket.on('game:tradeRespond', (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room) room.handleTradeRespond(socket.id, data);
  });

  socket.on('game:bankruptcyChoice', (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room) room.handleBankruptcyChoice(socket.id, data);
  });

  socket.on('game:minigameResult', (data) => {
    const room = roomManager.getPlayerRoom(socket.id);
    if (room) room.handleMinigameResult(socket.id, data);
  });

  // === DISCONNECT ===
  socket.on('disconnect', () => {
    console.log(`[-] Jogador desconectou: ${socket.id}`);
    roomManager.handleDisconnect(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🏢 Magnata Server rodando na porta ${PORT}`);
  console.log(`   Client: http://localhost:${PORT}`);
});
