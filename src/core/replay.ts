import { applyAction, createGame, isIdle, step } from './game.ts';
import type { ActionError, GameState, Level, TimedAction } from './types.ts';

export interface ReplayResult {
  state: GameState;
  /** Actions that were rejected, in order. A valid solution has none. */
  rejected: { tick: number; error: ActionError }[];
}

/**
 * Play a level from the start with the given timed actions. Stops when the game ends, when
 * there is nothing left to do (no more actions and the track is idle), or after `maxTicks`.
 */
export function replay(level: Level, actions: TimedAction[], maxTicks = 1_000_000): ReplayResult {
  const state = createGame(level);
  const sorted = actions.toSorted((a, b) => a.tick - b.tick);
  const rejected: ReplayResult['rejected'] = [];
  let next = 0;

  while (state.status === 'playing' && state.tick < maxTicks) {
    while (next < sorted.length && sorted[next]!.tick <= state.tick) {
      const { tick, action } = sorted[next++]!;
      const result = applyAction(state, action);
      if (!result.ok) rejected.push({ tick, error: result.error });
    }
    if (next >= sorted.length && isIdle(state)) break;
    step(state);
  }
  return { state, rejected };
}

/** A solution is valid if it wins with no rejected actions and no power-ups. */
export function verifySolution(level: Level, actions: TimedAction[]): { ok: boolean; reason?: string } {
  const { state, rejected } = replay(level, actions);
  if (rejected.length)
    return { ok: false, reason: `rejected action at tick ${rejected[0]!.tick}: ${rejected[0]!.error}` };
  const used = Object.values(state.powerUps).reduce((a, b) => a + b, 0);
  if (used) return { ok: false, reason: `uses ${used} power-up(s)` };
  if (state.status === 'won') return { ok: true };
  if (state.status === 'lost') return { ok: false, reason: `lost (${state.lossReason}) at tick ${state.tick}` };
  return { ok: false, reason: `not cleared: ${state.remaining} pixel(s) left at tick ${state.tick}` };
}
