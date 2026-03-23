// ========================================
// Player - Modelo do Jogador (Shared)
// ========================================

import { STARTING_MONEY, STARTING_DICE } from './constants.js';
import { NEST_POSITIONS } from './board-layout.js';

export class Player {
  constructor(id, color, name, isBot = false) {
    this.id = id;
    this.color = color;
    this.name = name || `Jogador ${id + 1}`;
    this.isBot = isBot;
    this.lastDice = null;
    this.money = STARTING_MONEY;
    this.position = NEST_POSITIONS[color];
    this.cards = [];
    this.businesses = [];
    this.laps = 0;
    this.diceCount = STARTING_DICE;

    this.effects = {
      lebre: 0,
      tartaruga: 0,
      isencaoTaxas: 0,
      isencaoNegocios: 0,
      contaTrancada: false,
      miraLeao: false,
      cobrancaMafia: null,
    };

    this.bankrupt = false;

    this.stats = {
      totalEarned: 0,
      totalSpent: 0,
      businessesBuilt: 0,
      cardsPlayed: 0,
    };
  }

  getTotalBusinessValue() {
    let total = 0;
    for (const biz of this.businesses) {
      total += biz.cost;
    }
    return total;
  }

  canAfford(amount) {
    return this.money >= amount;
  }

  pay(amount) {
    this.money -= amount;
    this.stats.totalSpent += amount;
    return this.money;
  }

  receive(amount) {
    if (this.effects.contaTrancada) {
      this.effects.contaTrancada = false;
      return 0;
    }
    this.money += amount;
    this.stats.totalEarned += amount;
    return amount;
  }

  addCard(card) {
    this.cards.push(card);
  }

  removeCard(cardIndex) {
    return this.cards.splice(cardIndex, 1)[0];
  }

  rollDice(predetermined = null) {
    if (predetermined) {
      this.lastDice = predetermined;
      return predetermined;
    }
    const results = [];
    for (let i = 0; i < this.diceCount; i++) {
      if (this.effects.lebre > 0) {
        results.push(6);
      } else if (this.effects.tartaruga > 0) {
        results.push(1);
      } else {
        results.push(Math.floor(Math.random() * 6) + 1);
      }
    }
    this.lastDice = results;
    return results;
  }

  tickEffects() {
    if (this.effects.lebre > 0) this.effects.lebre--;
    if (this.effects.tartaruga > 0) this.effects.tartaruga--;
  }

  resetEffects() {
    this.effects = {
      lebre: 0,
      tartaruga: 0,
      isencaoTaxas: 0,
      isencaoNegocios: 0,
      contaTrancada: false,
      miraLeao: false,
      cobrancaMafia: null,
    };
    this.diceCount = 2;
  }

  serialize() {
    return {
      id: this.id,
      color: this.color,
      name: this.name,
      isBot: this.isBot,
      money: this.money,
      position: this.position,
      laps: this.laps,
      diceCount: this.diceCount,
      bankrupt: this.bankrupt,
      lastDice: this.lastDice,
      effects: { ...this.effects },
      stats: { ...this.stats },
      cards: this.cards.map(c => c.id),
      businesses: this.businesses.map(b => ({
        type: b.type,
        spaceId: b.spaceId,
        slot: b.slot,
        level: b.level,
      })),
    };
  }
}
