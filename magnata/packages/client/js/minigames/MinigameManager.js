// ========================================
// MinigameManager - Gerenciador de Minigames
// ========================================

import { MINIGAME_DURATION_MS, GameSpeed } from '../config/constants.js';
import { MakeChange } from './MakeChange.js';
import { CoinCatch } from './CoinCatch.js';
import { MemoryGame } from './MemoryGame.js';
import { FindTheKey } from './FindTheKey.js';

export class MinigameManager {
  constructor(container) {
    this.container = container;
    this.minigames = [MakeChange, CoinCatch, MemoryGame, FindTheKey];
  }

  play(player, difficulty = 'easy') {
    return new Promise(resolve => {
      // Selecionar minigame aleatório
      const MinigameClass = this.minigames[Math.floor(Math.random() * this.minigames.length)];

      // Criar overlay
      const overlay = document.createElement('div');
      overlay.className = 'minigame-overlay';

      const header = document.createElement('div');
      header.className = 'minigame-header';
      header.innerHTML = `
        <span class="minigame-title">${MinigameClass.TITLE}</span>
        <span class="minigame-timer" id="mg-timer">30</span>
        <span class="minigame-score" id="mg-score">0 pts</span>
      `;
      overlay.appendChild(header);

      const canvas = document.createElement('canvas');
      canvas.className = 'minigame-canvas';
      canvas.width = 800;
      canvas.height = 500;
      overlay.appendChild(canvas);

      this.container.appendChild(overlay);

      const ctx = canvas.getContext('2d');
      let score = 0;
      let timeLeft = GameSpeed.minigame / 1000;

      const timerEl = overlay.querySelector('#mg-timer');
      const scoreEl = overlay.querySelector('#mg-score');

      // Instanciar minigame
      const game = new MinigameClass(ctx, canvas.width, canvas.height, difficulty);

      game.onScoreChange = (newScore) => {
        score = newScore;
        scoreEl.textContent = `${score} pts`;
      };

      // Timer
      const timerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        if (timeLeft <= 5) timerEl.classList.add('urgent');
        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          endGame();
        }
      }, 1000);

      // Game loop
      let running = true;
      const gameLoop = (timestamp) => {
        if (!running) return;
        game.update(timestamp);
        game.render(ctx);
        requestAnimationFrame(gameLoop);
      };

      game.start();
      requestAnimationFrame(gameLoop);

      // Input handlers
      const handleClick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        game.handleClick(x, y);
      };

      const handleMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        game.handleMouseMove(x, y);
      };

      const handleKey = (e) => {
        game.handleKey(e.key);
      };

      canvas.addEventListener('click', handleClick);
      canvas.addEventListener('mousemove', handleMove);
      document.addEventListener('keydown', handleKey);

      function endGame() {
        running = false;
        canvas.removeEventListener('click', handleClick);
        canvas.removeEventListener('mousemove', handleMove);
        document.removeEventListener('keydown', handleKey);
        game.destroy();

        // Converter pontos em dinheiro (1 ponto = $1)
        const earnings = Math.max(0, score);

        // Mostrar resultado
        const result = document.createElement('div');
        result.className = 'minigame-result';
        result.innerHTML = `
          <h2>Tempo Esgotado!</h2>
          <p class="result-score">${score} pontos</p>
          <p class="result-money">Você ganhou $${earnings}!</p>
          <button class="btn btn-primary" id="mg-close">Continuar</button>
        `;
        overlay.appendChild(result);

        overlay.querySelector('#mg-close').addEventListener('click', () => {
          overlay.remove();
          resolve(earnings);
        });
      }
    });
  }
}
