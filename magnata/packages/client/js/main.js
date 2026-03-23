// ========================================
// Magnata - Main Application
// ========================================

import { PLAYER_COLORS, PLAYER_COLOR_ORDER, BUSINESS_TYPES, BUSINESS_ORDER, COLOR_SLOT, GAME_MODES, GameSpeed } from './config/constants.js';
import { SPACES, hasBifurcation } from './config/board-layout.js';
import { GameState } from './core/GameState.js';
import { TurnManager } from './core/TurnManager.js';
import { BonusCalculator } from './core/BonusCalculator.js';
import { BoardRenderer } from './board/BoardRenderer.js';
import { DiceRoller } from './ui/DiceRoller.js';
import { HudPanel } from './ui/HudPanel.js';
import { CardHand } from './ui/CardHand.js';
import { StockExchange } from './ui/StockExchange.js';
import { VictoryScreen } from './ui/VictoryScreen.js';
import { TradeDialog } from './ui/TradeDialog.js';
import { MinigameManager } from './minigames/MinigameManager.js';
import { BotAI } from './core/BotAI.js';
import { SaveManager } from './core/SaveManager.js';
import { TutorialScreen } from './ui/TutorialScreen.js';
import { eventBus } from './utils/EventBus.js';
import { soundManager } from './utils/SoundManager.js';
import { SocketClient } from './network/SocketClient.js';
import { NetworkAdapter } from './network/NetworkAdapter.js';
import { LobbyUI } from './network/LobbyUI.js';

const BOT_NAMES = ['Bot Ana', 'Bot Carlos', 'Bot Luna', 'Bot Pedro'];

class MagnataGame {
  constructor() {
    this.gameState = null;
    this.turnManager = null;
    this.boardRenderer = null;
    this.diceRoller = null;
    this.hudPanel = null;
    this.cardHand = null;
    this.stockExchange = null;
    this.victoryScreen = null;
    this.tradeDialog = null;
    this.minigameManager = null;
    this.botAI = new BotAI();
    this.animationFrameId = null;
    this.isOnline = false;
    this.socketClient = null;
    this.networkAdapter = null;

    this.setupScreen();
  }

  // === TELA DE SETUP ===
  setupScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="setup-screen">
        <div class="setup-logo">
          <div class="logo-icon">🏢</div>
          <h1 class="game-title">MAGNATA</h1>
          <p class="game-subtitle">Construa seu império, negocie e domine o tabuleiro!</p>
        </div>

        <div class="setup-form">
          <div class="player-count-selector">
            <label>Jogadores Humanos:</label>
            <div class="count-buttons">
              <button class="count-btn" data-count="1">1</button>
              <button class="count-btn selected" data-count="2">2</button>
              <button class="count-btn" data-count="3">3</button>
              <button class="count-btn" data-count="4">4</button>
            </div>
          </div>

          <div class="player-count-selector" id="difficulty-selector">
            <label>Dificuldade Bot:</label>
            <div class="count-buttons">
              <button class="count-btn diff-btn" data-diff="easy">Fácil</button>
              <button class="count-btn diff-btn selected" data-diff="normal">Normal</button>
              <button class="count-btn diff-btn" data-diff="hard">Difícil</button>
            </div>
          </div>

          <div class="player-count-selector" id="gamemode-selector">
            <label>Modo de Jogo:</label>
            <div class="count-buttons">
              <button class="count-btn diff-btn selected" data-mode="classic">Clássico</button>
              <button class="count-btn diff-btn" data-mode="rapid">Rápido</button>
              <button class="count-btn diff-btn" data-mode="marathon">Maratona</button>
            </div>
          </div>

          <div id="player-inputs"></div>

