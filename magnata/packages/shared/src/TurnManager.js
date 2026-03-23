// ========================================
// TurnManager - Lógica Pura de Turnos (Shared)
// ========================================
// Máquina de estados sem dependências de UI.
// Retorna resultados para que o chamador (client ou server) os processe.

import { SPACES, NEST_POSITIONS, getNextSpaces, hasBifurcation } from './board-layout.js';
import { SPACE_TYPES, STOCK_MAX_WIN, STOCK_MAX_LOSS, COLOR_SLOT } from './constants.js';
import { CARD_TYPES } from './cards-data.js';
import { Business } from './Business.js';
import { BonusCalculator } from './BonusCalculator.js';
import { RandomEventManager } from './RandomEventManager.js';

export class TurnManager {
  constructor(gameState) {
    this.gs = gameState;
  }

  get currentPlayer() {
    return this.gs.currentPlayer;
  }

  // === FASE 1: ROLAR DADOS ===
  executeRoll(predetermined = null) {
    const player = this.currentPlayer;
    this.gs.turnPhase = 'ROLL';
    this.gs.addLog(`--- Turno de ${player.name} ---`);

    const diceResults = player.rollDice(predetermined);
    const total = diceResults.reduce((a, b) => a + b, 0);

    this.gs.addLog(`${player.name} rolou ${diceResults.join(' + ')} = ${total}`);
    return { diceResults, total };
  }

  // === FASE 2: CALCULAR MOVIMENTO ===
  // Retorna o caminho e eventos que ocorrem durante o movimento.
  // O chamador é responsável pela animação.
  calculateMove(steps) {
    const player = this.currentPlayer;
    this.gs.turnPhase = 'MOVE';
    const nestPos = NEST_POSITIONS[player.color];
    const events = [];
    let currentPos = player.position;
    let stoppedEarly = false;
    let needsBifurcation = null;

    for (let step = 0; step < steps; step++) {
      const nextSpaces = getNextSpaces(currentPos);

      // Bifurcação - precisamos da escolha do jogador
      if (nextSpaces.length > 1 && step < steps - 1) {
        needsBifurcation = { position: currentPos, options: nextSpaces, remainingSteps: steps - step };
        // Não podemos continuar sem a escolha - retornar parcialmente
        return { path: [], events, needsBifurcation, landedSpace: null, stoppedEarly: false };
      }

      currentPos = nextSpaces[0];
      player.position = currentPos;
      const space = SPACES[currentPos];

      // Volta completa
      if (currentPos === nestPos) {
        player.laps++;
        player.receive(200);
        for (const biz of player.businesses) {
          biz.levelUp();
        }
        let lapMsg;
        if (this.gs.deck.remainingCards > 0) {
          const newCard = this.gs.deck.draw();
          player.addCard(newCard);
          lapMsg = `${player.name} completou volta ${player.laps}! Recebeu $200, 1 carta e negócios subiram de nível.`;
        } else {
          lapMsg = `${player.name} completou volta ${player.laps}! Recebeu $200 e negócios subiram de nível.`;
        }
        this.gs.addLog(lapMsg);
        events.push({ type: 'lapCompleted', player, laps: player.laps });
      }

      // Pedágio
      if (space.toll && space.toll.ownerId !== player.id && step < steps - 1) {
        if (player.effects.isencaoTaxas > 0) {
          player.effects.isencaoTaxas--;
          this.gs.addLog(`${player.name} usou Isenção de Taxas para evitar pedágio.`);
          events.push({ type: 'tollAvoided', player, spaceId: currentPos });
        } else {
          player.pay(100);
          const tollOwner = this.gs.players[space.toll.ownerId];
          tollOwner.receive(100);
          this.gs.addLog(`${player.name} pagou $100 de pedágio para ${tollOwner.name}.`);
          events.push({ type: 'tollPaid', player, amount: 100, ownerId: space.toll.ownerId });
        }
      }

      // Obstrução
      if (space.obstruction && space.obstruction.ownerId !== player.id && step < steps - 1) {
        const diceResults = player.lastDice || [];
        const diceMax = Math.max(...diceResults, 0);
        if (diceMax < 6) {
          this.gs.addLog(`${player.name} foi bloqueado pela obstrução na casa ${space.id}!`);
          events.push({ type: 'blocked', player, spaceId: currentPos });
          stoppedEarly = true;
          break;
        }
      }

      events.push({ type: 'moved', position: currentPos });
    }

    const landedSpace = SPACES[player.position];
    this.gs.addLog(`${player.name} parou na casa ${player.position} (${landedSpace.type})`);

    return { path: events.filter(e => e.type === 'moved').map(e => e.position), events, needsBifurcation: null, landedSpace, stoppedEarly };
  }

  // Continuar movimento após escolha de bifurcação
  continueMove(chosenSpace, remainingSteps) {
    const player = this.currentPlayer;
    player.position = chosenSpace;

    // Recalcular restante do caminho com a nova posição
    return this.calculateMove(remainingSteps - 1);
  }

