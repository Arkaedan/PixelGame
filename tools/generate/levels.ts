import { join } from 'node:path';
import * as art from './art.ts';
import type { LevelSpec } from './build.ts';
import { importPng } from './png.ts';

const artDir = join(import.meta.dirname, '../../art');

/** The bundled levels, in play order. Change a seed to get a different queue for the same art. */
export function levelSpecs(): LevelSpec[] {
  return [
    { id: '001', name: 'Heart', difficulty: 'easy', seed: 1, art: art.heart() },
    { id: '002', name: 'Smiley', difficulty: 'easy', seed: 2, art: art.smiley() },
    { id: '003', name: 'Quilt', difficulty: 'easy', seed: 3, art: art.quilt() },
    { id: '004', name: 'Sunset', difficulty: 'easy', seed: 4, art: art.sunset() },
    { id: '005', name: 'Mushroom', difficulty: 'medium', seed: 5, art: art.mushroom() },
    { id: '006', name: 'Rainbow', difficulty: 'medium', seed: 6, art: art.rainbow() },
    { id: '007', name: 'Cat', difficulty: 'medium', seed: 7, art: art.cat() },
    { id: '008', name: 'Tree', difficulty: 'medium', seed: 8, art: art.tree() },
    { id: '009', name: 'Fish', difficulty: 'medium', seed: 9, art: art.fish() },
    { id: '010', name: 'Target', difficulty: 'hard', seed: 22, art: art.target() },
    { id: '011', name: 'Planet', difficulty: 'hard', seed: 15, art: art.planet() },
    { id: '012', name: 'Argyle', difficulty: 'hard', seed: 12, art: art.argyle() },
    { id: '013', name: 'House', difficulty: 'hard', seed: 15, art: art.house() },
    {
      id: '014',
      name: 'Mountains',
      difficulty: 'hard',
      seed: 14,
      art: importPng(join(artDir, 'mountains.png'), { size: 60, maxColours: 7 }),
    },
    { id: '015', name: 'Stained Glass', difficulty: 'hard', seed: 15, art: art.stainedGlass() },
  ];
}