          <button class="btn btn-primary btn-large" id="start-game">
            ▶ Jogar Local
          </button>
          <button class="btn btn-primary btn-large" id="play-online" style="width:100%;margin-top:6px;background:linear-gradient(135deg,#2F80ED,#6C63FF)">
            🌐 Jogar Online
          </button>
          ${SaveManager.hasSave() ? '<button class="btn btn-secondary btn-large" id="continue-game" style="width:100%;margin-top:6px">📂 Continuar Jogo Salvo</button>' : ''}
          <button class="btn btn-secondary btn-large" id="show-stats" style="width:100%;margin-top:6px">📊 Estatísticas</button>
        </div>
      </div>
    `;

    let playerCount = 2;
    let gameMode = 'classic';

    // Seletor de modo de jogo
    app.querySelectorAll('.count-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        app.querySelectorAll('.count-btn[data-mode]').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        gameMode = btn.dataset.mode;
      });
    });

    const updatePlayerInputs = () => {
      const container = document.getElementById('player-inputs');
      container.innerHTML = '';
      for (let i = 0; i < playerCount; i++) {
        const color = PLAYER_COLOR_ORDER[i];
        const colors = PLAYER_COLORS[color];
        const div = document.createElement('div');
        div.className = 'player-input';
        div.style.borderLeftColor = colors.main;
        div.innerHTML = `
          <span class="player-color-dot" style="background:${colors.main}"></span>
          <input type="text" class="player-name-input" data-index="${i}"
                 placeholder="Jogador ${i + 1}" value="Jogador ${i + 1}" maxlength="15">
          <span class="player-color-label">${colors.label}</span>
        `;
        container.appendChild(div);
      }
    };

    const playerBtns = app.querySelectorAll('.count-btn[data-count]');
    playerBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        playerBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        playerCount = parseInt(btn.dataset.count);
        updatePlayerInputs();
        // Mostrar dificuldade se há bots
        const diffSel = document.getElementById('difficulty-selector');
        if (diffSel) diffSel.style.display = playerCount < 4 ? 'flex' : 'none';
      });
    });

    // Dificuldade dos bots
    app.querySelectorAll('.count-btn[data-diff]').forEach(btn => {
      btn.addEventListener('click', () => {
        app.querySelectorAll('.count-btn[data-diff]').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        BotAI.difficulty = btn.dataset.diff;
      });
    });

    updatePlayerInputs();

    app.querySelector('#start-game').addEventListener('click', () => {
      const inputs = app.querySelectorAll('.player-name-input');
      const configs = [];
      inputs.forEach((input, i) => {
        configs.push({
          name: input.value.trim() || `Jogador ${i + 1}`,
          color: PLAYER_COLOR_ORDER[i],
          isBot: false,
        });
      });
      // Completar até 4 jogadores com bots
      let botIdx = 0;
      while (configs.length < 4) {
        const i = configs.length;
        configs.push({
          name: BOT_NAMES[botIdx++],
          color: PLAYER_COLOR_ORDER[i],
          isBot: true,
        });
      }
      this.startGame(configs, gameMode);
    });

    // Continuar jogo salvo
    const continueBtn = app.querySelector('#continue-game');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        const saveData = SaveManager.load();
        if (!saveData || !saveData.players) {
          SaveManager.deleteSave();
          alert('Save corrompido. Iniciando novo jogo.');
          return;
        }
        // Reconstruir configs a partir do save
        const configs = saveData.players.map(p => ({
          name: p.name,
          color: p.color,
          isBot: p.isBot || false,
        }));
        this.startGame(configs);
        // Restaurar estado completo
        SaveManager.restore(this.gameState, saveData);
        this.updateUI();
        this.gameState.addLog('Jogo restaurado do save anterior.');
      });
    }

    // Botão Jogar Online
    app.querySelector('#play-online')?.addEventListener('click', () => {
      this.startOnlineMode();
    });

    // Botão de estatísticas
    app.querySelector('#show-stats')?.addEventListener('click', () => {
      const stats = SaveManager.loadStats();
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'modal';
      const entries = Object.entries(stats.players);
      modal.innerHTML = `
        <h2>📊 Estatísticas</h2>
        ${entries.length === 0 ? '<p style="color:var(--text-secondary);text-align:center">Nenhuma partida jogada ainda.</p>' : `
          <table class="tutorial-table">
            <tr><th>Jogador</th><th>Partidas</th><th>Vitórias</th><th>Win%</th><th>Melhor $</th></tr>
            ${entries.sort((a,b) => b[1].wins - a[1].wins).map(([name, s]) => `
              <tr>
                <td style="font-weight:700">${name}</td>
                <td>${s.gamesPlayed}</td>
                <td>${s.wins}</td>
                <td>${s.gamesPlayed > 0 ? Math.round(s.wins / s.gamesPlayed * 100) : 0}%</td>
                <td style="color:var(--accent-gold)">$${s.bestPatrimony}</td>
              </tr>
            `).join('')}
          </table>
          <p style="font-size:11px;color:var(--text-secondary)">Total de partidas: ${stats.totalGames} | Última: ${stats.lastPlayed || '—'}</p>
        `}
        <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:10px">
          <button class="btn btn-secondary btn-small" id="clear-stats">Limpar</button>
          <button class="btn btn-primary btn-small" id="close-stats">Fechar</button>
        </div>
      `;
      modal.querySelector('#close-stats').addEventListener('click', () => overlay.remove());
      modal.querySelector('#clear-stats').addEventListener('click', () => {
        SaveManager.clearStats();
        overlay.remove();
      });
      overlay.appendChild(modal);
      app.appendChild(overlay);
    });
  }

  // === MODO ONLINE ===
  async startOnlineMode() {
    const app = document.getElementById('app');
    try {
      this.socketClient = new SocketClient();
      await this.socketClient.connect();

      const lobbyUI = new LobbyUI(app, this.socketClient);
      const result = await lobbyUI.show();

      if (!result) {
        // Voltou ao menu local
        this.setupScreen();
        return;
      }

      // Jogo iniciou - resultado contém gameState e players
      this.startOnlineGame(result);
    } catch (err) {
      console.error('Erro ao conectar:', err);
      alert('Erro ao conectar ao servidor. Verifique se o servidor está rodando.');
      this.setupScreen();
    }
  }

  startOnlineGame(lobbyData) {
    this.isOnline = true;
    const { gameState: serializedState, players } = lobbyData;

    // Criar configs dos jogadores a partir do lobby
    const playerConfigs = players.map(p => ({
      name: p.name,
      color: p.color,
      isBot: p.isBot,
    }));

    // Iniciar o jogo normalmente (UI)
    this.startGame(playerConfigs, serializedState.gameMode || 'classic');

    // Sincronizar estado do servidor
    if (serializedState) {
      SaveManager.restore(this.gameState, serializedState);
      this.updateUI();
    }

    // Criar NetworkAdapter para bridge server ↔ UI
    this.networkAdapter = new NetworkAdapter(this.socketClient, this);

    // NÃO rodar runTurnLoop() - o server controla os turnos
  }

  // === INICIAR JOGO (LOCAL) ===
  startGame(playerConfigs, gameMode = 'classic') {
    const app = document.getElementById('app');
    // Layout: sidebar esquerda (jogadores) | centro (tabuleiro + dados) | sidebar direita (cartas + log)
    app.innerHTML = `
      <div class="game-layout">
        <button class="mobile-toggle mobile-toggle-left" id="toggle-hud">👥</button>
        <button class="mobile-toggle mobile-toggle-right" id="toggle-actions">🃏</button>
        <div class="drawer-overlay" id="drawer-overlay"></div>

