// ========================================
// TurnManager - Gerenciador de Turnos
// ========================================

import { SPACES, NEST_POSITIONS, TOTAL_SPACES, getNextSpaces, hasBifurcation } from '../config/board-layout.js';
import { SPACE_TYPES, STOCK_MAX_WIN, STOCK_MAX_LOSS } from '../config/constants.js';
import { CARD_TYPES } from '../config/cards-data.js';
import { Business } from './Business.js';
import { BonusCalculator } from './BonusCalculator.js';
import { PawnAnimator } from '../board/PawnAnimator.js';
import { eventBus } from '../utils/EventBus.js';
import { soundManager } from '../utils/SoundManager.js';

export class TurnManager {
  constructor(gameState, ui) {
    this.gs = gameState;
    this.ui = ui;
    this.pawnAnimator = new PawnAnimator();
    this.diceResults = [];
  }

  get currentPlayer() {
    return this.gs.currentPlayer;
  }

  // === FASE 1: ROLAR DADOS ===
  async phaseRoll() {
    this.gs.turnPhase = 'ROLL';
    const player = this.currentPlayer;

    this.gs.addLog(`--- Turno de ${player.name} ---`);

    this.diceResults = player.rollDice();
    const total = this.diceResults.reduce((a, b) => a + b, 0);

    this.gs.addLog(`${player.name} rolou ${this.diceResults.join(' + ')} = ${total}`);
    eventBus.emit('diceRolled', { player, results: this.diceResults, total });

    await this.ui.showDiceAnimation(this.diceResults);
    return total;
  }

  // === FASE 2: MOVER PEÃO ===
  async phaseMove(steps) {
    this.gs.turnPhase = 'MOVE';
    const player = this.currentPlayer;
    const nestPos = NEST_POSITIONS[player.color];

    await this.pawnAnimator.animateMove(player, steps, async (p, space, step, totalSteps) => {
      // Volta completa
      if (p.position === nestPos) {
        p.laps++;
        p.receive(200);
        for (const biz of p.businesses) {
          biz.levelUp();
        }
        // Carta grátis ao completar volta
        if (this.gs.deck.remainingCards > 0) {
          const newCard = this.gs.deck.draw();
          p.addCard(newCard);
          this.gs.addLog(`${p.name} completou volta ${p.laps}! Recebeu $200, 1 carta e negócios subiram de nível.`);
        } else {
          this.gs.addLog(`${p.name} completou volta ${p.laps}! Recebeu $200 e negócios subiram de nível.`);
        }
        soundManager.playLevelUp();
        eventBus.emit('lapCompleted', { player: p, laps: p.laps });
      }

      // Pedágio
      if (space.toll && space.toll.ownerId !== p.id && step < totalSteps) {
        if (p.effects.isencaoTaxas > 0) {
          p.effects.isencaoTaxas--;
          this.gs.addLog(`${p.name} usou Isenção de Taxas para evitar pedágio.`);
        } else {
          p.pay(100);
          const tollOwner = this.gs.players[space.toll.ownerId];
          tollOwner.receive(100);
          soundManager.playPayment();
          this.gs.addLog(`${p.name} pagou $100 de pedágio para ${tollOwner.name}.`);
        }
      }

      // Obstrução
      if (space.obstruction && space.obstruction.ownerId !== p.id && step < totalSteps) {
        const diceMax = Math.max(...this.diceResults);
        if (diceMax < 6) {
          this.gs.addLog(`${p.name} foi bloqueado pela obstrução na casa ${space.id}!`);
          return true;
        }
      }

      eventBus.emit('boardUpdate');
      return false;
    });

    const landedSpace = SPACES[player.position];
    this.gs.addLog(`${player.name} parou na casa ${player.position} (${landedSpace.type})`);
    eventBus.emit('playerLanded', { player, space: landedSpace });
    return landedSpace;
  }

