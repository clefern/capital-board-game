// ========================================
// GameRoom - Sala de Jogo Multiplayer
// ========================================

import { GameState } from '../../shared/src/GameState.js';
import { TurnManager } from '../../shared/src/TurnManager.js';
import { PLAYER_COLOR_ORDER } from '../../shared/src/constants.js';
import { BotPlayer } from './BotPlayer.js';
import { MinigameValidator } from './validation.js';

const BOT_NAMES = ['Bot Ana', 'Bot Carlos', 'Bot Luna', 'Bot Pedro'];
const ROLL_TIMEOUT = 30000;     // 30s para rolar dados
const ACTION_TIMEOUT = 60000;   // 60s para ação
const MINIGAME_TIMEOUT = 35000; // 35s para minigame

export class GameRoom {
  constructor(roomId, io, gameMode = 'classic') {
    this.roomId = roomId;
    this.io = io;
    this.gameMode = gameMode;
    this.state = 'LOBBY'; // LOBBY | PLAYING | FINISHED
    this.players = []; // { socketId, name, playerId, isBot, disconnected }
    this.gameState = null;
    this.turnManager = null;
    this.botPlayer = new BotPlayer();

    // Controle de input
    this._waitingFor = null; // { type, playerId, resolve, timeout }
    this._minigameResults = new Map(); // playerId → score
  }

  // === LOBBY ===
  addPlayer(socket, name) {
    const playerId = this.players.length;
    this.players.push({
      socketId: socket.id,
      name,
      playerId,
      isBot: false,
      disconnected: false,
    });
    this._broadcastLobby();
    return playerId;
  }

  removePlayer(socketId) {
    const idx = this.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) return;

