// ========================================
// Deck - Baralho de Cartas
// ========================================

import { ALL_CARD_IDS, CARD_TYPES, COPIES_PER_CARD } from '../config/cards-data.js';

export class Deck {
  constructor() {
    this.drawPile = [];
    this.discardPile = [];
    this.init();
  }

  init() {
    this.drawPile = [];
    this.discardPile = [];

    // 4 cópias de cada uma das 23 cartas = 92
    for (const cardId of ALL_CARD_IDS) {
      for (let i = 0; i < COPIES_PER_CARD; i++) {
        this.drawPile.push({ ...CARD_TYPES[cardId], instanceId: `${cardId}_${i}` });
      }
    }

    this.shuffle();
  }

  shuffle() {
    // Fisher-Yates
    for (let i = this.drawPile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
    }
  }

  draw() {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length === 0) return null;
      this.drawPile = [...this.discardPile];
      this.discardPile = [];
      this.shuffle();
    }
    return this.drawPile.pop();
  }

  drawMultiple(count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
      const card = this.draw();
      if (card) cards.push(card);
    }
    return cards;
  }

  discard(card) {
    this.discardPile.push(card);
  }

  get remainingCards() {
    return this.drawPile.length;
  }
}
