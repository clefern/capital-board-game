// ========================================
// BonusCalculator - Cálculo de Bônus
// ========================================

import { BRAND_BONUS, REGION_BONUS_PER_BUSINESS, NEIGHBORHOOD_BONUS, REGION_RENT_TIER, RENT_TIER_MULTIPLIER } from '../config/constants.js';
import { SPACES, getAdjacentSpaces } from '../config/board-layout.js';

export class BonusCalculator {

  // Bônus de Marca: mesmo tipo de negócio em múltiplas regiões
  static getBrandBonus(business, playerBusinesses) {
    const sameType = playerBusinesses.filter(b => b.type === business.type);
    const regions = new Set(sameType.map(b => SPACES[b.spaceId].region));
    const regionCount = regions.size;
    return BRAND_BONUS[regionCount] || 0;
  }

  // Bônus de Região: negócios na própria região colorida
  static getRegionBonus(business, playerBusinesses, playerColor) {
    const space = SPACES[business.spaceId];
    if (space.region !== playerColor) return 0;

    const businessesInOwnRegion = playerBusinesses.filter(b => {
      const s = SPACES[b.spaceId];
      return s.region === playerColor;
    });

    return businessesInOwnRegion.length * REGION_BONUS_PER_BUSINESS;
  }

  // Bônus de Vizinhança: tipos diferentes de negócio adjacentes (do mesmo dono)
  static getNeighborhoodBonus(business, playerBusinesses) {
    const adjacentIds = getAdjacentSpaces(business.spaceId);
    const adjacentBusinesses = playerBusinesses.filter(b =>
      adjacentIds.includes(b.spaceId) && b.type !== business.type
    );

    const differentTypes = new Set(adjacentBusinesses.map(b => b.type));
    const count = differentTypes.size;
    return NEIGHBORHOOD_BONUS[count] || 0;
  }

  // Multiplicador de valorização da região (tier 1-4)
  static getRentTierMultiplier(business) {
    const space = SPACES[business.spaceId];
    const tier = REGION_RENT_TIER[space.region] || 1;
    return RENT_TIER_MULTIPLIER[tier] || 1;
  }

  // Multiplicador total de bônus (1 + soma de todos os bônus)
  static getTotalBonusMultiplier(business, playerBusinesses, playerColor) {
    const brand = this.getBrandBonus(business, playerBusinesses);
    const region = this.getRegionBonus(business, playerBusinesses, playerColor);
    const neighborhood = this.getNeighborhoodBonus(business, playerBusinesses);

    return 1 + brand + region + neighborhood;
  }

  // Renda final de um negócio com todos os bônus e valorização da região
  static calculateIncome(business, playerBusinesses, playerColor) {
    const multiplier = this.getTotalBonusMultiplier(business, playerBusinesses, playerColor);
    const rentTier = this.getRentTierMultiplier(business);
    return business.getIncome(multiplier * rentTier);
  }
}
