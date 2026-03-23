// ========================================
// Business - Modelo de Negócio (Shared)
// ========================================

import { BUSINESS_TYPES, LEVEL_UP_BONUS } from './constants.js';

export class Business {
  constructor(type, spaceId, ownerId, slot = 0) {
    const config = BUSINESS_TYPES[type];
    if (!config) throw new Error(`Tipo de negócio inválido: ${type}`);

    this.type = type;
    this.spaceId = spaceId;
    this.ownerId = ownerId;
    this.slot = slot;
    this.level = 1;
    this.cost = config.cost;
    this.baseIncome = config.baseIncome;
    this.label = config.label;
    this.color = config.color;
  }

  getLevelMultiplier() {
    return 1 + (this.level - 1) * LEVEL_UP_BONUS;
  }

  getBaseIncomeWithLevel() {
    return Math.floor(this.baseIncome * this.getLevelMultiplier());
  }

  getIncome(bonusMultiplier = 1) {
    return Math.floor(this.baseIncome * this.getLevelMultiplier() * bonusMultiplier);
  }

  getSellValue() {
    return Math.floor(this.cost / 2);
  }

  levelUp(levels = 1) {
    this.level += levels;
  }

  serialize() {
    return {
      type: this.type,
      spaceId: this.spaceId,
      ownerId: this.ownerId,
      slot: this.slot,
      level: this.level,
    };
  }
}
