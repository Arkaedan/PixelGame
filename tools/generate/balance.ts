import type { Art } from './build.ts';
import { createRng, randomInt } from './rng.ts';

const EMPTY = -1;

/**
 * Nudge the art so every colour's pixel count is a multiple of `unit`, so all ammo can be too.
 *
 * Works by moving single pixels between neighbouring regions: a pixel on the edge between
 * colours A and B is recoloured from A to B. To move pixels between colours that don't touch,
 * they're passed along a chain of neighbouring regions, so the colours in between end up
 * unchanged. Empty background counts as a region too (when the art has any), so pixels can be
 * trimmed from or added to a shape's edge. In practice at most unit-1 pixels per colour change,
 * all on region edges.
 */
export function balanceArt(art: Art, unit = 10, seed = 1): Art {
  const height = art.grid.length;
  const width = art.grid[0]!.length;
  const cells = Int8Array.from(art.grid.join(''), (ch) => (ch === '.' ? EMPTY : parseInt(ch, 36)));
  const colours = art.palette.length;
  const rng = createRng(seed);

  const count = (c: number): number => cells.reduce((n, v) => n + (v === c ? 1 : 0), 0);
  const residue = (c: number): number => count(c) % unit;
  const neighbours = (i: number): number[] => {
    const x = i % width;
    const y = (i - x) / width;
    const out: number[] = [];
    if (x > 0) out.push(i - 1);
    if (x < width - 1) out.push(i + 1);
    if (y > 0) out.push(i - width);
    if (y < height - 1) out.push(i + width);
    return out;
  };

  /** How many of the 8 cells around `i` are colour `c`. */
  const surroundedBy = (i: number, c: number): number => {
    const x = i % width;
    const y = (i - x) / width;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < width && ny < height && cells[ny * width + nx] === c) n++;
      }
    }
    return n;
  };

  /**
   * Recolour one pixel of `from` that touches `to` into `to` (either may be EMPTY). Prefers the
   * pixel most surrounded by `to`, so changes fill dents and trim bumps rather than adding specks.
   */
  const moveOne = (from: number, to: number): void => {
    let best: number[] = [];
    let bestScore = 0;
    cells.forEach((v, i) => {
      if (v !== from || !neighbours(i).some((n) => cells[n] === to)) return;
      const score = surroundedBy(i, to);
      if (score > bestScore) {
        best = [i];
        bestScore = score;
      } else if (score === bestScore) {
        best.push(i);
      }
    });
    if (!best.length) throw new Error(`balanceArt: no edge between ${from} and ${to}`);
    cells[best[randomInt(rng, 0, best.length - 1)]!] = to;
  };

  /** Shortest chain of touching regions from colour `a` to any region accepted by `isTarget`. */
  const pathFrom = (a: number, isTarget: (c: number) => boolean): number[] | undefined => {
    const touching = new Map<number, Set<number>>();
    for (let c = EMPTY; c < colours; c++) touching.set(c, new Set());
    cells.forEach((v, i) => {
      for (const n of neighbours(i)) if (cells[n] !== v) touching.get(v)!.add(cells[n]!);
    });
    const previous = new Map<number, number>([[a, a]]);
    const queue = [a];
    while (queue.length) {
      const c = queue.shift()!;
      if (c !== a && isTarget(c)) {
        const path = [c];
        while (path[0] !== a) path.unshift(previous.get(path[0]!)!);
        return path;
      }
      for (const n of touching.get(c) ?? []) {
        if (!previous.has(n)) {
          previous.set(n, c);
          queue.push(n);
        }
      }
    }
    return undefined;
  };

  const moveAlong = (path: number[], amount: number): void => {
    for (let step = 0; step < path.length - 1; step++) {
      for (let k = 0; k < amount; k++) moveOne(path[step]!, path[step + 1]!);
    }
  };

  // First make the total a multiple of `unit` by trimming pixels into the background.
  let total = cells.reduce((n, v) => n + (v === EMPTY ? 0 : 1), 0) % unit;
  while (total > 0) {
    const a = [...Array(colours).keys()].find((c) => residue(c) > 0);
    const path = a === undefined ? undefined : pathFrom(a, (c) => c === EMPTY);
    if (a === undefined || !path) {
      throw new Error(
        'balanceArt: no background to trim into; art without one needs an area that is a multiple of unit',
      );
    }
    const amount = Math.min(residue(a), total);
    moveAlong(path, amount);
    total -= amount;
  }

  // Then pass leftover pixels from colour to colour until every count is a multiple.
  for (;;) {
    const a = [...Array(colours).keys()].find((c) => residue(c) > 0);
    if (a === undefined) break;
    const path = pathFrom(a, (c) => c !== EMPTY && residue(c) > 0);
    if (!path) throw new Error(`balanceArt: colour ${a} cannot reach another colour to balance with`);
    const b = path.at(-1)!;
    moveAlong(path, Math.min(residue(a), unit - residue(b)));
  }

  const grid: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const v = cells[y * width + x]!;
      row += v === EMPTY ? '.' : v.toString(36);
    }
    grid.push(row);
  }
  return { palette: art.palette, grid };
}
