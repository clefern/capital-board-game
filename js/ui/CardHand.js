// ========================================
// CardHand - Mão de Cartas (Sidebar Vertical)
// ========================================

export class CardHand {
  constructor(container) {
    this.container = container;
    this.el = document.createElement('div');
    this.el.className = 'card-hand';
    this.container.appendChild(this.el);
    this.onCardSelected = null;
  }

  update(player) {
    this.el.innerHTML = '';
    if (!player || player.bankrupt) return;

    const label = document.createElement('div');
    label.className = 'hand-label';
    label.textContent = `Cartas de ${player.name}`;
    this.el.appendChild(label);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';

    player.cards.forEach((card, index) => {
      const cardEl = document.createElement('div');
      cardEl.className = `card ${card.type === 'victory' ? 'victory-card' : ''}`;
      cardEl.dataset.index = index;

      cardEl.innerHTML = `
        <div class="card-icon">${card.icon}</div>
        <div class="card-info">
          <div class="card-name">${card.name}</div>
          <div class="card-desc">${card.description}</div>
        </div>
        <div class="card-cost">${card.cost > 0 ? `$${card.cost}` : 'Grátis'}</div>
      `;

      cardEl.addEventListener('mouseenter', () => cardEl.classList.add('hovered'));
      cardEl.addEventListener('mouseleave', () => cardEl.classList.remove('hovered'));

      if (this.onCardSelected) {
        cardEl.addEventListener('click', () => this.onCardSelected(index, card));
      }

      cardsContainer.appendChild(cardEl);
    });

    this.el.appendChild(cardsContainer);
  }

  enableSelection(player, callback) {
    this.onCardSelected = callback;
    this.el.classList.add('selectable');
    this.update(player);
  }

  disableSelection() {
    this.onCardSelected = null;
    this.el.classList.remove('selectable');
  }
}
