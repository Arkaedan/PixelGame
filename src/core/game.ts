import { firstPixel } from './track';
import {
  EMPTY,
  RULES,
  type Action,
  type ActionError,
  type ActionResult,
  type GameEvent,
  type GameState,
  type Level,
  type LossReason,
  type Shooter,
} from './types';

export function createGame(level: Level): GameState {
  let nextId = 0;
  const queue = level.queue.map((col) =>
    col.map((s): Shooter => ({ id: nextId++, color: s.c, ammo: s.a, hidden: !!s.hidden })),
  );
  let remaining = 0;
  for (const v of level.cells) if (v !== EMPTY) remaining++;
  return {
    level,
    tick: 0,
    cells: level.cells.slice(),
    remaining,
    queue,
    buffer: Array.from({ length: level.bufferSize }, (): Shooter | null => null),
    track: [],
    pending: [],
    capacity: level.trackCapacity,
    revealAll: false,
    powerUps: { extraSlot: 0, pickAny: 0, reveal: 0 },
    status: 'playing',
  };
}

const copy = (s: Shooter): Shooter => ({ ...s });

export function cloneGame(state: GameState): GameState {
  return {
    ...state,
    cells: state.cells.slice(),
    queue: state.queue.map((col) => col.map(copy)),
    buffer: state.buffer.map((s) => (s ? copy(s) : null)),
    track: state.track.map((t) => ({ shooter: copy(t.shooter), pos: t.pos })),
    pending: state.pending.map(copy),
    powerUps: { ...state.powerUps },
  };
}

/** Number of shooters that count towards track capacity. */
export function onTrackCount(state: GameState): number {
  return state.track.length + state.pending.length;
}

/** Whether the queue shooter at `index` of a column can be seen and picked (with Pick Any). */
export function isQueueVisible(state: GameState, index: number): boolean {
  return state.revealAll || index < state.level.visibleRows;
}

/** Whether a queue shooter's colour and ammo are shown (mystery shooters show "?"). */
export function isQueueRevealed(state: GameState, column: number, index: number): boolean {
  const s = state.queue[column]?.[index];
  if (!s || !isQueueVisible(state, index)) return false;
  return !s.hidden || index === 0 || state.revealAll;
}

export function applyAction(state: GameState, action: Action): ActionResult {
  if (state.status !== 'playing') return fail('not-playing');

  switch (action.type) {
    case 'deployQueue': {
      const column = state.queue[action.column];
      if (!column) return fail('bad-column');
      const index = action.index ?? 0;
      if (!column[index]) return fail('empty-column');
      if (!isQueueVisible(state, index)) return fail('not-visible');
      if (onTrackCount(state) >= state.capacity) return fail('track-full');
      const [shooter] = column.splice(index, 1);
      state.pending.push(shooter!);
      if (index > 0) state.powerUps.pickAny++;
      return OK;
    }
    case 'deployBuffer': {
      if (action.slot < 0 || action.slot >= state.buffer.length) return fail('bad-slot');
      const shooter = state.buffer[action.slot];
      if (!shooter) return fail('empty-slot');
      if (onTrackCount(state) >= state.capacity) return fail('track-full');
      state.buffer[action.slot] = null;
      state.pending.push(shooter);
      return OK;
    }
    case 'powerUp':
      if (action.kind === 'extraSlot') {
        state.capacity++;
        state.powerUps.extraSlot++;
        return OK;
      }
      if (state.revealAll) return fail('already-revealed');
      state.revealAll = true;
      state.powerUps.reveal++;
      return OK;
  }
}

/**
 * Advance the simulation by one step:
 *   1. every track shooter moves one position; those completing the lap go to the buffer
 *   2. one pending shooter enters if the entry is clear
 *   3. shooters fire, furthest along first; empty shooters disappear
 *   4. win / stuck checks
 */
export function step(state: GameState): GameEvent[] {
  if (state.status !== 'playing') return [];
  const { level } = state;
  const events: GameEvent[] = [];
  state.tick++;

  const moving = state.track;
  state.track = [];
  for (const t of moving) {
    t.pos++;
    if (t.pos < level.trackLength) {
      state.track.push(t);
      continue;
    }
    const slot = state.buffer.indexOf(null);
    if (slot === -1) {
      lose(state, 'overflow', events);
      return events;
    }
    state.buffer[slot] = t.shooter;
    events.push({ type: 'buffered', shooterId: t.shooter.id, slot });
  }

  if (state.pending.length && state.track.every((t) => t.pos >= RULES.entryGap)) {
    const shooter = state.pending.shift()!;
    state.track.push({ shooter, pos: 0 });
    events.push({ type: 'enter', shooterId: shooter.id });
  }

  for (const t of state.track) {
    const cell = firstPixel(state.cells, level.width, level.height, level.slots[t.pos]!);
    if (cell === -1 || state.cells[cell] !== t.shooter.color) continue;
    state.cells[cell] = EMPTY;
    state.remaining--;
    t.shooter.ammo--;
    events.push({ type: 'shot', shooterId: t.shooter.id, cell, color: t.shooter.color, pos: t.pos });
    if (t.shooter.ammo === 0) events.push({ type: 'exhausted', shooterId: t.shooter.id, pos: t.pos });
  }
  state.track = state.track.filter((t) => t.shooter.ammo > 0);

  if (state.remaining === 0) {
    state.status = 'won';
    events.push({ type: 'won' });
  } else if (isStuck(state)) {
    lose(state, 'stuck', events);
  }
  return events;
}

/** True when nothing is moving, the queue is empty and no buffered shooter has a target. */
export function isStuck(state: GameState): boolean {
  if (state.track.length || state.pending.length) return false;
  if (state.queue.some((col) => col.length)) return false;
  const colors = new Set(state.buffer.filter((s) => s !== null).map((s) => s.color));
  if (!colors.size) return true;
  const { width, height, slots } = state.level;
  for (const slot of slots) {
    const cell = firstPixel(state.cells, width, height, slot);
    if (cell !== -1 && colors.has(state.cells[cell]!)) return false;
  }
  return true;
}

/** Nothing will change until the player acts. */
export function isIdle(state: GameState): boolean {
  return state.track.length === 0 && state.pending.length === 0;
}

function lose(state: GameState, reason: LossReason, events: GameEvent[]): void {
  state.status = 'lost';
  state.lossReason = reason;
  events.push({ type: 'lost', reason });
}

const OK: ActionResult = { ok: true };
function fail(error: ActionError): ActionResult {
  return { ok: false, error };
}
