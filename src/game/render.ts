import { isQueueRevealed, onTrackCount, type GameState } from '../core/index.ts';
import { cellCentre, queueTiles, type Layout, type Point } from './layout.ts';

export const THEME = {
  bg: '#14161c',
  band: '#232836',
  boardBg: '#0c0e13',
  slot: '#2a3040',
  text: '#e8eaf0',
  muted: '#8a90a0',
  danger: '#ff5c6c',
  hidden: '#1b1f29',
  accent: '#7c9cff',
};

export const EFFECT_MS = { pop: 220, tracer: 140, fade: 260 };

export interface Pop {
  cell: number;
  color: number;
  t: number;
}

export interface Tracer {
  from: Point;
  to: Point;
  color: number;
  t: number;
}

export interface Fade {
  at: Point;
  color: number;
  t: number;
}

export interface Effects {
  pops: Pop[];
  tracers: Tracer[];
  fades: Fade[];
}

export interface Overlay {
  paused: boolean;
  /** Highlight the track counter in red until this time (a rejected deploy). */
  flashUntil: number;
  /** Pick Any is armed: highlight shooters that can be picked from behind the front. */
  pickAny: boolean;
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  layout: Layout,
  alpha: number,
  now: number,
  effects: Effects,
  overlay: Overlay,
): void {
  const { level } = state;
  const { board, band } = layout;
  const palette = level.palette;

  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  // Track band and board background
  ctx.fillStyle = THEME.band;
  ctx.beginPath();
  ctx.roundRect(board.x - band, board.y - band, board.w + 2 * band, board.h + 2 * band, band / 2);
  ctx.fill();
  ctx.fillStyle = THEME.boardBg;
  ctx.fillRect(board.x, board.y, board.w, board.h);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.setLineDash([2, 6]);
  ctx.strokeRect(board.x - band / 2, board.y - band / 2, board.w + band, board.h + band);
  ctx.restore();
  drawEntryMarker(ctx, layout);

  drawBoard(ctx, state, layout);

  for (const p of effects.pops) {
    const k = 1 - (now - p.t) / EFFECT_MS.pop;
    if (k <= 0) continue;
    const c = cellCentre(layout, level, p.cell);
    const s = layout.cell * (0.4 + 0.8 * k);
    ctx.globalAlpha = k;
    ctx.fillStyle = palette[p.color]!;
    ctx.fillRect(c.x - s / 2, c.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;

  ctx.lineCap = 'round';
  for (const t of effects.tracers) {
    const k = 1 - (now - t.t) / EFFECT_MS.tracer;
    if (k <= 0) continue;
    ctx.globalAlpha = k;
    ctx.strokeStyle = palette[t.color]!;
    ctx.lineWidth = Math.max(1.5, layout.cell * 0.35);
    ctx.beginPath();
    ctx.moveTo(t.from.x, t.from.y);
    ctx.lineTo(t.to.x, t.to.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const len = layout.track.length;
  for (const t of state.track) {
    const a = layout.track[t.pos]!;
    const b = layout.track[(t.pos + 1) % len]!;
    const at = { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
    drawToken(ctx, at, layout.token, palette[t.shooter.color]!, String(t.shooter.ammo));
  }
  // Shooters waiting for the entry to clear sit faintly on the entry corner.
  const next = state.pending[0];
  if (next) {
    ctx.globalAlpha = 0.45;
    drawToken(ctx, layout.track[0]!, layout.token * 0.8, palette[next.color]!, '');
    ctx.globalAlpha = 1;
  }
  for (const f of effects.fades) {
    const k = 1 - (now - f.t) / EFFECT_MS.fade;
    if (k <= 0) continue;
    ctx.globalAlpha = k;
    drawToken(ctx, f.at, layout.token * (1 + (1 - k) * 0.6), palette[f.color]!, '');
  }
  ctx.globalAlpha = 1;

  // Buffer
  state.buffer.forEach((s, i) => {
    const r = layout.buffer[i]!;
    ctx.fillStyle = THEME.slot;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    if (s) drawToken(ctx, { x: r.x + r.w / 2, y: r.y + r.h / 2 }, r.w * 0.78, palette[s.color]!, String(s.ammo));
  });

  ctx.font = `600 13px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const used = state.buffer.filter((s) => s !== null).length;
  if (overlay.pickAny) {
    ctx.fillStyle = THEME.accent;
    ctx.fillText('Pick Any: tap any shooter in the queue', layout.status.x, layout.status.y);
  } else {
    ctx.fillStyle = now < overlay.flashUntil ? THEME.danger : THEME.muted;
    ctx.fillText(
      `On track ${onTrackCount(state)}/${state.capacity}   ·   Buffer ${used}/${state.buffer.length}`,
      layout.status.x,
      layout.status.y,
    );
  }

  drawQueue(ctx, state, layout, overlay.pickAny);

  if (overlay.paused) {
    ctx.fillStyle = 'rgba(10,12,16,0.6)';
    ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.fillStyle = THEME.text;
    ctx.font = `700 28px system-ui, sans-serif`;
    ctx.fillText('Paused', layout.width / 2, board.y + board.h / 2);
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout): void {
  const { width, height, palette } = state.level;
  const { board, cell } = layout;
  const gap = cell >= 10 ? 1 : 0;
  let current = -1;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(board.y + y * cell);
    const y1 = Math.floor(board.y + (y + 1) * cell);
    for (let x = 0; x < width; x++) {
      const v = state.cells[y * width + x]!;
      if (v < 0) continue;
      if (v !== current) {
        ctx.fillStyle = palette[v]!;
        current = v;
      }
      const x0 = Math.floor(board.x + x * cell);
      const x1 = Math.floor(board.x + (x + 1) * cell);
      ctx.fillRect(x0, y0, x1 - x0 - gap, y1 - y0 - gap);
    }
  }
}

function drawQueue(ctx: CanvasRenderingContext2D, state: GameState, layout: Layout, pickAny: boolean): void {
  const palette = state.level.palette;
  const view = queueTiles(layout, state);
  for (const { column, index, rect, compact } of view.tiles) {
    const s = state.queue[column]![index]!;
    const revealed = isQueueRevealed(state, column, index);
    ctx.fillStyle = revealed ? palette[s.color]! : THEME.hidden;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, compact ? 5 : 8);
    ctx.fill();
    if (pickAny && index > 0) {
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (!revealed) {
      // Mystery tiles are dark with a dashed edge, so they can't be mistaken for a grey shooter.
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    } else if (index === 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const size = compact ? 12 : Math.min(20, layout.tile.h * 0.46) * (index === 0 ? 1 : 0.85);
    label(ctx, revealed ? String(s.ammo) : '?', rect.x + rect.w / 2, rect.y + rect.h / 2, size);
  }
  ctx.fillStyle = THEME.muted;
  ctx.font = `600 12px system-ui, sans-serif`;
  for (const m of view.more) ctx.fillText(`+${m.count}`, m.at.x, m.at.y);
}

function drawToken(ctx: CanvasRenderingContext2D, at: Point, size: number, colour: string, text: string): void {
  ctx.fillStyle = colour;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(at.x - size / 2, at.y - size / 2, size, size, size * 0.28);
  ctx.fill();
  ctx.stroke();
  if (text) label(ctx, text, at.x, at.y, size * (text.length > 2 ? 0.4 : 0.5));
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.22);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText(text, x, y + 1);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y + 1);
}

function drawEntryMarker(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const p = layout.track[0]!;
  const s = layout.band * 0.28;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.6, p.y - s);
  ctx.lineTo(p.x + s, p.y);
  ctx.lineTo(p.x - s * 0.6, p.y + s);
  ctx.closePath();
  ctx.fill();
}
