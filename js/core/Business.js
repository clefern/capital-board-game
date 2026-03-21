// ========================================
// Business - Modelo de Negócio
// ========================================

import { BUSINESS_TYPES, LEVEL_UP_BONUS } from '../config/constants.js';

export class Business {
  constructor(type, spaceId, ownerId, slot = 0) {
    const config = BUSINESS_TYPES[type];
    if (!config) throw new Error(`Tipo de negócio inválido: ${type}`);

    this.type = type;
    this.spaceId = spaceId;
    this.ownerId = ownerId;
    this.slot = slot; // 0-3, qual quadrante da casa
    this.level = 1;
    this.cost = config.cost;
    this.baseIncome = config.baseIncome;
    this.label = config.label;
    this.color = config.color;
  }

  // Renda com multiplicador de nível (sem bônus externos)
  getLevelMultiplier() {
    return 1 + (this.level - 1) * LEVEL_UP_BONUS;
  }

  // Renda base * nível
  getBaseIncomeWithLevel() {
    return Math.floor(this.baseIncome * this.getLevelMultiplier());
  }

  // Renda final com todos os bônus
  getIncome(bonusMultiplier = 1) {
    return Math.floor(this.baseIncome * this.getLevelMultiplier() * bonusMultiplier);
  }

  // Valor de venda (metade do custo)
  getSellValue() {
    return Math.floor(this.cost / 2);
  }

  levelUp(levels = 1) {
    this.level += levels;
  }
}
