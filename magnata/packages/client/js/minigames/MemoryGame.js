// ========================================
// MemoryGame (Jogo da Memória) - Minigame
// ========================================

export class MemoryGame {
  static TITLE = '🧠 Jogo da Memória';

  constructor(ctx, width, height, difficulty) {
    this.width = width;
    this.height = height;
    this.difficulty = difficulty;
    this.score = 0;
    this.onScoreChange = null;

    // Configuração por dificuldade
    this.pairs = difficulty === 'easy' ? 7 : 14;
    this.pointsPerMatch = difficulty === 'easy' ? 60 : 30;

    // Notas brasileiras para os pares
    this.billValues = [2, 5, 10, 20, 50, 100, 200];
    this.billColors = {
      2: '#89CFF0', 5: '#B39DDB', 10: '#FFAB91',
      20: '#FFF59D', 50: '#CE93D8', 100: '#EF9A9A', 200: '#A5D6A7'
    };

    this.cards = [];
    this.flippedCards = [];
    this.matchedPairs = 0;
    this.canFlip = true;

    this.initCards();
  }

  initCards() {
    const values = [];
    for (let i = 0; i < this.pairs; i++) {
      const val = this.billValues[i % this.billValues.length];
      values.push(val, val);
    }

    // Embaralhar
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }

    // Calcular grid
    const total = values.length;
    const cols = this.difficulty === 'easy' ? 7 : 7;
    const rows = Math.ceil(total / cols);
    const cardW = Math.min(90, (this.width - 40) / cols - 10);
    const cardH = cardW * 1.3;
    const startX = (this.width - cols * (cardW + 8)) / 2;
    const startY = (this.height - rows * (cardH + 8)) / 2;

    this.cards = values.map((val, i) => ({
      value: val,
      col: i % cols,
      row: Math.floor(i / cols),
      x: startX + (i % cols) * (cardW + 8),
      y: startY + Math.floor(i / cols) * (cardH + 8),
      width: cardW,
      height: cardH,
      flipped: false,
      matched: false,
    }));
  }

  start() {}

  update(timestamp) {}

  render(ctx) {
    ctx.clearRect(0, 0, this.width, this.height);

    // Fundo
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.width, this.height);

    // Cartas
    for (const card of this.cards) {
      const { x, y, width: w, height: h, flipped, matched, value } = card;

      if (matched) {
        // Carta já casada (transparente)
        ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
        ctx.strokeStyle = '#2ECC71';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#2ECC71';
        ctx.font = `bold ${w * 0.3}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`$${value}`, x + w / 2, y + h / 2);
      } else if (flipped) {
        // Carta virada (mostrando valor)
        ctx.fillStyle = this.billColors[value] || '#FFF';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#2C3E50';
        ctx.font = `bold ${w * 0.35}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`$${value}`, x + w / 2, y + h / 2);
      } else {
        // Carta coberta
        ctx.fillStyle = '#3498DB';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#2980B9';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        // Padrão no verso
        ctx.fillStyle = '#2980B9';
        ctx.font = `${w * 0.4}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', x + w / 2, y + h / 2);
      }
    }

    // Info
    ctx.fillStyle = '#ECF0F1';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Pares encontrados: ${this.matchedPairs}/${this.pairs} | Pontos: ${this.score}`, this.width / 2, this.height - 15);
  }

  handleClick(x, y) {
    if (!this.canFlip) return;

    for (const card of this.cards) {
      if (x >= card.x && x <= card.x + card.width &&
          y >= card.y && y <= card.y + card.height &&
          !card.flipped && !card.matched) {

        card.flipped = true;
        this.flippedCards.push(card);

        if (this.flippedCards.length === 2) {
          this.canFlip = false;
          const [a, b] = this.flippedCards;

          if (a.value === b.value) {
            // Match!
            a.matched = true;
            b.matched = true;
            this.matchedPairs++;
            this.score += this.pointsPerMatch;
            if (this.onScoreChange) this.onScoreChange(this.score);
            this.flippedCards = [];
            this.canFlip = true;

            // Se achou todos os pares, resetar
            if (this.matchedPairs >= this.pairs) {
              setTimeout(() => {
                this.matchedPairs = 0;
                this.initCards();
              }, 500);
            }
          } else {
            // No match
            setTimeout(() => {
              a.flipped = false;
              b.flipped = false;
              this.flippedCards = [];
              this.canFlip = true;
            }, 600);
          }
        }
        return;
      }
    }
  }

  handleMouseMove(x, y) {}
  handleKey(key) {}
  destroy() {}
}
