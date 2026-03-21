// ========================================
// Capital - Layout do Tabuleiro
// ========================================
// Ninhos (casas iniciais) ficam no MEIO de cada lado do tabuleiro.
// Os caminhos vão de ninho a ninho passando pelos cantos.
//
//                    [Nest Blue - meio do topo]
//                  /    outer(7)     inner(6)    \
//    canto TL ────                                ──── canto TR
//       |                                              |
//  [Nest Green]         (interior)           [Nest Yellow]
//   meio esquerdo                             meio direito
//       |                                              |
//    canto BL ────                                ──── canto BR
//                  \    outer(7)     inner(6)    /
//                    [Nest Red - meio da base]
//
// Em cada ninho, bifurcação: externo (7, pela borda) ou interno (6, pelo interior)

import { SPACE_TYPES } from './constants.js';
const { NEST, PROPERTY, MINIGAME, STOCK_EXCHANGE } = SPACE_TYPES;

const BOARD_W = 1050;
const BOARD_H = 1050;
const PAD = 35;
const CELL = 72;

// Cantos do tabuleiro (não têm casas, apenas pontos de referência para traçar caminhos)
const cornerTL = { x: PAD + CELL / 2, y: PAD + CELL / 2 };
const cornerTR = { x: BOARD_W - PAD - CELL / 2, y: PAD + CELL / 2 };
const cornerBR = { x: BOARD_W - PAD - CELL / 2, y: BOARD_H - PAD - CELL / 2 };
const cornerBL = { x: PAD + CELL / 2, y: BOARD_H - PAD - CELL / 2 };

// Ninhos no MEIO de cada lado
const midTop    = { x: BOARD_W / 2, y: PAD + CELL / 2 };           // Blue
const midRight  = { x: BOARD_W - PAD - CELL / 2, y: BOARD_H / 2 }; // Yellow
const midBottom = { x: BOARD_W / 2, y: BOARD_H - PAD - CELL / 2 }; // Red
const midLeft   = { x: PAD + CELL / 2, y: BOARD_H / 2 };           // Green

// Pontos interiores para caminhos internos (offset para dentro)
const INNER_OFF = 130;
function innerPoint(corner) {
  const cx = BOARD_W / 2, cy = BOARD_H / 2;
  const dx = corner.x - cx, dy = corner.y - cy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ratio = (len - INNER_OFF) / len;
  return { x: Math.round(cx + dx * ratio), y: Math.round(cy + dy * ratio) };
}

const innerTL = innerPoint(cornerTL);
const innerTR = innerPoint(cornerTR);
const innerBR = innerPoint(cornerBR);
const innerBL = innerPoint(cornerBL);

// Pontos internos dos ninhos (projetados para dentro)
const innerMidTop   = { x: midTop.x,    y: midTop.y + INNER_OFF };
const innerMidRight = { x: midRight.x - INNER_OFF, y: midRight.y };
const innerMidBot   = { x: midBottom.x, y: midBottom.y - INNER_OFF };
const innerMidLeft  = { x: midLeft.x + INNER_OFF,  y: midLeft.y };

function lerp(a, b, t) {
  return { x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) };
}

// Gera N posições uniformes entre dois pontos (passando por um ponto intermediário opcional)
function spacesViaCorner(from, corner, to, count) {
  // Distribui as casas ao longo do caminho from->corner->to
  const positions = [];
  const d1 = Math.hypot(corner.x - from.x, corner.y - from.y);
  const d2 = Math.hypot(to.x - corner.x, to.y - corner.y);
  const total = d1 + d2;
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    const dist = t * total;
    if (dist <= d1) {
      positions.push(lerp(from, corner, dist / d1));
    } else {
      positions.push(lerp(corner, to, (dist - d1) / d2));
    }
  }
  return positions;
}

function spacesAlongLine(from, to, count) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1);
    positions.push(lerp(from, to, t));
  }
  return positions;
}

