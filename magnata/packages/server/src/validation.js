// ========================================
// Validation - Validação de Inputs
// ========================================

// Limites máximos de score por tipo de minigame e dificuldade
const MINIGAME_LIMITS = {
  coinCatch:    { normal: { maxScore: 500, minTimeMs: 3000 }, hard: { maxScore: 350, minTimeMs: 3000 } },
  makeChange:   { normal: { maxScore: 400, minTimeMs: 2000 }, hard: { maxScore: 300, minTimeMs: 2000 } },
  memoryGame:   { normal: { maxScore: 600, minTimeMs: 5000 }, hard: { maxScore: 400, minTimeMs: 5000 } },
  findTheKey:   { normal: { maxScore: 300, minTimeMs: 1000 }, hard: { maxScore: 200, minTimeMs: 1000 } },
};

export class MinigameValidator {
  static validate(type, difficulty, score, timeMs) {
    const limits = MINIGAME_LIMITS[type]?.[difficulty];
    if (!limits) return Math.min(score, 300); // fallback

    // Score negativo ou não-número
    if (typeof score !== 'number' || score < 0 || isNaN(score)) return 0;

    // Muito rápido (provavelmente trapaça)
    if (timeMs < limits.minTimeMs) return 0;

    // Score acima do máximo possível
    if (score > limits.maxScore) return limits.maxScore;

    return Math.floor(score);
  }
}
