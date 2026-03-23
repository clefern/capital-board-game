// ========================================
// Deck - Baralho de Cartas (Shared)
// ========================================

import { ALL_CARD_IDS, CARD_TYPES, COPIES_PER_CARD } from './cards-data.js';

export class Deck {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.drawPile = [];
    this.discardPile = [];
    this.init();
  }

  init() {
    this.drawPile = [];
    this.discardPile = [];

    for (const cardId of ALL_CARD_IDS) {
      for (let i = 0; i < COPIES_PER_CARD; i++) {
        this.drawPile.push({ ...CARD_TYPES[cardId], instanceId: `${cardId}_${i}` });
      }
    }

    this.shuffle();
  }

  shuffle() {
    for (let i = this.drawPile.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
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
