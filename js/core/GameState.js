// ========================================
// GameState - Estado Central do Jogo
// ========================================

import { STARTING_CARDS, PLAYER_COLOR_ORDER, BUSINESS_TYPES } from '../config/constants.js';
import { SPACES, TOTAL_SPACES, NEST_POSITIONS } from '../config/board-layout.js';
import { Player } from './Player.js';
import { Business } from './Business.js';
import { Deck } from './Deck.js';
import { BonusCalculator } from './BonusCalculator.js';
import { eventBus } from '../utils/EventBus.js';

export class GameState {
  constructor(playerConfigs) {
    // playerConfigs: [{ name, color }, ...]
    this.players = playerConfigs.map((cfg, i) =>
      new Player(i, cfg.color, cfg.name)
    );
    this.currentPlayerIndex = 0;
    this.turnPhase = 'ROLL'; // ROLL | MOVE | PAY_DEBTS | SPECIAL | ACTION
    this.deck = new Deck();
    this.round = 0;
    this.gameOver = false;
    this.winner = null;
    this.log = [];

    // Distribuir cartas iniciais
    for (const player of this.players) {
      player.cards = this.deck.drawMultiple(STARTING_CARDS);
    }
  }

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  get activePlayers() {
    return this.players.filter(p => !p.bankrupt);
  }

  getSpace(spaceId) {
    return SPACES[spaceId];
  }

  // Todos os negócios em uma casa (até 4)
  getBusinessesAtSpace(spaceId) {
    const results = [];
    for (const player of this.players) {
      for (const biz of player.businesses) {
        if (biz.spaceId === spaceId) results.push({ business: biz, owner: player });
      }
    }
    return results;
  }

  // Negócio em um slot específico
  getBusinessAtSlot(spaceId, slot) {
    for (const player of this.players) {
      for (const biz of player.businesses) {
        if (biz.spaceId === spaceId && biz.slot === slot) return { business: biz, owner: player };
      }
    }
    return null;
  }

  // Retrocompatibilidade: retorna o primeiro negócio encontrado
  getBusinessAtSpace(spaceId) {
    const all = this.getBusinessesAtSpace(spaceId);
    return all.length > 0 ? all[0] : null;
  }

  // Slots livres em uma casa
  getFreeSlots(spaceId) {
    const occupied = this.getBusinessesAtSpace(spaceId).map(b => b.business.slot);
    return [0, 1, 2, 3].filter(s => !occupied.includes(s));
  }

  // Construir negócio em um slot específico
  buildBusiness(player, type, spaceId, slot = 0) {
    const space = SPACES[spaceId];
    if (space.type !== 'property') return false;
    if (this.getBusinessAtSlot(spaceId, slot)) return false;

    const config = BUSINESS_TYPES[type];
    if (!player.canAfford(config.cost)) return false;

    player.pay(config.cost);
    const business = new Business(type, spaceId, player.id, slot);
    player.businesses.push(business);

    this.addLog(`${player.name} construiu ${business.label} na casa ${spaceId}`);
    eventBus.emit('businessBuilt', { player, business });
    return true;
  }

  // Calcular renda de um negócio
  getBusinessIncome(business, owner) {
    return BonusCalculator.calculateIncome(business, owner.businesses, owner.color);
  }

  // Patrimônio total de um jogador
  getPlayerPatrimony(player) {
    let total = player.money;
    for (const biz of player.businesses) {
      total += biz.cost; // Valor total do negócio
    }
    return total;
  }

  // Patrimônio total do jogo (todos os jogadores)
  getTotalPatrimony() {
    return this.activePlayers.reduce((sum, p) => sum + this.getPlayerPatrimony(p), 0);
  }

  // Verificar condições de vitória
  checkVictoryCondition(player, cardId) {
    const patrimony = this.getPlayerPatrimony(player);
    const totalPatrimony = this.getTotalPatrimony();

    switch (cardId) {
      case 'mais_rico':
        return patrimony >= totalPatrimony * 0.4 && player.laps >= 2;

      case 'empresario_sucesso':
        return patrimony >= 7000;

      case 'jatinho': {
        const otherPlayers = this.activePlayers.filter(p => p.id !== player.id);
        return otherPlayers.every(p => player.laps >= p.laps + 2);
      }

      case 'nadando_dinheiro':
        return true; // Sem condição adicional além do custo

      case 'mega_negocio':
        return player.businesses.some(biz => {
          const income = this.getBusinessIncome(biz, player);
          return income >= 2000;
        });

      default:
        return false;
    }
  }

  // Avançar para próximo jogador
  nextTurn() {
    // Decrementar efeitos do jogador atual
    this.currentPlayer.tickEffects();

    // Próximo jogador ativo
    let next = (this.currentPlayerIndex + 1) % this.players.length;
    while (this.players[next].bankrupt && next !== this.currentPlayerIndex) {
      next = (next + 1) % this.players.length;
    }
    this.currentPlayerIndex = next;

    if (next === 0) this.round++;

    this.turnPhase = 'ROLL';
    eventBus.emit('turnChanged', { player: this.currentPlayer, round: this.round });
  }

  // Declarar falência
  declareBankruptcy(player) {
    player.bankrupt = true;
    // Remover negócios do jogador
    player.businesses = [];
    this.addLog(`${player.name} faliu!`);
    eventBus.emit('bankruptcy', { player });

    // Verificar se sobrou apenas 1 jogador
    if (this.activePlayers.length <= 1) {
      this.gameOver = true;
      this.winner = this.activePlayers[0];
      eventBus.emit('gameOver', { winner: this.winner, reason: 'Último jogador em pé' });
    }
  }

  // Declarar vencedor por carta de vitória
  declareVictory(player, card) {
    this.gameOver = true;
    this.winner = player;
    this.addLog(`${player.name} venceu com ${card.name}!`);
    eventBus.emit('gameOver', { winner: player, reason: card.name, card });
  }

  addLog(message) {
    this.log.push({ message, round: this.round, timestamp: Date.now() });
    eventBus.emit('log', message);
  }
}
