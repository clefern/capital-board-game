// ========================================
// VictoryScreen - Tela de Vitória Completa
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

    // Ranking: todos jogadores ordenados por patrimônio
    const ranked = [...gameState.players]
      .map(p => ({
        player: p,
        patrimony: gameState.getPlayerPatrimony(p),
        isWinner: p.id === winner.id,
      }))
      .sort((a, b) => b.patrimony - a.patrimony);

    const medals = ['🥇', '🥈', '🥉', '4º'];

    const modal = document.createElement('div');
    modal.className = 'modal victory-modal';
    modal.style.borderColor = colors.main;

    modal.innerHTML = `
      <div class="victory-crown">👑</div>
      <h1 class="victory-title" style="color:${colors.main}">${winner.name} Venceu!</h1>
      <div class="victory-reason">${reason}</div>

      <div class="victory-ranking">
        <h3>Classificação Final</h3>
        ${ranked.map((r, i) => {
          const c = PLAYER_COLORS[r.player.color];
          const p = r.player;
          return `
            <div class="ranking-row ${r.isWinner ? 'winner' : ''} ${p.bankrupt ? 'bankrupt' : ''}" style="border-left: 3px solid ${c.main}">
              <span class="rank-medal">${p.bankrupt ? '💀' : medals[i]}</span>
              <span class="rank-name" style="color:${c.main}">${p.isBot ? '🤖 ' : ''}${p.name}</span>
              <span class="rank-patrimony">$${r.patrimony}</span>
            </div>`;
        }).join('')}
      </div>

      <div class="victory-details">
        <h3>Estatísticas do Vencedor</h3>
        <div class="victory-stats">
          <div class="stat">
            <span class="stat-icon">💰</span>
            <span class="stat-label">Dinheiro</span>
            <span class="stat-value">$${winner.money}</span>
          </div>
          <div class="stat">
            <span class="stat-icon">🏢</span>
            <span class="stat-label">Negócios</span>
            <span class="stat-value">${winner.businesses.length}</span>
          </div>
          <div class="stat">
            <span class="stat-icon">🔄</span>
            <span class="stat-label">Voltas</span>
            <span class="stat-value">${winner.laps}</span>
          </div>
          <div class="stat">
            <span class="stat-icon">📊</span>
            <span class="stat-label">Rodadas</span>
            <span class="stat-value">${gameState.round + 1}</span>
          </div>
          <div class="stat">
            <span class="stat-icon">💵</span>
            <span class="stat-label">Total Ganho</span>
            <span class="stat-value">$${winner.stats.totalEarned}</span>
          </div>
          <div class="stat">
            <span class="stat-icon">💸</span>
            <span class="stat-label">Total Gasto</span>
            <span class="stat-value">$${winner.stats.totalSpent}</span>
          </div>
          <div class="stat">
            <span class="stat-icon">🏗️</span>
            <span class="stat-label">Construções</span>
            <span class="stat-value">${winner.stats.businessesBuilt}</span>
          </div>
          <div class="stat">
            <span class="stat-icon">🃏</span>
            <span class="stat-label">Cartas Jogadas</span>
            <span class="stat-value">${winner.stats.cardsPlayed}</span>
          </div>
        </div>
      </div>

      <button class="btn btn-primary btn-large" id="new-game-btn">🔄 Jogar Novamente</button>
    `;

    overlay.appendChild(modal);
    this.container.appendChild(overlay);

    overlay.querySelector('#new-game-btn').addEventListener('click', () => {
      overlay.remove();
      window.location.reload();
    });
  }
}
