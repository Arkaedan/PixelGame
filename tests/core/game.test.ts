import { describe, expect, it } from 'vitest';
import { applyAction, isQueueRevealed, isStuck, step } from '../../src/core/index.ts';
import { BLUE, boardRows, game, RED, run } from './helpers.ts';

const deploy = (column: number, index?: number) => ({ type: 'deployQueue' as const, column, index });

describe('shooting', () => {
  it('clears a row and wins when the board is empty', () => {
    const s = game(['000'], [[{ c: RED, a: 3 }]], {}, true);
    expect(applyAction(s, deploy(0))).toEqual({ ok: true });

    expect(step(s)).toEqual([{ type: 'enter', shooterId: 0 }]);
    // positions 1..3 face columns 0..2 from below
    expect(run(s, 2).map((e) => e.type)).toEqual(['shot', 'shot']);
    expect(step(s)).toEqual([
      { type: 'shot', shooterId: 0, cell: 2, color: RED, pos: 3 },
      { type: 'exhausted', shooterId: 0, color: RED, pos: 3 },
      { type: 'won' },
    ]);
    expect(s.status).toBe('won');
    expect(s.tick).toBe(4);
    expect(s.track).toEqual([]);
  });

  it('fires once per line per pass and is blocked by other colours', () => {
    // red column in the middle, walled by blue on both sides
    const s = game(['101', '101'], [[{ c: RED, a: 2 }], [{ c: BLUE, a: 4 }]]);
    applyAction(s, deploy(0));
    run(s, 3); // enter, bottom col 0 (blue first: blocked), bottom col 1
    expect(boardRows(s)).toEqual(['101', '1.1']);
    expect(s.track[0]!.shooter.ammo).toBe(1);

    run(s, 6); // rest of bottom, right side (blue first), corner, top col 2 (blue)
    expect(boardRows(s)).toEqual(['101', '1.1']);
    step(s); // top col 1
    expect(boardRows(s)).toEqual(['1.1', '1.1']);
    expect(s.track).toEqual([]);
    expect(s.status).toBe('playing');
  });

  it('hits exposed pixels from the side', () => {
    const s = game(['0', '1'], [[{ c: RED, a: 1 }], [{ c: BLUE, a: 1 }]]);
    applyAction(s, deploy(0));
    // 1x2 board: pos 1 bottom (blue first), pos 3 right row 1 (blue), pos 4 right row 0 (red)
    run(s, 4);
    expect(boardRows(s)).toEqual(['0', '1']);
    step(s);
    expect(boardRows(s)).toEqual(['.', '1']);
  });
});

describe('lap and buffer', () => {
  it('moves a shooter with ammo left to the buffer after one lap, keeping its ammo', () => {
    const s = game(['1'], [[{ c: RED, a: 5 }], [{ c: BLUE, a: 1 }]]);
    applyAction(s, deploy(0));
    run(s, 8); // lap length on a 1x1 board is 8
    expect(s.track).toHaveLength(1);
    expect(step(s)).toEqual([{ type: 'buffered', shooterId: 0, slot: 0 }]);
    expect(s.buffer[0]).toMatchObject({ color: RED, ammo: 5 });

    expect(applyAction(s, { type: 'deployBuffer', slot: 0 })).toEqual({ ok: true });
    expect(s.buffer[0]).toBeNull();
    step(s);
    expect(s.track[0]).toMatchObject({ pos: 0, shooter: { ammo: 5 } });
  });

  it('fails when a shooter finishes its lap with the buffer full', () => {
    const s = game(
      ['1'],
      [
        [
          { c: RED, a: 1 },
          { c: RED, a: 1 },
        ],
        [{ c: BLUE, a: 1 }],
      ],
      { bufferSize: 1 },
    );
    applyAction(s, deploy(0));
    applyAction(s, deploy(0));
    run(s, 9);
    expect(s.buffer[0]).not.toBeNull();
    expect(s.status).toBe('playing');
    expect(step(s)).toEqual([{ type: 'lost', reason: 'overflow' }]);
    expect(s.status).toBe('lost');
    expect(s.lossReason).toBe('overflow');
    expect(applyAction(s, deploy(1))).toEqual({ ok: false, error: 'not-playing' });
  });

  it('rejects bad buffer slots', () => {
    const s = game(['0'], [[{ c: RED, a: 1 }]]);
    expect(applyAction(s, { type: 'deployBuffer', slot: 0 })).toEqual({ ok: false, error: 'empty-slot' });
    expect(applyAction(s, { type: 'deployBuffer', slot: 5 })).toEqual({ ok: false, error: 'bad-slot' });
  });
});

