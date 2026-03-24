// ========================================
// Magnata - Layout do Tabuleiro
// ========================================
// Grid 11×9. Quatro molduras 4×4 nos cantos, cada uma com 2×2 vazio.
// Nests nos meios das bordas. Especiais extras antes de Blue e Red.
//
//  c c c c e e h c c c c     ← topo (seg4 frame | especiais | Blue | seg1 frame)
//  c     c       c     c
//  c     c       c     c
//  c c c c       c c c c     ← frames se fecham
//  h                   h     ← Green e Yellow (sozinhos na linha)
//  c c c c       c c c c     ← frames abrem
//  c     c       c     c
//  c     c       c     c
//  c c c c h e e c c c c     ← base (seg3 frame | Red | especiais | seg2 frame)
//
// Cada segmento: 1 home + 1 dep + 5 outer + 5 inner + 1 arr = 13
// Especiais: 4 extras (2 antes de Blue, 2 antes de Red)
// Total: 56 casas

import { SPACE_TYPES } from './constants.js';
const { NEST, PROPERTY, MINIGAME, STOCK_EXCHANGE } = SPACE_TYPES;

const CELL_W = 84;
const CELL_H = 72;
const BOARD_W = 11 * CELL_W;  // 924 — canvas exato para o grid 11×9
const BOARD_H = 9 * CELL_H;   // 648
const OFF_X = (BOARD_W - 10 * CELL_W) / 2;  // 42
const OFF_Y = (BOARD_H - 8 * CELL_H) / 2;   // 36

// Grid: col 0-10, row 0-8
function g(col, row) { return { x: OFF_X + col * CELL_W, y: OFF_Y + row * CELL_H }; }

function buildSpaces() {
  const s = [];
  let id = 0;
  function add(type, region, pos, extra = {}) {
    s.push({ id: id++, type, region, position: pos, businesses: [null,null,null,null], toll: null, obstruction: null, ...extra });
  }

  // ── Seg 1: Blue → Yellow (frame sup-dir, cols 7-10, rows 0-3) ──
  add(NEST, 'blue', g(6, 0), { nestColor: 'blue' });     // #0  h
  add(PROPERTY, 'blue', g(7, 0));                          // #1  dep
  // Outer: RIGHT→DOWN
  add(PROPERTY, 'blue', g(8, 0));                          // #2
  add(PROPERTY, 'blue', g(9, 0));                          // #3
  add(PROPERTY, 'blue', g(10, 0));                         // #4  TR corner
  add(PROPERTY, 'blue', g(10, 1));                         // #5
  add(PROPERTY, 'blue', g(10, 2));                         // #6
  // Inner: DOWN→RIGHT
  add(PROPERTY, 'blue', g(7, 1));                          // #7
  add(PROPERTY, 'blue', g(7, 2));                          // #8
  add(PROPERTY, 'blue', g(7, 3));                          // #9
  add(PROPERTY, 'blue', g(8, 3));                          // #10
  add(PROPERTY, 'blue', g(9, 3));                          // #11
  add(PROPERTY, 'blue', g(10, 3));                         // #12 arr

  // ── Seg 2: Yellow → Red (frame inf-dir, cols 7-10, rows 5-8) ──
  add(NEST, 'yellow', g(10, 4), { nestColor: 'yellow' }); // #13 h
  add(PROPERTY, 'yellow', g(10, 5));                        // #14 dep
  // Outer: DOWN→LEFT
  add(PROPERTY, 'yellow', g(10, 6));                        // #15
  add(PROPERTY, 'yellow', g(10, 7));                        // #16
  add(PROPERTY, 'yellow', g(10, 8));                        // #17 BR corner
  add(PROPERTY, 'yellow', g(9, 8));                         // #18
  add(PROPERTY, 'yellow', g(8, 8));                         // #19
  // Inner: LEFT→DOWN
  add(PROPERTY, 'yellow', g(9, 5));                         // #20
  add(PROPERTY, 'yellow', g(8, 5));                         // #21
  add(PROPERTY, 'yellow', g(7, 5));                         // #22
  add(PROPERTY, 'yellow', g(7, 6));                         // #23
  add(PROPERTY, 'yellow', g(7, 7));                         // #24
  add(PROPERTY, 'yellow', g(7, 8));                         // #25 arr
  // Especiais extras antes do Red
  add(STOCK_EXCHANGE, null, g(6, 8));                       // #26 BV
  add(MINIGAME, null, g(5, 8));                              // #27 MG

  // ── Seg 3: Red → Green (frame inf-esq, cols 0-3, rows 5-8) ──
  add(NEST, 'red', g(4, 8), { nestColor: 'red' });        // #28 h
  add(PROPERTY, 'red', g(3, 8));                            // #29 dep
  // Outer: LEFT→UP
  add(PROPERTY, 'red', g(2, 8));                            // #30
  add(PROPERTY, 'red', g(1, 8));                            // #31
  add(PROPERTY, 'red', g(0, 8));                            // #32 BL corner
  add(PROPERTY, 'red', g(0, 7));                            // #33
  add(PROPERTY, 'red', g(0, 6));                            // #34
  // Inner: UP→LEFT
  add(PROPERTY, 'red', g(3, 7));                            // #35
  add(PROPERTY, 'red', g(3, 6));                            // #36
  add(PROPERTY, 'red', g(3, 5));                            // #37
  add(PROPERTY, 'red', g(2, 5));                            // #38
  add(PROPERTY, 'red', g(1, 5));                            // #39
  add(PROPERTY, 'red', g(0, 5));                            // #40 arr

  // ── Seg 4: Green → Blue (frame sup-esq, cols 0-3, rows 0-3) ──
  add(NEST, 'green', g(0, 4), { nestColor: 'green' });    // #41 h
  add(PROPERTY, 'green', g(0, 3));                          // #42 dep
  // Outer: UP→RIGHT
  add(PROPERTY, 'green', g(0, 2));                          // #43
  add(PROPERTY, 'green', g(0, 1));                          // #44
  add(PROPERTY, 'green', g(0, 0));                          // #45 TL corner
  add(PROPERTY, 'green', g(1, 0));                          // #46
  add(PROPERTY, 'green', g(2, 0));                          // #47
  // Inner: RIGHT→UP
  add(PROPERTY, 'green', g(1, 3));                          // #48
  add(PROPERTY, 'green', g(2, 3));                          // #49
  add(PROPERTY, 'green', g(3, 3));                          // #50
  add(PROPERTY, 'green', g(3, 2));                          // #51
  add(PROPERTY, 'green', g(3, 1));                          // #52
  add(PROPERTY, 'green', g(3, 0));                          // #53 arr
  // Especiais extras antes do Blue
  add(MINIGAME, null, g(4, 0));                              // #54 MG
  add(STOCK_EXCHANGE, null, g(5, 0));                        // #55 BV

  return s;
}

