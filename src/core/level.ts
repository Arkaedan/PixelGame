import { buildSlots, trackLength } from './track.ts';
import { EMPTY, RULES, type Level, type LevelData } from './types.ts';

export class LevelError extends Error {
  readonly levelId: string;
  readonly problems: string[];

  constructor(levelId: string, problems: string[]) {
    super(`Invalid level "${levelId}":\n  - ${problems.join('\n  - ')}`);
    this.name = 'LevelError';
    this.levelId = levelId;
    this.problems = problems;
  }
}

export interface ParseOptions {
  /** Require each colour's total ammo to equal its pixel count (default true). */
  exactAmmo?: boolean;
}

function cellValue(ch: string): number {
  return ch === '.' ? EMPTY : parseInt(ch, 36);
}

export function parseLevel(data: LevelData, options: ParseOptions = {}): Level {
  const { exactAmmo = true } = options;
  const problems: string[] = [];
  const { width, height, palette } = data;

  if (!Number.isInteger(width) || width < 1) problems.push(`width must be a positive integer (got ${width})`);
  if (!Number.isInteger(height) || height < 1) problems.push(`height must be a positive integer (got ${height})`);
  if (palette.length < 1 || palette.length > 36)
    problems.push(`palette must have 1-36 colours (got ${palette.length})`);
  if (data.grid.length !== height) problems.push(`grid has ${data.grid.length} rows, expected ${height}`);
  if (problems.length) throw new LevelError(data.id, problems);

  const cells = new Int16Array(width * height);
  const pixelCounts = Array.from({ length: palette.length }, () => 0);
  data.grid.forEach((row, y) => {
    if (row.length !== width) problems.push(`grid row ${y} has length ${row.length}, expected ${width}`);
    for (let x = 0; x < width; x++) {
      const v = cellValue(row[x] ?? '.');
      if (Number.isNaN(v) || v >= palette.length) {
        problems.push(`grid row ${y} col ${x}: unknown colour "${row[x]}"`);
        cells[y * width + x] = EMPTY;
      } else {
        cells[y * width + x] = v;
        if (v !== EMPTY) pixelCounts[v]!++;
      }
    }
  });

  if (data.queue.length !== RULES.queueColumns) {
    problems.push(`queue has ${data.queue.length} columns, expected ${RULES.queueColumns}`);
  }
  const ammoTotals = Array.from({ length: palette.length }, () => 0);
  data.queue.forEach((column, ci) =>
    column.forEach((s, si) => {
      if (!Number.isInteger(s.c) || s.c < 0 || s.c >= palette.length) {
        problems.push(`queue[${ci}][${si}]: unknown colour ${s.c}`);
      } else if (!Number.isInteger(s.a) || s.a < 1) {
        problems.push(`queue[${ci}][${si}]: ammo must be a positive integer (got ${s.a})`);
      } else {
        ammoTotals[s.c]! += s.a;
      }
    }),
  );
  if (exactAmmo) {
    palette.forEach((_, c) => {
      if (ammoTotals[c] !== pixelCounts[c]) {
        problems.push(`colour ${c}: ammo total ${ammoTotals[c]} != pixel count ${pixelCounts[c]}`);
      }
    });
  }
  if (!pixelCounts.some((n) => n > 0)) problems.push('grid has no pixels');

  const trackCapacity = data.trackCapacity ?? RULES.trackCapacity;
  const bufferSize = data.bufferSize ?? RULES.bufferSize;
  const visibleRows = data.visibleRows ?? RULES.visibleRows;
  const entryGap = data.entryGap ?? Math.max(1, Math.ceil(Math.max(width, height) / RULES.cellsPerEntryGap));
  if (trackCapacity < 1) problems.push('trackCapacity must be at least 1');
  if (!Number.isInteger(entryGap) || entryGap < 1) problems.push('entryGap must be a positive integer');
  if (bufferSize < 0) problems.push('bufferSize must not be negative');
  if (visibleRows < 1) problems.push('visibleRows must be at least 1');

  if (problems.length) throw new LevelError(data.id, problems);

  return {
    id: data.id,
    name: data.name,
    difficulty: data.difficulty,
    width,
    height,
    palette: [...palette],
    cells,
    queue: data.queue.map((col) => col.map((s) => ({ ...s }))),
    trackCapacity,
    bufferSize,
    visibleRows,
    entryGap,
    trackLength: trackLength(width, height),
    slots: buildSlots(width, height),
    solution: data.solution,
  };
}