describe('stuck detection', () => {
  it('fails when nothing is left that can hit the board', () => {
    const s = game(['1'], [[{ c: RED, a: 1 }]]);
    applyAction(s, deploy(0));
    run(s, 9);
    expect(s.status).toBe('lost');
    expect(s.lossReason).toBe('stuck');
  });

  it('is not stuck while a buffered shooter has a target', () => {
    const s = game(['0'], [[{ c: RED, a: 1 }]]);
    s.buffer[0] = s.queue[0]!.shift()!;
    expect(isStuck(s)).toBe(false);
    s.cells[0] = BLUE;
    expect(isStuck(s)).toBe(true);
  });

  it('is not stuck while the queue has shooters', () => {
    const s = game(['1'], [[{ c: RED, a: 1 }], [{ c: BLUE, a: 1 }]]);
    applyAction(s, deploy(0));
    run(s, 9);
    expect(s.status).toBe('playing');
  });
});

describe('deploying', () => {
  it('lets one shooter enter per step', () => {
    const s = game(['1'], [[{ c: RED, a: 1 }], [{ c: RED, a: 1 }]]);
    applyAction(s, deploy(0));
    applyAction(s, deploy(1));
    step(s);
    expect(s.track.map((t) => t.pos)).toEqual([0]);
    expect(s.pending).toHaveLength(1);
    step(s);
    expect(s.track.map((t) => t.pos)).toEqual([1, 0]);
  });

  it('spaces shooters further apart on bigger boards', () => {
    // longest side 33 -> entry gap of 3 positions
    const s = game(['1'.repeat(33)], [[{ c: RED, a: 1 }], [{ c: RED, a: 1 }]]);
    expect(s.level.entryGap).toBe(3);
    applyAction(s, deploy(0));
    applyAction(s, deploy(1));
    run(s, 3);
    expect(s.track.map((t) => t.pos)).toEqual([2]);
    step(s);
    expect(s.track.map((t) => t.pos)).toEqual([3, 0]);
  });

  it('enforces track capacity, which Extra Slot raises', () => {
    const s = game(['1'], [[{ c: RED, a: 1 }], [{ c: RED, a: 1 }]], { trackCapacity: 1 });
    expect(applyAction(s, deploy(0))).toEqual({ ok: true });
    expect(applyAction(s, deploy(1))).toEqual({ ok: false, error: 'track-full' });
    expect(applyAction(s, { type: 'powerUp', kind: 'extraSlot' })).toEqual({ ok: true });
    expect(s.capacity).toBe(2);
    expect(applyAction(s, deploy(1))).toEqual({ ok: true });
    expect(applyAction(s, { type: 'powerUp', kind: 'extraSlot' })).toEqual({ ok: true });
    expect(s.powerUps).toEqual({ extraSlot: 2, pickAny: 0, reveal: 0 });
  });

  it('rejects empty and unknown columns', () => {
    const s = game(['0'], [[{ c: RED, a: 1 }]]);
    expect(applyAction(s, deploy(2))).toEqual({ ok: false, error: 'empty-column' });
    expect(applyAction(s, deploy(7))).toEqual({ ok: false, error: 'bad-column' });
  });
});

describe('Pick Any and Reveal', () => {
  const column = [RED, BLUE, RED, BLUE, RED].map((c) => ({ c, a: 1 }));

  it('deploys a visible shooter from behind the front and records it', () => {
    const s = game(['1'], [column]);
    expect(applyAction(s, deploy(0, 3))).toEqual({ ok: false, error: 'not-visible' });
    expect(applyAction(s, deploy(0, 1))).toEqual({ ok: true });
    expect(s.pending[0]!.color).toBe(BLUE);
    expect(s.queue[0]!.map((x) => x.color)).toEqual([RED, RED, BLUE, RED]);
    expect(s.powerUps.pickAny).toBe(1);
  });

  it('Reveal makes the whole queue pickable, once', () => {
    const s = game(['1'], [column]);
    expect(applyAction(s, { type: 'powerUp', kind: 'reveal' })).toEqual({ ok: true });
    expect(applyAction(s, { type: 'powerUp', kind: 'reveal' })).toEqual({ ok: false, error: 'already-revealed' });
    expect(applyAction(s, deploy(0, 4))).toEqual({ ok: true });
    expect(s.powerUps).toEqual({ extraSlot: 0, pickAny: 1, reveal: 1 });
  });

  it('shows mystery shooters only at the front or after Reveal', () => {
    const s = game(
      ['1'],
      [
        [
          { c: BLUE, a: 1 },
          { c: RED, a: 1, hidden: true },
          { c: RED, a: 1, hidden: true },
          { c: RED, a: 1 },
        ],
      ],
    );
    expect([0, 1, 2, 3].map((i) => isQueueRevealed(s, 0, i))).toEqual([true, false, false, false]);
    applyAction(s, deploy(0));
    expect([0, 1, 2].map((i) => isQueueRevealed(s, 0, i))).toEqual([true, false, true]);
    applyAction(s, { type: 'powerUp', kind: 'reveal' });
    expect([0, 1, 2].map((i) => isQueueRevealed(s, 0, i))).toEqual([true, true, true]);
  });
});
