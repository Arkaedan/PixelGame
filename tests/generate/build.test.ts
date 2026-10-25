import { describe, expect, it } from 'vitest';
import { parseLevel, verifySolution, type Difficulty } from '../../src/core/index.ts';
import { AMMO_UNIT, generateLevel, MAX_AMMO, type LevelSpec } from '../../tools/generate/build.ts';
import { formatLevel } from '../../tools/generate/format.ts';
import { Painter } from '../../tools/generate/paint.ts';
import { playGreedy } from '../../tools/generate/sim.ts';

const art = new Painter(20, 20, 16)
  .rect(0, 0, 16, 16, 0)
  .circle(8, 8, 6, 1)
  .rect(6, 6, 4, 4, 2)
  .toArt(['#e53935', '#1e88e5', '#fdd835']);

const spec = (difficulty: Difficulty, seed = 1): LevelSpec => ({ id: 't', name: 'T', difficulty, seed, art });

describe('generateLevel', () => {
  it.each(['easy', 'medium', 'hard'] as const)('builds a valid, beatable %s level', (difficulty) => {
    const { data } = generateLevel(spec(difficulty));
    const level = parseLevel(data); // also checks ammo totals match pixel counts exactly
    expect(verifySolution(level, data.solution!)).toEqual({ ok: true });
    expect(data.difficulty).toBe(difficulty);
  });

  it('is deterministic for a given seed', () => {
    expect(formatLevel(generateLevel(spec('medium', 3)).data)).toBe(formatLevel(generateLevel(spec('medium', 3)).data));
  });

  it('easy levels can be won greedily', () => {
    const { data } = generateLevel(spec('easy'));
    expect(playGreedy(parseLevel(data)).won).toBe(true);
  });

  it('only uses ammo of 10, 20, 30 or 40', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const ammo = generateLevel(spec(difficulty))
        .data.queue.flat()
        .map((s) => s.a);
      expect(ammo.filter((a) => a % AMMO_UNIT !== 0 || a > MAX_AMMO)).toEqual([]);
    }
  });

  it('hard levels use the buffer and mystery shooters', () => {
    const { data, stats } = generateLevel(spec('hard'));
    expect(stats.bufferRedeploys).toBeGreaterThan(0);
    expect(data.queue.flat().some((s) => s.hidden)).toBe(true);
    // mystery shooters never start at the front of a column
    expect(data.queue.every((col) => !col[0]?.hidden)).toBe(true);
  });
});

describe('Painter', () => {
  it('draws shapes by cell centre and outlines the result', () => {
    const grid = new Painter(5).circle(2.5, 2.5, 1.6, 0).outline(1).toArt(['#000', '#fff']).grid;
    expect(grid).toEqual(['.....', '.111.', '.101.', '.111.', '.....']);
  });
});
