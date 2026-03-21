// ========================================
// Capital - Constantes do Jogo
// ========================================

export const STARTING_MONEY = 500;
export const STARTING_CARDS = 5;
export const STARTING_DICE = 2;
export const MAX_DICE = 4;
export const MIN_DICE = 1;

// Negócios: custo e renda base
export const BUSINESS_TYPES = {
  bar:                 { cost: 50,   baseIncome: 25,   label: 'Bar',              color: '#8B4513' },
  deposito:            { cost: 100,  baseIncome: 50,   label: 'Depósito',         color: '#696969' },
  supermercado:        { cost: 150,  baseIncome: 75,   label: 'Supermercado',     color: '#228B22' },
  galeria:             { cost: 250,  baseIncome: 125,  label: 'Galeria',          color: '#4169E1' },
  predio_comercial:    { cost: 500,  baseIncome: 250,  label: 'Prédio Comercial', color: '#8A2BE2' },
  shopping:            { cost: 1000, baseIncome: 500,  label: 'Shopping',         color: '#FF4500' },
  super_centro:        { cost: 1500, baseIncome: 750,  label: 'Super Centro',     color: '#FFD700' },
};

export const BUSINESS_ORDER = ['bar', 'deposito', 'supermercado', 'galeria', 'predio_comercial', 'shopping', 'super_centro'];

// Bônus de Marca (mesmo negócio em múltiplas regiões)
export const BRAND_BONUS = {
  2: 0.25,
  3: 0.50,
  4: 1.00,
};

// Bônus de Região (negócios na própria região colorida)
export const REGION_BONUS_PER_BUSINESS = 0.20;

// Bônus de Vizinhança (tipos diferentes adjacentes)
export const NEIGHBORHOOD_BONUS = {
  1: 0.25,
  2: 0.50,
  3: 0.75,
  4: 1.00,
  5: 1.50,
  6: 2.00,
};

// Level up
export const LEVEL_UP_BONUS = 0.20;

// Minigames
export const MINIGAME_DURATION_MS = 30000;

// Bolsa de Valores
export const STOCK_MAX_WIN = 500;
export const STOCK_MAX_LOSS = 300;

// Cores dos jogadores
export const PLAYER_COLORS = {
  yellow: { main: '#F2C94C', light: '#FFF3C4', dark: '#B7950B', label: 'Amarelo' },
  red:    { main: '#EB5757', light: '#FDCFCF', dark: '#A93226', label: 'Vermelho' },
  blue:   { main: '#2F80ED', light: '#BDD7F5', dark: '#1A5276', label: 'Azul' },
  green:  { main: '#27AE60', light: '#C4EDCB', dark: '#1E8449', label: 'Verde' },
};

export const PLAYER_COLOR_ORDER = ['yellow', 'red', 'blue', 'green'];

// Quadrante fixo de cada cor (slot 0-3 dentro da casa)
// ┌──┬──┐
// │0 │1 │  0=yellow, 1=red
// ├──┼──┤
// │2 │3 │  2=blue,   3=green
// └──┴──┘
export const COLOR_SLOT = { yellow: 0, red: 1, blue: 2, green: 3 };

// Vitória
export const VICTORY_CONDITIONS = {
  mais_rico:   { patrimonyPercent: 0.40, minLaps: 2 },
  empresario:  { minPatrimony: 7000 },
  jatinho:     { lapAdvantage: 2, cost: 500 },
  nadando:     { cost: 3000 },
  mega_negocio:{ minBusinessIncome: 2000, cost: 500 },
};

// Tipos de casas
export const SPACE_TYPES = {
  NEST: 'nest',
  PROPERTY: 'property',
  MINIGAME: 'minigame',
  STOCK_EXCHANGE: 'stock_exchange',
  BIFURCATION: 'bifurcation',
};
