import { describe, expect, it } from 'vitest';
import { applyAction } from '../../src/core/index.ts';
import { computeLayout, contains, queueTiles } from '../../src/game/layout.ts';
import { game, RED } from '../core/helpers.ts';

const column = Array.from({ length: 12 }, () => ({ c: RED, a: 1 }));

describe('queueTiles', () => {
  it('shows the visible rows and counts the rest', () => {
    const s = game(['0'], [column, column.slice(0, 2)]);
    const view = queueTiles(computeLayout(375, 700, s.level), s);
    const col0 = view.tiles.filter((t) => t.column === 0);
    expect(col0.map((t) => t.index)).toEqual([0, 1, 2]);
    expect(col0.every((t) => !t.compact)).toBe(true);
    expect(view.tiles.filter((t) => t.column === 1)).toHaveLength(2);
    expect(view.more).toEqual([expect.objectContaining({ column: 0, count: 9 })]);
  });

  it('adds compact rows after Reveal, as many as fit', () => {
    const s = game(['0'], [column]);
    applyAction(s, { type: 'powerUp', kind: 'reveal' });
    const layout = computeLayout(375, 700, s.level);
    const tiles = queueTiles(layout, s).tiles.filter((t) => t.column === 0);
    expect(tiles.length).toBeGreaterThan(3);
    expect(tiles.slice(3).every((t) => t.compact)).toBe(true);
    for (const t of tiles) expect(t.rect.y + t.rect.h).toBeLessThanOrEqual(layout.height);
  });

  it('gives every tile a rect inside its column, without overlaps', () => {
    const s = game(['0'], [column, column, column]);
    applyAction(s, { type: 'powerUp', kind: 'reveal' });
    const layout = computeLayout(390, 800, s.level);
    const { tiles } = queueTiles(layout, s);
    for (const t of tiles) {
      const centre = { x: t.rect.x + t.rect.w / 2, y: t.rect.y + t.rect.h / 2 };
      expect(contains(layout.columns[t.column]!, centre)).toBe(true);
      const hits = tiles.filter((o) => contains(o.rect, centre));
      expect(hits).toEqual([t]);
    }
  });
});