    if (this.state === 'LOBBY') {
      this.players.splice(idx, 1);
      // Reindexar playerIds
      this.players.forEach((p, i) => { p.playerId = i; });
      this._broadcastLobby();
    }
  }

  _broadcastLobby() {
    this.io.to(this.roomId).emit('lobby:update', {
      roomId: this.roomId,
      players: this.players.map(p => ({
        name: p.name,
        playerId: p.playerId,
        isBot: p.isBot,
        disconnected: p.disconnected,
      })),
      hostName: this.players[0]?.name || '?',
      gameMode: this.gameMode,
    });
  }

  // === INICIAR JOGO ===
  startGame() {
    if (this.state !== 'LOBBY') return;

    // Preencher com bots até 4 jogadores
    let botIdx = 0;
    while (this.players.length < 4) {
      const playerId = this.players.length;
      this.players.push({
        socketId: null,
        name: BOT_NAMES[botIdx++],
        playerId,
        isBot: true,
        disconnected: false,
      });
    }

    // Criar GameState com configs
    const playerConfigs = this.players.map((p, i) => ({
      name: p.name,
      color: PLAYER_COLOR_ORDER[i],
      isBot: p.isBot,
    }));

    this.gameState = new GameState(playerConfigs, this.gameMode, (eventName, data) => {
      // Broadcast eventos de jogo para todos
      this.io.to(this.roomId).emit('game:event', { eventName, data: this._sanitizeEventData(data) });
    });

    this.turnManager = new TurnManager(this.gameState);
    this.state = 'PLAYING';

    // Enviar estado inicial
    this.io.to(this.roomId).emit('lobby:started', {
      gameState: this.gameState.serialize(),
      players: this.players.map(p => ({
        name: p.name,
        playerId: p.playerId,
        isBot: p.isBot,
        color: PLAYER_COLOR_ORDER[p.playerId],
      })),
    });

    console.log(`[GAME] Sala ${this.roomId} iniciou com ${this.players.filter(p => !p.isBot).length} humanos + ${this.players.filter(p => p.isBot).length} bots`);

    // Iniciar loop de turnos
    this._runTurnLoop();
  }

  // === LOOP DE TURNOS (Server-Driven) ===
  async _runTurnLoop() {
    while (!this.gameState.gameOver && this.state === 'PLAYING') {
      try {
        const player = this.gameState.currentPlayer;
        if (player.bankrupt) {
          this.gameState.nextTurn();
          this._broadcastState();
          continue;
        }

        // Broadcast início do turno
        this.io.to(this.roomId).emit('game:turnStart', {
          playerId: player.id,
          playerName: player.name,
          round: this.gameState.round,
        });

        // FASE 1: Rolar dados
        await this._phaseRoll(player);
        if (this.gameState.gameOver || this.state !== 'PLAYING') break;

        // FASE 2: Mover
        await this._phaseMove(player);
        if (this.gameState.gameOver || this.state !== 'PLAYING') break;

        // Evento aleatório
        const event = this.turnManager.tryRandomEvent();
        if (event) {
          this.io.to(this.roomId).emit('game:randomEvent', { event: { id: event.id, icon: event.icon, name: event.name, desc: event.desc } });
          this._broadcastState();
        }

        // FASE 3: Pagar dívidas
        const debtResult = this.turnManager.executePayDebts();
        this.io.to(this.roomId).emit('game:debtsPaid', { payments: debtResult.payments });
        this._broadcastState();

        if (debtResult.isBankrupt) {
          const recovered = await this._handleBankruptcy(player);
          if (!recovered) {
            this.gameState.declareBankruptcy(player);
            this._broadcastState();
            if (!this.gameState.gameOver) this.gameState.nextTurn();
            this._broadcastState();
            continue;
          }
        }
        if (this.gameState.gameOver) break;

        // FASE 4: Especial (minigame/bolsa)
        const special = this.turnManager.executeSpecial();
        if (special.type === 'minigame') {
          await this._phaseMinigame(player);
        } else if (special.type === 'stock') {
          this.io.to(this.roomId).emit('game:stockResult', { result: special.result, playerId: player.id });
        }
        this._broadcastState();
        if (this.gameState.gameOver) break;

        // FASE 5: Ação
        await this._phaseAction(player);
        this._broadcastState();

        // Próximo turno
        if (!this.gameState.gameOver) {
          this.gameState.nextTurn();
          this._broadcastState();
        }
      } catch (err) {
        console.error(`[GAME] Erro no turno (${this.roomId}):`, err);
        this.gameState.addLog(`⚠ Erro: ${err.message}`);
        this.gameState.nextTurn();
        this._broadcastState();
      }
    }

    // Game over
    if (this.gameState.gameOver) {
      this.state = 'FINISHED';
      this.io.to(this.roomId).emit('game:gameOver', {
        winnerId: this.gameState.winner?.id ?? null,
        winnerName: this.gameState.winner?.name ?? null,
        reason: this.gameState.log[this.gameState.log.length - 1]?.message || 'Fim de jogo',
      });
      console.log(`[GAME] Sala ${this.roomId} finalizada. Vencedor: ${this.gameState.winner?.name || 'nenhum'}`);
    }
  }

  // === FASES ===

  async _phaseRoll(player) {
    const playerInfo = this.players[player.id];

    if (playerInfo.isBot || playerInfo.disconnected) {
      await this._botDelay(500, 1000);
      const result = this.turnManager.executeRoll();
      this.io.to(this.roomId).emit('game:diceRolled', { playerId: player.id, ...result });
      return result;
    }

    // Aguardar input do jogador
    this.io.to(this.roomId).emit('game:waitingForInput', { playerId: player.id, inputType: 'roll', timeout: ROLL_TIMEOUT });

    const input = await this._waitForInput('roll', player.id, ROLL_TIMEOUT);
    const result = this.turnManager.executeRoll();
    this.io.to(this.roomId).emit('game:diceRolled', { playerId: player.id, ...result });
    return result;
  }

  async _phaseMove(player) {
    const diceResults = player.lastDice || [];
    const total = diceResults.reduce((a, b) => a + b, 0);
    const moveResult = this.turnManager.calculateMove(total);

    // Tratar bifurcação
    if (moveResult.needsBifurcation) {
      const bif = moveResult.needsBifurcation;
      const playerInfo = this.players[player.id];
      let chosenSpace;

      if (playerInfo.isBot || playerInfo.disconnected) {
        await this._botDelay(300, 600);
        chosenSpace = this.botPlayer.chooseBifurcationPath(player, bif.options, this.gameState);
      } else {
        this.io.to(this.roomId).emit('game:waitingForInput', { playerId: player.id, inputType: 'choosePath', options: bif.options, timeout: 15000 });
        const input = await this._waitForInput('choosePath', player.id, 15000);
        chosenSpace = input?.spaceId ?? bif.options[0];
      }

      const continueResult = this.turnManager.continueMove(chosenSpace, bif.remainingSteps);
      this.io.to(this.roomId).emit('game:playerMoved', {
        playerId: player.id,
        position: player.position,
        path: continueResult.path,
        events: continueResult.events.map(e => ({ type: e.type, position: e.position })),
      });
      return;
    }

    this.io.to(this.roomId).emit('game:playerMoved', {
      playerId: player.id,
      position: player.position,
      path: moveResult.path,
      events: moveResult.events.map(e => ({ type: e.type, position: e.position })),
    });
  }

  async _phaseMinigame(player) {
    // Todos jogam simultaneamente!
    this._minigameResults.clear();
    const minigameTypes = ['coinCatch', 'makeChange', 'memoryGame', 'findTheKey'];
    const type = minigameTypes[Math.floor(Math.random() * minigameTypes.length)];

    // Dificuldade: quem caiu na casa tem vantagem
    const difficulties = {};
    for (const p of this.gameState.activePlayers) {
      difficulties[p.id] = p.id === player.id ? 'normal' : 'hard';
    }

    this.io.to(this.roomId).emit('game:minigameStart', { type, difficulties, triggerPlayerId: player.id, timeout: MINIGAME_TIMEOUT });

    // Coletar resultados de todos
    const resultPromises = this.gameState.activePlayers.map(async (p) => {
      const pInfo = this.players[p.id];
      if (pInfo.isBot || pInfo.disconnected) {
        await this._botDelay(2000, 5000);
        const score = this.botPlayer.simulateMinigame(difficulties[p.id]);
        this._minigameResults.set(p.id, score);
        return;
      }
      // Aguardar resultado do jogador
      const result = await this._waitForMinigameResult(p.id, MINIGAME_TIMEOUT);
      const validatedScore = MinigameValidator.validate(type, difficulties[p.id], result?.score || 0, result?.timeMs || 0);
      this._minigameResults.set(p.id, validatedScore);
    });

    await Promise.all(resultPromises);

    // Calcular recompensas
    const rankings = [];
    for (const p of this.gameState.activePlayers) {
      const score = this._minigameResults.get(p.id) || 0;
      const multiplier = p.id === player.id ? 1.5 : 1.0;
      const reward = Math.floor(score * multiplier);
      const minReward = p.id === player.id ? 100 : 0;
      const finalReward = Math.max(reward, minReward);

      p.receive(finalReward);
      rankings.push({ playerId: p.id, playerName: p.name, score, reward: finalReward });
      this.gameState.addLog(`${p.name} ganhou $${finalReward} no minigame (score: ${score}).`);
    }

    rankings.sort((a, b) => b.reward - a.reward);
    this.io.to(this.roomId).emit('game:minigameResults', { rankings });
  }

  async _phaseAction(player) {
    const playerInfo = this.players[player.id];

    if (playerInfo.isBot || playerInfo.disconnected) {
      await this._botDelay(500, 1000);
      const action = this.botPlayer.chooseAction(player, this.gameState);
      const result = this.turnManager.executeAction(action);
      this.io.to(this.roomId).emit('game:actionExecuted', { playerId: player.id, action: action.type, result });
      return;
    }

    this.io.to(this.roomId).emit('game:waitingForInput', { playerId: player.id, inputType: 'action', timeout: ACTION_TIMEOUT });

    const input = await this._waitForInput('action', player.id, ACTION_TIMEOUT);
    const action = input || { type: 'pass' };
    const result = this.turnManager.executeAction(action);
    this.io.to(this.roomId).emit('game:actionExecuted', { playerId: player.id, action: action.type, result });
  }

  async _handleBankruptcy(player) {
    const playerInfo = this.players[player.id];

    if (playerInfo.isBot || playerInfo.disconnected) {
      return this.botPlayer.handleBankruptcy(player, this.gameState);
    }

    if (player.businesses.length === 0) return false;

    this.io.to(this.roomId).emit('game:waitingForInput', { playerId: player.id, inputType: 'bankruptcy', timeout: 60000 });

    const input = await this._waitForInput('bankruptcy', player.id, 60000);
    if (!input || input.declareBankrupt) return false;

    // Vender negócio indicado
    if (input.sellBusinessIndex != null && input.sellBusinessIndex < player.businesses.length) {
      const biz = player.businesses[input.sellBusinessIndex];
      player.receive(biz.getSellValue());
      player.businesses.splice(input.sellBusinessIndex, 1);
      this.gameState.addLog(`${player.name} vendeu ${biz.label} por $${biz.getSellValue()}.`);
      this._broadcastState();

      if (player.money >= 0) return true;
      if (player.businesses.length > 0) return this._handleBankruptcy(player);
      return false;
    }

    return false;
  }

  // === INPUT HANDLING ===

  _waitForInput(type, playerId, timeout) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this._waitingFor?.type === type && this._waitingFor?.playerId === playerId) {
          this._waitingFor = null;
          resolve(null); // Timeout → auto-action
        }
      }, timeout);

      this._waitingFor = { type, playerId, resolve, timer };
    });
  }

  _waitForMinigameResult(playerId, timeout) {
    return new Promise((resolve) => {
      const key = `minigame_${playerId}`;
      const timer = setTimeout(() => {
        if (!this._minigameResults.has(playerId)) {
          resolve({ score: 0, timeMs: timeout });
        }
      }, timeout);

      // Armazenar o resolver para ser chamado quando o resultado chegar
      if (!this._minigameResolvers) this._minigameResolvers = new Map();
      this._minigameResolvers.set(playerId, { resolve, timer });
    });
  }

  handleRollDice(socketId) {
    const player = this._getPlayerBySocket(socketId);
    if (!player) return;
    if (this._waitingFor?.type === 'roll' && this._waitingFor?.playerId === player.id) {
      clearTimeout(this._waitingFor.timer);
      const resolve = this._waitingFor.resolve;
      this._waitingFor = null;
      resolve({});
    }
  }

  handleChoosePath(socketId, spaceId) {
    const player = this._getPlayerBySocket(socketId);
    if (!player) return;
    if (this._waitingFor?.type === 'choosePath' && this._waitingFor?.playerId === player.id) {
      clearTimeout(this._waitingFor.timer);
      const resolve = this._waitingFor.resolve;
      this._waitingFor = null;
      resolve({ spaceId });
    }
  }

  handleAction(socketId, actionData) {
    const player = this._getPlayerBySocket(socketId);
    if (!player) return;
    if (this._waitingFor?.type === 'action' && this._waitingFor?.playerId === player.id) {
      clearTimeout(this._waitingFor.timer);
      const resolve = this._waitingFor.resolve;
      this._waitingFor = null;
      resolve(actionData);
    }
  }

  handleTradePropose(socketId, data) {
    const player = this._getPlayerBySocket(socketId);
    if (!player) return;
    // Forward trade proposal to the target player
    const targetInfo = this.players.find(p => p.playerId === data.targetPlayerId);
    if (targetInfo && !targetInfo.isBot && !targetInfo.disconnected) {
      this.io.to(targetInfo.socketId).emit('game:tradeProposal', {
        fromPlayerId: player.id,
        fromPlayerName: player.name,
        ...data,
      });
    }
  }

  handleTradeRespond(socketId, data) {
    const player = this._getPlayerBySocket(socketId);
    if (!player) return;
    if (data.accept && this._waitingFor?.type === 'action') {
      // Resolve a ação com trade aceito
      clearTimeout(this._waitingFor.timer);
      const resolve = this._waitingFor.resolve;
      this._waitingFor = null;
      resolve({
        type: 'trade',
        targetPlayerId: data.fromPlayerId,
        giveIndices: data.giveIndices || [],
        receiveIndices: data.receiveIndices || [],
        money: data.money || 0,
      });
    }
  }

  handleBankruptcyChoice(socketId, data) {
    const player = this._getPlayerBySocket(socketId);
    if (!player) return;
    if (this._waitingFor?.type === 'bankruptcy' && this._waitingFor?.playerId === player.id) {
      clearTimeout(this._waitingFor.timer);
      const resolve = this._waitingFor.resolve;
      this._waitingFor = null;
      resolve(data);
    }
  }

  handleMinigameResult(socketId, data) {
    const player = this._getPlayerBySocket(socketId);
    if (!player) return;
    if (this._minigameResolvers?.has(player.id)) {
      const { resolve, timer } = this._minigameResolvers.get(player.id);
      clearTimeout(timer);
      this._minigameResolvers.delete(player.id);
      resolve(data);
    }
  }

  // === DISCONNECT/RECONNECT ===

  handleDisconnect(socketId) {
    const playerInfo = this.players.find(p => p.socketId === socketId);
    if (!playerInfo) return;

    playerInfo.disconnected = true;
    console.log(`[ROOM] ${playerInfo.name} desconectou da sala ${this.roomId}`);

    if (this.state === 'LOBBY') {
      this.removePlayer(socketId);
      return;
    }

    // Em jogo: marcar como desconectado (bot assume)
    this.io.to(this.roomId).emit('game:playerDisconnected', {
      playerId: playerInfo.playerId,
      playerName: playerInfo.name,
    });

    // Se estava esperando input desse jogador, auto-resolver
    if (this._waitingFor?.playerId === playerInfo.playerId) {
      clearTimeout(this._waitingFor.timer);
      const resolve = this._waitingFor.resolve;
      this._waitingFor = null;
      resolve(null);
    }
  }

  handleReconnect(socket, playerId) {
    const playerInfo = this.players.find(p => p.playerId === playerId);
    if (!playerInfo) return false;

    playerInfo.socketId = socket.id;
    playerInfo.disconnected = false;
    socket.join(this.roomId);

    // Enviar estado completo
    socket.emit('game:stateSync', {
      gameState: this.gameState.serialize(),
      players: this.players.map(p => ({
        name: p.name,
        playerId: p.playerId,
        isBot: p.isBot,
        color: PLAYER_COLOR_ORDER[p.playerId],
        disconnected: p.disconnected,
      })),
    });

    this.io.to(this.roomId).emit('game:playerReconnected', {
      playerId: playerInfo.playerId,
      playerName: playerInfo.name,
    });

    console.log(`[ROOM] ${playerInfo.name} reconectou na sala ${this.roomId}`);
    return true;
  }

  // === HELPERS ===

  _getPlayerBySocket(socketId) {
    const info = this.players.find(p => p.socketId === socketId);
    if (!info) return null;
    return this.gameState.players[info.playerId];
  }

  _broadcastState() {
    this.io.to(this.roomId).emit('game:stateSync', {
      gameState: this.gameState.serialize(),
    });
  }

  _sanitizeEventData(data) {
    if (!data) return data;
    // Remover referências circulares para serialização
    const clean = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'player' && value) {
        clean.playerId = value.id;
        clean.playerName = value.name;
      } else if (key === 'winner' && value) {
        clean.winnerId = value.id;
        clean.winnerName = value.name;
      } else if (key === 'business' && value) {
        clean.business = { type: value.type, label: value.label, spaceId: value.spaceId };
      } else if (key === 'card' && value) {
        clean.card = { id: value.id, name: value.name };
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }

  _botDelay(min, max) {
    const ms = min + Math.random() * (max - min);
    return new Promise(r => setTimeout(r, ms));
  }
}
