// ========================================
// DiceRoller - Animação de Dados 3D com Sons
// ========================================

import { soundManager } from '../utils/SoundManager.js';

export class DiceRoller {
  constructor(container) {
    this.container = container;
    this.el = document.createElement('div');
    this.el.className = 'dice-roller';
    this.container.appendChild(this.el);
  }

  static DOTS = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };

  createDiceFace(value) {
    const face = document.createElement('div');
    face.className = 'dice-face';
    const dots = DiceRoller.DOTS[value];
    for (const [col, row] of dots) {
      const dot = document.createElement('div');
      dot.className = 'dice-dot';
      dot.style.gridColumn = col + 1;
      dot.style.gridRow = row + 1;
      face.appendChild(dot);
    }
    return face;
  }

  async show(results) {
    return new Promise(resolve => {
      this.el.innerHTML = '';
      this.el.classList.add('active');

      const diceEls = results.map(() => {
        const wrapper = document.createElement('div');
        wrapper.className = 'dice-3d';
        const inner = document.createElement('div');
        inner.className = 'dice-inner rolling';
        wrapper.appendChild(inner);
        this.el.appendChild(wrapper);
        return { wrapper, inner };
      });

      // Som de rolagem
      soundManager.playDiceRoll();

      let frame = 0;
      const maxFrames = 20;

      const rollInterval = setInterval(() => {
        diceEls.forEach(({ inner }) => {
          const rand = Math.floor(Math.random() * 6) + 1;
          inner.innerHTML = '';
          inner.appendChild(this.createDiceFace(rand));
        });
        frame++;

        if (frame >= maxFrames) {
          clearInterval(rollInterval);

          // Som de resultado
          soundManager.playDiceResult();

          diceEls.forEach(({ inner, wrapper }, i) => {
            inner.classList.remove('rolling');
            inner.classList.add('bounce');
            inner.innerHTML = '';
            inner.appendChild(this.createDiceFace(results[i]));
            wrapper.classList.add('final');
          });

          const total = results.reduce((a, b) => a + b, 0);
          const totalEl = document.createElement('div');
          totalEl.className = 'dice-total-display';
          totalEl.innerHTML = `<span class="dice-equals">=</span><span class="dice-sum">${total}</span>`;
          this.el.appendChild(totalEl);

          setTimeout(() => {
            this.el.classList.add('fade-out');
            setTimeout(() => {
              this.el.classList.remove('active', 'fade-out');
              this.el.innerHTML = '';
              resolve(total);
            }, 400);
          }, 1200);
        }
      }, 60);
    });
  }
}
