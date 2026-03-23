// ========================================
// GameIcons - Ícones personalizados do Magnata
// ========================================
// Cada ícone é desenhado com Canvas 2D paths.
// Podem ser coloridos dinamicamente.

export class GameIcons {

  // ═══════════════════════════════════
  // NEGÓCIOS
  // ═══════════════════════════════════

  // Bar — caneca de chope
  static drawBar(ctx, x, y, s, color = '#8B4513') {
    ctx.save();
    ctx.translate(x, y);
    const h = s * 0.8, w = s * 0.6;
    // Caneca corpo
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w/2, -h/2);
    ctx.lineTo(-w/2, h/2);
    ctx.lineTo(w/2, h/2);
    ctx.lineTo(w/2, -h/2);
    ctx.closePath();
    ctx.fill();
    // Alça
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.arc(w/2 + s*0.12, 0, s*0.15, -Math.PI/2, Math.PI/2);
    ctx.stroke();
    // Espuma
    ctx.fillStyle = '#FFF8DC';
    ctx.beginPath();
    ctx.ellipse(0, -h/2, w/2 + s*0.04, s*0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Brilho
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(-w/2 + s*0.06, -h/2 + s*0.1, s*0.08, h * 0.5);
    ctx.restore();
  }

  // Armazém — caixa/depósito
  static drawWarehouse(ctx, x, y, s, color = '#696969') {
    ctx.save();
    ctx.translate(x, y);
    const w = s * 0.75, h = s * 0.6;
    // Telhado curvo
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w/2, 0);
    ctx.quadraticCurveTo(-w/2, -h, 0, -h);
    ctx.quadraticCurveTo(w/2, -h, w/2, 0);
    ctx.lineTo(w/2, h*0.4);
    ctx.lineTo(-w/2, h*0.4);
    ctx.closePath();
    ctx.fill();
    // Porta
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-s*0.12, -s*0.05, s*0.24, h*0.45);
    // Linhas do portão
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    for (let ly = -s*0.02; ly < h*0.35; ly += s*0.08) {
      ctx.beginPath();
      ctx.moveTo(-s*0.1, ly);
      ctx.lineTo(s*0.1, ly);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Supermercado — carrinho de compras
  static drawSupermarket(ctx, x, y, s, color = '#228B22') {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Corpo do carrinho
    ctx.beginPath();
    ctx.moveTo(-s*0.35, -s*0.3);
    ctx.lineTo(-s*0.25, -s*0.3);
    ctx.lineTo(-s*0.1, s*0.15);
    ctx.lineTo(s*0.3, s*0.15);
    ctx.lineTo(s*0.35, -s*0.15);
    ctx.lineTo(-s*0.18, -s*0.15);
    ctx.stroke();
    // Rodas
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-s*0.05, s*0.3, s*0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s*0.22, s*0.3, s*0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Galeria — quadro com moldura
  static drawGallery(ctx, x, y, s, color = '#4169E1') {
    ctx.save();
    ctx.translate(x, y);
    const w = s * 0.7, h = s * 0.55;
    // Moldura externa
    ctx.fillStyle = '#DAA520';
    ctx.fillRect(-w/2 - 2, -h/2 - 2, w + 4, h + 4);
    // Quadro
    ctx.fillStyle = color;
    ctx.fillRect(-w/2, -h/2, w, h);
    // Montanha (paisagem)
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(-w/2, h/2);
    ctx.lineTo(-s*0.1, -s*0.05);
    ctx.lineTo(s*0.1, s*0.1);
    ctx.lineTo(s*0.25, -s*0.12);
    ctx.lineTo(w/2, h/2);
    ctx.closePath();
    ctx.fill();
    // Sol
    ctx.fillStyle = 'rgba(255,215,0,0.5)';
    ctx.beginPath();
    ctx.arc(w/2 - s*0.12, -h/2 + s*0.1, s*0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Prédio comercial — torre com janelas
  static drawCommercial(ctx, x, y, s, color = '#8A2BE2') {
    ctx.save();
    ctx.translate(x, y);
    const w = s * 0.45, h = s * 0.85;
    // Prédio
    ctx.fillStyle = color;
    ctx.fillRect(-w/2, -h/2, w, h);
    // Janelas (3x4 grid)
    ctx.fillStyle = 'rgba(255,255,200,0.6)';
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillRect(
          -w/2 + s*0.06 + col * s*0.17,
          -h/2 + s*0.08 + row * s*0.2,
          s*0.1, s*0.1
        );
      }
    }
    // Porta
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-s*0.06, h/2 - s*0.18, s*0.12, s*0.18);
    ctx.restore();
  }

  // Shopping — sacola de compras
  static drawShopping(ctx, x, y, s, color = '#FF4500') {
    ctx.save();
    ctx.translate(x, y);
    const w = s * 0.6, h = s * 0.7;
    // Sacola
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w/2, -h*0.2);
    ctx.lineTo(-w/2 + s*0.06, h/2);
    ctx.lineTo(w/2 - s*0.06, h/2);
    ctx.lineTo(w/2, -h*0.2);
    ctx.closePath();
    ctx.fill();
    // Alças
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.arc(0, -h*0.2, w*0.3, Math.PI, 0);
    ctx.stroke();
    // Etiqueta/estrela
    ctx.fillStyle = '#FFD700';
    this._drawStar(ctx, 0, s*0.08, s*0.1, 5);
    ctx.restore();
  }

  // Super Centro — arranha-céu com estrela
  static drawSuperCenter(ctx, x, y, s, color = '#FFD700') {
    ctx.save();
    ctx.translate(x, y);
    const w = s * 0.5, h = s * 0.9;
    // Prédio principal
    const grad = ctx.createLinearGradient(0, -h/2, 0, h/2);
    grad.addColorStop(0, color);
    grad.addColorStop(1, '#B8860B');
    ctx.fillStyle = grad;
    ctx.fillRect(-w/2, -h/2 + s*0.1, w, h - s*0.1);
    // Topo triangular
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w/2, -h/2 + s*0.1);
    ctx.lineTo(0, -h/2);
    ctx.lineTo(w/2, -h/2 + s*0.1);
    ctx.closePath();
    ctx.fill();
    // Janelas iluminadas
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillRect(
          -w/2 + s*0.06 + col * s*0.2,
          -h/2 + s*0.15 + row * s*0.15,
          s*0.08, s*0.06
        );
      }
    }
    // Estrela no topo
    ctx.fillStyle = '#FFF';
    this._drawStar(ctx, 0, -h/2 - s*0.02, s*0.06, 4);
    ctx.restore();
  }

  // ═══════════════════════════════════
  // CASAS ESPECIAIS
  // ═══════════════════════════════════

  // Minigame — dado estilizado
  static drawMinigame(ctx, x, y, s, color = '#d4a5e8') {
    ctx.save();
    ctx.translate(x, y);
    const sz = s * 0.65;
    // Dado
    ctx.fillStyle = color;
    this._roundRect(ctx, -sz/2, -sz/2, sz, sz, s*0.08);
    ctx.fill();
    // Pontos do dado (face 5)
    ctx.fillStyle = '#fff';
    const ds = s * 0.06;
    const positions = [[-1,-1],[1,-1],[0,0],[-1,1],[1,1]];
    for (const [px, py] of positions) {
      ctx.beginPath();
      ctx.arc(px * sz * 0.25, py * sz * 0.25, ds, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Bolsa de Valores — gráfico de ações
  static drawStockExchange(ctx, x, y, s, color = '#fad390') {
    ctx.save();
    ctx.translate(x, y);
    // Eixos
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-s*0.35, -s*0.35);
    ctx.lineTo(-s*0.35, s*0.3);
    ctx.lineTo(s*0.35, s*0.3);
    ctx.stroke();
    // Linha do gráfico (subida)
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.08;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-s*0.3, s*0.15);
    ctx.lineTo(-s*0.12, -s*0.05);
    ctx.lineTo(s*0.05, s*0.08);
    ctx.lineTo(s*0.2, -s*0.2);
    ctx.lineTo(s*0.3, -s*0.3);
    ctx.stroke();
    // Seta para cima
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(s*0.3, -s*0.3);
    ctx.lineTo(s*0.22, -s*0.22);
    ctx.lineTo(s*0.35, -s*0.22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Base/Nest — casa estilizada
  static drawNest(ctx, x, y, s, color = '#F2C94C') {
    ctx.save();
    ctx.translate(x, y);
    // Telhado
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-s*0.4, 0);
    ctx.lineTo(0, -s*0.4);
    ctx.lineTo(s*0.4, 0);
    ctx.closePath();
    ctx.fill();
    // Corpo
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(-s*0.25, 0, s*0.5, s*0.3);
    // Porta
    ctx.fillStyle = color;
    ctx.fillRect(-s*0.08, s*0.05, s*0.16, s*0.25);
    ctx.restore();
  }

  // ═══════════════════════════════════
  // UI / LOGO
  // ═══════════════════════════════════

  // Moeda — cifrão circular
  static drawCoin(ctx, x, y, s, color = '#F2C94C') {
    ctx.save();
    ctx.translate(x, y);
    const r = s * 0.4;
    // Círculo
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // Borda
    ctx.strokeStyle = '#B7950B';
    ctx.lineWidth = s * 0.06;
    ctx.stroke();
    // $
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${s * 0.4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
    ctx.restore();
  }

  // Logo Magnata — M estilizado
  static drawLogo(ctx, x, y, s, color = '#F2C94C') {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.font = `bold ${s}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(242,201,76,0.4)';
    ctx.shadowBlur = s * 0.3;
    ctx.fillText('M', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ═══════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════

  static _drawStar(ctx, cx, cy, r, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? r : r * 0.4;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  static _roundRect(ctx, x, y, w, h, r) {
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

  // Map de tipo de negócio → método de desenho
  static drawBusiness(ctx, x, y, s, type, color) {
    switch (type) {
      case 'bar': return this.drawBar(ctx, x, y, s, color);
      case 'deposito': return this.drawWarehouse(ctx, x, y, s, color);
      case 'supermercado': return this.drawSupermarket(ctx, x, y, s, color);
      case 'galeria': return this.drawGallery(ctx, x, y, s, color);
      case 'predio_comercial': return this.drawCommercial(ctx, x, y, s, color);
      case 'shopping': return this.drawShopping(ctx, x, y, s, color);
      case 'super_centro': return this.drawSuperCenter(ctx, x, y, s, color);
    }
  }
}
