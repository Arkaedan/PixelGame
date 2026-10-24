import {
  createGame,
  parseLevel,
  step,
  type GameEvent,
  type GameState,
  type LevelData,
  type ShooterSpec,
} from '../../src/core/index.ts';

export const RED = 0;
export const BLUE = 1;

/** Build level data with a red/blue palette. Columns beyond those given are empty. */
export function levelData(grid: string[], columns: ShooterSpec[][], extra: Partial<LevelData> = {}): LevelData {
  const queue = Array.from({ length: 5 }, (_, i) => columns[i] ?? []);
  return {
    id: 'test',
    name: 'Test',
    width: grid[0]!.length,
    height: grid.length,
    palette: ['#f00', '#00f'],
    grid,
    queue,
    ...extra,
  };
}

/** Create a game; ammo totals are not checked unless `exact` is set. */
export function game(
  grid: string[],
  columns: ShooterSpec[][],
  extra: Partial<LevelData> = {},
  exact = false,
): GameState {
  return createGame(parseLevel(levelData(grid, columns, extra), { exactAmmo: exact }));
}

export function run(state: GameState, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...step(state));
  return events;
}

export function boardRows(state: GameState): string[] {
  const { width, height } = state.level;
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const v = state.cells[y * width + x]!;
      row += v < 0 ? '.' : v.toString(36);
    }
    rows.push(row);
  }
  return rows;
}
