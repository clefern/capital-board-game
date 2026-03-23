// ========================================
// MakeChange (Troque o Troco) - Minigame
// ========================================

export class MakeChange {
  static TITLE = '💵 Troque o Troco';

  constructor(ctx, width, height, difficulty) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.difficulty = difficulty;
    this.bills = [1, 2, 5, 10, 20, 50, 100];
    this.billColors = {
      1: '#A8D5BA', 2: '#89CFF0', 5: '#B39DDB',
      10: '#FFAB91', 20: '#FFF59D', 50: '#CE93D8', 100: '#EF9A9A'
    };
    this.score = 0;
    this.targetAmount = 0;
    this.selectedBills = [];
    this.currentSum = 0;
    this.feedback = null;
    this.feedbackTimer = 0;
    this.onScoreChange = null;

    this.generateTarget();
  }

  generateTarget() {
    if (this.difficulty === 'easy') {
      // Fácil: encontrar 1 nota
      const bill = this.bills[Math.floor(Math.random() * this.bills.length)];
      this.targetAmount = bill;
    } else {
      // Difícil: soma de 1-2 notas
      const b1 = this.bills[Math.floor(Math.random() * this.bills.length)];
      const b2 = this.bills[Math.floor(Math.random() * this.bills.length)];
      this.targetAmount = b1 + (Math.random() > 0.5 ? b2 : 0);
    }
    this.selectedBills = [];
    this.currentSum = 0;
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

    // Alvo
    ctx.fillStyle = '#ECF0F1';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Quanto dá? $${this.targetAmount}`, this.width / 2, 50);

    // Soma atual
    ctx.fillStyle = '#F39C12';
    ctx.font = '24px sans-serif';
    ctx.fillText(`Sua soma: $${this.currentSum}`, this.width / 2, 90);

    // Notas
    const billWidth = 90;
    const billHeight = 55;
    const startX = (this.width - this.bills.length * (billWidth + 10)) / 2;

    this.bills.forEach((bill, i) => {
      const x = startX + i * (billWidth + 10);
      const y = 150;
      const selected = this.selectedBills.includes(bill);

      // Sombra
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 3, y + 3, billWidth, billHeight);

      // Nota
      ctx.fillStyle = selected ? '#27AE60' : this.billColors[bill];
      ctx.fillRect(x, y, billWidth, billHeight);

      // Borda
      ctx.strokeStyle = selected ? '#1E8449' : '#333';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, billWidth, billHeight);

      // Valor
      ctx.fillStyle = '#2C3E50';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`$${bill}`, x + billWidth / 2, y + billHeight / 2);

      // Guardar posição para click detection
      this._billRects = this._billRects || [];
      this._billRects[i] = { x, y, w: billWidth, h: billHeight, value: bill };
    });

    // Botão confirmar
    const confirmX = this.width / 2 - 60;
    const confirmY = 250;
    ctx.fillStyle = this.currentSum === this.targetAmount ? '#27AE60' : '#7F8C8D';
    ctx.fillRect(confirmX, confirmY, 120, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Confirmar', this.width / 2, confirmY + 22);
    this._confirmRect = { x: confirmX, y: confirmY, w: 120, h: 40 };

    // Botão limpar
    const clearX = this.width / 2 - 60;
    const clearY = 300;
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(clearX, clearY, 120, 40);
    ctx.fillStyle = '#fff';
    ctx.fillText('Limpar', this.width / 2, clearY + 22);
    this._clearRect = { x: clearX, y: clearY, w: 120, h: 40 };

    // Feedback
    if (this.feedback) {
      ctx.font = 'bold 28px sans-serif';
      ctx.fillStyle = this.feedback.correct ? '#2ECC71' : '#E74C3C';
      ctx.fillText(this.feedback.text, this.width / 2, 380);
    }

    // Score
    ctx.fillStyle = '#ECF0F1';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Pontuação: ${this.score}`, this.width / 2, 440);
  }

  handleClick(x, y) {
    // Checar notas
    if (this._billRects) {
      for (const rect of this._billRects) {
        if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
          const idx = this.selectedBills.indexOf(rect.value);
          if (idx >= 0) {
            this.selectedBills.splice(idx, 1);
            this.currentSum -= rect.value;
          } else {
            this.selectedBills.push(rect.value);
            this.currentSum += rect.value;
          }
          return;
        }
      }
    }

    // Confirmar
    if (this._confirmRect) {
      const r = this._confirmRect;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        if (this.currentSum === this.targetAmount) {
          this.score += 25;
          this.feedback = { text: '✅ Correto! +25', correct: true };
          this.feedbackTimer = 1000;
          this.generateTarget();
        } else {
          this.score -= 50;
          this.feedback = { text: '❌ Errado! -50', correct: false };
          this.feedbackTimer = 1000;
          this.selectedBills = [];
          this.currentSum = 0;
        }
        if (this.onScoreChange) this.onScoreChange(this.score);
        return;
      }
    }

    // Limpar
    if (this._clearRect) {
      const r = this._clearRect;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        this.selectedBills = [];
        this.currentSum = 0;
      }
    }
  }

  handleMouseMove(x, y) {}
  handleKey(key) {}
  destroy() {}
}
