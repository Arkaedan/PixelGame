// Regenerates levels/*.json from the art in art.ts. Run with `pnpm levels`.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARTS } from './art.ts';
import { buildLevel, formatLevel } from './build.ts';

const outDir = join(import.meta.dirname, '../../levels');
mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(outDir)) if (file.endsWith('.json')) rmSync(join(outDir, file));

for (const art of ARTS) {
  const data = buildLevel(art);
  const file = `${data.id}-${data.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.json`;
  writeFileSync(join(outDir, file), formatLevel(data));
  const pixels = data.grid.join('').replaceAll('.', '').length;
  const shooters = data.queue.reduce((n, col) => n + col.length, 0);
  console.log(`${file}: ${data.width}x${data.height}, ${pixels} pixels, ${shooters} shooters`);
}
