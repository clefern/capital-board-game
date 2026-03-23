// ========================================
// BotPlayer - IA dos Bots (Server-Side)
// ========================================

import { BUSINESS_TYPES, BUSINESS_ORDER } from '../../shared/src/constants.js';
import { SPACES, NEST_POSITIONS } from '../../shared/src/board-layout.js';

export class BotPlayer {

  chooseAction(player, gs) {
    // 1. Tentar jogar carta de vitória
    const victory = this._tryPlayVictoryCard(player, gs);
    if (victory) return victory;

    // 2. Tentar construir
    const build = this._chooseBuild(player, gs);
    if (build) return build;

    // 3. Tentar jogar carta de ação
    const card = this._chooseCard(player, gs);
    if (card) return card;

    // 4. Comprar carta
    if (player.cards.length <= 2 && player.canAfford(200) && gs.deck.remainingCards > 0) {
      player.pay(200);
      const newCard = gs.deck.draw();
      player.addCard(newCard);
      gs.addLog(`${player.name} comprou uma carta por $200.`);
    }

    return { type: 'pass' };
  }

  chooseBifurcationPath(player, options, gs) {
    const maxLaps = Math.max(...gs.activePlayers.map(p => p.laps));
    const behindInLaps = player.laps < maxLaps;
    if (behindInLaps) {
      return Math.random() < 0.7 ? options[1] : options[0];
    }
    return Math.random() < 0.6 ? options[0] : options[1];
  }

  handleBankruptcy(player, gs) {
    if (player.businesses.length === 0) return false;

    const sorted = player.businesses
      .map((biz, i) => ({ biz, origIndex: i }))
      .sort((a, b) => a.biz.getSellValue() - b.biz.getSellValue());

    for (const { biz } of sorted) {
      const idx = player.businesses.indexOf(biz);
      if (idx === -1) continue;
      player.receive(biz.getSellValue());
      player.businesses.splice(idx, 1);
      gs.addLog(`${player.name} vendeu ${biz.label} por $${biz.getSellValue()}.`);
      if (player.money >= 0) return true;
    }

    return player.money >= 0;
  }

  simulateMinigame(difficulty = 'normal') {
    const base = difficulty === 'hard' ? 30 : 50;
    const range = difficulty === 'hard' ? 120 : 200;
    return base + Math.floor(Math.random() * range);
  }

  // === Helpers ===

  _tryPlayVictoryCard(player, gs) {
    for (let i = 0; i < player.cards.length; i++) {
      const card = player.cards[i];
      if (card.type !== 'victory') continue;
      if (!player.canAfford(card.cost)) continue;
      if (gs.checkVictoryCondition(player, card.id)) {
        return { type: 'play_card', cardIndex: i, target: null };
      }
    }
    return null;
  }

  _chooseBuild(player, gs) {
    if (!gs.canPlayerBuildAt(player, player.position)) return null;
    const budget = player.money > 1000
      ? Math.floor(player.money * 0.8)
      : Math.floor(player.money * 0.6);

    const affordable = BUSINESS_ORDER
      .filter(type => BUSINESS_TYPES[type].cost <= budget)
      .reverse();

    if (affordable.length === 0) return null;
    return { type: 'build', businessType: affordable[0] };
  }

  _chooseCard(player, gs) {
    if (player.cards.length === 0) return null;

    const priority = {
      dinheiro_facil: 100,
      operacao_lebre: 90,
      dado_dado: 85,
      marketing_agressivo: 80,
      na_mira_do_leao: 75,
      cobranca_mafia: 70,
      operacao_tartaruga: 65,
      implosao: 60,
      dado_perdido: 55,
      valorizacao_instantanea: 50,
      isencao_taxas: 45,
      isencao_negocios: 40,
      pedagio: 35,
      cuidado_obras: 30,
      conta_trancada: 25,
      novo_comeco: 20,
      demolicao: 15,
      seguro_empresarial: 10,
    };

    const candidates = player.cards
      .map((card, index) => ({ card, index, prio: priority[card.id] || 0 }))
      .filter(c => c.card.type !== 'victory')
      .filter(c => player.canAfford(c.card.cost))
      .filter(c => c.prio > 0)
      .sort((a, b) => b.prio - a.prio);

    for (const { card, index } of candidates) {
      if (card.id === 'seguro_empresarial' && player.money > 150) continue;
      if (card.id === 'marketing_agressivo' && player.businesses.length === 0) continue;
      if (card.id === 'valorizacao_instantanea' && player.businesses.length === 0) continue;

      const target = this._buildTarget(card, player, gs);
      return { type: 'play_card', cardIndex: index, target };
    }

    return null;
  }

  _buildTarget(card, player, gs) {
    switch (card.targetType) {
      case 'self':
      case null:
        return null;
      case 'opponent': {
        const opponents = gs.activePlayers.filter(p => p.id !== player.id);
        if (opponents.length === 0) return null;
        const richest = opponents.reduce((best, p) =>
          gs.getPlayerPatrimony(p) > gs.getPlayerPatrimony(best) ? p : best
        );
        return { playerId: richest.id };
      }
      case 'opponent_business': {
        const opponents = gs.activePlayers.filter(p => p.id !== player.id && p.businesses.length > 0);
        if (opponents.length === 0) return null;
        const target = opponents.reduce((best, p) =>
          gs.getPlayerPatrimony(p) > gs.getPlayerPatrimony(best) ? p : best
        );
        let bestIdx = 0, bestValue = 0;
        target.businesses.forEach((biz, i) => {
          const value = biz.cost * biz.level;
          if (value > bestValue) { bestValue = value; bestIdx = i; }
        });
        return { playerId: target.id, businessIndex: bestIdx };
      }
      case 'own_business': {
        if (player.businesses.length === 0) return null;
        let bestIdx = 0, bestIncome = 0;
        player.businesses.forEach((biz, i) => {
          if (biz.baseIncome > bestIncome) { bestIncome = biz.baseIncome; bestIdx = i; }
        });
        return { businessIndex: bestIdx };
      }
      case 'board': {
        const opponentNests = gs.activePlayers
          .filter(p => p.id !== player.id)
          .map(p => NEST_POSITIONS[p.color]);
        for (const nestId of opponentNests) {
          const space = SPACES[nestId + 1];
          if (space && space.type === 'property' && !space.toll && !space.obstruction) {
            return { spaceId: space.id };
          }
        }
        const fallback = SPACES.find(s => s.type === 'property' && !s.toll && !s.obstruction);
        return { spaceId: fallback ? fallback.id : 0 };
      }
      default:
        return null;
    }
  }
}
