// ========================================
// RoomManager - Gerenciamento de Salas
// ========================================

import { GameRoom } from './GameRoom.js';

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();         // roomId → GameRoom
    this.playerRooms = new Map();   // socketId → roomId
  }

  createRoom(socket, playerName, gameMode = 'classic') {
    // Sair de sala anterior se houver
    this.leaveRoom(socket);

    let roomId;
    do {
      roomId = generateRoomId();
    } while (this.rooms.has(roomId));

    const room = new GameRoom(roomId, this.io, gameMode);
    room.addPlayer(socket, playerName);
    this.rooms.set(roomId, room);
    this.playerRooms.set(socket.id, roomId);

    socket.join(roomId);
    console.log(`[ROOM] ${playerName} criou sala ${roomId} (${gameMode})`);

    return { success: true, roomId, playerId: 0 };
  }

  joinRoom(socket, roomId, playerName) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Sala não encontrada' };
    }
    if (room.state !== 'LOBBY') {
      return { success: false, error: 'Jogo já em andamento' };
    }
    if (room.players.length >= 4) {
      return { success: false, error: 'Sala cheia' };
    }

    // Sair de sala anterior se houver
    this.leaveRoom(socket);

    const playerId = room.addPlayer(socket, playerName);
    this.playerRooms.set(socket.id, roomId);
    socket.join(roomId);

    console.log(`[ROOM] ${playerName} entrou na sala ${roomId} (${room.players.length}/4)`);
    return { success: true, roomId, playerId };
  }

  leaveRoom(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.removePlayer(socket.id);
      socket.leave(roomId);

      if (room.players.length === 0) {
        this.rooms.delete(roomId);
        console.log(`[ROOM] Sala ${roomId} removida (vazia)`);
      }
    }

    this.playerRooms.delete(socket.id);
  }

  startGame(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    // Só o host (primeiro jogador) pode iniciar
    if (room.players[0]?.socketId !== socket.id) {
      socket.emit('game:error', { message: 'Apenas o host pode iniciar o jogo' });
      return;
    }

    if (room.players.length < 1) {
      socket.emit('game:error', { message: 'Precisa de pelo menos 1 jogador' });
      return;
    }

    room.startGame();
  }

  listRooms() {
    const list = [];
    for (const [id, room] of this.rooms) {
      if (room.state === 'LOBBY') {
        list.push({
          roomId: id,
          hostName: room.players[0]?.name || '?',
          playerCount: room.players.length,
          maxPlayers: 4,
          gameMode: room.gameMode,
        });
      }
    }
    return list;
  }

  getPlayerRoom(socketId) {
    const roomId = this.playerRooms.get(socketId);
    if (!roomId) return null;
    return this.rooms.get(roomId);
  }

  handleDisconnect(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.handleDisconnect(socket.id);

      // Se todos desconectaram, remover sala
      const allDisconnected = room.players.every(p => p.disconnected || p.isBot);
      if (allDisconnected) {
        this.rooms.delete(roomId);
        console.log(`[ROOM] Sala ${roomId} removida (todos desconectaram)`);
      }
    }

    this.playerRooms.delete(socket.id);
  }
}
