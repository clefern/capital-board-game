// ========================================
// CoinCatch (Cata Moedas) - Minigame
// ========================================

export class CoinCatch {
  static TITLE = '🐷 Cata Moedas';

  constructor(ctx, width, height, difficulty) {
    this.width = width;
    this.height = height;
    this.difficulty = difficulty;
    this.score = 0;
    this.onScoreChange = null;
    this.lastTimestamp = 0;
    this.spawnTimer = 0;

    // Porco (catcher)
    this.pig = {
      x: width / 2,
      y: height - 60,
      width: 60,
      height: 50,
      speed: 6,
      braking: false,
    };

    // Itens caindo
    this.items = [];
    this.keys = { left: false, right: false };
  }

  start() {
    this.lastTimestamp = performance.now();
  }

  spawnItem() {
    const rand = Math.random();
    let type, color, points, size;

    if (rand < 0.15) {
      // Martelo
      type = 'hammer';
      color = '#8B4513';
      points = -100;
      size = 30;
    } else if (rand < 0.3 && this.difficulty === 'easy') {
      // Moeda verde (só no fácil)
      type = 'coin_green';
      color = '#2ECC71';
      points = 100;
      size = 22;
    } else if (rand < 0.55) {
      // Moeda dourada
      type = 'coin_gold';
      color = '#F1C40F';
      points = 20;
      size = 20;
    } else {
      // Moeda prateada
      type = 'coin_silver';
      color = '#BDC3C7';
      points = 5;
      size = 18;
    }

    this.items.push({
      x: Math.random() * (this.width - 40) + 20,
      y: -size,
      type,
      color,
      points,
      size,
      speed: 2 + Math.random() * 3,
    });
  }

  update(timestamp) {
    const delta = timestamp - (this.lastTimestamp || timestamp);
    this.lastTimestamp = timestamp;

    // Mover porco
    if (this.keys.left) {
      this.pig.x = Math.max(this.pig.width / 2, this.pig.x - this.pig.speed);
    }
    if (this.keys.right) {
      this.pig.x = Math.min(this.width - this.pig.width / 2, this.pig.x + this.pig.speed);
    }

    // Spawn
    this.spawnTimer += delta;
    if (this.spawnTimer > 400) {
      this.spawnTimer = 0;
      this.spawnItem();
    }

    // Mover itens
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.speed;

      // Colisão com porco
      const dx = Math.abs(item.x - this.pig.x);
      const dy = Math.abs(item.y - this.pig.y);
      if (dx < (this.pig.width / 2 + item.size / 2) && dy < (this.pig.height / 2 + item.size / 2)) {
        this.score += item.points;
        if (this.onScoreChange) this.onScoreChange(this.score);
        this.items.splice(i, 1);
        continue;
      }

      // Fora da tela
      if (item.y > this.height + 20) {
        this.items.splice(i, 1);
      }
    }
  }

  render(ctx) {
    ctx.clearRect(0, 0, this.width, this.height);

    // Fundo
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#87CEEB');
    grad.addColorStop(1, '#228B22');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Chão
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, this.height - 30, this.width, 30);

    // Itens
    for (const item of this.items) {
      if (item.type === 'hammer') {
        ctx.font = `${item.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔨', item.x, item.y);
      } else {
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // $ no centro
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${item.size * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', item.x, item.y);
      }
    }

    // Porco
    ctx.font = '45px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐷', this.pig.x, this.pig.y);

    // Instruções
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('← → para mover | Clique no porco para frear', this.width / 2, 25);

    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${this.score} pts`, this.width / 2, 55);
  }

  handleClick(x, y) {
    // Clicar no porco = frear
    const dx = Math.abs(x - this.pig.x);
    const dy = Math.abs(y - this.pig.y);
    if (dx < 40 && dy < 40) {
      this.pig.braking = true;
      setTimeout(() => { this.pig.braking = false; }, 300);
    }
  }

  handleMouseMove(x, y) {
    // Mover porco com mouse
    this.pig.x = Math.max(this.pig.width / 2, Math.min(this.width - this.pig.width / 2, x));
  }

  handleKey(key) {
    if (key === 'ArrowLeft') this.keys.left = true;
    if (key === 'ArrowRight') this.keys.right = true;
    setTimeout(() => {
      if (key === 'ArrowLeft') this.keys.left = false;
      if (key === 'ArrowRight') this.keys.right = false;
    }, 100);
  }

  destroy() {
    this.items = [];
  }
}
