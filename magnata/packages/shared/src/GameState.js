// ========================================
// GameState - Estado Central do Jogo (Shared)
// ========================================

import { STARTING_CARDS, PLAYER_COLOR_ORDER, BUSINESS_TYPES, COLOR_SLOT, GAME_MODES } from './constants.js';
import { SPACES, TOTAL_SPACES, NEST_POSITIONS } from './board-layout.js';
import { Player } from './Player.js';
import { Business } from './Business.js';
import { Deck } from './Deck.js';
import { BonusCalculator } from './BonusCalculator.js';
import { CARD_TYPES } from './cards-data.js';

export class GameState {
  constructor(playerConfigs, gameMode = 'classic', onEvent = null) {
    this.gameMode = gameMode;
    this.onEvent = onEvent || (() => {});
    const modeConfig = GAME_MODES[gameMode] || GAME_MODES.classic;
    this.roundLimit = modeConfig.roundLimit || null;

    this.players = playerConfigs.map((cfg, i) => {
      const p = new Player(i, cfg.color, cfg.name, cfg.isBot || false);
      p.money = modeConfig.money;
      return p;
    });
    this.currentPlayerIndex = 0;
    this.turnPhase = 'ROLL';
    this.deck = new Deck();
    this.round = 0;
    this.gameOver = false;
    this.winner = null;
    this.log = [];

    const cardsPerPlayer = modeConfig.cards;
    for (const player of this.players) {
      player.cards = this.deck.drawMultiple(cardsPerPlayer);
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

  getBusinessesAtSpace(spaceId) {
    const results = [];
    for (const player of this.players) {
      for (const biz of player.businesses) {
        if (biz.spaceId === spaceId) results.push({ business: biz, owner: player });
      }
    }
    return results;
  }

  getBusinessAtSlot(spaceId, slot) {
    for (const player of this.players) {
      for (const biz of player.businesses) {
        if (biz.spaceId === spaceId && biz.slot === slot) return { business: biz, owner: player };
      }
    }
    return null;
  }

  getBusinessAtSpace(spaceId) {
    const all = this.getBusinessesAtSpace(spaceId);
    return all.length > 0 ? all[0] : null;
  }

  canPlayerBuildAt(player, spaceId) {
    const space = SPACES[spaceId];
    if (space.type !== 'property') return false;
    const slot = COLOR_SLOT[player.color];
    return !this.getBusinessAtSlot(spaceId, slot);
  }

  buildBusiness(player, type, spaceId) {
    const space = SPACES[spaceId];
    if (space.type !== 'property') return false;

    const slot = COLOR_SLOT[player.color];
    if (this.getBusinessAtSlot(spaceId, slot)) return false;

    const config = BUSINESS_TYPES[type];
    if (!player.canAfford(config.cost)) return false;

    player.pay(config.cost);
    const business = new Business(type, spaceId, player.id, slot);
    player.businesses.push(business);
    player.stats.businessesBuilt++;

    this.addLog(`${player.name} construiu ${business.label} na casa ${spaceId}`);
    this.onEvent('businessBuilt', { player, business });
    return true;
  }

  getBusinessIncome(business, owner) {
    return BonusCalculator.calculateIncome(business, owner.businesses, owner.color);
  }

  getPlayerPatrimony(player) {
    let total = player.money;
    for (const biz of player.businesses) {
      total += biz.cost;
    }
    return total;
  }

  getTotalPatrimony() {
    return this.activePlayers.reduce((sum, p) => sum + this.getPlayerPatrimony(p), 0);
  }

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
        return true;
      case 'mega_negocio':
        return player.businesses.some(biz => {
          const income = this.getBusinessIncome(biz, player);
          return income >= 2000;
        });
      default:
        return false;
    }
  }

