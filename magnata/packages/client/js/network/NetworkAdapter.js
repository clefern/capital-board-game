// ========================================
// NetworkAdapter - Ponte entre Server e UI
// ========================================
// Traduz eventos do Socket.IO para ações no client.

import { eventBus } from '../utils/EventBus.js';
import { GameState } from '../../../shared/src/GameState.js';

export class NetworkAdapter {
  constructor(socketClient, game) {
    this.socket = socketClient;
    this.game = game;
    this.myPlayerId = socketClient.playerId;
    this._setupListeners();
  }

  _setupListeners() {
    // Estado sincronizado
    this.socket.on('game:stateSync', ({ gameState }) => {
      if (this.game.gameState) {
        this._syncState(gameState);
        this.game.updateUI();
      }
    });

    // Início do turno
    this.socket.on('game:turnStart', ({ playerId, playerName, round }) => {
      eventBus.emit('turnChanged', {
        player: this.game.gameState?.players[playerId],
        round,
      });
      this.game.updateUI();
    });

    // Dados rolados
    this.socket.on('game:diceRolled', ({ playerId, diceResults, total }) => {
      if (this.game.diceRoller) {
        this.game.diceRoller.show(diceResults);
      }
      eventBus.emit('diceRolled', {
        player: this.game.gameState?.players[playerId],
        results: diceResults,
        total,
      });
    });

    // Jogador moveu
    this.socket.on('game:playerMoved', ({ playerId, position, path, events }) => {
      eventBus.emit('boardUpdate');
      this.game.updateUI();
    });

    // Dívidas pagas
    this.socket.on('game:debtsPaid', ({ payments }) => {
      for (const p of payments) {
        if (p.type === 'rent' || p.type === 'tax' || p.type === 'mafia') {
          eventBus.emit('payment', { amount: p.amount });
        }
      }
      this.game.updateUI();
    });

    // Resultado da bolsa
    this.socket.on('game:stockResult', ({ result, playerId }) => {
      if (this.game.stockExchange && playerId === this.myPlayerId) {
        this.game.stockExchange.show(result);
      }
    });

    // Minigame - todos jogam!
    this.socket.on('game:minigameStart', ({ type, difficulties, triggerPlayerId, timeout }) => {
      const myDifficulty = difficulties[this.myPlayerId] || 'normal';
      this._playMinigame(type, myDifficulty, timeout);
    });

    // Resultados do minigame
    this.socket.on('game:minigameResults', ({ rankings }) => {
      this._showMinigameRankings(rankings);
      this.game.updateUI();
    });

    // Esperando input
    this.socket.on('game:waitingForInput', ({ playerId, inputType, timeout, options }) => {
      if (playerId === this.myPlayerId) {
        this._handleInputRequest(inputType, timeout, options);
      } else {
        this._showWaitingMessage(playerId, inputType);
      }
    });

    // Ação executada
    this.socket.on('game:actionExecuted', ({ playerId, action, result }) => {
      eventBus.emit('boardUpdate');
      this.game.updateUI();
    });

    // Evento aleatório
    this.socket.on('game:randomEvent', ({ event }) => {
      eventBus.emit('randomEvent', { event });
    });

    // Game over
    this.socket.on('game:gameOver', ({ winnerId, winnerName, reason }) => {
      const winner = this.game.gameState?.players[winnerId];
      if (winner && this.game.victoryScreen) {
        this.game.victoryScreen.show(winner, reason, this.game.gameState);
      }
    });

    // Erros
    this.socket.on('game:error', ({ message }) => {
      this.game.showToast(`⚠ ${message}`, 'danger');
    });

    // Jogador desconectou/reconectou
    this.socket.on('game:playerDisconnected', ({ playerName }) => {
      this.game.showToast(`📡 ${playerName} desconectou`, 'info');
    });

    this.socket.on('game:playerReconnected', ({ playerName }) => {
      this.game.showToast(`📡 ${playerName} reconectou`, 'info');
    });

    // Proposta de troca
    this.socket.on('game:tradeProposal', (data) => {
      this._handleTradeProposal(data);
    });

    // Eventos genéricos do jogo
    this.socket.on('game:event', ({ eventName, data }) => {
      eventBus.emit(eventName, data);
    });
  }

  _syncState(serialized) {
    const gs = this.game.gameState;
    if (!gs) return;

    // Atualizar campos básicos
    gs.round = serialized.round || 0;
    gs.currentPlayerIndex = serialized.currentPlayerIndex || 0;
    gs.turnPhase = serialized.turnPhase || 'ROLL';
    gs.gameOver = serialized.gameOver || false;

    // Atualizar jogadores
    for (const pd of serialized.players) {
      const player = gs.players.find(p => p.id === pd.id);
      if (!player) continue;
      player.money = pd.money;
      player.position = pd.position;
      player.laps = pd.laps;
      player.diceCount = pd.diceCount;
      player.bankrupt = pd.bankrupt;
      player.lastDice = pd.lastDice || null;
      if (pd.effects) player.effects = { ...pd.effects };
      if (pd.stats) player.stats = { ...pd.stats };
    }
  }

  _handleInputRequest(inputType, timeout, options) {
    const panel = document.getElementById('center-actions');
    if (!panel) return;

    switch (inputType) {
      case 'roll':
        this._showRollButton(panel, timeout);
        break;
      case 'action':
        this._showOnlineActionMenu(panel, timeout);
        break;
      case 'choosePath':
        this._showBifurcationChoice(panel, options, timeout);
        break;
      case 'bankruptcy':
        this._showBankruptcyUI(panel, timeout);
        break;
    }
  }

