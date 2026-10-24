import { POWER_UPS, type PowerUpKind } from '../core/index.ts';

/** One winning attempt. `ticks` is simulation steps, so it ignores pause and fast-forward. */
export interface ClearRecord {
  powerUps: Record<PowerUpKind, number>;
  ticks: number;
  /** ISO date of the clear. */
  at: string;
}

export interface LevelProgress {
  best: ClearRecord;
  clears: number;
}

interface SavedProgress {
  version: 1;
  levels: Record<string, LevelProgress>;
}

/** The subset of `Storage` we need, so tests can pass an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'pixelgame.progress.v1';

export function totalPowerUps(record: Pick<ClearRecord, 'powerUps'>): number {
  return POWER_UPS.reduce((sum, k) => sum + record.powerUps[k], 0);
}

/** Fewer power-ups wins; ties go to the faster clear. */
export function isBetter(a: ClearRecord, b: ClearRecord): boolean {
  const ta = totalPowerUps(a);
  const tb = totalPowerUps(b);
  return ta < tb || (ta === tb && a.ticks < b.ticks);
}

export interface RecordResult {
  isNewBest: boolean;
  /** The best record before this clear, if there was one. */
  previous?: ClearRecord;
}

/**
 * Per-device progress: each level's best clear and how often it was cleared. Saved to
 * localStorage when available; if storage is missing or broken, progress lasts for the session.
 */
export class ProgressStore {
  private readonly store: KeyValueStore | undefined;
  private data: SavedProgress;

  constructor(store: KeyValueStore | undefined) {
    this.store = store;
    this.data = load(store);
  }

  static browser(): ProgressStore {
    let store: KeyValueStore | undefined;
    try {
      store = window.localStorage;
    } catch {
      store = undefined;
    }
    return new ProgressStore(store);
  }

  get(levelId: string): LevelProgress | undefined {
    return this.data.levels[levelId];
  }

  /** The first level is always open; each later one opens once the one before it is cleared. */
  isUnlocked(levelIds: readonly string[], index: number): boolean {
    if (index <= 0) return true;
    const previous = levelIds[index - 1];
    return previous !== undefined && this.get(previous) !== undefined;
  }

  recordClear(levelId: string, record: ClearRecord): RecordResult {
    const existing = this.data.levels[levelId];
    const isNewBest = !existing || isBetter(record, existing.best);
    this.data.levels[levelId] = {
      best: isNewBest ? record : existing.best,
      clears: (existing?.clears ?? 0) + 1,
    };
    this.save();
    return { isNewBest, previous: existing?.best };
  }

  private save(): void {
    try {
      this.store?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or blocked: keep progress in memory for this session.
    }
  }
}

function load(store: KeyValueStore | undefined): SavedProgress {
  const empty: SavedProgress = { version: 1, levels: {} };
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (!isSavedProgress(parsed)) return empty;
    return parsed;
  } catch {
    return empty;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

function isSavedProgress(v: unknown): v is SavedProgress {
  return (
    isObject(v) && v['version'] === 1 && isObject(v['levels']) && Object.values(v['levels']).every(isLevelProgress)
  );
}

function isLevelProgress(p: unknown): p is LevelProgress {
  if (!isObject(p) || typeof p['clears'] !== 'number') return false;
  const best = p['best'];
  if (!isObject(best) || typeof best['ticks'] !== 'number' || typeof best['at'] !== 'string') return false;
  const powerUps = best['powerUps'];
  return isObject(powerUps) && POWER_UPS.every((k) => typeof powerUps[k] === 'number');
}
