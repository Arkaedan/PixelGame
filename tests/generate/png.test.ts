import { describe, expect, it } from 'vitest';
import { colourDistance, imageToArt, type RgbaImage } from '../../tools/generate/png.ts';

/** Build an RGBA image from rows of single-character keys. */
function image(rows: string[], colours: Record<string, [number, number, number, number]>): RgbaImage {
  const width = rows[0]!.length;
  const data = new Uint8Array(width * rows.length * 4);
  rows.forEach((row, y) =>
    row.split('').forEach((ch, x) => data.set(colours[ch] ?? [0, 0, 0, 0], (y * width + x) * 4)),
  );
  return { width, height: rows.length, data };
}

const R: [number, number, number, number] = [255, 0, 0, 255];
const B: [number, number, number, number] = [0, 0, 255, 255];

describe('imageToArt', () => {
  it('keeps exact colours at native size, most-used first, transparency as empty', () => {
    const art = imageToArt(image(['RRB', 'R.B', 'RR.'], { R, B }), { maxColours: 8 });
    expect(art.palette).toEqual(['#ff0000', '#0000ff']);
    expect(art.grid).toEqual(['001', '0.1', '00.']);
  });

  it('downscales by area, dropping mostly transparent cells', () => {
    const src = image(['RRBB', 'RRBB', 'R...', '....'], { R, B });
    const art = imageToArt(src, { size: 2, maxColours: 8 });
    // bottom-left block is 1/4 opaque, below the default 50% coverage
    expect(art.grid).toEqual(['01', '..']);
  });

  it('quantises to at most maxColours', () => {
    const keys = 'abcdefgh';
    const colours = Object.fromEntries(
      keys
        .split('')
        .map((k, i): [string, [number, number, number, number]] => [k, [i * 30, 255 - i * 30, (i * 70) % 256, 255]]),
    );
    const art = imageToArt(image([keys, keys], colours), { maxColours: 3, minDistance: 0 });
    expect(art.palette.length).toBeLessThanOrEqual(3);
    expect(art.grid.join('')).toMatch(/^[0-2]+$/);
  });

  it('merges colours players could not tell apart', () => {
    const nearRed: [number, number, number, number] = [250, 8, 4, 255];
    const art = imageToArt(image(['RRn', 'BBB'], { R, B, n: nearRed }), { maxColours: 8 });
    expect(art.palette).toHaveLength(2);
    expect(art.grid).toEqual(['000', '111']);
  });

  it('is repeatable for the same seed', () => {
    const src = image(['RBRB', 'BRBR'], { R, B });
    expect(imageToArt(src, { maxColours: 1, seed: 7 })).toEqual(imageToArt(src, { maxColours: 1, seed: 7 }));
  });
});

describe('colourDistance', () => {
  it('is zero for equal colours and large for opposites', () => {
    expect(colourDistance([10, 20, 30], [10, 20, 30])).toBe(0);
    expect(colourDistance([0, 0, 0], [255, 255, 255])).toBeGreaterThan(700);
  });
});