// Caminhos externos (7 casas, passam pelos cantos)
const outerSeg1 = spacesViaCorner(midTop, cornerTR, midRight, 7);   // Blue->Yellow (topo-dir)
const outerSeg2 = spacesViaCorner(midRight, cornerBR, midBottom, 7); // Yellow->Red (dir-baixo)
const outerSeg3 = spacesViaCorner(midBottom, cornerBL, midLeft, 7);  // Red->Green (baixo-esq)
const outerSeg4 = spacesViaCorner(midLeft, cornerTL, midTop, 7);     // Green->Blue (esq-topo)

// Caminhos internos (6 casas, atalho pelo interior)
const innerSeg1 = spacesViaCorner(innerMidTop, innerTR, innerMidRight, 6);
const innerSeg2 = spacesViaCorner(innerMidRight, innerBR, innerMidBot, 6);
const innerSeg3 = spacesViaCorner(innerMidBot, innerBL, innerMidLeft, 6);
const innerSeg4 = spacesViaCorner(innerMidLeft, innerTL, innerMidTop, 6);

function buildSpaces() {
  const spaces = [];
  let id = 0;

  function add(type, region, position, extra = {}) {
    spaces.push({
      id: id++, type, region, position,
      businesses: [null, null, null, null],
      toll: null, obstruction: null,
      ...extra,
    });
  }

  // #0: Nest Blue (meio do topo)
  add(NEST, 'blue', midTop, { nestColor: 'blue' });

  // #1-7: Outer seg1 (Blue → Yellow, pelo canto TR)
  outerSeg1.forEach((pos, i) => {
    add(i === 3 ? MINIGAME : PROPERTY, i === 3 ? null : 'blue', pos);
  });

  // #8-13: Inner seg1
  innerSeg1.forEach(pos => add(PROPERTY, 'blue', pos));

  // #14: Nest Yellow (meio da direita)
  add(NEST, 'yellow', midRight, { nestColor: 'yellow' });

  // #15-21: Outer seg2 (Yellow → Red, pelo canto BR)
  outerSeg2.forEach((pos, i) => {
    add(i === 3 ? STOCK_EXCHANGE : PROPERTY, i === 3 ? null : 'yellow', pos);
  });

  // #22-27: Inner seg2
  innerSeg2.forEach(pos => add(PROPERTY, 'yellow', pos));

  // #28: Nest Red (meio da base)
  add(NEST, 'red', midBottom, { nestColor: 'red' });

  // #29-35: Outer seg3 (Red → Green, pelo canto BL)
  outerSeg3.forEach((pos, i) => {
    add(i === 3 ? MINIGAME : PROPERTY, i === 3 ? null : 'red', pos);
  });

  // #36-41: Inner seg3
  innerSeg3.forEach(pos => add(PROPERTY, 'red', pos));

  // #42: Nest Green (meio da esquerda)
  add(NEST, 'green', midLeft, { nestColor: 'green' });

  // #43-49: Outer seg4 (Green → Blue, pelo canto TL)
  outerSeg4.forEach((pos, i) => {
    add(i === 3 ? STOCK_EXCHANGE : PROPERTY, i === 3 ? null : 'green', pos);
  });

  // #50-55: Inner seg4
  innerSeg4.forEach(pos => add(PROPERTY, 'green', pos));

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
  { from: 0, path: [1, 2, 3, 4, 5, 6, 7, 14], label: 'outerSeg1' },
  { from: 14, path: [15, 16, 17, 18, 19, 20, 21, 28], label: 'outerSeg2' },
  { from: 28, path: [29, 30, 31, 32, 33, 34, 35, 42], label: 'outerSeg3' },
  { from: 42, path: [43, 44, 45, 46, 47, 48, 49, 0], label: 'outerSeg4' },
  { from: 0, path: [8, 9, 10, 11, 12, 13, 14], label: 'innerSeg1' },
  { from: 14, path: [22, 23, 24, 25, 26, 27, 28], label: 'innerSeg2' },
  { from: 28, path: [36, 37, 38, 39, 40, 41, 42], label: 'innerSeg3' },
  { from: 42, path: [50, 51, 52, 53, 54, 55, 0], label: 'innerSeg4' },
];

export const BOARD_DIMENSIONS = { width: BOARD_W, height: BOARD_H };
export const SPACE_RENDER_SIZE = CELL;
export const BOARD_CENTER = { x: BOARD_W / 2, y: BOARD_H / 2 };
