import { describe, expect, it } from 'vitest';
import { cloneGame, parseLevel, replay, step, verifySolution, type TimedAction } from '../../src/core';
import { BLUE, levelData, RED } from './helpers';

// Red frame around a blue centre: blue can only be reached once red is cleared.
const framed = parseLevel(
  levelData(['000', '010', '000'], [[{ c: RED, a: 4 }], [{ c: RED, a: 4 }], [{ c: BLUE, a: 1 }]]),
);

const winning: TimedAction[] = [
  { tick: 0, action: { type: 'deployQueue', column: 0 } },
  { tick: 0, action: { type: 'deployQueue', column: 1 } },
  { tick: 20, action: { type: 'deployQueue', column: 2 } },
];

describe('replay', () => {
  it('plays a level through to a win', () => {
    const { state, rejected } = replay(framed, winning);
    expect(rejected).toEqual([]);
    expect(state.status).toBe('won');
    expect(verifySolution(framed, winning)).toEqual({ ok: true });
  });

  it('is deterministic', () => {
    const a = replay(framed, winning).state;
    const b = replay(framed, winning).state;
    expect(a.tick).toBe(b.tick);
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
    expect(a.buffer).toEqual(b.buffer);
  });

  it('stops when idle with no actions left', () => {
    const { state } = replay(framed, winning.slice(0, 1));
    expect(state.status).toBe('playing');
    expect(state.track).toEqual([]);
    expect(state.remaining).toBeGreaterThan(0);
  });

  it('rejects solutions that use power-ups, lose, or contain invalid actions', () => {
    const withPowerUp: TimedAction[] = [{ tick: 0, action: { type: 'powerUp', kind: 'extraSlot' } }, ...winning];
    expect(verifySolution(framed, withPowerUp)).toEqual({ ok: false, reason: 'uses 1 power-up(s)' });

    const early: TimedAction[] = [{ tick: 0, action: { type: 'deployQueue', column: 2 } }];
    expect(verifySolution(framed, early).reason).toMatch(/^lost \(stuck\)|not cleared/);

    const invalid: TimedAction[] = [...winning, { tick: 1, action: { type: 'deployBuffer', slot: 0 } }];
    expect(verifySolution(framed, invalid)).toEqual({ ok: false, reason: 'rejected action at tick 1: empty-slot' });
  });
});

describe('cloneGame', () => {
  it('produces an independent copy', () => {
    const { state } = replay(framed, winning.slice(0, 2), 3);
    const copy = cloneGame(state);
    step(copy);
    step(copy);
    expect(copy.tick).toBe(state.tick + 2);
    expect(Array.from(copy.cells)).not.toEqual(Array.from(state.cells));
    expect(state.track[0]!.pos).not.toBe(copy.track[0]!.pos);
  });
});