  // === FASE 3: PAGAR DÍVIDAS ===
  executePayDebts() {
    this.gs.turnPhase = 'PAY_DEBTS';
    const player = this.currentPlayer;
    const payments = [];

    // Mira do Leão
    if (player.effects.miraLeao) {
      const tax = Math.floor(player.money * 0.5);
      player.pay(tax);
      player.effects.miraLeao = false;
      this.gs.addLog(`${player.name} pagou $${tax} de imposto (Na Mira do Leão).`);
      payments.push({ type: 'tax', amount: tax });
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
      payments.push({ type: 'mafia', amount: mafiaAmount, toPlayerId: fromPlayerId });
    }

    // Renda de negócios na casa
    const allBiz = this.gs.getBusinessesAtSpace(player.position);
    const opponentBiz = allBiz.filter(b => b.owner.id !== player.id);
    if (opponentBiz.length > 0) {
      if (player.effects.isencaoNegocios > 0) {
        player.effects.isencaoNegocios--;
        this.gs.addLog(`${player.name} usou Isenção de Negócios.`);
        payments.push({ type: 'businessExemption' });
      } else {
        for (const { business, owner } of opponentBiz) {
          const income = this.gs.getBusinessIncome(business, owner);
          player.pay(income);
          owner.receive(income);
          this.gs.addLog(`${player.name} pagou $${income} a ${owner.name} (${business.label}).`);
          payments.push({ type: 'rent', amount: income, toPlayerId: owner.id, businessLabel: business.label });
        }
      }
    }

    return { payments, isBankrupt: player.money < 0 };
  }

  // === FASE 4: ESPECIAL (MINIGAME / BOLSA) ===
  executeSpecial(rng = Math.random) {
    this.gs.turnPhase = 'SPECIAL';
    const player = this.currentPlayer;
    const space = SPACES[player.position];

    if (space.type === SPACE_TYPES.MINIGAME) {
      return { type: 'minigame', playerId: player.id };
    } else if (space.type === SPACE_TYPES.STOCK_EXCHANGE) {
      const totalRange = STOCK_MAX_WIN + STOCK_MAX_LOSS;
      const roll = rng() * totalRange;
      const result = Math.floor(roll - STOCK_MAX_LOSS);

      if (result >= 0) {
        player.receive(result);
        this.gs.addLog(`${player.name} ganhou $${result} na Bolsa de Valores!`);
      } else {
        player.pay(Math.abs(result));
        this.gs.addLog(`${player.name} perdeu $${Math.abs(result)} na Bolsa de Valores!`);
      }
      return { type: 'stock', result };
    }

    return { type: 'none' };
  }

  // === FASE 5: EXECUTAR AÇÃO ===
  executeAction(action) {
    this.gs.turnPhase = 'ACTION';
    const player = this.currentPlayer;

    switch (action.type) {
      case 'play_card':
        return this.executeCard(player, action.cardIndex, action.target);
      case 'build':
        this.gs.buildBusiness(player, action.businessType, player.position);
        return { type: 'build', businessType: action.businessType };
      case 'trade':
        return this.executeTrade(player, action);
      case 'pass':
        this.gs.addLog(`${player.name} passou a vez.`);
        return { type: 'pass' };
      default:
        return { type: 'pass' };
    }
  }

  executeCard(player, cardIndex, target) {
    const card = player.cards[cardIndex];
    if (!card) return { type: 'error', message: 'Carta inválida' };

    if (!player.canAfford(card.cost)) {
      this.gs.addLog(`${player.name} não tem dinheiro para jogar ${card.name}.`);
      return { type: 'error', message: 'Sem dinheiro' };
    }

    if (card.type === 'victory') {
      if (this.gs.checkVictoryCondition(player, card.id)) {
        player.pay(card.cost);
        player.removeCard(cardIndex);
        this.gs.declareVictory(player, card);
        return { type: 'victory', card };
      } else {
        this.gs.addLog(`${player.name} não atende as condições de ${card.name}.`);
        return { type: 'error', message: 'Condições não atendidas' };
      }
    }

    player.pay(card.cost);
    const removedCard = player.removeCard(cardIndex);
    this.gs.deck.discard(removedCard);
    player.stats.cardsPlayed++;

    this.applyCardEffect(player, card, target);
    this.gs.addLog(`${player.name} jogou ${card.name}.`);
    return { type: 'card', card, target };
  }

  applyCardEffect(player, card, target) {
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

  executeTrade(player, action) {
    const targetPlayer = this.gs.players.find(p => p.id === action.targetPlayerId);
    if (!targetPlayer) return { type: 'error', message: 'Jogador alvo não encontrado' };

    const givenCards = action.giveIndices.map(i => player.removeCard(i));
    const receivedCards = action.receiveIndices.map(i => targetPlayer.removeCard(i));
    givenCards.forEach(c => targetPlayer.addCard(c));
    receivedCards.forEach(c => player.addCard(c));

    const money = action.money || 0;
    if (money > 0) { player.pay(money); targetPlayer.receive(money); }
    else if (money < 0) { targetPlayer.pay(-money); player.receive(-money); }

    this.gs.addLog(`${player.name} trocou ${givenCards.length}↔${receivedCards.length} cartas com ${targetPlayer.name}${money ? ` (+$${Math.abs(money)})` : ''}.`);
    return { type: 'trade', givenCount: givenCards.length, receivedCount: receivedCards.length };
  }

  // Tentar evento aleatório
  tryRandomEvent(rng = Math.random) {
    return RandomEventManager.tryTrigger(this.gs, rng);
  }
}
