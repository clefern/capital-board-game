// ========================================
// Capital - Layout do Tabuleiro
// ========================================
// Cada casa de propriedade é um "quarteirão" com 4 terrenos (slots).
// Cada slot pode ter uma construção diferente.
// Casas são maiores e conectadas (sem espaço entre elas).
//
// Bifurcações nos ninhos: externo (7 casas pela borda) ou interno (6 pelo interior).

import { SPACE_TYPES } from './constants.js';
const { NEST, PROPERTY, MINIGAME, STOCK_EXCHANGE } = SPACE_TYPES;

const BOARD_W = 1050;
const BOARD_H = 1050;
const PAD = 35;
const CELL = 72; // tamanho de cada casa (maior, sem gap)

// Cantos do tabuleiro
const TL = { x: PAD + CELL / 2, y: PAD + CELL / 2 };
const TR = { x: BOARD_W - PAD - CELL / 2, y: PAD + CELL / 2 };
const BR = { x: BOARD_W - PAD - CELL / 2, y: BOARD_H - PAD - CELL / 2 };
const BL = { x: PAD + CELL / 2, y: BOARD_H - PAD - CELL / 2 };

// Margem interna para caminhos interiores
const INNER_OFF = 140;
const TL_IN = { x: TL.x + INNER_OFF, y: TL.y + INNER_OFF };
const TR_IN = { x: TR.x - INNER_OFF, y: TR.y + INNER_OFF };
const BR_IN = { x: BR.x - INNER_OFF, y: BR.y - INNER_OFF };
const BL_IN = { x: BL.x + INNER_OFF, y: BL.y - INNER_OFF };

function lerp(a, b, t) {
  return { x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) };
}

// Gera posições ao longo de uma linha, colando as casas (sem gap)
function spacesAlongLine(from, to, count) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    positions.push(lerp(from, to, t));
  }
  return positions;
}

// Caminhos
const outerTop    = spacesAlongLine(TL, TR, 7);
const innerTop    = spacesAlongLine(TL_IN, TR_IN, 6);
const outerRight  = spacesAlongLine(TR, BR, 7);
const innerRight  = spacesAlongLine(TR_IN, BR_IN, 6);
const outerBottom = spacesAlongLine(BR, BL, 7);
const innerBottom = spacesAlongLine(BR_IN, BL_IN, 6);
const outerLeft   = spacesAlongLine(BL, TL, 7);
const innerLeft   = spacesAlongLine(BL_IN, TL_IN, 6);

function buildSpaces() {
  const spaces = [];
  let id = 0;

  function add(type, region, position, extra = {}) {
    spaces.push({
      id: id++, type, region, position,
      businesses: [null, null, null, null], // 4 slots por casa
      toll: null, obstruction: null,
      ...extra,
    });
  }

  // #0: Nest Blue
  add(NEST, 'blue', TL, { nestColor: 'blue' });

  // #1-7: Outer top
  outerTop.forEach((pos, i) => {
    add(i === 3 ? MINIGAME : PROPERTY, i === 3 ? null : 'blue', pos);
  });

  // #8-13: Inner top
  innerTop.forEach(pos => add(PROPERTY, 'blue', pos));

  // #14: Nest Yellow
  add(NEST, 'yellow', TR, { nestColor: 'yellow' });

  // #15-21: Outer right
  outerRight.forEach((pos, i) => {
    add(i === 3 ? STOCK_EXCHANGE : PROPERTY, i === 3 ? null : 'yellow', pos);
  });

  // #22-27: Inner right
  innerRight.forEach(pos => add(PROPERTY, 'yellow', pos));

  // #28: Nest Red
  add(NEST, 'red', BR, { nestColor: 'red' });

  // #29-35: Outer bottom
  outerBottom.forEach((pos, i) => {
    add(i === 3 ? MINIGAME : PROPERTY, i === 3 ? null : 'red', pos);
  });

  // #36-41: Inner bottom
  innerBottom.forEach(pos => add(PROPERTY, 'red', pos));

  // #42: Nest Green
  add(NEST, 'green', BL, { nestColor: 'green' });

  // #43-49: Outer left
  outerLeft.forEach((pos, i) => {
    add(i === 3 ? STOCK_EXCHANGE : PROPERTY, i === 3 ? null : 'green', pos);
  });

  // #50-55: Inner left
  innerLeft.forEach(pos => add(PROPERTY, 'green', pos));

  return spaces;
}

export const SPACES = buildSpaces();
export const TOTAL_SPACES = SPACES.length;

export const NEST_POSITIONS = { blue: 0, yellow: 14, red: 28, green: 42 };

// === CONEXÕES ===
const CONNECTIONS = {};
CONNECTIONS[0]  = [1, 8];
CONNECTIONS[14] = [15, 22];
CONNECTIONS[28] = [29, 36];
CONNECTIONS[42] = [43, 50];

for (let i = 1; i <= 6; i++) CONNECTIONS[i] = [i + 1];
CONNECTIONS[7] = [14];
for (let i = 8; i <= 12; i++) CONNECTIONS[i] = [i + 1];
CONNECTIONS[13] = [14];

for (let i = 15; i <= 20; i++) CONNECTIONS[i] = [i + 1];
CONNECTIONS[21] = [28];
for (let i = 22; i <= 26; i++) CONNECTIONS[i] = [i + 1];
CONNECTIONS[27] = [28];

for (let i = 29; i <= 34; i++) CONNECTIONS[i] = [i + 1];
CONNECTIONS[35] = [42];
for (let i = 36; i <= 40; i++) CONNECTIONS[i] = [i + 1];
CONNECTIONS[41] = [42];

for (let i = 43; i <= 48; i++) CONNECTIONS[i] = [i + 1];
CONNECTIONS[49] = [0];
for (let i = 50; i <= 54; i++) CONNECTIONS[i] = [i + 1];
CONNECTIONS[55] = [0];

export function getNextSpaces(spaceId) {
  return CONNECTIONS[spaceId] || [0];
}

export function hasBifurcation(spaceId) {
  const next = CONNECTIONS[spaceId];
  return next && next.length > 1;
}

export function getAdjacentSpaces(spaceId) {
  const adj = [];
  for (const [from, tos] of Object.entries(CONNECTIONS)) {
    if (tos.includes(spaceId)) adj.push(parseInt(from));
  }
  const next = CONNECTIONS[spaceId];
  if (next) adj.push(...next);
  return adj;
}

export const PATH_SEGMENTS = [
  { from: 0, path: [1, 2, 3, 4, 5, 6, 7, 14], label: 'outerTop' },
  { from: 14, path: [15, 16, 17, 18, 19, 20, 21, 28], label: 'outerRight' },
  { from: 28, path: [29, 30, 31, 32, 33, 34, 35, 42], label: 'outerBottom' },
  { from: 42, path: [43, 44, 45, 46, 47, 48, 49, 0], label: 'outerLeft' },
  { from: 0, path: [8, 9, 10, 11, 12, 13, 14], label: 'innerTop' },
  { from: 14, path: [22, 23, 24, 25, 26, 27, 28], label: 'innerRight' },
  { from: 28, path: [36, 37, 38, 39, 40, 41, 42], label: 'innerBottom' },
  { from: 42, path: [50, 51, 52, 53, 54, 55, 0], label: 'innerLeft' },
];

export const BOARD_DIMENSIONS = { width: BOARD_W, height: BOARD_H };
export const SPACE_RENDER_SIZE = CELL;
export const BOARD_CENTER = { x: BOARD_W / 2, y: BOARD_H / 2 };
