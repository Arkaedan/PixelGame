// Regenerates levels/*.json from tools/generate/levels.ts. Run with `pnpm levels [id...]`.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateLevel } from './build.ts';
import { formatLevel } from './format.ts';
import { levelSpecs } from './levels.ts';

const only = process.argv.slice(2);
const outDir = join(import.meta.dirname, '../../levels');
mkdirSync(outDir, { recursive: true });

const fileName = (id: string, name: string): string =>
  `${id}-${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.json`;
const specs = levelSpecs().filter((s) => !only.length || only.includes(s.id));

if (!only.length) {
  // Full rebuild: remove files for levels that no longer exist.
  const keep = new Set(specs.map((s) => fileName(s.id, s.name)));
  for (const file of readdirSync(outDir)) if (file.endsWith('.json') && !keep.has(file)) rmSync(join(outDir, file));
}

const rows: Record<string, string | number>[] = [];
for (const spec of specs) {
  const started = performance.now();
  const { data, stats } = generateLevel(spec);
  writeFileSync(join(outDir, fileName(data.id, data.name)), formatLevel(data));
  rows.push({
    level: `${data.id} ${data.name}`,
    size: `${data.width}x${data.height}`,
    difficulty: spec.difficulty,
    colours: data.palette.length,
    pixels: stats.pixels,
    shooters: stats.shooters,
    'buffer peak': stats.bufferPeak,
    redeploys: stats.bufferRedeploys,
    mystery: stats.mystery,
    greedy: stats.greedyWon ? 'wins' : 'loses',
    attempt: stats.attempt + (stats.metTarget ? '' : ' (target missed)'),
    ms: Math.round(performance.now() - started),
  });
}
console.table(rows);
