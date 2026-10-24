import { parseLevel, type Level, type LevelData } from '../core/index.ts';

const files = import.meta.glob<LevelData>('../../levels/*.json', { eager: true, import: 'default' });

/** All bundled levels, in file-name order. */
export const LEVELS: Level[] = Object.keys(files)
  .toSorted()
  .map((path) => parseLevel(files[path]!));
