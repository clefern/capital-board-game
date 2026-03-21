// ========================================
// TradeDialog - Troca de Cartas
// ========================================

import { PLAYER_COLORS } from '../config/constants.js';

export class TradeDialog {
  constructor(container) {
    this.container = container;
  }

  show(currentPlayer, otherPlayers) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';

      const modal = document.createElement('div');
      modal.className = 'modal trade-modal';

      let selectedPartner = null;
      let selectedGiveCard = null;
      let selectedReceiveCard = null;

      const renderPartners = () => otherPlayers.map(p => {
        const colors = PLAYER_COLORS[p.color];
        return `<button class="btn partner-btn ${selectedPartner?.id === p.id ? 'selected' : ''}"
                  data-player-id="${p.id}" style="border-color:${colors.main}">
          <span class="player-color-dot" style="background:${colors.main}"></span>
          ${p.name} (${p.cards.length} cartas)
        </button>`;
      }).join('');

      const renderCards = (cards, prefix) => cards.map((card, i) => `
        <div class="trade-card ${prefix === 'give' && selectedGiveCard === i ? 'selected' : ''}
             ${prefix === 'recv' && selectedReceiveCard === i ? 'selected' : ''}"
             data-${prefix}-index="${i}">
          <span class="card-icon">${card.icon}</span>
          <span class="card-name">${card.name}</span>
        </div>
      `).join('');

      const render = () => {
        modal.innerHTML = `
          <h2>🤝 Troca de Cartas</h2>
          <div class="trade-section">
            <h3>Trocar com:</h3>
            <div class="trade-partners">${renderPartners()}</div>
          </div>
          <div class="trade-columns">
            <div class="trade-col">
              <h3>Suas cartas (dar):</h3>
              <div class="trade-cards">${renderCards(currentPlayer.cards, 'give')}</div>
            </div>
            ${selectedPartner ? `
            <div class="trade-col">
              <h3>Cartas de ${selectedPartner.name} (receber):</h3>
              <div class="trade-cards">${renderCards(selectedPartner.cards, 'recv')}</div>
            </div>` : ''}
          </div>
          <div class="trade-actions">
            <button class="btn btn-secondary" id="trade-cancel">Cancelar</button>
            <button class="btn btn-primary" id="trade-confirm"
              ${!selectedPartner || selectedGiveCard === null || selectedReceiveCard === null ? 'disabled' : ''}>
              Trocar
            </button>
          </div>
        `;

        // Event listeners
        modal.querySelectorAll('.partner-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.playerId);
            selectedPartner = otherPlayers.find(p => p.id === id);
            selectedReceiveCard = null;
            render();
          });
        });

        modal.querySelectorAll('[data-give-index]').forEach(el => {
          el.addEventListener('click', () => {
            selectedGiveCard = parseInt(el.dataset.giveIndex);
            render();
          });
        });

        modal.querySelectorAll('[data-recv-index]').forEach(el => {
          el.addEventListener('click', () => {
            selectedReceiveCard = parseInt(el.dataset.recvIndex);
            render();
          });
        });

        const cancelBtn = modal.querySelector('#trade-cancel');
        const confirmBtn = modal.querySelector('#trade-confirm');

        cancelBtn.addEventListener('click', () => {
          overlay.remove();
          resolve(null);
        });

        if (confirmBtn && !confirmBtn.disabled) {
          confirmBtn.addEventListener('click', () => {
            overlay.remove();
            resolve({
              partner: selectedPartner,
              giveIndex: selectedGiveCard,
              receiveIndex: selectedReceiveCard,
            });
          });
        }
      };

      overlay.appendChild(modal);
      this.container.appendChild(overlay);
      render();
    });
  }
}
