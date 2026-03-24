// ========================================
// BoardRenderer - Tabuleiro retangular com casas coladas
// ========================================
// Dois retângulos concêntricos de casas coladas.
// Info dos jogadores nos espaços entre os retângulos.

import { SPACES, BOARD_DIMENSIONS, SPACE_RENDER_W, SPACE_RENDER_H, BOARD_CENTER, PATH_SEGMENTS, PLAYER_INFO_POSITIONS, INNER_DECO_POSITIONS } from '../config/board-layout.js';
import { PLAYER_COLORS, SPACE_TYPES, BUSINESS_TYPES, REGION_RENT_TIER, RENT_TIER_MULTIPLIER } from '../config/constants.js';
import { BonusCalculator } from '../core/BonusCalculator.js';
import { GameIcons } from '../ui/GameIcons.js';

const EFFECT_INFO = {
  lebre:           { icon: '🐇', name: 'Operação Lebre', desc: 'Dados sempre caem 6' },
  tartaruga:       { icon: '🐢', name: 'Operação Tartaruga', desc: 'Dados sempre caem 1' },
  isencaoTaxas:    { icon: '📜', name: 'Isenção de Taxas', desc: 'Pula pagamentos de taxas' },
  isencaoNegocios: { icon: '🏢', name: 'Isenção de Negócios', desc: 'Pula pagamentos a oponentes' },
  contaTrancada:   { icon: '🔒', name: 'Conta Trancada', desc: 'Próximo rendimento vai para o banco' },
  miraLeao:        { icon: '🦁', name: 'Na Mira do Leão', desc: 'Penalidade de 50% no próximo turno' },
  cobrancaMafia:   { icon: '🎩', name: 'Cobrança da Máfia', desc: '30% dos negócios vai para quem aplicou' },
};

