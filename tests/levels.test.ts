import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLevel, verifySolution, type LevelData } from '../src/core/index.ts';

const dir = join(import.meta.dirname, '../levels');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('bundled levels', () => {
  it('exist', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s is valid and beatable without power-ups', (file) => {
    const data: LevelData = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    const level = parseLevel(data);
    expect(data.solution, 'level has a stored solution').toBeDefined();
    expect(verifySolution(level, data.solution ?? [])).toEqual({ ok: true });
  });

  it.each(files)('%s is 30, 40, 50 or 60 square with ammo of 10, 20, 30 or 40', (file) => {
    const data: LevelData = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    expect([30, 40, 50, 60]).toContain(data.width);
    expect(data.height).toBe(data.width);
    expect(data.queue.flat().filter((s) => ![10, 20, 30, 40].includes(s.a))).toEqual([]);
  });
});
