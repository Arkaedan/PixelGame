import {
  applyAction,
  createGame,
  isIdle,
  parseLevel,
  RULES,
  step,
  verifySolution,
  type Action,
  type Difficulty,
  type GameState,
  type LevelData,
  type ShooterSpec,
  type TimedAction,
} from '../../src/core/index.ts';
import { createRng, pickWeighted, randomInt, type Rng } from './rng.ts';
import { lapHits, playGreedy, runUntilIdle } from './sim.ts';

/** Pixel art: one string per row, '.' empty, '0'-'9'/'a'-'z' palette index. */
export interface Art {
  palette: string[];
  grid: string[];
}

export interface LevelSpec {
  id: string;
  name: string;
  difficulty: Difficulty;
  seed: number;
  art: Art;
}

interface Preset {
  /** Exponent on "pixels hit" when choosing the next colour; higher = more obvious choices. */
  greed: number;
  /** Chance that a new shooter carries more than one lap's worth of ammo (and must be buffered). */
  bufferUse: number;
  /** Most shooters the builder parks in the buffer at once. */
  maxBuffer: number;
  /** Fraction of shooters (not at a column front) that are mystery shooters. */
  mystery: number;
  /** Whether the greedy rating player must win, must lose, or either. */
  greedy: 'win' | 'lose' | 'any';
}

const PRESETS: Record<Difficulty, Preset> = {
  easy: { greed: 3, bufferUse: 0, maxBuffer: 0, mystery: 0, greedy: 'win' },
  medium: { greed: 1, bufferUse: 0.25, maxBuffer: 2, mystery: 0.05, greedy: 'any' },
  hard: { greed: 0.5, bufferUse: 0.6, maxBuffer: 4, mystery: 0.12, greedy: 'lose' },
};

const MAX_ATTEMPTS = 30;

export interface BuildStats {
  shooters: number;
  pixels: number;
  bufferPeak: number;
  bufferRedeploys: number;
  mystery: number;
  greedyWon: boolean;
  attempt: number;
  /** False if no attempt met the preset's greedy-player requirement. */
  metTarget: boolean;
}

/**
 * Build a level from a spec: try seeded candidates until one meets the difficulty's rating
 * requirement. Every returned level has a verified no-power-up solution.
 */
export function generateLevel(spec: LevelSpec): { data: LevelData; stats: BuildStats } {
  const preset = PRESETS[spec.difficulty];
  let fallback: { data: LevelData; stats: BuildStats } | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createRng(spec.seed * 1000 + attempt);
    const data = buildCandidate(spec, preset, rng);
    const check = verifySolution(parseLevel(data), data.solution!);
    if (!check.ok) throw new Error(`${spec.name}: generated solution fails: ${check.reason}`);

    const greedyWon = playGreedy(parseLevel(data)).won;
    const stats = { ...measure(data), greedyWon, attempt, metTarget: true };
    const met = preset.greedy === 'any' || (preset.greedy === 'win') === greedyWon;
    if (met) return { data, stats };
    fallback ??= { data, stats: { ...stats, metTarget: false } };
  }
  return fallback!;
}