  // === FASE 3: PAGAR DÍVIDAS ===
  async phasePayDebts() {
    this.gs.turnPhase = 'PAY_DEBTS';
    const player = this.currentPlayer;

    // Mira do Leão
    if (player.effects.miraLeao) {
      const tax = Math.floor(player.money * 0.5);
      player.pay(tax);
      player.effects.miraLeao = false;
      this.gs.addLog(`${player.name} pagou $${tax} de imposto (Na Mira do Leão).`);
    }

    // Cobrança da Máfia
    if (player.effects.cobrancaMafia) {
      const { fromPlayerId } = player.effects.cobrancaMafia;
      const mafiaAmount = Math.floor(player.getTotalBusinessValue() * 0.3);
      player.pay(mafiaAmount);
      const collector = this.gs.players[fromPlayerId];
      collector.receive(mafiaAmount);
      player.effects.cobrancaMafia = null;
      this.gs.addLog(`${player.name} pagou $${mafiaAmount} para ${collector.name} (Cobrança da Máfia).`);
    }

    // Renda de todos os negócios na casa (até 4 slots)
    const allBiz = this.gs.getBusinessesAtSpace(player.position);
    const opponentBiz = allBiz.filter(b => b.owner.id !== player.id);
    if (opponentBiz.length > 0) {
      if (player.effects.isencaoNegocios > 0) {
        player.effects.isencaoNegocios--;
        this.gs.addLog(`${player.name} usou Isenção de Negócios.`);
      } else {
        // Paga renda de cada negócio de oponentes
        for (const { business, owner } of opponentBiz) {
          const income = this.gs.getBusinessIncome(business, owner);
          player.pay(income);
          owner.receive(income);
          this.gs.addLog(`${player.name} pagou $${income} a ${owner.name} (${business.label}).`);
        }
        if (opponentBiz.length > 0) soundManager.playPayment();
      }
    }

    // Falência
    if (player.money < 0) {
      const canRecover = await this.ui.handleBankruptcy(player);
      if (!canRecover) {
        this.gs.declareBankruptcy(player);
        return false;
      }
    }

    return true;
  }

  // === FASE 4: MINIGAME / BOLSA ===
  async phaseSpecial() {
    this.gs.turnPhase = 'SPECIAL';
    const player = this.currentPlayer;
    const space = SPACES[player.position];

    if (space.type === SPACE_TYPES.MINIGAME) {
      soundManager.playMinigameStart();
      const earnings = await this.ui.playMinigame(player);
      player.receive(earnings);
      soundManager.playCoins();
      this.gs.addLog(`${player.name} ganhou $${earnings} no minigame!`);
    } else if (space.type === SPACE_TYPES.STOCK_EXCHANGE) {
      const result = this.rollStockExchange();
      if (result >= 0) {
        player.receive(result);
        soundManager.playStockUp();
        this.gs.addLog(`${player.name} ganhou $${result} na Bolsa de Valores!`);
      } else {
        player.pay(Math.abs(result));
        soundManager.playStockDown();
        this.gs.addLog(`${player.name} perdeu $${Math.abs(result)} na Bolsa de Valores!`);
      }
      await this.ui.showStockResult(result);
    }
  }

  rollStockExchange() {
    const totalRange = STOCK_MAX_WIN + STOCK_MAX_LOSS;
    const roll = Math.random() * totalRange;
    return Math.floor(roll - STOCK_MAX_LOSS);
  }

  // === FASE 5: AÇÃO ===
  async phaseAction() {
    this.gs.turnPhase = 'ACTION';
    const player = this.currentPlayer;
    const action = await this.ui.chooseAction(player, this.gs);

    switch (action.type) {
      case 'play_card':
        await this.executeCard(player, action.cardIndex, action.target);
        break;
      case 'build':
        this.gs.buildBusiness(player, action.businessType, player.position);
        soundManager.playBuild();
        break;
      case 'trade':
        await this.ui.executeTrade(player, action.targetPlayer, action.give, action.receive);
        break;
      case 'pass':
        this.gs.addLog(`${player.name} passou a vez.`);
        break;
    }
  }

