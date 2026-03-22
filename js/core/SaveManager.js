// ========================================
// SaveManager - Salvar/Carregar via LocalStorage
// ========================================

import { CARD_TYPES } from '../config/cards-data.js';
import { Business } from './Business.js';

const SAVE_KEY = 'capital_game_save';

export class SaveManager {

  static hasSave() {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch (e) {
      return false;
    }
  }

  static deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  static save(gameState) {
    try {
      const data = {
        version: 1,
        timestamp: Date.now(),
        round: gameState.round,
        currentPlayerIndex: gameState.currentPlayerIndex,
        turnPhase: gameState.turnPhase,
        players: gameState.players.map(p => ({
          id: p.id,
          color: p.color,
          name: p.name,
          isBot: p.isBot,
          money: p.money,
          position: p.position,
          laps: p.laps,
          diceCount: p.diceCount,
          bankrupt: p.bankrupt,
          effects: { ...p.effects },
          stats: { ...p.stats },
          lastDice: p.lastDice,
          cards: p.cards.map(c => c.id),
          businesses: p.businesses.map(b => ({
            type: b.type,
            spaceId: b.spaceId,
            slot: b.slot,
            level: b.level,
          })),
        })),
        // Deck state
        drawPile: gameState.deck.drawPile.map(c => c.id),
        discardPile: gameState.deck.discardPile.map(c => c.id),
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Erro ao salvar:', e);
      return false;
    }
  }

  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Erro ao carregar save:', e);
      return null;
    }
  }

  static restore(gameState, data) {
    try {
      gameState.round = data.round || 0;
      gameState.currentPlayerIndex = data.currentPlayerIndex || 0;
      gameState.turnPhase = data.turnPhase || 'ROLL';

      for (const pd of data.players) {
        const player = gameState.players.find(p => p.id === pd.id);
        if (!player) continue;

        player.money = pd.money;
        player.position = pd.position;
        player.laps = pd.laps;
        player.diceCount = pd.diceCount;
        player.bankrupt = pd.bankrupt;
        player.lastDice = pd.lastDice || null;
        player.effects = { ...pd.effects };
        if (pd.stats) player.stats = { ...pd.stats };

        // Reconstruir cartas
        player.cards = (pd.cards || [])
          .map(id => CARD_TYPES[id] ? { ...CARD_TYPES[id] } : null)
          .filter(Boolean);

        // Reconstruir negócios
        player.businesses = (pd.businesses || []).map(bd => {
          const biz = new Business(bd.type, bd.spaceId, player.id, bd.slot);
          biz.level = bd.level || 1;
          return biz;
        });
      }

      // Reconstruir deck
      if (data.drawPile) {
        gameState.deck.drawPile = data.drawPile
          .map(id => CARD_TYPES[id] ? { ...CARD_TYPES[id] } : null)
          .filter(Boolean);
      }
      if (data.discardPile) {
        gameState.deck.discardPile = data.discardPile
          .map(id => CARD_TYPES[id] ? { ...CARD_TYPES[id] } : null)
          .filter(Boolean);
      }

      return true;
    } catch (e) {
      console.error('Erro ao restaurar save:', e);
      return false;
    }
  }
}
