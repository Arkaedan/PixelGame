import {
  applyAction,
  cloneGame,
  createGame,
  isIdle,
  step,
  type Action,
  type GameState,
  type Level,
  type Shooter,
} from '../../src/core/index.ts';

/** Step until nothing is moving or the game ends. */
export function runUntilIdle(state: GameState): void {
  while (state.status === 'playing' && !isIdle(state)) step(state);
}

/**
 * Pixels a shooter of colour `color` with `ammo` would hit in one lap if sent out now on its own.
 * Expects an idle state.
 */
export function lapHits(state: GameState, color: number, ammo = Infinity): number {
  const probe = cloneGame(state);
  const id = -1000;
  probe.pending.push({ id, color, ammo, hidden: false });
  let hits = 0;
  while (probe.status === 'playing' && !isIdle(probe)) {
    for (const e of step(probe)) if (e.type === 'shot' && e.shooterId === id) hits++;
  }
  return hits;
}

export interface PlayResult {
  won: boolean;
  state: GameState;
  deploys: number;
}

interface Option {
  action: Action;
  shooter: Shooter;
  fromBuffer: boolean;
}

/**
 * A simple, short-sighted player used to rate difficulty: one shooter at a time, always picking
 * the visible shooter (column fronts and buffer) that hits the most pixels this lap. It never
 * uses power-ups and never deploys something that would overflow the buffer.
 */
export function playGreedy(level: Level): PlayResult {
  const state = createGame(level);
  let deploys = 0;
  while (state.status === 'playing') {
    const options: Option[] = [];
    state.buffer.forEach((shooter, slot) => {
      if (shooter) options.push({ action: { type: 'deployBuffer', slot }, shooter, fromBuffer: true });
    });
    state.queue.forEach((col, column) => {
      const shooter = col[0];
      if (shooter) options.push({ action: { type: 'deployQueue', column }, shooter, fromBuffer: false });
    });
    const bufferFree = state.buffer.includes(null);

    let best: Option | undefined;
    let bestScore = -1;
    for (const o of options) {
      const hits = lapHits(state, o.shooter.color, o.shooter.ammo);
      const finishes = hits >= o.shooter.ammo;
      if (o.fromBuffer && hits === 0) continue; // would come straight back
      if (!o.fromBuffer && !finishes && !bufferFree) continue; // would overflow
      const score = hits * 4 + (finishes ? 2 : 0) + (o.fromBuffer ? 1 : 0);
      if (score > bestScore) {
        best = o;
        bestScore = score;
      }
    }
    if (!best) break;
    applyAction(state, best.action);
    deploys++;
    runUntilIdle(state);
  }
  return { won: state.status === 'won', state, deploys };
}