  nextTurn() {
    if (!this.currentPlayer.bankrupt) {
      this.currentPlayer.tickEffects();
    }

    let next = (this.currentPlayerIndex + 1) % this.players.length;
    let attempts = 0;
    while (this.players[next].bankrupt && attempts < this.players.length) {
      next = (next + 1) % this.players.length;
      attempts++;
    }

    if (this.players[next].bankrupt) {
      this.gameOver = true;
      return;
    }

    this.currentPlayerIndex = next;

    if (next === 0) this.round++;

    if (this.roundLimit && this.round >= this.roundLimit) {
      this.gameOver = true;
      const richest = this.activePlayers.reduce((best, p) =>
        this.getPlayerPatrimony(p) > this.getPlayerPatrimony(best) ? p : best
      );
      this.winner = richest;
      this.addLog(`Limite de ${this.roundLimit} rodadas atingido! ${richest.name} venceu por patrimônio.`);
      this.onEvent('gameOver', { winner: richest, reason: `Mais rico após ${this.roundLimit} rodadas` });
      return;
    }

    this.turnPhase = 'ROLL';
    this.onEvent('turnChanged', { player: this.currentPlayer, round: this.round });
  }

  declareBankruptcy(player) {
    player.bankrupt = true;
    player.businesses = [];
    this.addLog(`${player.name} faliu!`);
    this.onEvent('bankruptcy', { player });

    if (this.activePlayers.length <= 1) {
      this.gameOver = true;
      this.winner = this.activePlayers[0];
      this.onEvent('gameOver', { winner: this.winner, reason: 'Último jogador em pé' });
    }
  }

  declareVictory(player, card) {
    this.gameOver = true;
    this.winner = player;
    this.addLog(`${player.name} venceu com ${card.name}!`);
    this.onEvent('gameOver', { winner: player, reason: card.name, card });
  }

  addLog(message) {
    this.log.push({ message, round: this.round, timestamp: Date.now() });
    this.onEvent('log', message);
  }

  serialize() {
    return {
      version: 1,
      timestamp: Date.now(),
      gameMode: this.gameMode,
      round: this.round,
      currentPlayerIndex: this.currentPlayerIndex,
      turnPhase: this.turnPhase,
      gameOver: this.gameOver,
      winnerId: this.winner ? this.winner.id : null,
      players: this.players.map(p => p.serialize()),
      drawPile: this.deck.drawPile.map(c => c.id),
      discardPile: this.deck.discardPile.map(c => c.id),
    };
  }

  static deserialize(data) {
    const playerConfigs = data.players.map(p => ({
      name: p.name,
      color: p.color,
      isBot: p.isBot,
    }));
    const gs = new GameState(playerConfigs, data.gameMode || 'classic');
    gs.round = data.round || 0;
    gs.currentPlayerIndex = data.currentPlayerIndex || 0;
    gs.turnPhase = data.turnPhase || 'ROLL';
    gs.gameOver = data.gameOver || false;

    for (const pd of data.players) {
      const player = gs.players.find(p => p.id === pd.id);
      if (!player) continue;
      player.money = pd.money;
      player.position = pd.position;
      player.laps = pd.laps;
      player.diceCount = pd.diceCount;
      player.bankrupt = pd.bankrupt;
      player.lastDice = pd.lastDice || null;
      player.effects = { ...pd.effects };
      if (pd.stats) player.stats = { ...pd.stats };

      player.cards = (pd.cards || [])
        .map(id => CARD_TYPES[id] ? { ...CARD_TYPES[id] } : null)
        .filter(Boolean);

      player.businesses = (pd.businesses || []).map(bd => {
        const biz = new Business(bd.type, bd.spaceId, player.id, bd.slot);
        biz.level = bd.level || 1;
        return biz;
      });
    }

    if (data.drawPile) {
      gs.deck.drawPile = data.drawPile
        .map(id => CARD_TYPES[id] ? { ...CARD_TYPES[id] } : null)
        .filter(Boolean);
    }
    if (data.discardPile) {
      gs.deck.discardPile = data.discardPile
        .map(id => CARD_TYPES[id] ? { ...CARD_TYPES[id] } : null)
        .filter(Boolean);
    }

    if (data.winnerId != null) {
      gs.winner = gs.players.find(p => p.id === data.winnerId) || null;
    }

    return gs;
  }
}
