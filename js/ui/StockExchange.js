// ========================================
// StockExchange - Bolsa de Valores
// ========================================

export class StockExchange {
  constructor(container) {
    this.container = container;
  }

  show(result) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';

      const modal = document.createElement('div');
      modal.className = 'modal stock-exchange-modal';

      const isPositive = result >= 0;
      modal.innerHTML = `
        <h2>📊 Bolsa de Valores</h2>
        <div class="stock-animation">
          <div class="stock-chart ${isPositive ? 'up' : 'down'}">
            ${isPositive ? '📈' : '📉'}
          </div>
          <div class="stock-result ${isPositive ? 'positive' : 'negative'}">
            ${isPositive ? '+' : ''}$${result}
          </div>
        </div>
        <p>${isPositive ? 'Seus investimentos renderam!' : 'Seus investimentos desvalorizaram!'}</p>
        <button class="btn btn-primary" id="stock-ok">OK</button>
      `;

      overlay.appendChild(modal);
      this.container.appendChild(overlay);

      overlay.querySelector('#stock-ok').addEventListener('click', () => {
        overlay.remove();
        resolve();
      });
    });
  }
}
