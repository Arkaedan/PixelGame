import { describe, expect, it } from 'vitest';
import { balanceArt } from '../../tools/generate/balance.ts';
import type { Art } from '../../tools/generate/build.ts';
import { Painter } from '../../tools/generate/paint.ts';
import { createRng, randomInt } from '../../tools/generate/rng.ts';

function counts(art: Art): number[] {
  const out = art.palette.map(() => 0);
  for (const ch of art.grid.join('')) if (ch !== '.') out[parseInt(ch, 36)]!++;
  return out;
}

function changedCells(a: Art, b: Art): number {
  const x = a.grid.join('');
  const y = b.grid.join('');
  let n = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) n++;
  return n;
}

const palette = ['#f00', '#0f0', '#00f', '#ff0'];

describe('balanceArt', () => {
  it('makes every colour count a multiple of 10 on art with a background', () => {
    const art = new Painter(30)
      .circle(15, 15, 11.3, 0)
      .ellipse(12, 12, 3.1, 2.2, 1)
      .rect(16, 17, 5, 3, 2)
      .toArt(palette);
    const balanced = balanceArt(art);
    expect(counts(balanced).every((n) => n % 10 === 0)).toBe(true);
    // a few edge pixels at most, not a redraw
    expect(changedCells(art, balanced)).toBeLessThanOrEqual(3 * 9 * 2);
  });

  it('balances full-bleed art by recolouring, without opening holes', () => {
    const art = new Painter(30).fill((x, y) => (Math.floor(x / 7) + Math.floor(y / 7)) % 3).toArt(palette);
    const balanced = balanceArt(art);
    expect(counts(balanced).every((n) => n % 10 === 0)).toBe(true);
    expect(balanced.grid.join('')).not.toContain('.');
  });

  it('handles colours that only touch the background, like scattered stars', () => {
    const rng = createRng(3);
    const p = new Painter(30).circle(15, 15, 8, 0);
    for (let i = 0; i < 23; i++) p.set(randomInt(rng, 0, 29), randomInt(rng, 0, 4), 1);
    const balanced = balanceArt(p.toArt(palette));
    expect(counts(balanced).every((n) => n % 10 === 0)).toBe(true);
  });

  it('leaves art that is already balanced alone', () => {
    const art = new Painter(30).rect(0, 0, 10, 10, 0).rect(10, 0, 10, 10, 1).toArt(palette);
    expect(balanceArt(art)).toEqual(art);
  });
});