  _showRollButton(panel, timeout) {
    const player = this.game.gameState.currentPlayer;
    panel.innerHTML = `
      <div class="center-action-menu">
        <div class="center-action-title" style="color:var(--accent-gold)">${player.name}</div>
        <button class="btn btn-primary roll-btn" id="roll-dice-btn">
          🎲 Rolar Dados
        </button>
        <div class="timeout-bar"><div class="timeout-fill" style="animation: shrink ${timeout / 1000}s linear"></div></div>
      </div>
    `;
    panel.querySelector('#roll-dice-btn').addEventListener('click', () => {
      panel.innerHTML = '';
      this.socket.rollDice();
    });
  }

  _showOnlineActionMenu(panel, timeout) {
    const player = this.game.gameState.currentPlayer;
    const gs = this.game.gameState;
    const canBuild = gs.canPlayerBuildAt(player, player.position);

    panel.innerHTML = `
      <div class="center-action-menu">
        <div class="center-action-title" style="color:var(--accent-gold)">Ação de ${player.name}</div>
        <div class="center-action-grid">
          <button class="btn center-act-btn" id="action-card" ${player.cards.length === 0 ? 'disabled' : ''}>🃏 Carta</button>
          <button class="btn center-act-btn" id="action-build" ${!canBuild ? 'disabled' : ''}>🏗️ Construir</button>
          <button class="btn center-act-btn" id="action-buy-card" ${!player.canAfford(200) || gs.deck.remainingCards === 0 ? 'disabled' : ''}>🛒 Comprar</button>
        </div>
        <button class="btn center-act-btn center-act-pass" id="action-pass">⏭️ Passar</button>
        <div class="timeout-bar"><div class="timeout-fill" style="animation: shrink ${timeout / 1000}s linear"></div></div>
      </div>
    `;

    panel.querySelector('#action-card')?.addEventListener('click', () => {
      // Reutilizar seleção de cartas do modo local, mas enviar via socket
      this.game.showCardSelection(player).then(result => {
        if (result) {
          this.socket.sendAction(result);
          panel.innerHTML = '';
        }
      });
    });

    panel.querySelector('#action-build')?.addEventListener('click', () => {
      this.game.showBuildMenu(player).then(result => {
        if (result) {
          this.socket.sendAction(result);
          panel.innerHTML = '';
        }
      });
    });

    panel.querySelector('#action-buy-card')?.addEventListener('click', () => {
      this.socket.sendAction({ type: 'pass' }); // Servidor trata buy-card como ação
      panel.innerHTML = '';
    });

    panel.querySelector('#action-pass')?.addEventListener('click', () => {
      this.socket.sendAction({ type: 'pass' });
      panel.innerHTML = '';
    });
  }

  _showBifurcationChoice(panel, options, timeout) {
    panel.innerHTML = `
      <div class="center-action-menu">
        <div class="center-action-title">Bifurcação!</div>
        <div class="bif-buttons">
          <button class="btn bif-btn" data-space="${options[0]}">🛣️ Externo</button>
          <button class="btn bif-btn bif-inner" data-space="${options[1]}">⚡ Atalho</button>
        </div>
      </div>
    `;
    panel.querySelectorAll('.bif-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.socket.choosePath(parseInt(btn.dataset.space));
        panel.innerHTML = '';
      });
    });
  }

  _showBankruptcyUI(panel, timeout) {
    const player = this.game.gameState.currentPlayer;
    if (player.businesses.length === 0) {
      this.socket.sendBankruptcyChoice({ declareBankrupt: true });
      return;
    }
    // Simplificado: vender o mais barato
    this.socket.sendBankruptcyChoice({ sellBusinessIndex: 0 });
  }

  _showWaitingMessage(playerId, inputType) {
    const panel = document.getElementById('center-actions');
    if (!panel) return;
    const player = this.game.gameState?.players[playerId];
    const name = player?.name || 'Jogador';
    const action = { roll: 'rolar dados', action: 'jogar', choosePath: 'escolher caminho', bankruptcy: 'resolver falência' }[inputType] || '';
    panel.innerHTML = `
      <div class="center-action-menu">
        <div class="center-action-title">Aguardando...</div>
        <div class="bot-thinking">${name} vai ${action}</div>
      </div>
    `;
  }

  async _playMinigame(type, difficulty, timeout) {
    if (!this.game.minigameManager) return;
    const startTime = Date.now();
    try {
      const score = await this.game.minigameManager.play(
        this.game.gameState.players[this.myPlayerId],
        difficulty
      );
      const timeMs = Date.now() - startTime;
      this.socket.sendMinigameResult(score, timeMs);
    } catch (err) {
      this.socket.sendMinigameResult(0, Date.now() - startTime);
    }
  }

  _showMinigameRankings(rankings) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <h2>🏆 Resultado do Minigame</h2>
      <div class="minigame-rankings">
        ${rankings.map((r, i) => `
          <div class="ranking-entry ${r.playerId === this.myPlayerId ? 'ranking-me' : ''}">
            <span class="ranking-pos">${i + 1}º</span>
            <span class="ranking-name">${r.playerName}</span>
            <span class="ranking-score">Score: ${r.score}</span>
            <span class="ranking-reward" style="color:var(--accent-gold)">+$${r.reward}</span>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-primary btn-small" id="ranking-close" style="margin-top:10px;width:100%">OK</button>
    `;
    modal.querySelector('#ranking-close').addEventListener('click', () => overlay.remove());
    overlay.appendChild(modal);
    document.getElementById('app').appendChild(overlay);

    // Auto-fechar após 5 segundos
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 5000);
  }

  _handleTradeProposal(data) {
    // TODO: Mostrar UI de proposta de troca recebida
    // Por enquanto, auto-rejeitar
    this.socket.respondTrade({ accept: false, fromPlayerId: data.fromPlayerId });
  }

  destroy() {
    // Limpar listeners se necessário
  }
}
