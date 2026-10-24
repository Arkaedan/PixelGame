import { RULES, type GameState, type Level } from '../core/index.ts';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Screen geometry for one level at one canvas size, in CSS pixels. */
export interface Layout {
  width: number;
  height: number;
  board: Rect;
  cell: number;
  /** Thickness of the track band around the board. */
  band: number;
  /** Size of a shooter token on the track. */
  token: number;
  /** Centre point of every track position. */
  track: Point[];
  buffer: Rect[];
  status: Point;
  /** Tap area of each queue column. */
  columns: Rect[];
  tile: { w: number; h: number; gap: number };
}

const PAD = 12;
const GAP = 8;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function computeLayout(width: number, height: number, level: Level): Layout {
  const colW = (width - 2 * PAD - (RULES.queueColumns - 1) * GAP) / RULES.queueColumns;
  const tileH = clamp(colW * 0.62, 34, 50);
  const slot = clamp(colW * 0.8, 36, 56);
  const statusH = 24;
  const moreH = 18;
  const queueH = level.visibleRows * (tileH + GAP) + moreH;
  const bottomH = slot + statusH + queueH + PAD * 2;

  // Square region for board + track, sized by the longer board side.
  const region = Math.max(120, Math.min(width - 2 * PAD, height - bottomH - PAD));
  const band = clamp(region * 0.075, 18, 30);
  const cell = (region - 2 * band) / Math.max(level.width, level.height);
  const bw = level.width * cell;
  const bh = level.height * cell;
  const board: Rect = { x: (width - bw) / 2, y: PAD + band + (region - 2 * band - bh) / 2, w: bw, h: bh };

  const left = board.x - band / 2;
  const right = board.x + bw + band / 2;
  const top = board.y - band / 2;
  const bottom = board.y + bh + band / 2;
  // Same order as buildSlots in core/track.ts: from the bottom-right corner, up, left, down, right.
  const track: Point[] = [{ x: right, y: bottom }];
  for (let y = level.height - 1; y >= 0; y--) track.push({ x: right, y: board.y + (y + 0.5) * cell });
  track.push({ x: right, y: top });
  for (let x = level.width - 1; x >= 0; x--) track.push({ x: board.x + (x + 0.5) * cell, y: top });
  track.push({ x: left, y: top });
  for (let y = 0; y < level.height; y++) track.push({ x: left, y: board.y + (y + 0.5) * cell });
  track.push({ x: left, y: bottom });
  for (let x = 0; x < level.width; x++) track.push({ x: board.x + (x + 0.5) * cell, y: bottom });

  const bufferTop = PAD + region + PAD;
  const bufferW = level.bufferSize * slot + Math.max(0, level.bufferSize - 1) * GAP;
  const buffer: Rect[] = Array.from({ length: level.bufferSize }, (_, i) => ({
    x: (width - bufferW) / 2 + i * (slot + GAP),
    y: bufferTop,
    w: slot,
    h: slot,
  }));

  const queueTop = bufferTop + slot + statusH;
  const columns: Rect[] = Array.from({ length: RULES.queueColumns }, (_, i) => ({
    x: PAD + i * (colW + GAP),
    y: queueTop,
    w: colW,
    h: Math.max(queueH, height - queueTop),
  }));

  return {
    width,
    height,
    board,
    cell,
    band,
    token: band * 0.84,
    track,
    buffer,
    status: { x: width / 2, y: bufferTop + slot + statusH / 2 },
    columns,
    tile: { w: colW, h: tileH, gap: GAP },
  };
}

export function contains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

export function cellCentre(layout: Layout, level: Level, cell: number): Point {
  const x = cell % level.width;
  const y = Math.floor(cell / level.width);
  return { x: layout.board.x + (x + 0.5) * layout.cell, y: layout.board.y + (y + 0.5) * layout.cell };
}

export interface QueueTile {
  column: number;
  index: number;
  rect: Rect;
  /** A slim tile for a row past the normally visible ones, shown after Reveal. */
  compact: boolean;
}

export interface QueueView {
  tiles: QueueTile[];
  /** "+N" labels for shooters that don't fit or aren't visible. */
  more: { column: number; count: number; at: Point }[];
}

const COMPACT_H = 22;
const COMPACT_GAP = 4;
const MORE_H = 18;
/** Tiles behind the front are inset rather than dimmed, so colours stay true for matching. */
const INSET = 4;

/** Where each visible queue shooter is drawn; shared by rendering and tap handling. */
export function queueTiles(layout: Layout, state: GameState): QueueView {
  const { tile } = layout;
  const view: QueueView = { tiles: [], more: [] };
  const bottom = layout.height - MORE_H;
  layout.columns.forEach((col, column) => {
    const items = state.queue[column]!;
    let y = col.y;
    let index = 0;
    for (; index < items.length; index++) {
      const compact = index >= state.level.visibleRows;
      if (compact && !state.revealAll) break;
      const h = compact ? COMPACT_H : tile.h;
      if (index > 0 && y + h > bottom) break;
      const inset = index === 0 ? 0 : INSET;
      const rect = compact
        ? { x: col.x + inset, y, w: col.w - 2 * inset, h }
        : { x: col.x + inset, y: y + inset, w: col.w - 2 * inset, h: h - 2 * inset };
      view.tiles.push({ column, index, rect, compact });
      y += h + (compact ? COMPACT_GAP : tile.gap);
    }
    if (index < items.length) {
      view.more.push({ column, count: items.length - index, at: { x: col.x + col.w / 2, y: y + 6 } });
    }
  });
  return view;
}
