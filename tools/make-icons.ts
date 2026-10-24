// Draws the app icons as pixel art and writes them to public/icons. Run with `pnpm icons`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { Painter } from './generate/paint.ts';

const PALETTE = ['#14161c', '#2d3344', '#0c0e13', '#e53935', '#ff8a80', '#fdd835', '#8e1b1b'];

/** A heart on a board, inside the track, with one shooter on its way round. `pad` cells of background around it. */
function iconArt(pad: number): Painter {
  const art = 24;
  const size = art + 2 * pad;
  const p = new Painter(size);
  const o = pad;
  p.fill(0);
  p.rect(o + 2, o + 2, 20, 20, 1);
  p.rect(o + 5, o + 5, 14, 14, 2);
  p.fill(3, (px, py) => {
    const u = ((px - o - 6) / 12) * 2.5 - 1.25;
    const v = 1.2 - ((py - o - 6.3) / 12) * 2.45;
    return u >= -1.4 && u <= 1.4 && (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0;
  });
  p.rect(o + 9, o + 9, 2, 2, 4);
  p.rect(o + 3, o + 19, 2, 2, 5);
  p.rect(o + 6, o + 19, 3, 2, 5);
  return p;
}

function writePng(path: string, painter: Painter, px: number, roundCorners: boolean): void {
  const scale = px / painter.width;
  const png = new PNG({ width: px, height: px });
  const radius = roundCorners ? px * 0.18 : 0;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const i = (y * px + x) * 4;
      const c = painter.get(Math.floor(x / scale), Math.floor(y / scale));
      const cx = Math.min(x, px - 1 - x);
      const cy = Math.min(y, px - 1 - y);
      const outside = radius > 0 && cx < radius && cy < radius && Math.hypot(radius - cx, radius - cy) > radius;
      if (c < 0 || outside) continue;
      const n = parseInt(PALETTE[c]!.slice(1), 16);
      png.data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i);
    }
  }
  writeFileSync(path, PNG.sync.write(png));
}

const out = join(import.meta.dirname, '../public/icons');
mkdirSync(out, { recursive: true });
const plain = iconArt(0);
// Maskable icons are cropped to a circle or squircle by Android; keep the art in the middle 75%.
const maskable = iconArt(4);
writePng(join(out, 'icon-192.png'), plain, 192, true);
writePng(join(out, 'icon-512.png'), plain, 512, true);
writePng(join(out, 'maskable-512.png'), maskable, 512, false);
writePng(join(out, 'apple-touch-icon.png'), maskable, 180, false);
writePng(join(out, 'favicon-64.png'), plain, 64, true);
console.log(`wrote icons to ${out}`);