        <aside class="sidebar sidebar-left" id="hud-container"></aside>

        <main class="game-center">
          <div class="game-toolbar">
            <button class="btn btn-small sound-toggle" id="sound-toggle" title="Som">🔊 Som</button>
            <button class="btn btn-small" id="music-toggle" title="Música">🎵 Música</button>
            <button class="btn btn-small" id="speed-toggle" title="Velocidade dos bots">⏩ Turbo</button>
            <button class="btn btn-small" id="help-btn" title="Ajuda">❓ Ajuda</button>
            <button class="btn btn-small btn-quit" id="quit-btn" title="Sair da partida">✕ Sair</button>
          </div>
          <div id="board-tooltip" class="board-tooltip"></div>
          <div class="board-wrapper">
            <canvas id="board-canvas"></canvas>
          </div>
          <div id="dice-container" class="dice-container"></div>
          <div id="bifurcation-ui" class="bifurcation-ui"></div>
          <div id="center-actions" class="center-actions"></div>
        </main>

        <aside class="sidebar sidebar-right">
          <div id="card-container" class="card-container"></div>
          <div id="log-container" class="log-container">
            <div class="log-header">Registro</div>
          </div>
        </aside>
      </div>
    `;

    this.gameState = new GameState(playerConfigs, gameMode);

    // Configurar velocidades globais baseado no modo
    const modeConfig = GAME_MODES[gameMode] || GAME_MODES.classic;
    GameSpeed.anim = modeConfig.animSpeed;
    GameSpeed.bot = modeConfig.botSpeed;
    GameSpeed.minigame = modeConfig.minigameTime;
    BotAI.speedMultiplier = modeConfig.botSpeed;

    this.boardRenderer = new BoardRenderer(document.getElementById('board-canvas'));
    this.diceRoller = new DiceRoller(document.getElementById('dice-container'));
    this.hudPanel = new HudPanel(document.getElementById('hud-container'));
    this.cardHand = new CardHand(document.getElementById('card-container'));
    this.stockExchange = new StockExchange(app);
    this.victoryScreen = new VictoryScreen(app);
    this.tradeDialog = new TradeDialog(app);
    this.minigameManager = new MinigameManager(app);
    this.tutorialScreen = new TutorialScreen(app);

    const uiAdapter = this.createUIAdapter();
    this.turnManager = new TurnManager(this.gameState, uiAdapter);

    this.setupEventListeners();
    this.startRenderLoop();
    this.updateUI();
    soundManager.startMusic();

    // Só rodar loop de turnos no modo local (online é server-driven)
    if (!this.isOnline) {
      this.runTurnLoop();
    }
  }

  createUIAdapter() {
    return {
      showDiceAnimation: (results) => this.diceRoller.show(results),
      showStockResult: async (result) => {
        if (this.gameState.currentPlayer.isBot) {
          await BotAI.delay(300, 600);
          return;
        }
        return this.stockExchange.show(result);
      },
      playMinigame: async (player) => {
        if (player.isBot) {
          await BotAI.delay(500, 1200);
          return this.botAI.simulateMinigame();
        }
        const difficulty = player.id === this.gameState.currentPlayerIndex ? 'easy' : 'hard';
        return this.minigameManager.play(player, difficulty);
      },
      handleBankruptcy: async (player) => {
        if (player.isBot) {
          await BotAI.delay(400, 800);
          return this.botAI.handleBankruptcy(player, this.gameState);
        }
        return this.showBankruptcyDialog(player);
      },
      chooseAction: async (player, gs) => {
        if (player.isBot) {
          await BotAI.delay(500, 1000);
          return this.botAI.chooseAction(player, gs);
        }
        return this.showActionMenu(player, gs);
      },
      executeTrade: (player, targetPlayer, giveIndices, receiveIndices, money = 0) => {
        // Multi-card trade: indices sorted descending to avoid index shifting
        const givenCards = giveIndices.map(i => player.removeCard(i));
        const receivedCards = receiveIndices.map(i => targetPlayer.removeCard(i));
        givenCards.forEach(c => targetPlayer.addCard(c));
        receivedCards.forEach(c => player.addCard(c));
        if (money > 0) { player.pay(money); targetPlayer.receive(money); }
        else if (money < 0) { targetPlayer.pay(-money); player.receive(-money); }
        this.gameState.addLog(`${player.name} trocou ${givenCards.length}↔${receivedCards.length} cartas com ${targetPlayer.name}${money ? ` (+$${Math.abs(money)})` : ''}.`);
      },
    };
  }

  // === MENU DE AÇÃO (centro do board) ===
  showActionMenu(player, gs) {
    return new Promise(resolve => {
      const panel = document.getElementById('center-actions');
      const colors = PLAYER_COLORS[player.color];
      const canBuild = gs.canPlayerBuildAt(player, player.position);

      panel.innerHTML = `
        <div class="center-action-menu">
          <div class="center-action-title" style="color:${colors.main}">Ação de ${player.name}</div>
          <div class="center-action-grid">
            <button class="btn center-act-btn" id="action-card" ${player.cards.length === 0 ? 'disabled' : ''}>
              🃏 Carta
            </button>
            <button class="btn center-act-btn" id="action-build" ${!canBuild ? 'disabled' : ''}>
              🏗️ Construir
            </button>
            <button class="btn center-act-btn" id="action-trade" ${player.cards.length === 0 ? 'disabled' : ''}>
              🤝 Trocar
            </button>
            <button class="btn center-act-btn" id="action-buy-card" ${!player.canAfford(200) || gs.deck.remainingCards === 0 ? 'disabled' : ''}>
              🛒 Comprar
            </button>
          </div>
          <button class="btn center-act-btn center-act-pass" id="action-pass">⏭️ Passar</button>
        </div>
      `;

      panel.querySelector('#action-card')?.addEventListener('click', () => {
        panel.innerHTML = '';
        this.showCardSelection(player).then(result => {
          result ? resolve(result) : this.showActionMenu(player, gs).then(resolve);
        });
      });

      panel.querySelector('#action-build')?.addEventListener('click', () => {
        panel.innerHTML = '';
        this.showBuildMenu(player).then(result => {
          result ? resolve(result) : this.showActionMenu(player, gs).then(resolve);
        });
      });

      panel.querySelector('#action-trade')?.addEventListener('click', async () => {
        panel.innerHTML = '';
        const others = gs.activePlayers.filter(p => p.id !== player.id && p.cards.length > 0);
        if (others.length === 0) {
          gs.addLog('Nenhum jogador com cartas para trocar.');
          this.showActionMenu(player, gs).then(resolve);
          return;
        }
        const result = await this.tradeDialog.show(player, others);
        if (result) {
          resolve({ type: 'trade', targetPlayer: result.partner, give: result.giveIndices, receive: result.receiveIndices, money: result.money || 0 });
        } else {
          this.showActionMenu(player, gs).then(resolve);
        }
      });

      panel.querySelector('#action-buy-card')?.addEventListener('click', () => {
        player.pay(200);
        const card = gs.deck.draw();
        player.addCard(card);
        gs.addLog(`${player.name} comprou uma carta por $200.`);
        soundManager.playButtonClick();
        panel.innerHTML = '';
        this.updateUI();
        resolve({ type: 'pass' });
      });

      panel.querySelector('#action-pass')?.addEventListener('click', () => {
        panel.innerHTML = '';
        resolve({ type: 'pass' });
      });
    });
  }

  showCardSelection(player) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <h2>Selecione uma carta</h2>
        <div class="card-selection"></div>
        <div style="text-align:right;margin-top:8px"><button class="btn btn-secondary btn-small" id="card-back">← Voltar</button></div>
      `;

