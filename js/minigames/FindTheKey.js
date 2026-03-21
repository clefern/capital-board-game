// ========================================
// FindTheKey (Encontre a Chave) - Minigame
// ========================================

export class FindTheKey {
  static TITLE = '🔑 Encontre a Chave';

  constructor(ctx, width, height, difficulty) {
    this.width = width;
    this.height = height;
    this.difficulty = difficulty;
    this.score = 0;
    this.onScoreChange = null;
    this.feedback = null;
    this.feedbackTimer = 0;

    this.keyCount = difficulty === 'easy' ? 6 : 9;
    this.keys = [];
    this.currentLock = null;

    this.generateRound();
  }

  generateRound() {
    // Tipos de chaves (formas diferentes)
    const keyShapes = [
      { teeth: [1, 0, 1, 0], label: 'A' },
      { teeth: [0, 1, 0, 1], label: 'B' },
      { teeth: [1, 1, 0, 0], label: 'C' },
      { teeth: [0, 0, 1, 1], label: 'D' },
      { teeth: [1, 0, 0, 1], label: 'E' },
      { teeth: [0, 1, 1, 0], label: 'F' },
      { teeth: [1, 1, 1, 0], label: 'G' },
      { teeth: [0, 1, 1, 1], label: 'H' },
      { teeth: [1, 0, 1, 1], label: 'I' },
    ];

    // Selecionar chaves para esta rodada
    const shuffled = [...keyShapes].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, this.keyCount);

    // A resposta correta
    const correctIndex = Math.floor(Math.random() * selected.length);
    this.currentLock = { ...selected[correctIndex] };

    // Posicionar chaves
    const cols = this.difficulty === 'easy' ? 3 : 3;
    const rows = Math.ceil(this.keyCount / cols);
    const keyW = 80;
    const keyH = 120;
    const gap = 20;
    const startX = (this.width - cols * (keyW + gap)) / 2 + gap / 2;
    const startY = 180;

    this.keys = selected.map((shape, i) => ({
      ...shape,
      x: startX + (i % cols) * (keyW + gap),
      y: startY + Math.floor(i / cols) * (keyH + gap),
      width: keyW,
      height: keyH,
      isCorrect: i === correctIndex,
      inverted: this.difficulty === 'hard' && Math.random() > 0.5,
    }));
  }

  start() {}

  update(timestamp) {
    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= 16;
      if (this.feedbackTimer <= 0) {
        this.feedback = null;
      }
    }
  }

  render(ctx) {
    ctx.clearRect(0, 0, this.width, this.height);

    // Fundo
    ctx.fillStyle = '#2C3E50';
    ctx.fillRect(0, 0, this.width, this.height);

    // Fechadura
    ctx.fillStyle = '#ECF0F1';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Encontre a chave que abre esta fechadura:', this.width / 2, 35);

    // Desenhar fechadura
    this.drawLock(ctx, this.width / 2, 100, this.currentLock);

    // Desenhar chaves
    for (const key of this.keys) {
      this.drawKey(ctx, key);
    }

    // Feedback
    if (this.feedback) {
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = this.feedback.correct ? '#2ECC71' : '#E74C3C';
      ctx.textAlign = 'center';
      ctx.fillText(this.feedback.text, this.width / 2, this.height - 30);
    }
  }

  drawLock(ctx, cx, cy, lock) {
    // Corpo da fechadura
    ctx.fillStyle = '#7F8C8D';
    ctx.fillRect(cx - 30, cy - 20, 60, 40);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 30, cy - 20, 60, 40);

    // Buraco da chave (mostra o padrão de dentes)
    const teeth = lock.teeth;
    const startX = cx - 15;
    for (let i = 0; i < teeth.length; i++) {
      const tx = startX + i * 10;
      ctx.fillStyle = teeth[i] ? '#2C3E50' : '#95A5A6';
      ctx.fillRect(tx, cy - 5, 8, teeth[i] ? 12 : 6);
    }
  }

  drawKey(ctx, key) {
    const { x, y, width: w, height: h, teeth, label, inverted } = key;

    // Fundo da chave
    ctx.fillStyle = '#F39C12';
    ctx.strokeStyle = '#E67E22';
    ctx.lineWidth = 2;

    // Cabo
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 20, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Haste
    ctx.fillRect(x + w / 2 - 4, y + 35, 8, h - 55);

    // Dentes
    const displayTeeth = inverted ? [...teeth].reverse() : teeth;
    const startTX = x + w / 2 - 15;
    const ty = y + h - 20;
    for (let i = 0; i < displayTeeth.length; i++) {
      const tx = startTX + i * 10;
      if (displayTeeth[i]) {
        ctx.fillStyle = '#E67E22';
        ctx.fillRect(tx, ty, 8, 12);
      }
    }

    // Label
    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + 23);

    if (inverted) {
      ctx.fillStyle = 'rgba(231,76,60,0.5)';
      ctx.font = '10px sans-serif';
      ctx.fillText('(invertida)', x + w / 2, y + h + 12);
    }
  }

  handleClick(x, y) {
    for (const key of this.keys) {
      if (x >= key.x && x <= key.x + key.width &&
          y >= key.y && y <= key.y + key.height) {
        if (key.isCorrect) {
          this.score += 40;
          this.feedback = { text: '✅ Correto! +40', correct: true };
        } else {
          this.feedback = { text: '❌ Errado!', correct: false };
        }
        this.feedbackTimer = 800;
        if (this.onScoreChange) this.onScoreChange(this.score);

        // Nova rodada
        setTimeout(() => this.generateRound(), 500);
        return;
      }
    }
  }

  handleMouseMove(x, y) {}
  handleKey(key) {}
  destroy() {}
}