  async executeCard(player, cardIndex, target) {
    const card = player.cards[cardIndex];
    if (!card) return;

    if (!player.canAfford(card.cost)) {
      this.gs.addLog(`${player.name} não tem dinheiro para jogar ${card.name}.`);
      return;
    }

    if (card.type === 'victory') {
      if (this.gs.checkVictoryCondition(player, card.id)) {
        player.pay(card.cost);
        player.removeCard(cardIndex);
        soundManager.playVictory();
        this.gs.declareVictory(player, card);
        return;
      } else {
        this.gs.addLog(`${player.name} não atende as condições de ${card.name}.`);
        return;
      }
    }

    player.pay(card.cost);
    const removedCard = player.removeCard(cardIndex);
    this.gs.deck.discard(removedCard);
    player.stats.cardsPlayed++;

    soundManager.playCardPlay();
    await this.applyCardEffect(player, card, target);
    this.gs.addLog(`${player.name} jogou ${card.name}.`);
    eventBus.emit('cardPlayed', { player, card, target });
  }

  async applyCardEffect(player, card, target) {
    const targetPlayer = target?.playerId != null ? this.gs.players[target.playerId] : null;

    switch (card.id) {
      case 'dinheiro_facil': player.receive(500); break;
      case 'seguro_empresarial': player.money = 200; break;
      case 'na_mira_do_leao': if (targetPlayer) targetPlayer.effects.miraLeao = true; break;
      case 'cobranca_mafia': if (targetPlayer) targetPlayer.effects.cobrancaMafia = { fromPlayerId: player.id }; break;
      case 'isencao_taxas': player.effects.isencaoTaxas += 3; break;
      case 'isencao_negocios': player.effects.isencaoNegocios += 3; break;
      case 'conta_trancada': if (targetPlayer) targetPlayer.effects.contaTrancada = true; break;
      case 'cuidado_obras':
        if (target?.spaceId != null) SPACES[target.spaceId].obstruction = { ownerId: player.id };
        break;
      case 'pedagio':
        if (target?.spaceId != null) SPACES[target.spaceId].toll = { ownerId: player.id };
        break;
      case 'demolicao':
        if (target?.spaceId != null) { SPACES[target.spaceId].toll = null; SPACES[target.spaceId].obstruction = null; }
        break;
      case 'operacao_lebre': player.effects.lebre = 3; break;
      case 'operacao_tartaruga': if (targetPlayer) targetPlayer.effects.tartaruga = 3; break;
      case 'dado_dado': if (player.diceCount < 4) player.diceCount++; break;
      case 'dado_perdido': if (targetPlayer && targetPlayer.diceCount > 1) targetPlayer.diceCount--; break;
      case 'novo_comeco': if (targetPlayer) targetPlayer.resetEffects(); break;
      case 'implosao':
        if (target?.businessIndex != null && targetPlayer) {
          const biz = targetPlayer.businesses[target.businessIndex];
          if (biz) { targetPlayer.businesses.splice(target.businessIndex, 1); this.gs.addLog(`${biz.label} de ${targetPlayer.name} foi destruído!`); }
        }
        break;
      case 'valorizacao_instantanea':
        if (target?.businessIndex != null) { const biz = player.businesses[target.businessIndex]; if (biz) biz.levelUp(3); }
        break;
      case 'marketing_agressivo':
        for (const biz of player.businesses) biz.levelUp(1);
        break;
    }
  }

  async executeTurn() {
    if (this.gs.gameOver) return;
    if (this.currentPlayer.bankrupt) return;

    const steps = await this.phaseRoll();
    await this.phaseMove(steps);
    const alive = await this.phasePayDebts();

    if (!alive) {
      // Jogador faliu: avançar para o próximo jogador
      if (!this.gs.gameOver) this.gs.nextTurn();
      return;
    }
    if (this.gs.gameOver) return;

    await this.phaseSpecial();
    if (this.gs.gameOver) return;

    await this.phaseAction();

    if (!this.gs.gameOver) {
      this.gs.nextTurn();
    }
  }
}