/** One seeded attempt. See docs/SPEC.md §6.3 for the approach. */
function buildCandidate(spec: LevelSpec, preset: Preset, rng: Rng): LevelData {
  const { art } = spec;
  const colours = art.palette.length;
  const data: LevelData = {
    id: spec.id,
    name: spec.name,
    difficulty: spec.difficulty,
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
  const steps: { tick: number; action: Action | { type: 'new'; index: number } }[] = [];
  let nextId = 0;

  while (state.remaining > 0) {
    const remaining = countByColour(state, colours);
    const reserved = Array.from({ length: colours }, () => 0);
    for (const s of state.buffer) if (s) reserved[s.color]! += s.ammo;
    const hits = art.palette.map((_, c) => lapHits(state, c));

    const buffered = state.buffer.flatMap((s, slot) =>
      s && hits[s.color]! > 0 ? [{ slot, hits: Math.min(hits[s.color]!, s.ammo) }] : [],
    );
    const fresh = art.palette.flatMap((_, c) => (hits[c]! > 0 && remaining[c]! > reserved[c]! ? [c] : []));
    if (!buffered.length && !fresh.length) throw new Error(`${spec.name}: builder has no move`);

    if (buffered.length && (!fresh.length || rng() < 0.6)) {
      const { slot } = pickWeighted(rng, buffered, (b) => b.hits ** preset.greed);
      steps.push({ tick: state.tick, action: { type: 'deployBuffer', slot } });
      applyOrThrow(state, { type: 'deployBuffer', slot });
    } else {
      const c = pickWeighted(rng, fresh, (col) => hits[col]! ** preset.greed);
      const lap = hits[c]!;
      const available = remaining[c]! - reserved[c]!;
      const parked = state.buffer.filter((s) => s !== null).length;
      const overshoot = parked < preset.maxBuffer && available > lap && rng() < preset.bufferUse;
      const ammo = overshoot ? pickRound(rng, lap + 1, available) : roundDown(Math.min(lap, available));
      steps.push({ tick: state.tick, action: { type: 'new', index: order.length } });
      order.push({ c, a: ammo });
      state.pending.push({ id: nextId++, color: c, ammo, hidden: false });
    }
    runUntilIdle(state);
    if (state.status === 'lost') throw new Error(`${spec.name}: builder lost (${state.lossReason})`);
  }

  const columnOf = assignColumns(order.length, rng);
  order.forEach((s, i) => data.queue[columnOf[i]!]!.push(s));
  addMystery(data.queue, Math.round(order.length * preset.mystery), rng);
  data.solution = steps.map(({ tick, action }): TimedAction => ({
    tick,
    action: action.type === 'new' ? { type: 'deployQueue', column: columnOf[action.index]! } : action,
  }));
  return data;
}

/** The builder only makes moves it has checked, so a rejection is a bug. */
function applyOrThrow(state: GameState, action: Action): void {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(`builder: ${action.type} rejected (${result.error})`);
}

/** Deal shooters (in deploy order) into columns at random, keeping column lengths roughly even. */
function assignColumns(count: number, rng: Rng): number[] {
  const lengths = Array.from({ length: RULES.queueColumns }, () => 0);
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const min = Math.min(...lengths);
    const options = lengths.flatMap((n, col) => (n <= min + 1 ? [col] : []));
    const col = options[randomInt(rng, 0, options.length - 1)]!;
    lengths[col]!++;
    result.push(col);
  }
  return result;
}

/** Hide `count` shooters that don't start at the front of their column. */
function addMystery(queue: ShooterSpec[][], count: number, rng: Rng): void {
  const candidates = queue.flatMap((col) => col.slice(1));
  for (let i = 0; i < count && candidates.length; i++) {
    const [s] = candidates.splice(randomInt(rng, 0, candidates.length - 1), 1);
    s!.hidden = true;
  }
}

function countByColour(state: GameState, colours: number): number[] {
  const counts = Array.from({ length: colours }, () => 0);
  for (const v of state.cells) if (v >= 0) counts[v]!++;
  return counts;
}

/** Largest round number (multiple of 10, then 5) not above n, or n itself when small. */
function roundDown(n: number): number {
  if (n >= 10) return Math.floor(n / 10) * 10;
  if (n >= 5) return 5;
  return n;
}

/** A round number in [lo, hi] if there is one (preferring the lower half), else a random value. */
function pickRound(rng: Rng, lo: number, hi: number): number {
  for (const unit of [10, 5]) {
    const options: number[] = [];
    for (let v = Math.ceil(lo / unit) * unit; v <= hi; v += unit) options.push(v);
    if (options.length) {
      const lower = options.filter((v) => v <= lo + (hi - lo) / 2);
      const pool = lower.length ? lower : options;
      return pool[randomInt(rng, 0, pool.length - 1)]!;
    }
  }
  return randomInt(rng, lo, hi);
}

function measure(data: LevelData): Omit<BuildStats, 'greedyWon' | 'attempt' | 'metTarget'> {
  const solution = data.solution ?? [];
  const state = createGame(parseLevel(data));
  let bufferPeak = 0;
  let next = 0;
  while (state.status === 'playing') {
    while (next < solution.length && solution[next]!.tick <= state.tick) applyAction(state, solution[next++]!.action);
    if (next >= solution.length && isIdle(state)) break;
    step(state);
    bufferPeak = Math.max(bufferPeak, state.buffer.filter((s) => s !== null).length);
  }
  const shooters = data.queue.flat();
  return {
    shooters: shooters.length,
    pixels: data.grid.join('').replaceAll('.', '').length,
    bufferPeak,
    bufferRedeploys: solution.filter((s) => s.action.type === 'deployBuffer').length,
    mystery: shooters.filter((s) => s.hidden).length,
  };
}
