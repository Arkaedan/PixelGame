import type { LevelData } from '../../src/core/index.ts';

const j = (v: unknown): string => JSON.stringify(v);
const block = (items: string[]): string => `[\n${items.map((s) => `    ${s}`).join(',\n')}\n  ]`;

/** Level JSON with one grid row, queue column or solution step per line. */
export function formatLevel(data: LevelData): string {
  const lines = [`  "id": ${j(data.id)}`, `  "name": ${j(data.name)}`];
  if (data.difficulty) lines.push(`  "difficulty": ${j(data.difficulty)}`);
  lines.push(
    `  "width": ${data.width}`,
    `  "height": ${data.height}`,
    `  "palette": ${j(data.palette)}`,
    `  "grid": ${block(data.grid.map(j))}`,
    `  "queue": ${block(data.queue.map(j))}`,
  );
  if (data.solution) lines.push(`  "solution": ${block(data.solution.map(j))}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}
