// ========================================
// TradeDialog - Troca de Cartas (multi-carta + dinheiro)
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
      const selectedGiveCards = new Set();
      const selectedReceiveCards = new Set();
      let offerMoney = 0;

      const renderPartners = () => otherPlayers.map(p => {
        const colors = PLAYER_COLORS[p.color];
        return `<button class="btn partner-btn ${selectedPartner?.id === p.id ? 'selected' : ''}"
                  data-player-id="${p.id}" style="border-color:${colors.main}">
          <span class="player-color-dot" style="background:${colors.main}"></span>
          ${p.name} (${p.cards.length} cartas)
        </button>`;
      }).join('');

      const renderCards = (cards, prefix, selectedSet) => cards.map((card, i) => `
        <div class="trade-card ${selectedSet.has(i) ? 'selected' : ''}"
             data-${prefix}-index="${i}">
          <span class="card-icon">${card.icon}</span>
          <span class="card-name">${card.name}</span>
        </div>
      `).join('');

      const render = () => {
        const canConfirm = selectedPartner && (selectedGiveCards.size > 0 || offerMoney > 0) && (selectedReceiveCards.size > 0 || offerMoney < 0);

        modal.innerHTML = `
          <h2>🤝 Troca de Cartas</h2>
          <div class="trade-section">
            <h3>Trocar com:</h3>
            <div class="trade-partners">${renderPartners()}</div>
          </div>
          <div class="trade-columns">
            <div class="trade-col">
              <h3>Suas cartas (dar):</h3>
              <div class="trade-cards">${renderCards(currentPlayer.cards, 'give', selectedGiveCards)}</div>
            </div>
            ${selectedPartner ? `
            <div class="trade-col">
              <h3>Cartas de ${selectedPartner.name} (receber):</h3>
              <div class="trade-cards">${renderCards(selectedPartner.cards, 'recv', selectedReceiveCards)}</div>
            </div>` : ''}
          </div>
          <div class="trade-money-section" style="margin:8px 0;display:flex;align-items:center;gap:8px">
            <label style="font-size:12px;color:var(--text-secondary)">Incluir dinheiro:</label>
            <button class="btn btn-small" id="money-minus">-$50</button>
            <span style="font-weight:700;color:${offerMoney >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
              ${offerMoney >= 0 ? '+' : ''}$${offerMoney}
            </span>
            <button class="btn btn-small" id="money-plus">+$50</button>
          </div>
          <div class="trade-actions">
            <button class="btn btn-secondary" id="trade-cancel">Cancelar</button>
            <button class="btn btn-primary" id="trade-confirm" ${!canConfirm ? 'disabled' : ''}>
              Trocar (${selectedGiveCards.size}↔${selectedReceiveCards.size})
            </button>
          </div>
        `;

        // Event listeners
        modal.querySelectorAll('.partner-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.playerId);
            selectedPartner = otherPlayers.find(p => p.id === id);
            selectedReceiveCards.clear();
            render();
          });
        });

        modal.querySelectorAll('[data-give-index]').forEach(el => {
          el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.giveIndex);
            if (selectedGiveCards.has(idx)) selectedGiveCards.delete(idx);
            else selectedGiveCards.add(idx);
            render();
          });
        });

        modal.querySelectorAll('[data-recv-index]').forEach(el => {
          el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.recvIndex);
            if (selectedReceiveCards.has(idx)) selectedReceiveCards.delete(idx);
            else selectedReceiveCards.add(idx);
            render();
          });
        });

        modal.querySelector('#money-minus')?.addEventListener('click', () => {
          if (currentPlayer.money + offerMoney >= 50) { offerMoney -= 50; render(); }
        });
        modal.querySelector('#money-plus')?.addEventListener('click', () => {
          offerMoney += 50; render();
        });

        modal.querySelector('#trade-cancel').addEventListener('click', () => {
          overlay.remove();
          resolve(null);
        });

        const confirmBtn = modal.querySelector('#trade-confirm');
        if (confirmBtn && !confirmBtn.disabled) {
          confirmBtn.addEventListener('click', () => {
            overlay.remove();
            resolve({
              partner: selectedPartner,
              giveIndices: [...selectedGiveCards].sort((a, b) => b - a),
              receiveIndices: [...selectedReceiveCards].sort((a, b) => b - a),
              money: offerMoney,
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
