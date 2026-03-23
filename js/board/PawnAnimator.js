// ========================================
// PawnAnimator - Animação Suave de Peões
// ========================================

import { SPACES, TOTAL_SPACES, getNextSpaces, hasBifurcation } from '../config/board-layout.js';
import { GameSpeed } from '../config/constants.js';
import { eventBus } from '../utils/EventBus.js';
import { soundManager } from '../utils/SoundManager.js';

export class PawnAnimator {
  constructor() {
    this.animating = false;
  }

  // Move o peão passo a passo com animação suave
  async animateMove(player, steps, onStepComplete) {
    this.animating = true;

    for (let step = 0; step < steps; step++) {
      const currentSpace = SPACES[player.position];
      const nextSpaces = getNextSpaces(player.position);

      let nextPos;
      if (nextSpaces.length > 1) {
        // Bifurcação - pedir escolha ao jogador
        nextPos = await this.askBifurcationChoice(player, nextSpaces);
      } else {
        nextPos = nextSpaces[0];
      }

      const toSpace = SPACES[nextPos];
      await this.animateStep(player, currentSpace, toSpace);
      soundManager.playPawnMove();
      player.position = nextPos;

      if (onStepComplete) {
        const shouldStop = await onStepComplete(player, toSpace, step + 1, steps);
        if (shouldStop) break;
      }
    }

    this.animating = false;
  }

  // Bifurcação: mostrar opções ao jogador
  askBifurcationChoice(player, options) {
    return new Promise(resolve => {
      eventBus.emit('bifurcationChoice', {
        player,
        options,
        onChoice: (chosenSpaceId) => resolve(chosenSpaceId),
      });
    });
  }

  // Animação suave entre duas casas com bounce
  animateStep(player, fromSpace, toSpace) {
    return new Promise(resolve => {
      const duration = 250 * GameSpeed.anim;
      const startTime = performance.now();

      player._animX = fromSpace.position.x;
      player._animY = fromSpace.position.y;
      player._isAnimating = true;

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const t = Math.min(elapsed / duration, 1);

        // Ease out com leve bounce
        const ease = t < 0.7
          ? 1 - Math.pow(1 - t / 0.7, 3)
          : 1 + Math.sin((t - 0.7) / 0.3 * Math.PI) * 0.05;

        player._animX = fromSpace.position.x + (toSpace.position.x - fromSpace.position.x) * ease;
        player._animY = fromSpace.position.y + (toSpace.position.y - fromSpace.position.y) * ease;

        // Leve pulo durante movimento
        const jumpHeight = Math.sin(t * Math.PI) * 8;
        player._animY -= jumpHeight;

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          player._animX = toSpace.position.x;
          player._animY = toSpace.position.y;
          player._isAnimating = false;
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }
}
