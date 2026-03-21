// ========================================
// BoardRenderer - Casas divididas em 4 quadrantes
// ========================================
// Cada casa de propriedade é um quarteirão com 4 terrenos.
// Cada terreno pode ter uma construção.
// Casas conectadas sem espaço, separadas por suas bordas.

import { SPACES, BOARD_DIMENSIONS, SPACE_RENDER_SIZE, BOARD_CENTER, PATH_SEGMENTS } from '../config/board-layout.js';
import { PLAYER_COLORS, SPACE_TYPES, BUSINESS_TYPES } from '../config/constants.js';

export class BoardRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = BOARD_DIMENSIONS.width;
    this.height = BOARD_DIMENSIONS.height;
    canvas.width = this.width;
    canvas.height = this.height;
    this.cellSize = SPACE_RENDER_SIZE;
    this.hoveredSpace = null;
  }

  render(gameState) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawBoardBackground(ctx);
    this.drawRegionFills(ctx);
    this.drawAllPaths(ctx);
    this.drawSpaces(ctx, gameState);
    this.drawCenterLogo(ctx, gameState);
    this.drawPawns(ctx, gameState);
  }

  drawBoardBackground(ctx) {
    const grad = ctx.createRadialGradient(this.width / 2, this.height / 2, 200, this.width / 2, this.height / 2, 700);
    grad.addColorStop(0, '#1e5738');
    grad.addColorStop(1, '#0f2d1c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = '#2a7a4a';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, this.width - 8, this.height - 8);
  }

  drawRegionFills(ctx) {
    const mid = this.width / 2;
    const p = 25;
    const a = 0.08;
    ctx.fillStyle = `rgba(47,128,237,${a})`; ctx.fillRect(p, p, mid - p, mid - p);
    ctx.fillStyle = `rgba(242,201,76,${a})`; ctx.fillRect(mid, p, mid - p, mid - p);
    ctx.fillStyle = `rgba(235,87,87,${a})`;  ctx.fillRect(mid, mid, mid - p, mid - p);
    ctx.fillStyle = `rgba(39,174,96,${a})`;  ctx.fillRect(p, mid, mid - p, mid - p);
  }

  drawAllPaths(ctx) {
    for (const seg of PATH_SEGMENTS) {
      const isInner = seg.label.startsWith('inner');
      ctx.strokeStyle = isInner ? 'rgba(242,201,76,0.15)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = isInner ? 1.5 : 2;
      if (isInner) ctx.setLineDash([4, 3]);

      ctx.beginPath();
      const start = SPACES[seg.from];
      ctx.moveTo(start.position.x, start.position.y);
      for (const id of seg.path) {
        ctx.lineTo(SPACES[id].position.x, SPACES[id].position.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawSpaces(ctx, gameState) {
    for (const space of SPACES) {
      this.drawSpace(ctx, space, gameState);
    }
  }

  drawSpace(ctx, space, gameState) {
    const { x, y } = space.position;
    const s = this.cellSize;
    const h = s / 2;

    if (space.type === SPACE_TYPES.NEST) {
      this.drawNest(ctx, x, y, s, PLAYER_COLORS[space.nestColor]);
      return;
    }

    if (space.type === SPACE_TYPES.MINIGAME || space.type === SPACE_TYPES.STOCK_EXCHANGE) {
      this.drawSpecialSpace(ctx, x, y, s, space.type);
      return;
    }

    // === CASA DE PROPRIEDADE (quarteirão com 4 terrenos) ===
    const regionColor = space.region ? PLAYER_COLORS[space.region] : null;
    const bg = regionColor ? regionColor.light : '#e0e0e0';
    const border = regionColor ? regionColor.main : '#999';

    // Fundo da casa inteira
    ctx.fillStyle = bg;
    ctx.fillRect(x - h, y - h, s, s);

    // Borda externa
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - h, y - h, s, s);

    // Linhas divisórias dos 4 quadrantes
    ctx.strokeStyle = this.adjustAlpha(border, 0.5);
    ctx.lineWidth = 1;
    // Horizontal
    ctx.beginPath();
    ctx.moveTo(x - h + 1, y);
    ctx.lineTo(x + h - 1, y);
    ctx.stroke();
    // Vertical
    ctx.beginPath();
    ctx.moveTo(x, y - h + 1);
    ctx.lineTo(x, y + h - 1);
    ctx.stroke();

    // Desenhar negócios nos 4 slots
    if (gameState) {
      const businesses = gameState.getBusinessesAtSpace(space.id);
      for (const { business, owner } of businesses) {
        this.drawBusinessInSlot(ctx, x, y, s, business, owner);
      }
    }

    // Pedágio / Obstrução (ícone no canto)
    if (space.toll) {
      ctx.fillStyle = '#FF6600';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('$', x - h + 2, y - h + 1);
    }
    if (space.obstruction) {
      ctx.fillStyle = '#CC0000';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('✖', x + h - 2, y - h + 1);
    }

    // Hover
    if (this.hoveredSpace === space.id) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x - h, y - h, s, s);
    }
  }

  // Posição do centro de cada slot dentro da casa
  //  ┌──┬──┐
  //  │0 │1 │
  //  ├──┼──┤
  //  │2 │3 │
  //  └──┴──┘
  getSlotCenter(cx, cy, size, slot) {
    const q = size / 4;
    const offsets = [
      { x: -q, y: -q },  // 0: top-left
      { x: +q, y: -q },  // 1: top-right
      { x: -q, y: +q },  // 2: bottom-left
      { x: +q, y: +q },  // 3: bottom-right
    ];
    const o = offsets[slot] || offsets[0];
    return { x: cx + o.x, y: cy + o.y };
  }

  drawBusinessInSlot(ctx, cx, cy, size, business, owner) {
    const config = BUSINESS_TYPES[business.type];
    const { x, y } = this.getSlotCenter(cx, cy, size, business.slot);
    const qs = size / 2 - 2; // tamanho do quadrante

    // Mini prédio isométrico no quadrante
    const bw = Math.min(14, qs * 0.55);
    const bh = Math.min(12 + business.level * 1.5, qs * 0.8);
    const bx = x - bw / 2;
    const by = y - bh / 2 + 2;

    // Frente
    ctx.fillStyle = config.color;
    ctx.fillRect(bx, by, bw, bh);

    // Topo
    ctx.fillStyle = this.lightenColor(config.color, 40);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 3, by - 3);
    ctx.lineTo(bx + bw + 3, by - 3);
    ctx.lineTo(bx + bw, by);
    ctx.fill();

    // Lado
    ctx.fillStyle = this.darkenColor(config.color, 40);
    ctx.beginPath();
    ctx.moveTo(bx + bw, by);
    ctx.lineTo(bx + bw + 3, by - 3);
    ctx.lineTo(bx + bw + 3, by + bh - 3);
    ctx.lineTo(bx + bw, by + bh);
    ctx.fill();

    // Janelas
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const wRows = Math.min(business.level, 2);
    for (let r = 0; r < wRows; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillRect(bx + 2 + c * (bw / 2 - 1), by + 2 + r * 5, 3, 2);
      }
    }

    // Borda do dono (contorno do quadrante)
    ctx.strokeStyle = PLAYER_COLORS[owner.color].main;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);
  }

  drawNest(ctx, x, y, size, colors) {
    const s = size + 6;
    const h = s / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    this.roundRect(ctx, x - h + 2, y - h + 2, s, s, 6);
    ctx.fill();

    const grad = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, h);
    grad.addColorStop(0, colors.light || '#fff');
    grad.addColorStop(1, colors.main);
    ctx.fillStyle = grad;
    this.roundRect(ctx, x - h, y - h, s, s, 6);
    ctx.fill();

    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏠', x, y);
  }

  drawSpecialSpace(ctx, x, y, size, type) {
    const h = size / 2;
    const isMinigame = type === SPACE_TYPES.MINIGAME;

    ctx.fillStyle = isMinigame ? '#d4a5e8' : '#fad390';
    ctx.fillRect(x - h, y - h, size, size);

    ctx.strokeStyle = isMinigame ? '#9B59B6' : '#F39C12';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - h, y - h, size, size);

    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isMinigame ? '🎮' : '📊', x, y - 4);

    ctx.fillStyle = isMinigame ? '#5B2C6F' : '#7E5109';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(isMinigame ? 'MINIGAME' : 'BOLSA', x, y + 14);

    if (this.hoveredSpace != null) {
      const sp = SPACES.find(s => s.id === this.hoveredSpace);
      if (sp && sp.position.x === x && sp.position.y === y) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x - h, y - h, size, size);
      }
    }
  }

  // === PEÕES (cada cor tem seu quadrante fixo) ===
  static SLOT_MAP = { yellow: 0, red: 1, blue: 2, green: 3 };

  drawPawns(ctx, gameState) {
    if (!gameState) return;

    for (const player of gameState.activePlayers) {
      const slot = BoardRenderer.SLOT_MAP[player.color] ?? 0;
      let basex, basey;

      if (player._isAnimating) {
        basex = player._animX;
        basey = player._animY;
      } else {
        const sp = SPACES[player.position];
        basex = sp.position.x;
        basey = sp.position.y;
      }

      const off = this.getSlotCenter(0, 0, this.cellSize, slot);
      const px = basex + off.x;
      const py = basey + off.y;

      this.drawPawn(ctx, px, py, player, gameState.currentPlayer.id === player.id);
    }
  }

  drawPawn(ctx, px, py, player, isActive) {
    const c = PLAYER_COLORS[player.color];
    const sc = 0.5; // escala menor para caber no quadrante

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(px, py + 5 * sc, 7 * sc, 3 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // Base
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(px, py + 3 * sc, 7 * sc, 3.5 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // Corpo
    ctx.fillStyle = c.main;
    ctx.beginPath();
    ctx.moveTo(px - 5 * sc, py + 2 * sc);
    ctx.quadraticCurveTo(px - 5 * sc, py - 5 * sc, px, py - 9 * sc);
    ctx.quadraticCurveTo(px + 5 * sc, py - 5 * sc, px + 5 * sc, py + 2 * sc);
    ctx.fill();

    // Brilho
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(px - 1 * sc, py - 6 * sc, 2 * sc, 0, Math.PI * 2);
    ctx.fill();

    // Contorno
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 5 * sc, py + 2 * sc);
    ctx.quadraticCurveTo(px - 5 * sc, py - 5 * sc, px, py - 9 * sc);
    ctx.quadraticCurveTo(px + 5 * sc, py - 5 * sc, px + 5 * sc, py + 2 * sc);
    ctx.stroke();

    if (isActive) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.arc(px, py - 2 * sc, 8 * sc, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(px - 3, py - 12 * sc);
      ctx.lineTo(px + 3, py - 12 * sc);
      ctx.lineTo(px, py - 8 * sc);
      ctx.fill();
    }
  }

  drawCenterLogo(ctx, gameState) {
    const cx = BOARD_CENTER.x;
    const cy = BOARD_CENTER.y;

    ctx.fillStyle = 'rgba(15,25,35,0.88)';
    this.roundRect(ctx, cx - 100, cy - 55, 200, 110, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(242,201,76,0.5)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, cx - 100, cy - 55, 200, 110, 10);
    ctx.stroke();

    ctx.fillStyle = '#F2C94C';
    ctx.font = 'bold 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(242,201,76,0.3)';
    ctx.shadowBlur = 10;
    ctx.fillText('CAPITAL', cx, cy - 20);
    ctx.shadowBlur = 0;

    if (gameState) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Rodada ${gameState.round + 1} | ${gameState.deck.remainingCards} cartas`, cx, cy + 8);

      const cur = gameState.currentPlayer;
      ctx.fillStyle = PLAYER_COLORS[cur.color].main;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`▶ ${cur.name}`, cx, cy + 28);
    }
  }

  getSpaceAtPosition(mx, my) {
    const tol = this.cellSize / 2 + 4;
    for (const space of SPACES) {
      if (Math.abs(mx - space.position.x) < tol && Math.abs(my - space.position.y) < tol) {
        return space;
      }
    }
    return null;
  }

  adjustAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  lightenColor(hex, amt) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(255, r + amt)},${Math.min(255, g + amt)},${Math.min(255, b + amt)})`;
  }

  darkenColor(hex, amt) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.max(0, r - amt)},${Math.max(0, g - amt)},${Math.max(0, b - amt)})`;
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
