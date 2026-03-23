// ========================================
// SocketClient - Wrapper Socket.IO
// ========================================

export class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.roomId = null;
    this.playerId = null;
    this._listeners = new Map();
  }

  async connect(serverUrl = '') {
    return new Promise((resolve, reject) => {
      // Socket.IO é carregado via CDN no index.html
      if (typeof io === 'undefined') {
        reject(new Error('Socket.IO não carregado'));
        return;
      }

      this.socket = io(serverUrl || window.location.origin, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        this.connected = true;
        console.log('[Socket] Conectado:', this.socket.id);
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        console.log('[Socket] Desconectado:', reason);
        this._emit('disconnected', { reason });
      });

      this.socket.on('connect_error', (err) => {
        console.error('[Socket] Erro de conexão:', err.message);
        reject(err);
      });

      // Repassar todos os eventos de jogo
      const gameEvents = [
        'lobby:update', 'lobby:started',
        'game:stateSync', 'game:turnStart', 'game:diceRolled',
        'game:playerMoved', 'game:debtsPaid', 'game:stockResult',
        'game:minigameStart', 'game:minigameResults',
        'game:actionExecuted', 'game:waitingForInput',
        'game:randomEvent', 'game:gameOver', 'game:event',
        'game:error', 'game:tradeProposal',
        'game:playerDisconnected', 'game:playerReconnected',
      ];

      for (const event of gameEvents) {
        this.socket.on(event, (data) => {
          this._emit(event, data);
        });
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.roomId = null;
    this.playerId = null;
  }

  // === LOBBY ===

  async createRoom(playerName, gameMode = 'classic') {
    return new Promise((resolve) => {
      this.socket.emit('lobby:create', { playerName, gameMode }, (result) => {
        if (result.success) {
          this.roomId = result.roomId;
          this.playerId = result.playerId;
        }
        resolve(result);
      });
    });
  }

  async joinRoom(roomId, playerName) {
    return new Promise((resolve) => {
      this.socket.emit('lobby:join', { roomId, playerName }, (result) => {
        if (result.success) {
          this.roomId = result.roomId;
          this.playerId = result.playerId;
        }
        resolve(result);
      });
    });
  }

  leaveRoom() {
    this.socket.emit('lobby:leave');
    this.roomId = null;
    this.playerId = null;
  }

  startGame() {
    this.socket.emit('lobby:start');
  }

  async listRooms() {
    return new Promise((resolve) => {
      this.socket.emit('lobby:list', {}, (result) => {
        resolve(result.rooms || []);
      });
    });
  }

  // === GAME ACTIONS ===

  rollDice() {
    this.socket.emit('game:rollDice');
  }

  choosePath(spaceId) {
    this.socket.emit('game:choosePath', { spaceId });
  }

  sendAction(action) {
    this.socket.emit('game:action', action);
  }

  sendMinigameResult(score, timeMs) {
    this.socket.emit('game:minigameResult', { score, timeMs });
  }

  sendBankruptcyChoice(data) {
    this.socket.emit('game:bankruptcyChoice', data);
  }

  proposeTrade(data) {
    this.socket.emit('game:tradePropose', data);
  }

  respondTrade(data) {
    this.socket.emit('game:tradeRespond', data);
  }

  // === EVENT SYSTEM ===

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const list = this._listeners.get(event);
    if (list) {
      const idx = list.indexOf(callback);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  _emit(event, data) {
    const list = this._listeners.get(event);
    if (list) {
      for (const cb of list) cb(data);
    }
  }
}
