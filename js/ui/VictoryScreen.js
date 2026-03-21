// ========================================
// VictoryScreen - Tela de Vitória
// ========================================

import { PLAYER_COLORS } from '../config/constants.js';

export class VictoryScreen {
  constructor(container) {
    this.container = container;
  }

  show(winner, reason, gameState) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay victory-overlay';

    const colors = PLAYER_COLORS[winner.color];
    const modal = document.createElement('div');
    modal.className = 'modal victory-modal';
    modal.style.borderColor = colors.main;

    modal.innerHTML = `
      <div class="victory-crown">👑</div>
      <h1 class="victory-title" style="color:${colors.main}">${winner.name} Venceu!</h1>
      <div class="victory-reason">${reason}</div>
      <div class="victory-stats">
        <div class="stat">
          <span class="stat-label">Patrimônio</span>
          <span class="stat-value">$${gameState.getPlayerPatrimony(winner)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Dinheiro</span>
          <span class="stat-value">$${winner.money}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Negócios</span>
          <span class="stat-value">${winner.businesses.length}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Voltas</span>
          <span class="stat-value">${winner.laps}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Rodadas</span>
          <span class="stat-value">${gameState.round + 1}</span>
        </div>
      </div>
      <button class="btn btn-primary btn-large" id="new-game-btn">Novo Jogo</button>
    `;

    overlay.appendChild(modal);
    this.container.appendChild(overlay);

    overlay.querySelector('#new-game-btn').addEventListener('click', () => {
      overlay.remove();
      window.location.reload();
    });
  }
}
