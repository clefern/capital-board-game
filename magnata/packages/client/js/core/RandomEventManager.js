// ========================================
// RandomEventManager - Eventos Aleatórios
// ========================================

import { eventBus } from '../utils/EventBus.js';

const EVENTS = [
  {
    id: 'crise', icon: '📉', name: 'Crise Econômica',
    desc: 'Todos perdem 20% do dinheiro!',
    apply(gs) {
      for (const p of gs.activePlayers) {
        const loss = Math.floor(p.money * 0.2);
        p.pay(loss);
        gs.addLog(`${p.name} perdeu $${loss} na crise.`);
      }
    }
  },
  {
    id: 'boom', icon: '📈', name: 'Boom Imobiliário',
    desc: 'Todos os negócios sobem 1 nível!',
    apply(gs) {
      for (const p of gs.activePlayers) {
        for (const biz of p.businesses) biz.levelUp(1);
      }
      gs.addLog('Boom imobiliário! Todos os negócios subiram de nível.');
    }
  },
  {
    id: 'greve', icon: '✊', name: 'Greve Geral',
    desc: 'Ninguém cobra aluguel por 2 turnos!',
    apply(gs) {
      for (const p of gs.activePlayers) {
        p.effects.isencaoNegocios = Math.max(p.effects.isencaoNegocios || 0, 2);
      }
      gs.addLog('Greve geral! Isenção de aluguel por 2 turnos.');
    }
  },
  {
    id: 'subsidio', icon: '🏛️', name: 'Subsídio do Governo',
    desc: 'Todos recebem $200!',
    apply(gs) {
      for (const p of gs.activePlayers) p.receive(200);
      gs.addLog('Subsídio do governo! Todos receberam $200.');
    }
  },
  {
    id: 'inflacao', icon: '💸', name: 'Inflação',
    desc: 'Custo de construção +50% por 3 turnos!',
    apply(gs) {
      gs._inflationTurns = (gs._inflationTurns || 0) + 3;
      gs.addLog('Inflação! Construir custa 50% mais caro por 3 turnos.');
    }
  },
  {
    id: 'feira', icon: '🎪', name: 'Feira de Negócios',
    desc: 'Todos ganham 1 carta grátis!',
    apply(gs) {
      for (const p of gs.activePlayers) {
        if (gs.deck.remainingCards > 0) {
          p.addCard(gs.deck.draw());
        }
      }
      gs.addLog('Feira de negócios! Todos ganharam uma carta.');
    }
  },
  {
    id: 'terremoto', icon: '🌋', name: 'Terremoto',
    desc: 'Um negócio aleatório de cada jogador perde 1 nível!',
    apply(gs) {
      for (const p of gs.activePlayers) {
        if (p.businesses.length > 0) {
          const biz = p.businesses[Math.floor(Math.random() * p.businesses.length)];
          if (biz.level > 1) biz.level--;
          gs.addLog(`${biz.label} de ${p.name} foi danificado pelo terremoto.`);
        }
      }
    }
  },
  {
    id: 'sorte', icon: '🍀', name: 'Sorte Grande',
    desc: 'Jogador atual ganha $500!',
    apply(gs) {
      const p = gs.currentPlayer;
      p.receive(500);
      gs.addLog(`${p.name} teve sorte grande e ganhou $500!`);
    }
  },
];

export class RandomEventManager {
  static EVENT_CHANCE = 0.15;

  static tryTrigger(gameState) {
    if (Math.random() > this.EVENT_CHANCE) return null;
    const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    event.apply(gameState);
    eventBus.emit('randomEvent', { event });
    return event;
  }
}
