import {
  cloneGame,
  createGame,
  isIdle,
  parseLevel,
  RULES,
  step,
  verifySolution,
  type GameState,
  type LevelData,
  type ShooterSpec,
  type TimedAction,
} from '../../src/core/index.ts';
import type { Art } from './art.ts';

/**
 * Turn pixel art into a level with a queue and a verified no-power-up solution.
 *
 * Simple constructive approach: repeatedly send out one shooter of whichever colour would hit the
 * most pixels in a single lap, with ammo rounded down so it always runs dry before finishing the
 * lap, and wait for it to finish. The shooters are dealt round-robin into the queue columns in
 * that order, so the recorded deploys are always from the front of a column.
 */
export function buildLevel(art: Art): LevelData {
  const data: LevelData = {
    id: art.id,
    name: art.name,
    width: art.grid[0]!.length,
    height: art.grid.length,
    palette: art.palette,
    grid: art.grid,
    queue: Array.from({ length: RULES.queueColumns }, () => []),
  };
  const state = createGame(parseLevel(data, { exactAmmo: false }));
  // A placeholder that is never deployed, so the builder's state is never judged "stuck".
  state.queue[0] = [{ id: -1, color: 0, ammo: 1, hidden: false }];

  const order: ShooterSpec[] = [];
  const solution: TimedAction[] = [];
  while (state.remaining > 0) {
    let best = -1;
    let bestHits = 0;
    for (let c = 0; c < art.palette.length; c++) {
      const hits = lapHits(state, c);
      if (hits > bestHits) {
        best = c;
        bestHits = hits;
      }
    }
    if (best === -1) throw new Error(`${art.name}: no colour can hit anything`);

    const ammo = roundAmmo(bestHits);
    solution.push({ tick: state.tick, action: { type: 'deployQueue', column: order.length % RULES.queueColumns } });
    order.push({ c: best, a: ammo });
    state.pending.push({ id: -2 - order.length, color: best, ammo, hidden: false });
    while (!isIdle(state) && state.status === 'playing') step(state);
    if (state.status === 'lost') throw new Error(`${art.name}: builder lost (${state.lossReason})`);
  }

  order.forEach((s, i) => data.queue[i % RULES.queueColumns]!.push(s));
  data.solution = solution;

  const check = verifySolution(parseLevel(data), solution);
  if (!check.ok) throw new Error(`${art.name}: generated solution fails: ${check.reason}`);
  return data;
}

/** Pixels a shooter of colour `c` with unlimited ammo would hit in one lap from the current state. */
function lapHits(state: GameState, c: number): number {
  const probe = cloneGame(state);
  const id = -1000;
  probe.pending.push({ id, color: c, ammo: Infinity, hidden: false });
  let hits = 0;
  while (!isIdle(probe) && probe.status === 'playing') {
    for (const e of step(probe)) if (e.type === 'shot' && e.shooterId === id) hits++;
  }
  return hits;
}

/** Prefer round numbers: multiples of 10, then 5, else the exact count. */
function roundAmmo(hits: number): number {
  if (hits >= 10) return Math.floor(hits / 10) * 10;
  if (hits >= 5) return 5;
  return hits;
}

const j = (v: unknown): string => JSON.stringify(v);
const block = (items: string[]): string => `[\n${items.map((s) => `    ${s}`).join(',\n')}\n  ]`;

/** Level JSON with one grid row, queue column or solution step per line. */
export function formatLevel(data: LevelData): string {
  const lines = [
    `  "id": ${j(data.id)}`,
    `  "name": ${j(data.name)}`,
    `  "width": ${data.width}`,
    `  "height": ${data.height}`,
    `  "palette": ${j(data.palette)}`,
    `  "grid": ${block(data.grid.map(j))}`,
    `  "queue": ${block(data.queue.map(j))}`,
  ];
  if (data.solution) lines.push(`  "solution": ${block(data.solution.map(j))}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}
