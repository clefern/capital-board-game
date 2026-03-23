// ========================================
// HudPanel - Painel de Informações dos Jogadores
// ========================================

import { PLAYER_COLORS, BUSINESS_TYPES } from '../config/constants.js';
import { BonusCalculator } from '../core/BonusCalculator.js';

export class HudPanel {
  constructor(container) {
    this.container = container;
    this.el = document.createElement('div');
    this.el.className = 'hud-panel';
    this.container.appendChild(this.el);
  }

  update(gameState) {
    this.el.innerHTML = '';

    for (const player of gameState.players) {
      const panel = document.createElement('div');
      panel.className = `player-panel ${player.bankrupt ? 'bankrupt' : ''}`;
      if (gameState.currentPlayer.id === player.id) {
        panel.classList.add('active');
      }

      const colors = PLAYER_COLORS[player.color];
      panel.style.borderColor = colors.main;

      if (gameState.currentPlayer.id === player.id) {
        panel.style.backgroundColor = colors.light;
        panel.style.color = '#1a1a2e';
      }

      // Header
      const header = document.createElement('div');
      header.className = 'player-header';
      header.innerHTML = `
        <span class="player-color-dot" style="background:${colors.main}"></span>
        <span class="player-name">${player.isBot ? '🤖 ' : ''}${player.name}</span>
        ${player.bankrupt ? '<span class="bankrupt-badge">FALIDO</span>' : ''}
      `;
      panel.appendChild(header);

      if (!player.bankrupt) {
        // Info
        const info = document.createElement('div');
        info.className = 'player-info';
        info.innerHTML = `
          <div class="info-row">
            <span>💰 Dinheiro:</span>
            <span class="money ${player.money < 0 ? 'negative' : ''}">$${player.money}</span>
          </div>
          <div class="info-row">
            <span>🔄 Voltas:</span>
            <span>${player.laps}</span>
          </div>
          <div class="info-row">
            <span>🎲 Dados:</span>
            <span>${player.diceCount}</span>
          </div>
          <div class="info-row">
            <span>🏢 Negócios:</span>
            <span>${player.businesses.length}</span>
          </div>
          <div class="info-row">
            <span>🃏 Cartas:</span>
            <span>${player.cards.length}</span>
          </div>
          <div class="info-row">
            <span>🏆 Patrimônio:</span>
            <span>$${gameState.getPlayerPatrimony(player)}</span>
          </div>
        `;
        panel.appendChild(info);

        // Efeitos ativos (coloridos: buff=verde, debuff=vermelho)
        const effects = this.getActiveEffects(player, gameState);
        if (effects.length > 0) {
          const effectsEl = document.createElement('div');
          effectsEl.className = 'player-effects';
          effectsEl.innerHTML = effects.map(e =>
            `<span class="effect-badge ${e.type}" title="${e.desc}">${e.label}</span>`
          ).join('');
          panel.appendChild(effectsEl);
        }

        // Negócios
        if (player.businesses.length > 0) {
          const bizList = document.createElement('div');
          bizList.className = 'business-list';
          for (const biz of player.businesses) {
            const income = BonusCalculator.calculateIncome(biz, player.businesses, player.color);
            const bizEl = document.createElement('div');
            bizEl.className = 'business-item';
            bizEl.innerHTML = `
              <span style="color:${BUSINESS_TYPES[biz.type].color}">●</span>
              ${biz.label} <small>Nv.${biz.level}</small>
              <span class="biz-income">$${income}/turno</span>
            `;
            bizList.appendChild(bizEl);
          }
          panel.appendChild(bizList);
        }
      }

      this.el.appendChild(panel);
    }
  }

  getActiveEffects(player, gameState) {
    const effects = [];
    if (player.effects.lebre > 0)
      effects.push({ label: `🐇 Lebre (${player.effects.lebre})`, type: 'buff', desc: 'Dados sempre caem 6' });
    if (player.effects.tartaruga > 0)
      effects.push({ label: `🐢 Tartaruga (${player.effects.tartaruga})`, type: 'debuff', desc: 'Dados sempre caem 1' });
    if (player.effects.isencaoTaxas > 0)
      effects.push({ label: `📜 Isenção Taxas (${player.effects.isencaoTaxas})`, type: 'buff', desc: 'Evita pedágio, Leão e Máfia' });
    if (player.effects.isencaoNegocios > 0)
      effects.push({ label: `🏢 Isenção Neg. (${player.effects.isencaoNegocios})`, type: 'buff', desc: 'Não paga aluguel de negócios' });
    if (player.effects.contaTrancada)
      effects.push({ label: '🔒 Conta Trancada', type: 'debuff', desc: 'Próximo recebimento vai para a Prefeitura' });
    if (player.effects.miraLeao)
      effects.push({ label: '🦁 Mira do Leão', type: 'debuff', desc: 'No próximo turno paga 50% do saldo' });
    if (player.effects.cobrancaMafia) {
      const from = gameState?.players?.[player.effects.cobrancaMafia.fromPlayerId];
      effects.push({ label: `🎩 Máfia${from ? ` (${from.name})` : ''}`, type: 'debuff', desc: `Paga 30% do valor dos negócios${from ? ` para ${from.name}` : ''}` });
    }
    return effects;
  }
}
