import { describe, expect, it } from 'vitest';
import { buildSlots, EMPTY, firstPixel, trackLength } from '../../src/core/index.ts';

describe('track layout', () => {
  it('has 2W+2H+4 positions with corners at the expected places', () => {
    const w = 3;
    const h = 2;
    const slots = buildSlots(w, h);
    expect(slots).toHaveLength(trackLength(w, h));
    expect(slots).toHaveLength(14);
    const corners = slots.flatMap((s, i) => (s.kind === 'corner' ? [i] : []));
    expect(corners).toEqual([0, h + 1, w + h + 2, w + 2 * h + 3]);
  });

  it('runs anticlockwise from the bottom-right corner: up, left, down, then right', () => {
    expect(buildSlots(3, 2).slice(1)).toEqual([
      { kind: 'line', side: 'right', index: 1 },
      { kind: 'line', side: 'right', index: 0 },
      { kind: 'corner' },
      { kind: 'line', side: 'top', index: 2 },
      { kind: 'line', side: 'top', index: 1 },
      { kind: 'line', side: 'top', index: 0 },
      { kind: 'corner' },
      { kind: 'line', side: 'left', index: 0 },
      { kind: 'line', side: 'left', index: 1 },
      { kind: 'corner' },
      { kind: 'line', side: 'bottom', index: 0 },
      { kind: 'line', side: 'bottom', index: 1 },
      { kind: 'line', side: 'bottom', index: 2 },
    ]);
  });

  it('visits every line of the board exactly once', () => {
    const slots = buildSlots(7, 4).filter((s) => s.kind === 'line');
    const keys = new Set(slots.map((s) => `${s.side}:${s.index}`));
    expect(keys.size).toBe(2 * 7 + 2 * 4);
  });
});

describe('firstPixel', () => {
  // 3x3, only the centre and the top-right corner filled
  const E = EMPTY;
  const cells = Int16Array.from([E, E, 1, E, 0, E, E, E, E]);

  it('finds the nearest pixel from each side', () => {
    expect(firstPixel(cells, 3, 3, { kind: 'line', side: 'bottom', index: 1 })).toBe(4);
    expect(firstPixel(cells, 3, 3, { kind: 'line', side: 'top', index: 2 })).toBe(2);
    expect(firstPixel(cells, 3, 3, { kind: 'line', side: 'right', index: 0 })).toBe(2);
    expect(firstPixel(cells, 3, 3, { kind: 'line', side: 'left', index: 1 })).toBe(4);
  });

  it('returns -1 for empty lines and corners', () => {
    expect(firstPixel(cells, 3, 3, { kind: 'line', side: 'bottom', index: 0 })).toBe(-1);
    expect(firstPixel(cells, 3, 3, { kind: 'corner' })).toBe(-1);
  });
});
