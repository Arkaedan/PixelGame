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
});
