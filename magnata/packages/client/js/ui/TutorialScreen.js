// ========================================
// TutorialScreen - Tela de Ajuda
// ========================================

export class TutorialScreen {
  constructor(container) {
    this.container = container;
  }

  show() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal tutorial-modal';

    modal.innerHTML = `
      <div class="tutorial-header">
        <h2>📖 Como Jogar Magnata</h2>
        <button class="btn btn-small" id="tutorial-close">✕</button>
      </div>

      <div class="tutorial-tabs">
        <button class="tutorial-tab active" data-tab="rules">Regras</button>
        <button class="tutorial-tab" data-tab="buildings">Construções</button>
        <button class="tutorial-tab" data-tab="cards">Cartas</button>
        <button class="tutorial-tab" data-tab="tips">Dicas</button>
      </div>

      <div class="tutorial-content" id="tutorial-content">
        ${this._rulesTab()}
      </div>
    `;

    overlay.appendChild(modal);
    this.container.appendChild(overlay);

    modal.querySelector('#tutorial-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    modal.querySelectorAll('.tutorial-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.tutorial-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const content = modal.querySelector('#tutorial-content');
        switch (tab.dataset.tab) {
          case 'rules': content.innerHTML = this._rulesTab(); break;
          case 'buildings': content.innerHTML = this._buildingsTab(); break;
          case 'cards': content.innerHTML = this._cardsTab(); break;
          case 'tips': content.innerHTML = this._tipsTab(); break;
        }
      });
    });
  }

  _rulesTab() {
    return `
      <h3>🎯 Objetivo</h3>
      <p>Construa negócios, acumule riqueza e use cartas de vitória para vencer!</p>

      <h3>🔄 Turno</h3>
      <ol>
        <li><b>Rolar dados</b> — mova seu peão pela soma</li>
        <li><b>Bifurcação</b> — escolha caminho externo (mais casas) ou atalho interno</li>
        <li><b>Pagamentos</b> — pague aluguéis, pedágios e efeitos de cartas</li>
        <li><b>Especial</b> — minigame ou bolsa de valores (se parar nessas casas)</li>
        <li><b>Ação</b> — jogar carta, construir, comprar carta ($200), trocar ou passar</li>
      </ol>

      <h3>🏠 Completar Volta</h3>
      <p>Ao passar pelo seu ninho: receba <b>$200</b>, ganhe <b>1 carta</b> e todos seus negócios <b>sobem 1 nível</b> (+20% renda).</p>

      <h3>💀 Falência</h3>
      <p>Se ficar com saldo negativo, venda negócios para se recuperar ou declare falência.</p>

      <h3>🏆 Vitória</h3>
      <p>Use uma carta de vitória quando atender suas condições. Cinco formas de vencer!</p>
    `;
  }

  _buildingsTab() {
    return `
      <h3>🏗️ Construções</h3>
      <p>Construa ao parar em uma casa de propriedade. Cada jogador ocupa 1 dos 4 slots da casa.</p>

      <table class="tutorial-table">
        <tr><th>Negócio</th><th>Custo</th><th>Renda</th></tr>
        <tr><td>Bar</td><td>$50</td><td>$25/turno</td></tr>
        <tr><td>Armazém</td><td>$100</td><td>$50/turno</td></tr>
        <tr><td>Supermercado</td><td>$150</td><td>$75/turno</td></tr>
        <tr><td>Galeria</td><td>$250</td><td>$125/turno</td></tr>
        <tr><td>Prédio Comercial</td><td>$500</td><td>$250/turno</td></tr>
        <tr><td>Shopping</td><td>$1000</td><td>$500/turno</td></tr>
        <tr><td>Super Centro</td><td>$1500</td><td>$750/turno</td></tr>
      </table>

      <h3>📈 Bônus</h3>
      <ul>
        <li><b>Marca</b> — mesmo tipo em 2+ regiões: +25% a +100%</li>
        <li><b>Região</b> — negócios na sua cor: +20% por negócio</li>
        <li><b>Vizinhança</b> — tipos diferentes adjacentes: +25% a +200%</li>
        <li><b>Valorização</b> — regiões têm multiplicadores: Verde 0.5x, Vermelho 1.0x, Azul 1.5x, Amarelo 2.0x</li>
      </ul>
    `;
  }

  _cardsTab() {
    return `
      <h3>🃏 Cartas de Ação</h3>
      <div class="tutorial-cards">
        <div class="tc"><b>💰 Dinheiro Fácil</b> (grátis) — Receba $500</div>
        <div class="tc"><b>🛡️ Seguro</b> (grátis) — Saldo vira $200</div>
        <div class="tc"><b>🦁 Mira do Leão</b> ($200) — Oponente paga 50% do saldo</div>
        <div class="tc"><b>🎩 Máfia</b> ($100) — Oponente paga 30% dos negócios a você</div>
        <div class="tc"><b>📜 Isenção Taxas</b> ($200) — Evite 3 cobranças</div>
        <div class="tc"><b>🏢 Isenção Negócios</b> ($200) — Evite 3 aluguéis</div>
        <div class="tc"><b>🐇 Lebre</b> (grátis) — Dados = 6 por 3 turnos</div>
        <div class="tc"><b>🐢 Tartaruga</b> ($200) — Oponente dados = 1 por 3 turnos</div>
        <div class="tc"><b>🎲 Dado Dado</b> ($200) — +1 dado permanente</div>
        <div class="tc"><b>💥 Implosão</b> ($200) — Destrua negócio de oponente</div>
        <div class="tc"><b>📈 Valorização</b> ($200) — Seu negócio +3 níveis</div>
        <div class="tc"><b>📢 Marketing</b> ($400) — Todos seus negócios +1 nível</div>
      </div>

      <h3>🏆 Cartas de Vitória</h3>
      <div class="tutorial-cards victory">
        <div class="tc"><b>👑 Mais Rico</b> (grátis) — 40%+ patrimônio + 2 voltas</div>
        <div class="tc"><b>🏆 Empresário</b> (grátis) — $7000+ patrimônio</div>
        <div class="tc"><b>✈️ Jatinho</b> ($500) — 2+ voltas a mais que todos</div>
        <div class="tc"><b>🤑 Nadando</b> ($3000) — Vitória instantânea</div>
        <div class="tc"><b>🌟 Mega Negócio</b> ($500) — Negócio com $2000+ renda</div>
      </div>
    `;
  }

  _tipsTab() {
    return `
      <h3>💡 Dicas de Estratégia</h3>
      <ul>
        <li>🏗️ <b>Construa cedo</b> — negócios baratos geram renda passiva desde o início</li>
        <li>🎨 <b>Diversifique</b> — mesmo tipo em várias regiões dá bônus de Marca</li>
        <li>🏠 <b>Sua região vale mais</b> — construa na sua cor para bônus de Região</li>
        <li>⚡ <b>Atalho interno</b> — use quando estiver atrás em voltas para ganhar $200 + carta mais rápido</li>
        <li>🃏 <b>Guarde cartas de vitória</b> — nunca troque cartas de vitória!</li>
        <li>💰 <b>Compre cartas</b> — com poucas cartas, gaste $200 para comprar mais opções</li>
        <li>🦁 <b>Ataque o líder</b> — use cartas ofensivas no jogador mais rico</li>
        <li>🛡️ <b>Seguro Empresarial</b> — só use quando estiver quase falindo</li>
        <li>🚧 <b>Pedágio estratégico</b> — coloque perto do ninho dos oponentes</li>
      </ul>
    `;
  }
}
