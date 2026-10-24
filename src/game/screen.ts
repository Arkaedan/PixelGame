import {
  applyAction,
  createGame,
  step,
  type Action,
  type GameEvent,
  type GameState,
  type Level,
} from '../core/index.ts';
import { cellCentre, computeLayout, contains, type Layout } from './layout.ts';
import { draw, EFFECT_MS, type Effects } from './render.ts';

/** Simulation step length at 1× speed. A 24×24 lap (100 positions) takes about 8 s. */
const TICK_MS = 80;
const SPEEDS = [1, 2, 4];
/** Pause between the last move and the result card, so the final pop is visible. */
const RESULT_DELAY_MS = 700;

export interface GameScreenOptions {
  levelNumber: number;
  hasNext: boolean;
  onExit: () => void;
  onNext: () => void;
}

/** One level being played: owns the DOM for the HUD, canvas and result card. */
export class GameScreen {
  private readonly level: Level;
  private readonly options: GameScreenOptions;
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resultEl: HTMLElement;
  private readonly speedBtn: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly resizeObserver: ResizeObserver;

  private state!: GameState;
  private layout!: Layout;
  private effects: Effects = { pops: [], tracers: [], fades: [] };
  private speed = 0;
  private paused = false;
  private flashUntil = 0;
  private acc = 0;
  private last = 0;
  private frame = 0;
  private resultTimer = 0;

  constructor(container: HTMLElement, level: Level, options: GameScreenOptions) {
    this.level = level;
    this.options = options;
    this.root = document.createElement('div');
    this.root.className = 'game';
    this.root.innerHTML = `
      <header class="hud">
        <button class="icon" data-act="back" aria-label="Levels">‹</button>
        <div class="title"><span class="num">${options.levelNumber}</span> ${escapeHtml(level.name)}</div>
        <button class="icon speed" data-act="speed" aria-label="Speed">1×</button>
        <button class="icon" data-act="pause" aria-label="Pause">❚❚</button>
        <button class="icon" data-act="restart" aria-label="Restart">↻</button>
      </header>
      <canvas></canvas>
      <div class="result" hidden></div>`;
    container.append(this.root);

    this.canvas = this.root.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.resultEl = this.root.querySelector('.result')!;
    this.speedBtn = this.root.querySelector('[data-act="speed"]')!;
    this.pauseBtn = this.root.querySelector('[data-act="pause"]')!;

    this.root.querySelector('.hud')!.addEventListener('click', (e) => {
      const act = actionOf(e);
      if (act === 'back') this.options.onExit();
      else if (act === 'speed') this.cycleSpeed();
      else if (act === 'pause') this.setPaused(!this.paused);
      else if (act === 'restart') this.restart();
    });
    this.resultEl.addEventListener('click', (e) => {
      const act = actionOf(e);
      if (act === 'retry') this.restart();
      else if (act === 'next') this.options.onNext();
      else if (act === 'levels') this.options.onExit();
    });
    this.canvas.addEventListener('pointerdown', (e) => this.onTap(e.offsetX, e.offsetY));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.restart();
    this.frame = requestAnimationFrame(this.tick);
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.resultTimer);
    this.resizeObserver.disconnect();
    this.root.remove();
  }

  private restart(): void {
    clearTimeout(this.resultTimer);
    this.state = createGame(this.level);
    this.effects = { pops: [], tracers: [], fades: [] };
    this.acc = 0;
    this.resultEl.hidden = true;
    this.setPaused(false);
    this.resize();
  }

  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout = computeLayout(w, h, this.level);
  }

  private cycleSpeed(): void {
    this.speed = (this.speed + 1) % SPEEDS.length;
    this.speedBtn.textContent = `${SPEEDS[this.speed]}×`;
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.pauseBtn.textContent = paused ? '▶' : '❚❚';
  }

  private onTap(x: number, y: number): void {
    if (this.paused || this.state.status !== 'playing' || !this.layout) return;
    const p = { x, y };
    let action: Action | undefined;
    const slot = this.layout.buffer.findIndex((r) => contains(r, p));
    if (slot !== -1) action = { type: 'deployBuffer', slot };
    const column = this.layout.columns.findIndex((r) => contains(r, p));
    if (column !== -1) action = { type: 'deployQueue', column };
    if (!action) return;

    const result = applyAction(this.state, action);
    if (result.ok) {
      vibrate(8);
    } else if (result.error === 'track-full') {
      this.flashUntil = performance.now() + 600;
      vibrate([20, 40, 20]);
    }
  }

  private readonly tick = (now: number): void => {
    const dt = this.last ? Math.min(now - this.last, 250) : 0;
    this.last = now;
    if (!this.paused && this.state.status === 'playing') {
      this.acc += dt * SPEEDS[this.speed]!;
      while (this.acc >= TICK_MS && this.state.status === 'playing') {
        this.acc -= TICK_MS;
        this.handle(step(this.state), now);
      }
      if (this.state.status !== 'playing') this.acc = 0;
    }
    this.pruneEffects(now);
    if (this.layout) {
      draw(this.ctx, this.state, this.layout, this.acc / TICK_MS, now, this.effects, {
        paused: this.paused,
        flashUntil: this.flashUntil,
      });
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private handle(events: GameEvent[], now: number): void {
    const { layout, level } = this;
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          this.effects.pops.push({ cell: e.cell, color: e.color, t: now });
          if (layout) {
            this.effects.tracers.push({
              from: layout.track[e.pos]!,
              to: cellCentre(layout, level, e.cell),
              color: e.color,
              t: now,
            });
          }
          break;
        case 'exhausted': {
          const at = layout?.track[e.pos];
          if (at) this.effects.fades.push({ at, color: e.color, t: now });
          break;
        }
        case 'won':
          vibrate([30, 60, 30]);
          this.showResult('Cleared!', 'Every pixel is gone.', true);
          break;
        case 'lost':
          vibrate(120);
          this.showResult(
            e.reason === 'overflow' ? 'Buffer overflow' : 'Out of moves',
            e.reason === 'overflow'
              ? 'A shooter finished its lap with the buffer full.'
              : 'Nothing left can hit the remaining pixels.',
            false,
          );
          break;
        default:
          break;
      }
    }
  }

  private pruneEffects(now: number): void {
    const fx = this.effects;
    if (fx.pops.length) fx.pops = fx.pops.filter((p) => now - p.t < EFFECT_MS.pop);
    if (fx.tracers.length) fx.tracers = fx.tracers.filter((t) => now - t.t < EFFECT_MS.tracer);
    if (fx.fades.length) fx.fades = fx.fades.filter((f) => now - f.t < EFFECT_MS.fade);
  }

  private showResult(title: string, detail: string, won: boolean): void {
    this.resultTimer = window.setTimeout(() => {
      const next = won && this.options.hasNext ? `<button class="primary" data-act="next">Next level</button>` : '';
      this.resultEl.innerHTML = `
        <div class="card ${won ? 'won' : 'lost'}">
          <h2>${title}</h2>
          <p>${detail}</p>
          <div class="actions">
            ${next}
            <button class="${won ? '' : 'primary'}" data-act="retry">Retry</button>
            <button data-act="levels">Levels</button>
          </div>
        </div>`;
      this.resultEl.hidden = false;
    }, RESULT_DELAY_MS);
  }
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported (e.g. desktop or iOS); haptics are optional.
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** The `data-act` value of the button (or its child) that was clicked. */
function actionOf(e: Event): string | undefined {
  return e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]')?.dataset['act'] : undefined;
}
