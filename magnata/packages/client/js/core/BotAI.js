// ========================================
// BotAI - Inteligência Artificial dos Bots
// ========================================

import { BUSINESS_TYPES, BUSINESS_ORDER } from '../config/constants.js';
import { SPACES, NEST_POSITIONS } from '../config/board-layout.js';

export class BotAI {

  static speedMultiplier = 1;
  static difficulty = 'normal'; // 'easy', 'normal', 'hard'

  // Delay aleatório para parecer natural
  static delay(min = 400, max = 900) {
    const ms = (min + Math.random() * (max - min)) * BotAI.speedMultiplier;
    return new Promise(r => setTimeout(r, ms));
  }

  // === DECISÃO PRINCIPAL: escolher ação do turno ===
  chooseAction(player, gs) {
    const diff = BotAI.difficulty;

    // Fácil: 40% de chance de simplesmente passar
    if (diff === 'easy' && Math.random() < 0.4) {
      return { type: 'pass' };
    }

    // 1. Tentar jogar carta de vitória (sempre, todas dificuldades)
    const victory = this._tryPlayVictoryCard(player, gs);
    if (victory) return victory;

    // 2. Tentar construir
    const build = this._chooseBuild(player, gs);
    if (build) return build;

    // 3. Tentar jogar carta de ação
    // Fácil: nunca joga cartas ofensivas
    const card = this._chooseCard(player, gs);
    if (card) return card;

    // 4. Comprar carta
    const cardThreshold = diff === 'hard' ? 3 : 2;
    if (player.cards.length <= cardThreshold && player.canAfford(200) && gs.deck.remainingCards > 0) {
      player.pay(200);
      const newCard = gs.deck.draw();
      player.addCard(newCard);
      gs.addLog(`${player.name} comprou uma carta por $200.`);
    }

    // 5. Passar
    return { type: 'pass' };
  }

  // === BIFURCAÇÃO: escolher caminho ===
  chooseBifurcationPath(player, options, gs) {
    // options[0] = externo, options[1] = interno (atalho)
    const maxLaps = Math.max(...gs.activePlayers.map(p => p.laps));
    const behindInLaps = player.laps < maxLaps;

    // Se está atrás em voltas → preferir atalho (70%)
    if (behindInLaps) {
      return Math.random() < 0.7 ? options[1] : options[0];
    }
    // Se está na frente → preferir externo (60%)
    return Math.random() < 0.6 ? options[0] : options[1];
  }

  // === FALÊNCIA: vender negócios para se recuperar ===
  handleBankruptcy(player, gs) {
    if (player.businesses.length === 0) return false;

    // Ordenar do mais barato ao mais caro (vender os baratos primeiro)
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

  // === MINIGAME: simular resultado ===
  simulateMinigame() {
    return 50 + Math.floor(Math.random() * 200);
  }

  // ── Helpers internos ──

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

    // Orçamento: 60% do dinheiro (80% se rico)
    const budget = player.money > 1000
      ? Math.floor(player.money * 0.8)
      : Math.floor(player.money * 0.6);

    // Pegar o melhor negócio dentro do orçamento
    const affordable = BUSINESS_ORDER
      .filter(type => BUSINESS_TYPES[type].cost <= budget)
      .reverse(); // mais caro primeiro

    if (affordable.length === 0) return null;
    return { type: 'build', businessType: affordable[0] };
  }

