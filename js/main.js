// ========================================
// Capital - Main Application
// ========================================

import { PLAYER_COLORS, PLAYER_COLOR_ORDER, BUSINESS_TYPES, BUSINESS_ORDER } from './config/constants.js';
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

const BOT_NAMES = ['Bot Ana', 'Bot Carlos', 'Bot Luna', 'Bot Pedro'];

class CapitalGame {
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

    this.setupScreen();
  }

  // === TELA DE SETUP ===
  setupScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="setup-screen">
        <div class="setup-logo">
          <div class="logo-icon">🏢</div>
          <h1 class="game-title">CAPITAL</h1>
          <p class="game-subtitle">Construa negócios, lucre e use cartas para vencer!</p>
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

          <div id="player-inputs"></div>

          <button class="btn btn-primary btn-large" id="start-game">
            ▶ Iniciar Jogo
          </button>
          ${SaveManager.hasSave() ? '<button class="btn btn-secondary btn-large" id="continue-game" style="width:100%;margin-top:6px">📂 Continuar Jogo Salvo</button>' : ''}
        </div>
      </div>
    `;

    let playerCount = 2;

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
      this.startGame(configs);
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
  }

  // === INICIAR JOGO ===
  startGame(playerConfigs) {
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
          </div>
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

    this.gameState = new GameState(playerConfigs);
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
    this.runTurnLoop();
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
      executeTrade: (player, targetPlayer, giveIdx, receiveIdx) => {
        const giveCard = player.removeCard(giveIdx);
        const receiveCard = targetPlayer.removeCard(receiveIdx);
        player.addCard(receiveCard);
        targetPlayer.addCard(giveCard);
        this.gameState.addLog(`${player.name} trocou cartas com ${targetPlayer.name}.`);
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
          resolve({ type: 'trade', targetPlayer: result.partner, give: result.giveIndex, receive: result.receiveIndex });
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
          <p>Venda negócios ou declare falência.</p>
          <div class="sell-list">
            ${player.businesses.map((biz, i) =>
              `<button class="btn sell-btn" data-index="${i}">Vender ${biz.label} Nv.${biz.level} → $${biz.getSellValue()}</button>`
            ).join('')}
          </div>
          <button class="btn btn-danger" id="declare-bankrupt">Declarar Falência</button>
        `;

        modal.querySelectorAll('.sell-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            const biz = player.businesses[idx];
            player.receive(biz.getSellValue());
            player.businesses.splice(idx, 1);
            this.gameState.addLog(`${player.name} vendeu ${biz.label} por $${biz.getSellValue()}.`);
            if (player.money >= 0) { overlay.remove(); resolve(true); } else { render(); }
          });
        });

        modal.querySelector('#declare-bankrupt').addEventListener('click', () => { overlay.remove(); resolve(false); });
      };

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

    // Tooltip do tabuleiro
    let tooltip = document.createElement('div');
    tooltip.className = 'board-tooltip';
    tooltip.style.display = 'none';
    document.getElementById('app').appendChild(tooltip);

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      const space = this.boardRenderer.getSpaceAtPosition(x, y);
      this.boardRenderer.hoveredSpace = space ? space.id : null;

      if (space && this.gameState) {
        const info = this.getSpaceTooltip(space);
        tooltip.innerHTML = info;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY - 10) + 'px';
      } else {
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
      this.boardRenderer.hoveredSpace = null;
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
    eventBus.on('lapCompleted', () => this.updateUI());
    eventBus.on('businessBuilt', () => this.updateUI());
    eventBus.on('cardPlayed', () => this.updateUI());
    eventBus.on('bankruptcy', () => this.updateUI());
    eventBus.on('boardUpdate', () => this.updateUI());
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

  getSpaceTooltip(space) {
    if (space.type === 'nest') {
      const color = PLAYER_COLORS[space.nestColor];
      return `<b style="color:${color.main}">Ninho ${color.label}</b>`;
    }
    if (space.type === 'minigame') return '<b>🎮 Minigame</b><br>Jogue um minigame por dinheiro!';
    if (space.type === 'stock_exchange') return '<b>📊 Bolsa de Valores</b><br>Ganhe ou perca até $500';

    // Property
    const region = space.region ? PLAYER_COLORS[space.region] : null;
    let html = `<b>Casa #${space.id}</b>`;
    if (region) html += ` <span style="color:${region.main}">(${region.label})</span>`;

    // Negócios nesta casa
    const bizs = this.gameState.getBusinessesAtSpace(space.id);
    if (bizs.length > 0) {
      html += '<div style="margin-top:4px">';
      for (const { business, owner } of bizs) {
        const ownerColor = PLAYER_COLORS[owner.color];
        const income = this.gameState.getBusinessIncome(business, owner);
        html += `<div><span style="color:${ownerColor.main}">${owner.name}</span>: ${business.label} Nv.${business.level} ($${income}/t)</div>`;
      }
      html += '</div>';
    }

    if (space.toll) html += '<div style="color:#FF6600">$ Pedágio ($100)</div>';
    if (space.obstruction) html += '<div style="color:#CC0000">✖ Obstrução</div>';

    return html;
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
    new CapitalGame();
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