export class BoardRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = BOARD_DIMENSIONS.width;
    this.height = BOARD_DIMENSIONS.height;
    canvas.width = this.width;
    canvas.height = this.height;
    this.cellW = SPACE_RENDER_W;
    this.cellH = SPACE_RENDER_H;
    this.hoveredSpace = null;
    this._effectHitboxes = [];
  }

  render(gameState) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this._currentPlayerPos = gameState ? gameState.currentPlayer.position : -1;
    this._effectHitboxes = [];
    this.drawBoardBackground(ctx);
    this.drawRegionFills(ctx);
    this.drawDecoInnerCells(ctx);
    this.drawSpaces(ctx, gameState);
    this.drawCenterLogo(ctx, gameState);
    this.drawPlayerInfoPanels(ctx, gameState);
    this.drawPawns(ctx, gameState);
  }

  drawBoardBackground(ctx) {
    const grad = ctx.createRadialGradient(this.width / 2, this.height / 2, 150, this.width / 2, this.height / 2, 600);
    grad.addColorStop(0, '#1e5738');
    grad.addColorStop(1, '#0f2d1c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = '#2a7a4a';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, this.width - 8, this.height - 8);
  }

  drawRegionFills(ctx) {
    const midX = this.width / 2;
    const midY = this.height / 2;
    const p = 20;
    const a = 0.06;
    ctx.fillStyle = `rgba(47,128,237,${a})`;  ctx.fillRect(p, p, midX - p, midY - p);
    ctx.fillStyle = `rgba(242,201,76,${a})`;  ctx.fillRect(midX, p, midX - p, midY - p);
    ctx.fillStyle = `rgba(235,87,87,${a})`;   ctx.fillRect(midX, midY, midX - p, midY - p);
    ctx.fillStyle = `rgba(39,174,96,${a})`;   ctx.fillRect(p, midY, midX - p, midY - p);
  }

  // Casas decorativas do retângulo interno (completam o frame visual)
  drawDecoInnerCells(ctx) {
    const w = this.cellW, h = this.cellH;
    const hw = w / 2, hh = h / 2;
    for (const pos of INNER_DECO_POSITIONS) {
      ctx.fillStyle = 'rgba(30,50,40,0.6)';
      ctx.fillRect(pos.x - hw, pos.y - hh, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pos.x - hw, pos.y - hh, w, h);
    }
  }

  drawSpaces(ctx, gameState) {
    for (const space of SPACES) {
      this.drawSpace(ctx, space, gameState);
    }
  }

  drawSpace(ctx, space, gameState) {
    const { x, y } = space.position;
    const w = this.cellW, h = this.cellH;
    const hw = w / 2, hh = h / 2;

    if (space.type === SPACE_TYPES.NEST) {
      this.drawNest(ctx, x, y, w, h, PLAYER_COLORS[space.nestColor]);
      return;
    }

    if (space.type === SPACE_TYPES.MINIGAME || space.type === SPACE_TYPES.STOCK_EXCHANGE) {
      this.drawSpecialSpace(ctx, x, y, w, h, space.type);
      return;
    }

    // === CASA DE PROPRIEDADE ===
    const regionColor = space.region ? PLAYER_COLORS[space.region] : null;
    const bg = regionColor ? regionColor.light : '#e0e0e0';
    const border = regionColor ? regionColor.main : '#999';

    ctx.fillStyle = bg;
    ctx.fillRect(x - hw, y - hh, w, h);

    ctx.strokeStyle = regionColor ? regionColor.dark : '#666';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - hw, y - hh, w, h);

    // Linhas divisórias dos 4 quadrantes
    ctx.strokeStyle = this.darkenColor(border, 30);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - hw + 1, y);
    ctx.lineTo(x + hw - 1, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - hh + 1);
    ctx.lineTo(x, y + hh - 1);
    ctx.stroke();

    // Negócios
    if (gameState) {
      const businesses = gameState.getBusinessesAtSpace(space.id);
      for (const { business, owner } of businesses) {
        this.drawBusinessInSlot(ctx, x, y, w, h, business, owner);
      }
    }

    // Pedágio — cancela com cor do jogador
    if (space.toll) {
      const tollOwner = gameState?.players?.[space.toll.ownerId];
      const tollColor = tollOwner ? PLAYER_COLORS[tollOwner.color] : { main: '#FF6600', dark: '#CC5500' };
      ctx.save();
      ctx.fillStyle = this.adjustAlpha(tollColor.main, 0.12);
      ctx.fillRect(x - hw, y - hh, w, h);

      const barY = y - 4;
      const barHt = 6;
      ctx.fillStyle = tollColor.main;
      ctx.fillRect(x - hw + 2, barY, w - 4, barHt);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      for (let lx = x - hw + 6; lx < x + hw - 2; lx += 8) {
        ctx.beginPath();
        ctx.moveTo(lx, barY);
        ctx.lineTo(lx + barHt, barY + barHt);
        ctx.stroke();
      }

      ctx.fillStyle = tollColor.dark || tollColor.main;
      ctx.fillRect(x - hw + 3, barY, 4, hh + 4);

      const cr = 12;
      ctx.fillStyle = tollColor.main;
      ctx.beginPath();
      ctx.arc(x, y + 6, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', x, y + 7);

      ctx.restore();
    }

    // Obstrução — cone com cor do jogador
    if (space.obstruction) {
      const obsOwner = gameState?.players?.[space.obstruction.ownerId];
      const obsColor = obsOwner ? PLAYER_COLORS[obsOwner.color] : { main: '#CC0000', dark: '#990000' };
      ctx.save();
      ctx.fillStyle = this.adjustAlpha(obsColor.main, 0.12);
      ctx.fillRect(x - hw, y - hh, w, h);

      const ty = y - 2;
      const tw = 22, th = 20;
      ctx.fillStyle = obsColor.dark || obsColor.main;
      ctx.beginPath();
      ctx.moveTo(x, ty - th / 2);
      ctx.lineTo(x - tw / 2, ty + th / 2);
      ctx.lineTo(x + tw / 2, ty + th / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', x, ty + 2);

      ctx.fillStyle = obsColor.dark || obsColor.main;
      ctx.fillRect(x - 14, y + 10, 28, 5);
      ctx.fillStyle = obsColor.main;
      for (let lx = x - 12; lx < x + 12; lx += 8) {
        ctx.fillRect(lx, y + 10, 4, 5);
      }

      ctx.restore();
    }

    // Hover
    if (this.hoveredSpace === space.id) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x - hw, y - hh, w, h);
    }

    // Destaque pulsante na casa do jogador atual
    if (this._currentPlayerPos === space.id) {
      const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 300);
      ctx.strokeStyle = `rgba(255,215,0,${pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - hw - 1, y - hh - 1, w + 2, h + 2);
    }
  }

  getSlotCenter(cx, cy, cellW, cellH, slot) {
    const qw = cellW / 4;
    const qh = cellH / 4;
    const offsets = [
      { x: -qw, y: -qh },
      { x: +qw, y: -qh },
      { x: -qw, y: +qh },
      { x: +qw, y: +qh },
    ];
    const o = offsets[slot] || offsets[0];
    return { x: cx + o.x, y: cy + o.y };
  }

  drawBusinessInSlot(ctx, cx, cy, cellW, cellH, business, owner) {
    const config = BUSINESS_TYPES[business.type];
    const { x, y } = this.getSlotCenter(cx, cy, cellW, cellH, business.slot);
    const hsw = cellW / 4;
    const hsh = cellH / 4;
    const pad = 2;
    const sx = x - hsw + pad;
    const sy = y - hsh + pad;
    const sw = hsw * 2 - pad * 2;
    const sh = hsh * 2 - pad * 2;

    // Fundo do slot
    ctx.fillStyle = this.darkenColor(config.color, 30);
    ctx.fillRect(sx, sy, sw, sh);

    // Desenho específico por tipo
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.clip();

    switch (business.type) {
      case 'bar': this.drawBar(ctx, sx, sy, sw, sh, config.color); break;
      case 'deposito': this.drawDeposito(ctx, sx, sy, sw, sh, config.color); break;
      case 'supermercado': this.drawSupermercado(ctx, sx, sy, sw, sh, config.color); break;
      case 'galeria': this.drawGaleria(ctx, sx, sy, sw, sh, config.color); break;
      case 'predio_comercial': this.drawPredioComercial(ctx, sx, sy, sw, sh, config.color); break;
      case 'shopping': this.drawShopping(ctx, sx, sy, sw, sh, config.color); break;
      case 'super_centro': this.drawSuperCentro(ctx, sx, sy, sw, sh, config.color); break;
    }

    ctx.restore();

    // Borda com cor do dono
    ctx.strokeStyle = PLAYER_COLORS[owner.color].main;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, sw, sh);

    // Indicador de bônus (borda dourada brilhante)
    const bonusMult = BonusCalculator.getTotalBonusMultiplier(business, owner.businesses, owner.color);
    if (bonusMult > 1) {
      const glow = 0.4 + 0.3 * Math.sin(Date.now() / 600);
      ctx.strokeStyle = `rgba(255,215,0,${glow})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx - 1, sy - 1, sw + 2, sh + 2);
    }

    // Nível (badge)
    if (business.level > 1) {
      const bsz = 12;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(sx + sw - bsz, sy + sh - bsz, bsz, bsz);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${business.level}`, sx + sw - bsz / 2, sy + sh - bsz / 2);
    }
  }

  // ── BAR: casinha simples com toldo ──
  drawBar(ctx, sx, sy, sw, sh, color) {
    const cx = sx + sw / 2;
    // Parede
    ctx.fillStyle = color;
    ctx.fillRect(sx + 4, sy + sh * 0.35, sw - 8, sh * 0.6);
    // Toldo listrado
    ctx.fillStyle = this.lightenColor(color, 60);
    ctx.fillRect(sx + 2, sy + sh * 0.28, sw - 4, sh * 0.12);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      if (i % 2 === 0) ctx.fillRect(sx + 2 + i * (sw - 4) / 4, sy + sh * 0.28, (sw - 4) / 4, sh * 0.12);
    }
    // Porta
    ctx.fillStyle = this.darkenColor(color, 40);
    ctx.fillRect(cx - 3, sy + sh * 0.65, 6, sh * 0.3);
    // Telhado triangular
    ctx.fillStyle = this.darkenColor(color, 20);
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy + sh * 0.35);
    ctx.lineTo(cx, sy + sh * 0.1);
    ctx.lineTo(sx + sw - 2, sy + sh * 0.35);
    ctx.fill();
  }

  // ── DEPÓSITO: galpão com portão ──
  drawDeposito(ctx, sx, sy, sw, sh, color) {
    // Galpão
    ctx.fillStyle = color;
    ctx.fillRect(sx + 3, sy + sh * 0.3, sw - 6, sh * 0.65);
    // Teto curvo (arco)
    ctx.fillStyle = this.lightenColor(color, 30);
    ctx.beginPath();
    ctx.moveTo(sx + 3, sy + sh * 0.35);
    ctx.quadraticCurveTo(sx + sw / 2, sy + sh * 0.05, sx + sw - 3, sy + sh * 0.35);
    ctx.lineTo(sx + sw - 3, sy + sh * 0.3);
    ctx.lineTo(sx + 3, sy + sh * 0.3);
    ctx.fill();
    // Portão
    ctx.fillStyle = this.darkenColor(color, 50);
    ctx.fillRect(sx + sw * 0.2, sy + sh * 0.5, sw * 0.6, sh * 0.45);
    // Linhas do portão
    ctx.strokeStyle = this.darkenColor(color, 70);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + sw * 0.5, sy + sh * 0.5);
    ctx.lineTo(sx + sw * 0.5, sy + sh * 0.95);
    ctx.stroke();
  }

  // ── SUPERMERCADO: fachada com vitrine ──
  drawSupermercado(ctx, sx, sy, sw, sh, color) {
    // Prédio
    ctx.fillStyle = color;
    ctx.fillRect(sx + 2, sy + sh * 0.2, sw - 4, sh * 0.75);
    // Letreiro topo
    ctx.fillStyle = this.lightenColor(color, 50);
    ctx.fillRect(sx + 2, sy + sh * 0.15, sw - 4, sh * 0.12);
    // Vitrines (2)
    ctx.fillStyle = 'rgba(173,216,230,0.7)';
    ctx.fillRect(sx + 5, sy + sh * 0.4, sw * 0.35, sh * 0.3);
    ctx.fillRect(sx + sw * 0.55, sy + sh * 0.4, sw * 0.35, sh * 0.3);
    // Porta
    ctx.fillStyle = this.darkenColor(color, 40);
    ctx.fillRect(sx + sw / 2 - 3, sy + sh * 0.7, 6, sh * 0.25);
    // Carrinho (ícone simples)
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.floor(sh * 0.2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛒', sx + sw / 2, sy + sh * 0.15 + sh * 0.06);
  }

  // ── GALERIA: fachada elegante com colunas ──
  drawGaleria(ctx, sx, sy, sw, sh, color) {
    // Prédio
    ctx.fillStyle = color;
    ctx.fillRect(sx + 2, sy + sh * 0.25, sw - 4, sh * 0.7);
    // Frontão triangular
    ctx.fillStyle = this.lightenColor(color, 40);
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy + sh * 0.25);
    ctx.lineTo(sx + sw / 2, sy + sh * 0.05);
    ctx.lineTo(sx + sw - 2, sy + sh * 0.25);
    ctx.fill();
    // Colunas (3)
    ctx.fillStyle = this.lightenColor(color, 60);
    for (let i = 0; i < 3; i++) {
      const cx = sx + sw * 0.2 + i * sw * 0.3;
      ctx.fillRect(cx - 2, sy + sh * 0.25, 4, sh * 0.65);
    }
    // Janelas arredondadas entre colunas
    ctx.fillStyle = 'rgba(200,180,255,0.5)';
    ctx.fillRect(sx + sw * 0.27, sy + sh * 0.4, sw * 0.18, sh * 0.2);
    ctx.fillRect(sx + sw * 0.57, sy + sh * 0.4, sw * 0.18, sh * 0.2);
  }

  // ── PRÉDIO COMERCIAL: torre com andares ──
  drawPredioComercial(ctx, sx, sy, sw, sh, color) {
    const tw = sw * 0.65;
    const tx = sx + (sw - tw) / 2;
    // Torre
    ctx.fillStyle = color;
    ctx.fillRect(tx, sy + sh * 0.1, tw, sh * 0.85);
    // Andares (linhas horizontais)
    ctx.strokeStyle = this.darkenColor(color, 30);
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      const ly = sy + sh * 0.1 + i * (sh * 0.85) / 6;
      ctx.beginPath();
      ctx.moveTo(tx, ly);
      ctx.lineTo(tx + tw, ly);
      ctx.stroke();
    }
    // Janelas (grade)
    ctx.fillStyle = 'rgba(180,200,255,0.6)';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillRect(tx + 4 + c * (tw / 2 - 2), sy + sh * 0.15 + r * sh * 0.14, tw / 2 - 6, sh * 0.08);
      }
    }
    // Topo (antena)
    ctx.strokeStyle = this.lightenColor(color, 30);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2, sy + sh * 0.1);
    ctx.lineTo(sx + sw / 2, sy + sh * 0.02);
    ctx.stroke();
    ctx.fillStyle = '#f00';
    ctx.beginPath();
    ctx.arc(sx + sw / 2, sy + sh * 0.02, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── SHOPPING: prédio largo com letreiro ──
  drawShopping(ctx, sx, sy, sw, sh, color) {
    // Prédio principal
    ctx.fillStyle = color;
    ctx.fillRect(sx + 2, sy + sh * 0.2, sw - 4, sh * 0.75);
    // Letreiro grande
    ctx.fillStyle = this.lightenColor(color, 50);
    ctx.fillRect(sx + 2, sy + sh * 0.12, sw - 4, sh * 0.13);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(sh * 0.1)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SHOP', sx + sw / 2, sy + sh * 0.19);
    // Vitrines (3)
    ctx.fillStyle = 'rgba(255,200,100,0.5)';
    for (let i = 0; i < 3; i++) {
      const vx = sx + 4 + i * (sw - 8) / 3;
      ctx.fillRect(vx + 1, sy + sh * 0.4, (sw - 12) / 3, sh * 0.25);
    }
    // Entrada grande
    ctx.fillStyle = this.darkenColor(color, 50);
    ctx.fillRect(sx + sw * 0.3, sy + sh * 0.7, sw * 0.4, sh * 0.25);
    // Portas duplas
    ctx.strokeStyle = this.darkenColor(color, 70);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + sw * 0.5, sy + sh * 0.7);
    ctx.lineTo(sx + sw * 0.5, sy + sh * 0.95);
    ctx.stroke();
  }

  // ── SUPER CENTRO: arranha-céu dourado com coroa ──
  drawSuperCentro(ctx, sx, sy, sw, sh, color) {
    const tw = sw * 0.55;
    const tx = sx + (sw - tw) / 2;
    // Torre principal
    ctx.fillStyle = color;
    ctx.fillRect(tx, sy + sh * 0.15, tw, sh * 0.8);
    // Gradiente dourado
    const grad = ctx.createLinearGradient(tx, sy, tx + tw, sy + sh);
    grad.addColorStop(0, this.lightenColor(color, 40));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, this.darkenColor(color, 40));
    ctx.fillStyle = grad;
    ctx.fillRect(tx, sy + sh * 0.15, tw, sh * 0.8);
    // Janelas brilhantes
    ctx.fillStyle = 'rgba(255,255,200,0.6)';
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillRect(tx + 3 + c * (tw / 2 - 1), sy + sh * 0.2 + r * sh * 0.11, tw / 2 - 5, sh * 0.06);
      }
    }
    // Pináculo/coroa no topo
    ctx.fillStyle = this.lightenColor(color, 60);
    ctx.beginPath();
    ctx.moveTo(sx + sw / 2 - 5, sy + sh * 0.15);
    ctx.lineTo(sx + sw / 2, sy + sh * 0.02);
    ctx.lineTo(sx + sw / 2 + 5, sy + sh * 0.15);
    ctx.fill();
    // Estrela no topo
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.floor(sh * 0.15)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', sx + sw / 2, sy + sh * 0.06);
    // Base alargada
    ctx.fillStyle = this.darkenColor(color, 20);
    ctx.fillRect(sx + 3, sy + sh * 0.85, sw - 6, sh * 0.1);
  }

  drawNest(ctx, x, y, w, h, colors) {
    const hw = w / 2, hh = h / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    this.roundRect(ctx, x - hw + 2, y - hh + 2, w, h, 4);
    ctx.fill();

    const grad = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, Math.min(hw, hh));
    grad.addColorStop(0, colors.light || '#fff');
    grad.addColorStop(1, colors.main);
    ctx.fillStyle = grad;
    this.roundRect(ctx, x - hw, y - hh, w, h, 4);
    ctx.fill();

    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 2;
    ctx.stroke();

    GameIcons.drawNest(ctx, x, y, Math.min(w, h) * 0.7, colors.main);
  }

  drawSpecialSpace(ctx, x, y, w, h, type) {
    const hw = w / 2, hh = h / 2;
    const isMinigame = type === SPACE_TYPES.MINIGAME;

    ctx.fillStyle = isMinigame ? '#d4a5e8' : '#fad390';
    ctx.fillRect(x - hw, y - hh, w, h);

    ctx.strokeStyle = isMinigame ? '#9B59B6' : '#F39C12';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - hw, y - hh, w, h);

    const iconSize = Math.min(w, h) * 0.65;
    if (isMinigame) {
      GameIcons.drawMinigame(ctx, x, y - 4, iconSize, '#d4a5e8');
    } else {
      GameIcons.drawStockExchange(ctx, x, y - 4, iconSize, '#fad390');
    }

    ctx.fillStyle = isMinigame ? '#5B2C6F' : '#7E5109';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText(isMinigame ? 'MINIGAME' : 'BOLSA', x, y + 16);

    if (this.hoveredSpace != null) {
      const sp = SPACES.find(s => s.id === this.hoveredSpace);
      if (sp && sp.position.x === x && sp.position.y === y) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x - hw, y - hh, w, h);
      }
    }
  }

  // === PAINÉIS DE INFO DOS JOGADORES ===
  drawPlayerInfoPanels(ctx, gameState) {
    if (!gameState) return;

    for (const player of gameState.players) {
      const pos = PLAYER_INFO_POSITIONS[player.color];
      if (!pos) continue;

      const colors = PLAYER_COLORS[player.color];
      const tier = REGION_RENT_TIER[player.color] || 1;
      const mult = RENT_TIER_MULTIPLIER[tier] || 1;
      const pw = 2 * this.cellW - 8, ph = 2 * this.cellH - 8;
      const px = pos.x - pw / 2;
      const py = pos.y - ph / 2;
      const isActive = gameState.currentPlayer.id === player.id;

      ctx.save();

      // Fundo
      ctx.globalAlpha = player.bankrupt ? 0.3 : 0.92;
      ctx.fillStyle = 'rgba(10,15,25,0.85)';
      this.roundRect(ctx, px, py, pw, ph, 8);
      ctx.fill();

      // Borda (dourada se ativo)
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isActive ? '#FFD700' : colors.main;
      ctx.lineWidth = isActive ? 3 : 2;
      this.roundRect(ctx, px, py, pw, ph, 8);
      ctx.stroke();

      // Faixa de cor no topo
      ctx.fillStyle = colors.main;
      ctx.globalAlpha = 0.3;
      this.roundRect(ctx, px + 2, py + 2, pw - 4, 26, 6);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (player.bankrupt) {
        ctx.fillStyle = '#EB5757';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('FALIDO', pos.x, pos.y);
        ctx.restore();
        continue;
      }

      const lx = px + 12;
      let ly = py + 15;

      // ── Barra do topo: Nome (esq) + Saldo (dir) ──
      const moneyStr = `$${player.money}`;
      ctx.font = 'bold 12px sans-serif';
      ctx.textBaseline = 'middle';

      // Medir saldo para saber espaço do nome
      const moneyW = ctx.measureText(moneyStr).width;
      const maxNameW = pw - 24 - moneyW - 8; // margem esq + dir + gap

      // Nome com ellipsis
      const rawName = `${player.isBot ? '🤖 ' : ''}${player.name}`;
      let displayName = rawName;
      if (ctx.measureText(rawName).width > maxNameW) {
        while (displayName.length > 1 && ctx.measureText(displayName + '…').width > maxNameW) {
          displayName = displayName.slice(0, -1);
        }
        displayName += '…';
      }
      ctx.fillStyle = colors.light;
      ctx.textAlign = 'left';
      ctx.fillText(displayName, lx, ly);

      // Saldo à direita
      ctx.fillStyle = player.money < 0 ? '#EB5757' : '#4ADE80';
      ctx.textAlign = 'right';
      ctx.fillText(moneyStr, px + pw - 10, ly);
      ctx.textAlign = 'left';

      // Flash de mudança de dinheiro
      if (player._moneyFlash) {
        const elapsed = Date.now() - player._moneyFlash.time;
        if (elapsed < 1500) {
          const alpha = 1 - elapsed / 1500;
          const amt = player._moneyFlash.amount;
          ctx.fillStyle = amt > 0 ? `rgba(74,222,128,${alpha})` : `rgba(248,113,113,${alpha})`;
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${amt > 0 ? '+' : ''}${amt}`, px + pw - 10, ly + 12 - elapsed * 0.008);
          ctx.textAlign = 'left';
        } else {
          player._moneyFlash = null;
        }
      }

      // ── Dados visuais ──
      ly += 24;
      if (player.lastDice) {
        const dSize = 24;
        const dGap = 5;
        const total = player.lastDice.reduce((a, b) => a + b, 0);
        for (let di = 0; di < player.lastDice.length; di++) {
          const dx = lx + di * (dSize + dGap);
          const dy = ly - dSize / 2;
          this._drawDieFace(ctx, dx, dy, dSize, player.lastDice[di]);
        }
        // Total
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`= ${total}`, px + pw - 10, ly);
        ctx.textAlign = 'left';
      } else {
        ctx.fillStyle = '#4a5568';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('—', lx, ly);
      }

      // ── Linha separadora ──
      ly += 12;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(px + pw - 12, ly);
      ctx.stroke();

      // ── Stats em grid 2×2 ──
      ly += 14;
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#cbd5e1';
      const col2 = px + pw / 2 + 4;

      // Linha 1: Negócios | Cartas
      ctx.textAlign = 'left';
      ctx.fillText(`🏢 ${player.businesses.length}`, lx, ly);
      ctx.fillText(`🃏 ${player.cards.length}`, col2, ly);

      // Linha 2: Dados | Voltas
      ly += 22;
      ctx.fillText(`🎲 ${player.diceCount}`, lx, ly);
      ctx.fillText(`🔄 ${player.laps}`, col2, ly);

      // ── Barras de valorização (tier) ──
      ly += 22;
      const barW = (pw - 34) / 4;
      const barH = 12;
      const barGap = 3;
      for (let i = 0; i < 4; i++) {
        const bx = lx + i * (barW + barGap);
        const active = i < tier;
        if (active) {
          const intensity = 0.4 + (i / 3) * 0.6;
          ctx.fillStyle = this.adjustAlpha(colors.main, intensity);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
        }
        this.roundRect(ctx, bx, ly - barH / 2, barW, barH, 3);
        ctx.fill();
      }

      // Multiplicador
      ctx.fillStyle = colors.light;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`x${mult.toFixed(1)}`, px + pw - 10, ly);

      // ── Ícones de efeitos ativos ──
      if (player.effects) {
        const activeEffects = [];
        for (const [key, info] of Object.entries(EFFECT_INFO)) {
          const val = player.effects[key];
          if (val && val !== false) {
            activeEffects.push({ ...info, key, duration: typeof val === 'number' ? val : null });
          }
        }
        if (activeEffects.length > 0) {
          ly += 16;
          const iconSize = 18;
          const gap = 4;
          let ix = lx;
          ctx.font = `${iconSize - 2}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          for (const eff of activeEffects) {
            // Fundo do ícone
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            this.roundRect(ctx, ix, ly - iconSize / 2, iconSize, iconSize, 3);
            ctx.fill();
            // Ícone
            ctx.fillStyle = '#fff';
            ctx.fillText(eff.icon, ix + iconSize / 2, ly + 1);
            // Badge de duração
            if (eff.duration !== null && eff.duration > 0) {
              ctx.fillStyle = 'rgba(0,0,0,0.7)';
              ctx.beginPath();
              ctx.arc(ix + iconSize - 2, ly - iconSize / 2 + 3, 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#FFD700';
              ctx.font = 'bold 8px sans-serif';
              ctx.fillText(`${eff.duration}`, ix + iconSize - 2, ly - iconSize / 2 + 3.5);
              ctx.font = `${iconSize - 2}px sans-serif`;
            }
            // Guardar hitbox para tooltip
            this._effectHitboxes.push({
              x: ix, y: ly - iconSize / 2, w: iconSize, h: iconSize,
              icon: eff.icon, name: eff.name, desc: eff.desc,
              duration: eff.duration,
            });
            ix += iconSize + gap;
          }
        }
      }

      ctx.restore();
    }
  }

  // === PEÕES ===
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

      const off = this.getSlotCenter(0, 0, this.cellW, this.cellH, slot);
      const px = basex + off.x;
      const py = basey + off.y;

      this.drawPawn(ctx, px, py, player, gameState.currentPlayer.id === player.id);
    }
  }

  drawPawn(ctx, px, py, player, isActive) {
    const c = PLAYER_COLORS[player.color];
    const slotW = this.cellW / 2;
    const slotH = this.cellH / 2;
    const sc = Math.min(slotW, slotH) / 20;

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
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
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(px - 1.5 * sc, py - 5 * sc, 2 * sc, 0, Math.PI * 2);
    ctx.fill();

    // Contorno
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px - 5 * sc, py + 2 * sc);
    ctx.quadraticCurveTo(px - 5 * sc, py - 5 * sc, px, py - 9 * sc);
    ctx.quadraticCurveTo(px + 5 * sc, py - 5 * sc, px + 5 * sc, py + 2 * sc);
    ctx.stroke();

    // Indicador de jogador ativo (borda dourada ao redor do slot)
    if (isActive) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      const hsw = slotW / 2 - 1, hsh = slotH / 2 - 1;
      ctx.strokeRect(px - hsw, py - hsh, slotW - 2, slotH - 2);
      ctx.setLineDash([]);
    }
  }

  drawCenterLogo(ctx, gameState) {
    const cx = BOARD_CENTER.x;
    const cy = BOARD_CENTER.y;

    ctx.fillStyle = 'rgba(15,25,35,0.88)';
    this.roundRect(ctx, cx - 90, cy - 45, 180, 90, 8);
    ctx.fill();

    ctx.strokeStyle = 'rgba(242,201,76,0.5)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, cx - 90, cy - 45, 180, 90, 8);
    ctx.stroke();

    // Ícones decorativos
    GameIcons.drawCoin(ctx, cx - 70, cy - 16, 20, '#F2C94C');
    GameIcons.drawCoin(ctx, cx + 70, cy - 16, 20, '#F2C94C');

    ctx.fillStyle = '#F2C94C';
    ctx.font = 'bold 24px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(242,201,76,0.3)';
    ctx.shadowBlur = 10;
    ctx.fillText('MAGNATA', cx, cy - 16);
    ctx.shadowBlur = 0;

    if (gameState) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '11px sans-serif';
      ctx.fillText(`Rodada ${gameState.round + 1} | ${gameState.deck.remainingCards} cartas`, cx, cy + 8);

      const cur = gameState.currentPlayer;
      ctx.fillStyle = PLAYER_COLORS[cur.color].main;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`▶ ${cur.name}`, cx, cy + 24);
    }
  }

  _drawDieFace(ctx, x, y, size, value) {
    const r = 4;
    // Fundo do dado
    ctx.fillStyle = '#f0f0f0';
    this.roundRect(ctx, x, y, size, size, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, size, size, r);
    ctx.stroke();

    // Pontos
    ctx.fillStyle = '#1a1a2e';
    const dot = size * 0.12;
    const cx = x + size / 2, cy = y + size / 2;
    const off = size * 0.28;
    const positions = {
      1: [[cx, cy]],
      2: [[cx - off, cy - off], [cx + off, cy + off]],
      3: [[cx - off, cy - off], [cx, cy], [cx + off, cy + off]],
      4: [[cx - off, cy - off], [cx + off, cy - off], [cx - off, cy + off], [cx + off, cy + off]],
      5: [[cx - off, cy - off], [cx + off, cy - off], [cx, cy], [cx - off, cy + off], [cx + off, cy + off]],
      6: [[cx - off, cy - off], [cx + off, cy - off], [cx - off, cy], [cx + off, cy], [cx - off, cy + off], [cx + off, cy + off]],
    };
    for (const [px, py] of (positions[value] || [])) {
      ctx.beginPath();
      ctx.arc(px, py, dot, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  getSpaceAtPosition(mx, my) {
    const tolX = this.cellW / 2 + 4;
    const tolY = this.cellH / 2 + 4;
    for (const space of SPACES) {
      if (Math.abs(mx - space.position.x) < tolX && Math.abs(my - space.position.y) < tolY) {
        return space;
      }
    }
    return null;
  }

  getEffectAtPosition(mx, my) {
    for (const hb of this._effectHitboxes) {
      if (mx >= hb.x && mx <= hb.x + hb.w && my >= hb.y && my <= hb.y + hb.h) return hb;
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
