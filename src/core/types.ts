/** Default rule values. Levels may override capacity, buffer size and visible rows. */
export const RULES = {
  queueColumns: 5,
  trackCapacity: 5,
  bufferSize: 5,
  visibleRows: 3,
  /**
   * A deployed shooter enters only when no shooter is within `entryGap` positions of the entry.
   * By default the gap is one position per this many cells of the board's longest side, so shooters
   * stay visually apart on big boards where cells are small.
   */
  cellsPerEntryGap: 16,
} as const;

/** Grid cell value for "no pixel". */
export const EMPTY = -1;

export type Difficulty = 'easy' | 'medium' | 'hard';

export type PowerUpKind = 'extraSlot' | 'pickAny' | 'reveal';
export const POWER_UPS: readonly PowerUpKind[] = ['extraSlot', 'pickAny', 'reveal'];

/** A shooter as written in a level file. */
export interface ShooterSpec {
  /** Palette index. */
  c: number;
  /** Ammo. */
  a: number;
  /** Mystery shooter: shown as "?" until it reaches the front of its column. */
  hidden?: boolean;
}

/**
 * Player input. Deploying from a queue column at `index > 0` is the Pick Any power-up.
 */
export type Action =
  | { type: 'deployQueue'; column: number; index?: number }
  | { type: 'deployBuffer'; slot: number }
  | { type: 'powerUp'; kind: 'extraSlot' | 'reveal' };

/** An action applied when `state.tick === tick`, i.e. before the next step runs. */
export interface TimedAction {
  tick: number;
  action: Action;
}

/** Level JSON as stored on disk. */
export interface LevelData {
  id: string;
  name: string;
  difficulty?: Difficulty;
  width: number;
  height: number;
  palette: string[];
  /** One string per row, top first. '.' is empty; '0'-'9','a'-'z' index the palette. */
  grid: string[];
  /** Queue columns, front first. */
  queue: ShooterSpec[][];
  trackCapacity?: number;
  bufferSize?: number;
  visibleRows?: number;
  entryGap?: number;
  /** A no-power-up playthrough that clears the level. */
  solution?: TimedAction[];
}

export type Side = 'bottom' | 'right' | 'top' | 'left';

/** What a track position faces: a corner (never shoots) or one line of the board. */
export type TrackSlot = { kind: 'corner' } | { kind: 'line'; side: Side; index: number };

/** A parsed, validated level. Treat as immutable. */
export interface Level {
  id: string;
  name: string;
  difficulty?: Difficulty;
  width: number;
  height: number;
  palette: string[];
  /** Row-major palette indices, EMPTY for no pixel. */
  cells: Int16Array;
  queue: ShooterSpec[][];
  trackCapacity: number;
  bufferSize: number;
  visibleRows: number;
  entryGap: number;
  trackLength: number;
  slots: TrackSlot[];
  solution?: TimedAction[];
}

export interface Shooter {
  id: number;
  color: number;
  ammo: number;
  hidden: boolean;
}

export interface TrackShooter {
  shooter: Shooter;
  pos: number;
}

export type LossReason = 'overflow' | 'stuck';

export interface GameState {
  level: Level;
  /** Steps completed so far. */
  tick: number;
  cells: Int16Array;
  remaining: number;
  queue: Shooter[][];
  buffer: (Shooter | null)[];
  /** Shooters on the track, furthest along first. */
  track: TrackShooter[];
  /** Deployed shooters waiting for the entry to clear. They count towards capacity. */
  pending: Shooter[];
  capacity: number;
  revealAll: boolean;
  powerUps: Record<PowerUpKind, number>;
  status: 'playing' | 'won' | 'lost';
  lossReason?: LossReason;
}

export type GameEvent =
  | { type: 'enter'; shooterId: number }
  | { type: 'shot'; shooterId: number; cell: number; color: number; pos: number }
  | { type: 'exhausted'; shooterId: number; color: number; pos: number }
  | { type: 'buffered'; shooterId: number; slot: number }
  | { type: 'won' }
  | { type: 'lost'; reason: LossReason };

export type ActionError =
  | 'not-playing'
  | 'track-full'
  | 'bad-column'
  | 'empty-column'
  | 'not-visible'
  | 'bad-slot'
  | 'empty-slot'
  | 'already-revealed';

export type ActionResult = { ok: true } | { ok: false; error: ActionError };
