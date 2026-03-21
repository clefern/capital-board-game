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
import { eventBus } from './utils/EventBus.js';
import { soundManager } from './utils/SoundManager.js';

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
            <label>Jogadores:</label>
            <div class="count-buttons">
              <button class="count-btn selected" data-count="2">2</button>
              <button class="count-btn" data-count="3">3</button>
              <button class="count-btn" data-count="4">4</button>
            </div>
          </div>

          <div id="player-inputs"></div>

          <button class="btn btn-primary btn-large" id="start-game">
            ▶ Iniciar Jogo
          </button>
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

    app.querySelectorAll('.count-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        app.querySelectorAll('.count-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        playerCount = parseInt(btn.dataset.count);
        updatePlayerInputs();
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
        });
      });
      this.startGame(configs);
    });
  }

  // === INICIAR JOGO ===
  startGame(playerConfigs) {
    const app = document.getElementById('app');
    // Layout: sidebar esquerda (jogadores) | centro (tabuleiro + dados) | sidebar direita (cartas + log)
    app.innerHTML = `
      <div class="game-layout">
        <aside class="sidebar sidebar-left" id="hud-container"></aside>

        <main class="game-center">
          <div class="game-toolbar">
            <button class="btn btn-small sound-toggle" id="sound-toggle" title="Som">🔊 Som</button>
          </div>
          <div class="board-wrapper">
            <canvas id="board-canvas"></canvas>
          </div>
          <div id="dice-container" class="dice-container"></div>
          <div id="bifurcation-ui" class="bifurcation-ui"></div>
        </main>

        <aside class="sidebar sidebar-right">
          <div id="action-panel" class="action-panel"></div>
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

    const uiAdapter = this.createUIAdapter();
    this.turnManager = new TurnManager(this.gameState, uiAdapter);

    this.setupEventListeners();
    this.startRenderLoop();
    this.updateUI();
    this.runTurnLoop();
  }

  createUIAdapter() {
    return {
      showDiceAnimation: (results) => this.diceRoller.show(results),
      showStockResult: (result) => this.stockExchange.show(result),
      playMinigame: (player) => {
        const difficulty = player.id === this.gameState.currentPlayerIndex ? 'easy' : 'hard';
        return this.minigameManager.play(player, difficulty);
      },
      handleBankruptcy: (player) => this.showBankruptcyDialog(player),
      chooseAction: (player, gs) => this.showActionMenu(player, gs),
      executeTrade: (player, targetPlayer, giveIdx, receiveIdx) => {
        const giveCard = player.removeCard(giveIdx);
        const receiveCard = targetPlayer.removeCard(receiveIdx);
        player.addCard(receiveCard);
        targetPlayer.addCard(giveCard);
        this.gameState.addLog(`${player.name} trocou cartas com ${targetPlayer.name}.`);
      },
    };
  }

  // === MENU DE AÇÃO (sidebar direita) ===
  showActionMenu(player, gs) {
    return new Promise(resolve => {
      const panel = document.getElementById('action-panel');
      const space = SPACES[player.position];
      const freeSlots = space.type === 'property' ? gs.getFreeSlots(player.position) : [];
      const canBuild = freeSlots.length > 0;

      panel.innerHTML = `
        <div class="action-menu">
          <div class="action-title">Ação de ${player.name}</div>
          <div class="action-buttons">
            <button class="btn action-btn" id="action-card" ${player.cards.length === 0 ? 'disabled' : ''}>
              🃏 Jogar Carta
            </button>
            <button class="btn action-btn" id="action-build" ${!canBuild ? 'disabled' : ''}>
              🏗️ Construir
            </button>
            <button class="btn action-btn" id="action-trade" ${player.cards.length === 0 ? 'disabled' : ''}>
              🤝 Trocar Cartas
            </button>
            <button class="btn action-btn action-pass" id="action-pass">
              ⏭️ Passar
            </button>
          </div>
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

      panel.querySelector('#action-pass')?.addEventListener('click', () => {
        panel.innerHTML = '';
        resolve({ type: 'pass' });
      });
    });
  }

  showCardSelection(player) {
    return new Promise(resolve => {
      const panel = document.getElementById('action-panel');
      panel.innerHTML = `
        <div class="action-menu">
          <div class="action-title">Selecione uma carta</div>
          <div class="card-selection"></div>
          <button class="btn btn-secondary btn-small" id="card-back">← Voltar</button>
        </div>
      `;

      const container = panel.querySelector('.card-selection');
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
            panel.innerHTML = '';
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

      panel.querySelector('#card-back').addEventListener('click', () => { panel.innerHTML = ''; resolve(null); });
    });
  }

  showTargetSelection(player, cardIndex, card) {
    return new Promise(resolve => {
      const panel = document.getElementById('action-panel');
      const opponents = this.gameState.activePlayers.filter(p => p.id !== player.id);

      panel.innerHTML = `
        <div class="action-menu">
          <div class="action-title">Alvo: ${card.name}</div>
          <div class="target-list">
            ${opponents.map(opp => {
              const c = PLAYER_COLORS[opp.color];
              return `<button class="btn target-btn" data-id="${opp.id}" style="border-color:${c.main}">
                <span class="player-color-dot" style="background:${c.main}"></span>
                ${opp.name} ($${opp.money})
              </button>`;
            }).join('')}
          </div>
          <button class="btn btn-secondary btn-small" id="target-back">← Voltar</button>
        </div>
      `;

      panel.querySelectorAll('.target-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id);
          const opp = opponents.find(p => p.id === id);
          panel.innerHTML = '';
          if (card.targetType === 'opponent_business') {
            if (opp.businesses.length === 0) { this.gameState.addLog(`${opp.name} não tem negócios.`); resolve(null); return; }
            this.showOpponentBusinessSelection(player, cardIndex, opp).then(resolve);
          } else {
            resolve({ type: 'play_card', cardIndex, target: { playerId: opp.id } });
          }
        });
      });

      panel.querySelector('#target-back').addEventListener('click', () => { panel.innerHTML = ''; resolve(null); });
    });
  }

  showOpponentBusinessSelection(player, cardIndex, opponent) {
    return new Promise(resolve => {
      const panel = document.getElementById('action-panel');
      panel.innerHTML = `
        <div class="action-menu">
          <div class="action-title">Negócio de ${opponent.name}</div>
          <div class="target-list">
            ${opponent.businesses.map((biz, i) =>
              `<button class="btn target-btn" data-idx="${i}">${biz.label} Nv.${biz.level}</button>`
            ).join('')}
          </div>
          <button class="btn btn-secondary btn-small" id="biz-back">← Voltar</button>
        </div>
      `;

      panel.querySelectorAll('.target-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          panel.innerHTML = '';
          resolve({ type: 'play_card', cardIndex, target: { playerId: opponent.id, businessIndex: parseInt(btn.dataset.idx) } });
        });
      });

      panel.querySelector('#biz-back').addEventListener('click', () => { panel.innerHTML = ''; resolve(null); });
    });
  }

  showOwnBusinessSelection(player, cardIndex, card) {
    return new Promise(resolve => {
      if (player.businesses.length === 0) { this.gameState.addLog('Você não tem negócios.'); resolve(null); return; }
      const panel = document.getElementById('action-panel');
      panel.innerHTML = `
        <div class="action-menu">
          <div class="action-title">Seu negócio: ${card.name}</div>
          <div class="target-list">
            ${player.businesses.map((biz, i) => {
              const income = BonusCalculator.calculateIncome(biz, player.businesses, player.color);
              return `<button class="btn target-btn" data-idx="${i}">${biz.label} Nv.${biz.level} — $${income}/turno</button>`;
            }).join('')}
          </div>
          <button class="btn btn-secondary btn-small" id="own-biz-back">← Voltar</button>
        </div>
      `;

      panel.querySelectorAll('.target-btn').forEach(btn => {
        btn.addEventListener('click', () => { panel.innerHTML = ''; resolve({ type: 'play_card', cardIndex, target: { businessIndex: parseInt(btn.dataset.idx) } }); });
      });

      panel.querySelector('#own-biz-back').addEventListener('click', () => { panel.innerHTML = ''; resolve(null); });
    });
  }

  showBoardTargetSelection(player, cardIndex, card) {
    return new Promise(resolve => {
      const panel = document.getElementById('action-panel');
      panel.innerHTML = `
        <div class="action-menu">
          <div class="action-title">Clique em uma casa</div>
          <p class="action-hint">${card.name}: clique na casa desejada no tabuleiro</p>
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
      const panel = document.getElementById('action-panel');
      const freeSlots = this.gameState.getFreeSlots(player.position);
      const slotLabels = ['↖ Sup-Esq', '↗ Sup-Dir', '↙ Inf-Esq', '↘ Inf-Dir'];

      panel.innerHTML = `
        <div class="action-menu">
          <div class="action-title">Construir (Casa ${player.position})</div>
          <div class="build-slots">
            <div class="slot-label">Terreno:</div>
            <div class="slot-buttons">
              ${freeSlots.map((s, i) =>
                `<button class="btn btn-small slot-btn ${i === 0 ? 'selected' : ''}" data-slot="${s}">${slotLabels[s]}</button>`
              ).join('')}
            </div>
          </div>
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
          <button class="btn btn-secondary btn-small" id="build-back">← Voltar</button>
        </div>
      `;

      let selectedSlot = freeSlots[0];

      // Seleção de slot
      panel.querySelectorAll('.slot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          panel.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedSlot = parseInt(btn.dataset.slot);
        });
      });

      panel.querySelectorAll('.build-btn:not(.disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
          panel.innerHTML = '';
          resolve({ type: 'build', businessType: btn.dataset.type, slot: selectedSlot });
        });
      });

      panel.querySelector('#build-back').addEventListener('click', () => { panel.innerHTML = ''; resolve(null); });
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
        // Esperar o jogador clicar "Rolar Dados"
        await this.waitForRollClick();
        await this.turnManager.executeTurn();
        this.updateUI();
      } catch (err) {
        console.error('Erro no turno:', err);
        this.gameState.addLog(`⚠ Erro: ${err.message}`);
        // Avançar para o próximo jogador para não travar
        this.gameState.nextTurn();
        this.updateUI();
      }
    }

    if (this.gameState.winner) {
      this.victoryScreen.show(
        this.gameState.winner,
        this.gameState.log[this.gameState.log.length - 1]?.message || 'Vitória!',
        this.gameState
      );
    }
  }

  // Botão interativo para iniciar o turno
  waitForRollClick() {
    return new Promise(resolve => {
      const panel = document.getElementById('action-panel');
      const player = this.gameState.currentPlayer;
      const colors = PLAYER_COLORS[player.color];

      panel.innerHTML = `
        <div class="action-menu roll-prompt">
          <div class="roll-player" style="color:${colors.main}">${player.name}</div>
          <button class="btn btn-primary btn-large roll-btn" id="roll-dice-btn">
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

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      const space = this.boardRenderer.getSpaceAtPosition(x, y);
      this.boardRenderer.hoveredSpace = space ? space.id : null;
    });

    // Bifurcação: mostrar botões de escolha
    eventBus.on('bifurcationChoice', ({ player, options, onChoice }) => {
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
  }

  updateUI() {
    this.hudPanel.update(this.gameState);
    this.cardHand.update(this.gameState.currentPlayer);
  }

  appendLog(message) {
    const logEl = document.getElementById('log-container');
    if (!logEl) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = message;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
    while (logEl.children.length > 60) logEl.removeChild(logEl.children[1]); // keep header
  }

  startRenderLoop() {
    const loop = () => {
      this.boardRenderer.render(this.gameState);
      this.animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }
}

window.addEventListener('DOMContentLoaded', () => { new CapitalGame(); });
