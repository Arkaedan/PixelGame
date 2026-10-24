import { describe, expect, it } from 'vitest';
import { EMPTY, LevelError, parseLevel, type LevelData } from '../../src/core/index.ts';
import { BLUE, levelData, RED } from './helpers.ts';

function problemsOf(data: LevelData): string {
  try {
    parseLevel(data);
  } catch (e) {
    if (e instanceof LevelError) return e.problems.join('\n');
    throw e;
  }
  throw new Error('expected parseLevel to throw');
}

describe('parseLevel', () => {
  it('parses a valid level and applies default rules', () => {
    const level = parseLevel(levelData(['0.1', '00.'], [[{ c: RED, a: 3 }], [{ c: BLUE, a: 1 }]]));
    expect(Array.from(level.cells)).toEqual([RED, EMPTY, BLUE, RED, RED, EMPTY]);
    expect(level.trackCapacity).toBe(5);
    expect(level.bufferSize).toBe(5);
    expect(level.visibleRows).toBe(3);
    expect(level.trackLength).toBe(2 * 3 + 2 * 2 + 4);
  });

  it('accepts rule overrides', () => {
    const level = parseLevel(
      levelData(['0'], [[{ c: RED, a: 1 }]], { trackCapacity: 2, bufferSize: 1, visibleRows: 4 }),
    );
    expect([level.trackCapacity, level.bufferSize, level.visibleRows]).toEqual([2, 1, 4]);
  });

  it('rejects ammo totals that do not match pixel counts', () => {
    const data = levelData(['00', '11'], [[{ c: RED, a: 3 }], [{ c: BLUE, a: 1 }]]);
    expect(() => parseLevel(data)).toThrow(/colour 0: ammo total 3 != pixel count 2/);
    expect(() => parseLevel(data)).toThrow(/colour 1: ammo total 1 != pixel count 2/);
    expect(() => parseLevel(data, { exactAmmo: false })).not.toThrow();
  });

  it('reports every problem it finds', () => {
    const data = levelData(
      ['0x', '0'],
      [
        [
          { c: 5, a: 1 },
          { c: RED, a: 0 },
        ],
      ],
    );
    data.queue = data.queue.slice(0, 4);
    const problems = problemsOf(data);
    expect(problems).toMatch(/row 0 col 1: unknown colour "x"/);
    expect(problems).toMatch(/row 1 has length 1, expected 2/);
    expect(problems).toMatch(/queue has 4 columns/);
    expect(problems).toMatch(/queue\[0\]\[0\]: unknown colour 5/);
    expect(problems).toMatch(/queue\[0\]\[1\]: ammo must be a positive integer/);
  });

  it('rejects mismatched dimensions and empty grids', () => {
    expect(() => parseLevel(levelData(['00'], [], { height: 2 }))).toThrow(/grid has 1 rows, expected 2/);
    expect(() => parseLevel(levelData(['..'], []))).toThrow(/no pixels/);
  });
});