  _chooseCard(player, gs) {
    if (player.cards.length === 0) return null;

    // Prioridade das cartas (maior = jogar primeiro)
    const priority = {
      dinheiro_facil: 100,        // sempre jogar (grátis + $500)
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
      seguro_empresarial: 10,     // só em emergência
    };

    // Avaliar e ordenar cartas jogáveis
    const candidates = player.cards
      .map((card, index) => ({ card, index, prio: priority[card.id] || 0 }))
      .filter(c => c.card.type !== 'victory')
      .filter(c => player.canAfford(c.card.cost))
      .filter(c => c.prio > 0)
      .filter(c => {
        // Fácil: não joga cartas ofensivas
        if (BotAI.difficulty === 'easy' && ['opponent', 'opponent_business'].includes(c.card.targetType)) return false;
        return true;
      })
      .sort((a, b) => b.prio - a.prio);

    // Filtros contextuais
    for (const { card, index } of candidates) {
      // Seguro empresarial: só se quase falido
      if (card.id === 'seguro_empresarial' && player.money > 150) continue;

      // Marketing: só se tem negócios
      if (card.id === 'marketing_agressivo' && player.businesses.length === 0) continue;

      // Valorização: só se tem negócios
      if (card.id === 'valorizacao_instantanea' && player.businesses.length === 0) continue;

      // Demolição: só se existe pedágio/obstrução de oponente
      if (card.id === 'demolicao') {
        const hasTarget = SPACES.some(s =>
          (s.toll && s.toll.ownerId !== player.id) ||
          (s.obstruction && s.obstruction.ownerId !== player.id)
        );
        if (!hasTarget) continue;
      }

      // Novo começo: só se oponente tem efeitos bufados
      if (card.id === 'novo_comeco') {
        const target = this._findOpponentWithBuffs(player, gs);
        if (!target) continue;
      }

      // Cartas ofensivas: precisam de oponente válido
      if (['opponent', 'opponent_business'].includes(card.targetType)) {
        const opponents = gs.activePlayers.filter(p => p.id !== player.id);
        if (opponents.length === 0) continue;

        if (card.targetType === 'opponent_business') {
          const hasBusinesses = opponents.some(p => p.businesses.length > 0);
          if (!hasBusinesses) continue;
        }
      }

      // Construir target e retornar
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
        const targetId = this._chooseTarget(player, gs);
        return { playerId: targetId };
      }

      case 'opponent_business': {
        const opponents = gs.activePlayers.filter(p => p.id !== player.id && p.businesses.length > 0);
        if (opponents.length === 0) return null;
        // Alvo: oponente com negócios mais valiosos
        const target = opponents.reduce((best, p) =>
          gs.getPlayerPatrimony(p) > gs.getPlayerPatrimony(best) ? p : best
        );
        const bizIdx = this._chooseOpponentBusiness(target);
        return { playerId: target.id, businessIndex: bizIdx };
      }

      case 'own_business': {
        if (player.businesses.length === 0) return null;
        return { businessIndex: this._chooseOwnBusiness(player) };
      }

      case 'board':
        return { spaceId: this._chooseBoardSpace(card, player, gs) };

      default:
        return null;
    }
  }

  _chooseTarget(player, gs) {
    // Alvo: oponente mais rico
    const opponents = gs.activePlayers.filter(p => p.id !== player.id);
    const richest = opponents.reduce((best, p) =>
      gs.getPlayerPatrimony(p) > gs.getPlayerPatrimony(best) ? p : best
    );
    return richest.id;
  }

  _chooseOpponentBusiness(opponent) {
    // Destruir o negócio mais valioso
    let bestIdx = 0;
    let bestValue = 0;
    opponent.businesses.forEach((biz, i) => {
      const value = biz.cost * biz.level;
      if (value > bestValue) { bestValue = value; bestIdx = i; }
    });
    return bestIdx;
  }

  _chooseOwnBusiness(player) {
    // Valorizar o negócio com maior renda base
    let bestIdx = 0;
    let bestIncome = 0;
    player.businesses.forEach((biz, i) => {
      if (biz.baseIncome > bestIncome) { bestIncome = biz.baseIncome; bestIdx = i; }
    });
    return bestIdx;
  }

  _chooseBoardSpace(card, player, gs) {
    if (card.id === 'demolicao') {
      // Demolir pedágio/obstrução de oponente
      const target = SPACES.find(s =>
        (s.toll && s.toll.ownerId !== player.id) ||
        (s.obstruction && s.obstruction.ownerId !== player.id)
      );
      return target ? target.id : 0;
    }

    // Pedágio/obstrução: colocar perto do nest de oponentes
    const opponentNests = gs.activePlayers
      .filter(p => p.id !== player.id)
      .map(p => NEST_POSITIONS[p.color]);

    // Pegar casas adjacentes aos nests dos oponentes
    for (const nestId of opponentNests) {
      const space = SPACES[nestId + 1]; // casa logo depois do nest
      if (space && space.type === 'property' && !space.toll && !space.obstruction) {
        return space.id;
      }
    }

    // Fallback: qualquer casa de propriedade sem pedágio
    const fallback = SPACES.find(s => s.type === 'property' && !s.toll && !s.obstruction);
    return fallback ? fallback.id : 0;
  }

  _findOpponentWithBuffs(player, gs) {
    return gs.activePlayers.find(p =>
      p.id !== player.id && (
        p.effects.lebre > 0 ||
        p.diceCount > 2 ||
        p.effects.isencaoTaxas > 0 ||
        p.effects.isencaoNegocios > 0
      )
    );
  }
}
