// ========================================
// Player - Modelo do Jogador
// ========================================

import { STARTING_MONEY, STARTING_DICE } from '../config/constants.js';
import { NEST_POSITIONS } from '../config/board-layout.js';

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
    this.businesses = []; // { spaceId, type, level }
    this.laps = 0;
    this.diceCount = STARTING_DICE;

    // Efeitos ativos
    this.effects = {
      lebre: 0,         // turnos restantes com dados=6
      tartaruga: 0,     // turnos restantes com dados=1
      isencaoTaxas: 0,  // usos restantes
      isencaoNegocios: 0,// usos restantes
      contaTrancada: false, // dinheiro vai pra prefeitura
      miraLeao: false,   // próximo turno paga 50% à prefeitura
      cobrancaMafia: null, // { fromPlayerId } paga 30% ao jogador
    };

    this.bankrupt = false;

    // Estatísticas do jogo
    this.stats = {
      totalEarned: 0,
      totalSpent: 0,
      businessesBuilt: 0,
      cardsPlayed: 0,
    };
  }

  // Patrimônio total = dinheiro + valor dos negócios
  getPatrimony(gameState) {
    let total = this.money;
    for (const biz of this.businesses) {
      const { Business } = gameState.constructor;
      total += biz.getSellValue();
    }
    return total;
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
    this._moneyFlash = { amount: -amount, time: Date.now() };
    return this.money;
  }

  receive(amount) {
    if (this.effects.contaTrancada) {
      this.effects.contaTrancada = false;
      return 0;
    }
    this.money += amount;
    this.stats.totalEarned += amount;
    this._moneyFlash = { amount, time: Date.now() };
    return amount;
  }

  addCard(card) {
    this.cards.push(card);
  }

  removeCard(cardIndex) {
    return this.cards.splice(cardIndex, 1)[0];
  }

  // Rolar dados considerando efeitos
  rollDice() {
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

  // Decrementar efeitos temporários no início do turno
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
}