export const SPACES = buildSpaces();
export const TOTAL_SPACES = SPACES.length;
export const NEST_POSITIONS = { blue: 0, yellow: 13, red: 28, green: 41 };

// Sem frame decorativo - as 4 molduras são independentes
export const INNER_DECO_POSITIONS = [];

// === CONEXÕES ===
const C = {};
// Seg 1 (Blue→Yellow)
C[0]=[1]; C[1]=[2,7];
C[2]=[3]; C[3]=[4]; C[4]=[5]; C[5]=[6]; C[6]=[12];
C[7]=[8]; C[8]=[9]; C[9]=[10]; C[10]=[11]; C[11]=[12];
C[12]=[13];
// Seg 2 (Yellow→Red + especiais)
C[13]=[14]; C[14]=[15,20];
C[15]=[16]; C[16]=[17]; C[17]=[18]; C[18]=[19]; C[19]=[25];
C[20]=[21]; C[21]=[22]; C[22]=[23]; C[23]=[24]; C[24]=[25];
C[25]=[26]; C[26]=[27]; C[27]=[28];
// Seg 3 (Red→Green)
C[28]=[29]; C[29]=[30,35];
C[30]=[31]; C[31]=[32]; C[32]=[33]; C[33]=[34]; C[34]=[40];
C[35]=[36]; C[36]=[37]; C[37]=[38]; C[38]=[39]; C[39]=[40];
C[40]=[41];
// Seg 4 (Green→Blue + especiais)
C[41]=[42]; C[42]=[43,48];
C[43]=[44]; C[44]=[45]; C[45]=[46]; C[46]=[47]; C[47]=[53];
C[48]=[49]; C[49]=[50]; C[50]=[51]; C[51]=[52]; C[52]=[53];
C[53]=[54]; C[54]=[55]; C[55]=[0];

export function getNextSpaces(id) { return C[id] || [0]; }
export function hasBifurcation(id) { const n = C[id]; return n && n.length > 1; }
export function getAdjacentSpaces(id) {
  const adj = [];
  for (const [f, ts] of Object.entries(C)) { if (ts.includes(id)) adj.push(parseInt(f)); }
  if (C[id]) adj.push(...C[id]);
  return adj;
}

export const PATH_SEGMENTS = [
  { from: 0,  path: [1,2,3,4,5,6,12,13], label: 'outerSeg1' },
  { from: 13, path: [14,15,16,17,18,19,25,26,27,28], label: 'outerSeg2' },
  { from: 28, path: [29,30,31,32,33,34,40,41], label: 'outerSeg3' },
  { from: 41, path: [42,43,44,45,46,47,53,54,55,0], label: 'outerSeg4' },
  { from: 1,  path: [7,8,9,10,11,12], label: 'innerSeg1' },
  { from: 14, path: [20,21,22,23,24,25], label: 'innerSeg2' },
  { from: 29, path: [35,36,37,38,39,40], label: 'innerSeg3' },
  { from: 42, path: [48,49,50,51,52,53], label: 'innerSeg4' },
];

export const BOARD_DIMENSIONS = { width: BOARD_W, height: BOARD_H };
export const SPACE_RENDER_W = CELL_W;
export const SPACE_RENDER_H = CELL_H;
export const BOARD_CENTER = { x: BOARD_W / 2, y: BOARD_H / 2 };

// Info dos jogadores no espaço 2×2 vazio DENTRO de cada moldura
// Centros calculados a partir de g(col,row) com CELL_W=84, CELL_H=72
export const PLAYER_INFO_POSITIONS = {
  blue:   { x: (g(8,0).x + g(9,0).x) / 2, y: (g(0,1).y + g(0,2).y) / 2 },
  yellow: { x: (g(8,0).x + g(9,0).x) / 2, y: (g(0,6).y + g(0,7).y) / 2 },
  red:    { x: (g(1,0).x + g(2,0).x) / 2, y: (g(0,6).y + g(0,7).y) / 2 },
  green:  { x: (g(1,0).x + g(2,0).x) / 2, y: (g(0,1).y + g(0,2).y) / 2 },
};