      const container = modal.querySelector('.card-selection');
      player.cards.forEach((card, index) => {
        const canAfford = player.canAfford(card.cost);
        const el = document.createElement('div');
        el.className = `card-option ${card.type === 'victory' ? 'victory' : ''} ${!canAfford ? 'disabled' : ''}`;
        el.innerHTML = `
          <span class="card-icon">${card.icon}</span>
          <div class="card-option-info">
            <span class="card-name">${card.name}</span>
            <span class="card-desc-small">${card.description}</span>
          </div>
          <span class="card-cost">${card.cost > 0 ? `$${card.cost}` : 'Grátis'}</span>
        `;
        if (canAfford) {
          el.addEventListener('click', () => {
            overlay.remove();
            if (['opponent', 'opponent_business'].includes(card.targetType)) {
              this.showTargetSelection(player, index, card).then(resolve);
            } else if (card.targetType === 'board') {
              this.showBoardTargetSelection(player, index, card).then(resolve);
            } else if (card.targetType === 'own_business') {
              this.showOwnBusinessSelection(player, index, card).then(resolve);
            } else {
              resolve({ type: 'play_card', cardIndex: index, target: null });
            }
          });
        }
        container.appendChild(el);
      });

      modal.querySelector('#card-back').addEventListener('click', () => { overlay.remove(); resolve(null); });
      overlay.appendChild(modal);
      document.getElementById('app').appendChild(overlay);
    });
  }

  showTargetSelection(player, cardIndex, card) {
    return new Promise(resolve => {
      const opponents = this.gameState.activePlayers.filter(p => p.id !== player.id);
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <h2>Alvo: ${card.name}</h2>
        <div class="target-list">
          ${opponents.map(opp => {
            const c = PLAYER_COLORS[opp.color];
            return `<button class="btn target-btn" data-id="${opp.id}" style="border-color:${c.main}">
              <span class="player-color-dot" style="background:${c.main}"></span>
              ${opp.name} ($${opp.money})
            </button>`;
          }).join('')}
        </div>
        <div style="text-align:right;margin-top:8px"><button class="btn btn-secondary btn-small" id="target-back">← Voltar</button></div>
      `;

      modal.querySelectorAll('.target-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id);
          const opp = opponents.find(p => p.id === id);
          overlay.remove();
          if (card.targetType === 'opponent_business') {
            if (opp.businesses.length === 0) { this.gameState.addLog(`${opp.name} não tem negócios.`); resolve(null); return; }
            this.showOpponentBusinessSelection(player, cardIndex, opp).then(resolve);
          } else {
            resolve({ type: 'play_card', cardIndex, target: { playerId: opp.id } });
          }
        });
      });

      modal.querySelector('#target-back').addEventListener('click', () => { overlay.remove(); resolve(null); });
      overlay.appendChild(modal);
      document.getElementById('app').appendChild(overlay);
    });
  }

  showOpponentBusinessSelection(player, cardIndex, opponent) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <h2>Negócio de ${opponent.name}</h2>
        <div class="target-list">
          ${opponent.businesses.map((biz, i) =>
            `<button class="btn target-btn" data-idx="${i}">${biz.label} Nv.${biz.level}</button>`
          ).join('')}
        </div>
        <div style="text-align:right;margin-top:8px"><button class="btn btn-secondary btn-small" id="biz-back">← Voltar</button></div>
      `;

      modal.querySelectorAll('.target-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          overlay.remove();
          resolve({ type: 'play_card', cardIndex, target: { playerId: opponent.id, businessIndex: parseInt(btn.dataset.idx) } });
        });
      });

      modal.querySelector('#biz-back').addEventListener('click', () => { overlay.remove(); resolve(null); });
      overlay.appendChild(modal);
      document.getElementById('app').appendChild(overlay);
    });
  }

  showOwnBusinessSelection(player, cardIndex, card) {
    return new Promise(resolve => {
      if (player.businesses.length === 0) { this.gameState.addLog('Você não tem negócios.'); resolve(null); return; }
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <h2>Seu negócio: ${card.name}</h2>
        <div class="target-list">
          ${player.businesses.map((biz, i) => {
            const income = BonusCalculator.calculateIncome(biz, player.businesses, player.color);
            return `<button class="btn target-btn" data-idx="${i}">${biz.label} Nv.${biz.level} — $${income}/turno</button>`;
          }).join('')}
        </div>
        <div style="text-align:right;margin-top:8px"><button class="btn btn-secondary btn-small" id="own-biz-back">← Voltar</button></div>
      `;

      modal.querySelectorAll('.target-btn').forEach(btn => {
        btn.addEventListener('click', () => { overlay.remove(); resolve({ type: 'play_card', cardIndex, target: { businessIndex: parseInt(btn.dataset.idx) } }); });
      });

      modal.querySelector('#own-biz-back').addEventListener('click', () => { overlay.remove(); resolve(null); });
      overlay.appendChild(modal);
      document.getElementById('app').appendChild(overlay);
    });
  }

  showBoardTargetSelection(player, cardIndex, card) {
    return new Promise(resolve => {
      const panel = document.getElementById('center-actions');
      panel.innerHTML = `
        <div class="center-action-menu">
          <div class="center-action-title">${card.name}</div>
          <p style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">Clique na casa desejada</p>
          <button class="btn btn-secondary btn-small" id="board-back">← Voltar</button>
        </div>
      `;

      const canvas = document.getElementById('board-canvas');
      const handler = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        const space = this.boardRenderer.getSpaceAtPosition(x, y);
        if (space) {
          canvas.removeEventListener('click', handler);
          panel.innerHTML = '';
          resolve({ type: 'play_card', cardIndex, target: { spaceId: space.id } });
        }
      };
      canvas.addEventListener('click', handler);

      panel.querySelector('#board-back').addEventListener('click', () => {
        canvas.removeEventListener('click', handler);
        panel.innerHTML = '';
        resolve(null);
      });
    });
  }

  showBuildMenu(player) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <h2>Construir (Casa ${player.position})</h2>
        <div class="build-options">
          ${BUSINESS_ORDER.map(type => {
            const config = BUSINESS_TYPES[type];
            const canAfford = player.canAfford(config.cost);
            return `<button class="btn build-btn ${!canAfford ? 'disabled' : ''}" data-type="${type}">
              <span class="biz-dot" style="background:${config.color}"></span>
              <span class="biz-name">${config.label}</span>
              <span class="biz-price">$${config.cost}</span>
              <span class="biz-income-label">→ $${config.baseIncome}/t</span>
            </button>`;
          }).join('')}
        </div>
        <div style="text-align:right;margin-top:8px"><button class="btn btn-secondary btn-small" id="build-back">← Voltar</button></div>
      `;

      modal.querySelectorAll('.build-btn:not(.disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
          overlay.remove();
          resolve({ type: 'build', businessType: btn.dataset.type });
        });
      });

      modal.querySelector('#build-back').addEventListener('click', () => { overlay.remove(); resolve(null); });
      overlay.appendChild(modal);
      document.getElementById('app').appendChild(overlay);
    });
  }

  showBankruptcyDialog(player) {
    return new Promise(resolve => {
      if (player.businesses.length === 0) { resolve(false); return; }

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'modal bankruptcy-modal';

      const render = () => {
        modal.innerHTML = `
          <h2>⚠️ Saldo: $${player.money}</h2>
          <p>Leiloe negócios para outros jogadores ou declare falência.</p>
          <div class="sell-list">
            ${player.businesses.map((biz, i) =>
              `<button class="btn sell-btn" data-index="${i}">🔨 Leiloar ${biz.label} Nv.${biz.level} (mín. $${biz.getSellValue()})</button>`
            ).join('')}
          </div>
          <button class="btn btn-danger" id="declare-bankrupt">Declarar Falência</button>
        `;

        modal.querySelectorAll('.sell-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.index);
            const biz = player.businesses[idx];
            overlay.remove();
            await this.runAuction(player, biz, idx);
            if (player.money >= 0) { resolve(true); return; }
            if (player.businesses.length === 0) { resolve(false); return; }
            // Reabrir recursivamente
            this.showBankruptcyDialog(player).then(resolve);
          });
        });

        modal.querySelector('#declare-bankrupt').addEventListener('click', () => { overlay.remove(); resolve(false); });
      };

      overlay.appendChild(modal);
      document.getElementById('app').appendChild(overlay);
      render();
    });
  }

  runAuction(seller, business, bizIndex) {
    return new Promise(resolve => {
      const minPrice = business.getSellValue();
      const bidders = this.gameState.activePlayers.filter(p => p.id !== seller.id && !p.bankrupt);

      // Sem compradores possíveis — vender direto
      if (bidders.length === 0) {
        seller.receive(minPrice);
        seller.businesses.splice(bizIndex, 1);
        this.gameState.addLog(`${seller.name} vendeu ${business.label} por $${minPrice}.`);
        this.updateUI();
        resolve();
        return;
      }

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'modal';
      let currentBid = minPrice;
      let currentBidder = null;
      let timeLeft = 10;

      const sellDirect = () => {
        clearInterval(timer);
        seller.receive(minPrice);
        seller.businesses.splice(bizIndex, 1);
        this.gameState.addLog(`${seller.name} vendeu ${business.label} por $${minPrice}.`);
        overlay.remove();
        this.updateUI();
        resolve();
      };

      const finishAuction = () => {
        clearInterval(timer);
        try {
          if (currentBidder) {
            currentBidder.pay(currentBid);
            seller.receive(currentBid);
            business.slot = COLOR_SLOT[currentBidder.color];
            currentBidder.businesses.push(business);
            seller.businesses.splice(bizIndex, 1);
            this.gameState.addLog(`${currentBidder.name} comprou ${business.label} de ${seller.name} por $${currentBid} no leilão!`);
            this.showToast(`🔨 ${currentBidder.name} arrematou ${business.label}!`, 'info');
          } else {
            seller.receive(minPrice);
            seller.businesses.splice(bizIndex, 1);
            this.gameState.addLog(`${seller.name} vendeu ${business.label} por $${minPrice} (sem lances).`);
          }
        } catch (err) {
          console.error('Erro no leilão:', err);
          seller.receive(minPrice);
          if (seller.businesses.includes(business)) {
            seller.businesses.splice(seller.businesses.indexOf(business), 1);
          }
        }
        overlay.remove();
        this.updateUI();
        resolve();
      };

      const render = () => {
        modal.innerHTML = `
          <h2>🔨 Leilão: ${business.label} Nv.${business.level}</h2>
          <div style="text-align:center;margin:10px 0">
            <div style="font-size:24px;font-weight:700;color:var(--accent-gold)">$${currentBid}</div>
            <div style="font-size:12px;color:var(--text-secondary)">${currentBidder ? `Maior lance: ${currentBidder.name}` : 'Sem lances'}</div>
            <div style="font-size:18px;font-weight:700;margin-top:6px;color:${timeLeft <= 3 ? 'var(--accent-red)' : 'var(--text-primary)'}">${timeLeft}s</div>
          </div>
          <div class="target-list">
            ${bidders.map(p => {
              const colors = PLAYER_COLORS[p.color];
              const canBid = p.canAfford(currentBid + 50);
              return `<button class="btn target-btn ${!canBid ? 'disabled' : ''}" data-id="${p.id}" style="border-color:${colors.main}">
                <span class="player-color-dot" style="background:${colors.main}"></span>
                ${p.name} ($${p.money}) — Lance $${currentBid + 50}
              </button>`;
            }).join('')}
          </div>
          <button class="btn btn-secondary" id="auction-skip" style="margin-top:8px;width:100%">Vender por $${minPrice} (sem leilão)</button>
        `;

        modal.querySelectorAll('.target-btn:not(.disabled)').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            currentBidder = bidders.find(p => p.id === id);
            currentBid += 50;
            timeLeft = 10;
            render();
          });
        });

        modal.querySelector('#auction-skip')?.addEventListener('click', sellDirect);
      };

      const timer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) { finishAuction(); return; }
        render();
      }, 1000);

      overlay.appendChild(modal);
      document.getElementById('app').appendChild(overlay);
      render();
    });
  }

  // === LOOP DE TURNOS ===
  async runTurnLoop() {
    while (!this.gameState.gameOver) {
      try {
        // Pular jogadores falidos
        if (this.gameState.currentPlayer.bankrupt) {
          this.gameState.nextTurn();
          this.updateUI();
          continue;
        }
        // Esperar o jogador clicar "Rolar Dados"
        await this.waitForRollClick();
        await this.turnManager.executeTurn();
        this.updateUI();
        SaveManager.save(this.gameState);
      } catch (err) {
        console.error('Erro no turno:', err);
        this.gameState.addLog(`⚠ Erro: ${err.message}`);
        // Avançar para o próximo jogador para não travar
        this.gameState.nextTurn();
        this.updateUI();
      }
    }

    SaveManager.deleteSave();
    if (this.gameState.winner) {
      this.victoryScreen.show(
        this.gameState.winner,
        this.gameState.log[this.gameState.log.length - 1]?.message || 'Vitória!',
        this.gameState
      );
    }
  }

  // Botão interativo para iniciar o turno
  async waitForRollClick() {
    const panel = document.getElementById('center-actions');
    const player = this.gameState.currentPlayer;
    const colors = PLAYER_COLORS[player.color];

    if (player.isBot) {
      panel.innerHTML = `
        <div class="center-action-menu">
          <div class="center-action-title" style="color:${colors.main}">🤖 ${player.name}</div>
          <div class="bot-thinking">Pensando...</div>
        </div>
      `;
      await BotAI.delay(600, 1200);
      panel.innerHTML = '';
      return;
    }

    return new Promise(resolve => {
      panel.innerHTML = `
        <div class="center-action-menu">
          <div class="center-action-title" style="color:${colors.main}">${player.name}</div>
          <button class="btn btn-primary roll-btn" id="roll-dice-btn">
            🎲 Rolar Dados
          </button>
        </div>
      `;

      panel.querySelector('#roll-dice-btn').addEventListener('click', () => {
        soundManager.playButtonClick();
        panel.innerHTML = '';
        resolve();
      });
    });
  }

  setupEventListeners() {
    const canvas = document.getElementById('board-canvas');

    // Botão de som
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        soundManager.muted = !soundManager.muted;
        soundBtn.textContent = soundManager.muted ? '🔇 Mudo' : '🔊 Som';
        if (!soundManager.muted) soundManager.playButtonClick();
      });
    }

    // Botão de música
    const musicBtn = document.getElementById('music-toggle');
    if (musicBtn) {
      musicBtn.addEventListener('click', () => {
        if (soundManager._musicPlaying) {
          soundManager.stopMusic();
          musicBtn.textContent = '🎵 Música OFF';
          musicBtn.style.color = '#94a3b8';
        } else {
          soundManager.startMusic();
          musicBtn.textContent = '🎵 Música';
          musicBtn.style.color = '';
        }
      });
    }

    // Botão de ajuda
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => this.tutorialScreen.show());
    }

    // Botão de sair
    const quitBtn = document.getElementById('quit-btn');
    if (quitBtn) {
      quitBtn.addEventListener('click', () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
          <h2>Sair da Partida</h2>
          <p style="color:var(--text-secondary);margin:10px 0">Tem certeza? O progresso será perdido.</p>
          <div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="btn btn-secondary btn-small" id="quit-cancel">Cancelar</button>
            <button class="btn btn-small" id="quit-confirm" style="background:var(--accent-red)">Sair</button>
          </div>
        `;
        modal.querySelector('#quit-cancel').addEventListener('click', () => overlay.remove());
        modal.querySelector('#quit-confirm').addEventListener('click', () => window.location.reload());
        overlay.appendChild(modal);
        document.getElementById('app').appendChild(overlay);
      });
    }

    // Botão de velocidade dos bots
    const speedBtn = document.getElementById('speed-toggle');
    if (speedBtn) {
      speedBtn.addEventListener('click', () => {
        if (BotAI.speedMultiplier === 1) {
          BotAI.speedMultiplier = 0.1;
          speedBtn.textContent = '⏩ Turbo ON';
          speedBtn.style.color = '#fbbf24';
        } else {
          BotAI.speedMultiplier = 1;
          speedBtn.textContent = '⏩ Turbo';
          speedBtn.style.color = '';
        }
      });
    }

    // Mobile drawer toggles
    const overlay = document.getElementById('drawer-overlay');
    const hudSidebar = document.querySelector('.sidebar-left');
    const actionSidebar = document.querySelector('.sidebar-right');

    const closeDrawers = () => {
      hudSidebar.classList.remove('open');
      actionSidebar.classList.remove('open');
      overlay.classList.remove('active');
    };

    document.getElementById('toggle-hud')?.addEventListener('click', () => {
      actionSidebar.classList.remove('open');
      hudSidebar.classList.toggle('open');
      overlay.classList.toggle('active', hudSidebar.classList.contains('open'));
    });

    document.getElementById('toggle-actions')?.addEventListener('click', () => {
      hudSidebar.classList.remove('open');
      actionSidebar.classList.toggle('open');
      overlay.classList.toggle('active', actionSidebar.classList.contains('open'));
    });

    overlay?.addEventListener('click', closeDrawers);

    // Fechar drawer ao escolher ação
    this.closeDrawers = closeDrawers;

    // Atalhos de teclado
    document.addEventListener('keydown', (e) => {
      // Enter/Space = rolar dados
      if (e.key === 'Enter' || e.key === ' ') {
        const rollBtn = document.getElementById('roll-dice-btn');
        if (rollBtn) { e.preventDefault(); rollBtn.click(); return; }
      }
      // 1-5 = ações no menu central
      const actionMap = { '1': 'action-card', '2': 'action-build', '3': 'action-trade', '4': 'action-buy-card', '5': 'action-pass' };
      if (actionMap[e.key]) {
        const btn = document.getElementById(actionMap[e.key]);
        if (btn && !btn.disabled) { btn.click(); return; }
      }
      // Escape = fechar modal
      if (e.key === 'Escape') {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
          const backBtn = modal.querySelector('[id$="-back"], #trade-cancel, #auction-skip');
          if (backBtn) backBtn.click();
        }
      }
    });

    // Hover no canvas com tooltip informativo
    const tooltip = document.getElementById('board-tooltip');
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      const space = this.boardRenderer.getSpaceAtPosition(x, y);
      this.boardRenderer.hoveredSpace = space ? space.id : null;

      if (space && tooltip && this.gameState) {
        const html = this._buildTooltipHTML(space);
        if (html) {
          tooltip.innerHTML = html;
          tooltip.style.display = 'block';
          tooltip.style.left = (e.clientX + 15) + 'px';
          tooltip.style.top = (e.clientY + 15) + 'px';
          // Evitar sair da tela
          const tr = tooltip.getBoundingClientRect();
          if (tr.right > window.innerWidth) tooltip.style.left = (e.clientX - tr.width - 10) + 'px';
          if (tr.bottom > window.innerHeight) tooltip.style.top = (e.clientY - tr.height - 10) + 'px';
        } else {
          tooltip.style.display = 'none';
        }
      } else if (tooltip) {
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      this.boardRenderer.hoveredSpace = null;
      if (tooltip) tooltip.style.display = 'none';
    });

    // Bifurcação: mostrar botões de escolha (ou auto-choice para bots)
    eventBus.on('bifurcationChoice', ({ player, options, onChoice }) => {
      if (player.isBot) {
        BotAI.delay(300, 600).then(() => {
          onChoice(this.botAI.chooseBifurcationPath(player, options, this.gameState));
        });
        return;
      }

      const ui = document.getElementById('bifurcation-ui');
      soundManager.playBifurcation();
      ui.innerHTML = `
        <div class="bifurcation-panel">
          <div class="bif-title">Bifurcação!</div>
          <p>${player.name}, escolha o caminho:</p>
          <div class="bif-buttons">
            <button class="btn bif-btn" data-space="${options[0]}">
              🛣️ Caminho Externo
            </button>
            <button class="btn bif-btn bif-inner" data-space="${options[1]}">
              ⚡ Atalho Interno
            </button>
          </div>
        </div>
      `;
      ui.querySelectorAll('.bif-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          soundManager.playButtonClick();
          ui.innerHTML = '';
          onChoice(parseInt(btn.dataset.space));
        });
      });
    });

    eventBus.on('log', (message) => this.appendLog(message));

    // Atualizar HUD em tempo real quando eventos acontecem
    eventBus.on('lapCompleted', (data) => { this.updateUI(); this.showToast(`🔄 ${data?.player?.name || 'Jogador'} completou uma volta!`, 'info'); });
    eventBus.on('businessBuilt', (data) => { this.updateUI(); if (data?.cost) this.showFloatingNumber(-data.cost); });
    eventBus.on('cardPlayed', () => this.updateUI());
    eventBus.on('bankruptcy', (data) => { this.updateUI(); this.showToast(`💀 ${data?.player?.name || 'Jogador'} faliu!`, 'danger'); });
    eventBus.on('boardUpdate', () => this.updateUI());
    eventBus.on('randomEvent', ({ event }) => this.showToast(`${event.icon} ${event.name}: ${event.desc}`, 'info'));
    eventBus.on('payment', (data) => { if (data?.amount) this.showFloatingNumber(-Math.abs(data.amount)); });
    eventBus.on('income', (data) => { if (data?.amount) this.showFloatingNumber(Math.abs(data.amount)); });
  }

  showFloatingNumber(amount) {
    const container = document.querySelector('.game-center');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'float-number';
    el.style.color = amount > 0 ? '#4ADE80' : '#F87171';
    el.textContent = `${amount > 0 ? '+' : ''}$${Math.abs(amount)}`;
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.getElementById('app').appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  _buildTooltipHTML(space) {
    const gs = this.gameState;
    const regionLabels = { blue: 'Azul', yellow: 'Amarela', red: 'Vermelha', green: 'Verde' };
    let lines = [];

    // Tipo da casa
    if (space.nestColor) {
      const c = PLAYER_COLORS[space.nestColor];
      lines.push(`<div class="tt-title" style="color:${c.main}">🏠 Base ${c.label}</div>`);
    } else if (space.type === 'minigame') {
      lines.push(`<div class="tt-title" style="color:#d4a5e8">🎮 Casa de Minigame</div>`);
    } else if (space.type === 'stock_exchange') {
      lines.push(`<div class="tt-title" style="color:#fad390">📈 Bolsa de Valores</div>`);
    } else if (space.type === 'property') {
      const region = regionLabels[space.region] || space.region;
      lines.push(`<div class="tt-title">Casa ${space.id} — Região ${region}</div>`);
    }

    // Negócios na casa
    if (gs) {
      const businesses = gs.getBusinessesAtSpace(space.id);
      for (const { business, owner } of businesses) {
        const income = BonusCalculator.calculateIncome(business, owner.businesses, owner.color);
        const c = PLAYER_COLORS[owner.color];
        lines.push(`<div class="tt-biz"><span class="tt-dot" style="background:${c.main}"></span>${business.label} Nv.${business.level} — <b>$${income}/t</b> <span class="tt-owner">(${owner.name})</span></div>`);
      }
    }

    // Pedágio
    if (space.toll && gs) {
      const owner = gs.players[space.toll.ownerId];
      const c = owner ? PLAYER_COLORS[owner.color] : null;
      lines.push(`<div class="tt-special" style="color:${c?.main || '#FF6600'}">$ Pedágio de ${owner?.name || '?'} — $100 ao passar</div>`);
    }

    // Obstrução
    if (space.obstruction && gs) {
      const owner = gs.players[space.obstruction.ownerId];
      const c = owner ? PLAYER_COLORS[owner.color] : null;
      lines.push(`<div class="tt-special" style="color:${c?.main || '#CC0000'}">⚠ Obstrução de ${owner?.name || '?'} — Só passa com 6</div>`);
    }

    if (lines.length === 0) return null;
    return lines.join('');
  }

  updateUI() {
    this.hudPanel.update(this.gameState);
    this.cardHand.update(this.gameState.currentPlayer);
  }

  appendLog(message) {
    const logEl = document.getElementById('log-container');
    if (!logEl) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + this.getLogClass(message);
    entry.textContent = message;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
    while (logEl.children.length > 60) logEl.removeChild(logEl.children[1]);
  }

  getLogClass(msg) {
    if (/pagou|perdeu|pedágio|imposto/i.test(msg)) return 'log-payment';
    if (/recebeu|ganhou|\$200|comprou uma carta/i.test(msg)) return 'log-income';
    if (/jogou|carta/i.test(msg)) return 'log-card';
    if (/construiu/i.test(msg)) return 'log-build';
    if (/faliu|venceu|completou volta|volta \d/i.test(msg)) return 'log-system';
    return '';
  }

  startRenderLoop() {
    const loop = () => {
      this.boardRenderer.render(this.gameState);
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    new MagnataGame();
  } catch (e) {
    console.error('Erro ao iniciar o jogo:', e);
  }
  // Splash desaparece sozinho via CSS animation (2s delay + 0.6s fade)
  // Cleanup do DOM após a animação terminar
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) splash.remove();
  }, 3000);
});
