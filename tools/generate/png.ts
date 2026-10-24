import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { Art } from './build.ts';
import { createRng, randomInt } from './rng.ts';

export interface ImportOptions {
  /** Target length of the image's longer side, in cells. Defaults to the image's own size. */
  size?: number;
  /** Most colours to keep (1-36). */
  maxColours: number;
  /** Cells less than this fraction opaque become empty. */
  minCoverage?: number;
  /** Colours closer than this (redmean distance, 0-765) are merged so players can tell them apart. */
  minDistance?: number;
  seed?: number;
}

export interface RgbaImage {
  width: number;
  height: number;
  /** RGBA bytes, row-major. */
  data: Uint8Array;
}

type Rgb = [number, number, number];

export function importPng(path: string, options: ImportOptions): Art {
  const png = PNG.sync.read(readFileSync(path));
  return imageToArt({ width: png.width, height: png.height, data: png.data }, options);
}

/** Downscale (area average), quantise to a small palette, and lay out as level art. */
export function imageToArt(image: RgbaImage, options: ImportOptions): Art {
  const { maxColours, minCoverage = 0.5, minDistance = 60, seed = 1 } = options;
  if (maxColours < 1 || maxColours > 36) throw new Error('maxColours must be 1-36');
  const cells = downscale(image, options.size, minCoverage);

  const colours = cells.cells.filter((c): c is Rgb => c !== null);
  if (!colours.length) throw new Error('image has no opaque pixels');
  let palette = uniqueColours(colours);
  if (palette.length > maxColours) palette = kMeans(colours, maxColours, seed);
  palette = mergeClose(palette, colours, minDistance);

  // Map cells to the palette, then order the palette by use and drop unused entries.
  const assigned = cells.cells.map((c) => (c ? nearest(palette, c) : -1));
  const counts = palette.map((_, i) => assigned.filter((a) => a === i).length);
  const order = palette.map((_, i) => i).filter((i) => counts[i]! > 0);
  order.sort((a, b) => counts[b]! - counts[a]!);
  const remap = new Map(order.map((old, i) => [old, i]));

  const grid: string[] = [];
  for (let y = 0; y < cells.height; y++) {
    let row = '';
    for (let x = 0; x < cells.width; x++) {
      const a = assigned[y * cells.width + x]!;
      row += a < 0 ? '.' : remap.get(a)!.toString(36);
    }
    grid.push(row);
  }
  return { palette: order.map((i) => toHex(palette[i]!)), grid };
}

function downscale(image: RgbaImage, size: number | undefined, minCoverage: number) {
  const scale = size ? size / Math.max(image.width, image.height) : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const cells: (Rgb | null)[] = [];
  for (let cy = 0; cy < height; cy++) {
    const y0 = Math.floor((cy * image.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * image.height) / height));
    for (let cx = 0; cx < width; cx++) {
      const x0 = Math.floor((cx * image.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * image.width) / width));
      let r = 0;
      let g = 0;
      let b = 0;
      let alpha = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * image.width + x) * 4;
          const a = image.data[i + 3]!;
          r += image.data[i]! * a;
          g += image.data[i + 1]! * a;
          b += image.data[i + 2]! * a;
          alpha += a;
        }
      }
      const coverage = alpha / ((x1 - x0) * (y1 - y0) * 255);
      cells.push(coverage < minCoverage ? null : [r / alpha, g / alpha, b / alpha]);
    }
  }
  return { width, height, cells };
}

function uniqueColours(colours: Rgb[]): Rgb[] {
  const seen = new Map<string, Rgb>();
  for (const c of colours) {
    const rounded: Rgb = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
    seen.set(rounded.join(','), rounded);
  }
  return [...seen.values()];
}

/** Perceptually weighted RGB distance ("redmean"). */
export function colourDistance(a: Rgb, b: Rgb): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

function nearest(palette: Rgb[], c: Rgb): number {
  let best = 0;
  let bestD = Infinity;
  palette.forEach((p, i) => {
    const d = colourDistance(p, c);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/** k-means with k-means++ seeding (seeded, so imports are repeatable). */
function kMeans(colours: Rgb[], k: number, seed: number): Rgb[] {
  const rng = createRng(seed);
  const centres: Rgb[] = [colours[randomInt(rng, 0, colours.length - 1)]!];
  while (centres.length < k) {
    const d2 = colours.map((c) => Math.min(...centres.map((m) => colourDistance(c, m))) ** 2);
    const total = d2.reduce((a, b) => a + b, 0);
    if (total === 0) break;
    let r = rng() * total;
    let i = 0;
    while (r > d2[i]! && i < colours.length - 1) r -= d2[i++]!;
    centres.push(colours[i]!);
  }
  for (let iter = 0; iter < 20; iter++) {
    const sums = centres.map((): [number, number, number, number] => [0, 0, 0, 0]);
    for (const c of colours) {
      const s = sums[nearest(centres, c)]!;
      s[0] += c[0];
      s[1] += c[1];
      s[2] += c[2];
      s[3]++;
    }
    sums.forEach((s, i) => {
      if (s[3]) centres[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  return centres;
}

/** Repeatedly merge the two closest palette colours (weighted by use) until all are far enough apart. */
function mergeClose(palette: Rgb[], colours: Rgb[], minDistance: number): Rgb[] {
  const entries = palette.map((p) => ({ c: p, n: 0 }));
  for (const c of colours) entries[nearest(palette, c)]!.n++;
  for (;;) {
    let pair: [number, number] | undefined;
    let closest = minDistance;
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const d = colourDistance(entries[i]!.c, entries[j]!.c);
        if (d < closest) {
          closest = d;
          pair = [i, j];
        }
      }
    }
    if (!pair) return entries.map((e) => e.c);
    const [a, b] = [entries[pair[0]]!, entries[pair[1]]!];
    const n = Math.max(1, a.n + b.n);
    const w = a.n / n || 0.5;
    a.c = [a.c[0] * w + b.c[0] * (1 - w), a.c[1] * w + b.c[1] * (1 - w), a.c[2] * w + b.c[2] * (1 - w)];
    a.n += b.n;
    entries.splice(pair[1], 1);
  }
}

function toHex(c: Rgb): string {
  return `#${c
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
