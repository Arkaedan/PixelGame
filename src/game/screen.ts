import {
  applyAction,
  createGame,
  POWER_UPS,
  step,
  type Action,
  type GameEvent,
  type GameState,
  type Level,
  type PowerUpKind,
} from '../core/index.ts';
import { totalPowerUps, type ClearRecord, type ProgressStore } from '../storage/progress.ts';
import type { SettingsStore } from '../storage/settings.ts';
import type { Sfx } from './audio.ts';
import { cellCentre, computeLayout, contains, queueTiles, type Layout, type Point } from './layout.ts';
import { draw, EFFECT_MS, noEffects, type Effects } from './render.ts';
import { bindSoundAndVibration, soundAndVibrationRows } from './settings-ui.ts';
import { describePowerUps, escapeHtml, formatDuration, plural, POWER_UP_NAMES } from './text.ts';

/** Simulation step length at 1× speed. A 24×24 lap (100 positions) takes about 2.3 s. */
export const TICK_MS = 23;
const SPEEDS = [1, 2, 4];
/** Pause between the last move and the result card, so the final pop is visible. */
const RESULT_DELAY_MS = 700;

export interface GameScreenOptions {
  levelNumber: number;
  hasNext: boolean;
  progress: ProgressStore;
  settings: SettingsStore;
  sfx: Sfx;
  onExit: () => void;
  onNext: () => void;
}

/** One level being played: owns the DOM for the HUD, canvas, power-up bar and result card. */
export class GameScreen {
  private readonly level: Level;
  private readonly options: GameScreenOptions;
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resultEl: HTMLElement;
  private readonly pauseEl: HTMLElement;
  private readonly speedBtn: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly powerUpBar: HTMLElement;
  private readonly resizeObserver: ResizeObserver;

  private state!: GameState;
  private layout!: Layout;
  private effects: Effects = noEffects();
  private speed: number;
  private paused = false;
  /** Pick Any is armed: the next queue tap may take any visible shooter. */
  private picking = false;
  private flashUntil = 0;
  private shakeUntil = 0;
  private acc = 0;
  private last = 0;
  private frame = 0;
  private resultTimer = 0;

  constructor(container: HTMLElement, level: Level, options: GameScreenOptions) {
    this.level = level;
    this.options = options;
    this.speed = Math.max(0, SPEEDS.indexOf(options.settings.get().speed));
    this.root = document.createElement('div');
    this.root.className = 'game';
    this.root.innerHTML = `
      <header class="hud">
        <button class="icon" data-act="back" aria-label="Levels">‹</button>
        <div class="title"><span class="num">${options.levelNumber}</span> ${escapeHtml(level.name)}</div>
        <button class="icon speed" data-act="speed" aria-label="Speed">${SPEEDS[this.speed]}×</button>
        <button class="icon" data-act="pause" aria-label="Pause">❚❚</button>
        <button class="icon" data-act="restart" aria-label="Restart">↻</button>
      </header>
      <canvas></canvas>
      <footer class="powerups">
        ${POWER_UPS.map(
          (kind) => `
          <button data-act="${kind}">
            <span class="pu-icon">${POWER_UP_ICONS[kind]}</span>
            <span class="pu-name">${POWER_UP_NAMES[kind]}</span>
            <span class="pu-count" hidden></span>
          </button>`,
        ).join('')}
      </footer>
      <div class="result" hidden></div>
      <div class="pause" hidden>
        <div class="card" role="dialog" aria-label="Paused">
          <h2>Paused</h2>
          <div class="pause-settings"></div>
          <div class="actions">
            <button class="primary" data-act="resume">Resume</button>
            <button data-act="restart">Restart</button>
            <button data-act="levels">Levels</button>
          </div>
        </div>
      </div>`;
    container.append(this.root);

    this.canvas = this.root.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.resultEl = this.root.querySelector('.result')!;
    this.pauseEl = this.root.querySelector('.pause')!;
    this.speedBtn = this.root.querySelector('[data-act="speed"]')!;
    this.pauseBtn = this.root.querySelector('[data-act="pause"]')!;
    this.powerUpBar = this.root.querySelector('.powerups')!;

    this.root.querySelector('.hud')!.addEventListener('click', (e) => {
      const act = actionOf(e);
      if (act === 'back') this.options.onExit();
      else if (act === 'speed') this.cycleSpeed();
      else if (act === 'pause') this.setPaused(!this.paused);
      else if (act === 'restart') this.restart();
    });
    this.powerUpBar.addEventListener('click', (e) => this.usePowerUp(actionOf(e)));
    this.resultEl.addEventListener('click', (e) => {
      const act = actionOf(e);
      if (act === 'retry') this.restart();
      else if (act === 'next') this.options.onNext();
      else if (act === 'levels') this.options.onExit();
    });
    this.pauseEl.addEventListener('click', (e) => {
      const act = actionOf(e);
      if (act === 'resume') this.setPaused(false);
      else if (act === 'restart') this.restart();
      else if (act === 'levels') this.options.onExit();
    });
    bindSoundAndVibration(this.pauseEl, options.settings, options.sfx);
    this.canvas.addEventListener('pointerdown', (e) => this.onTap(e.offsetX, e.offsetY));
    // Browsers only allow audio after a user gesture.
    this.root.addEventListener('pointerdown', () => this.options.sfx.unlock());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.restart();
    this.frame = requestAnimationFrame(this.tick);

    if (import.meta.env.DEV) {
      // Dev-only console hook for play-testing, e.g. stepping through a level's stored solution.
      Object.assign(window, {
        __pixelgame: { state: () => this.state, apply: (a: Action) => applyAction(this.state, a) },
      });
    }
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
    this.effects = noEffects();
    this.shakeUntil = 0;
    this.acc = 0;
    this.picking = false;
    this.resultEl.hidden = true;
    this.setPaused(false);
    this.updatePowerUpBar();
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

  /** Pausing opens the pause menu, which also has the sound and vibration switches. */
  private setPaused(paused: boolean): void {
    if (paused && this.state.status !== 'playing') return;
    this.paused = paused;
    this.pauseBtn.textContent = paused ? '▶' : '❚❚';
    if (paused) {
      this.pauseEl.querySelector('.pause-settings')!.innerHTML = soundAndVibrationRows(this.options.settings.get());
    }
    this.pauseEl.hidden = !paused;
  }

  private usePowerUp(act: string | undefined): void {
    if (this.paused || this.state.status !== 'playing') return;
    if (act === 'pickAny') {
      this.picking = !this.picking;
      this.options.sfx.play('deploy');
    } else if (act === 'extraSlot' || act === 'reveal') {
      if (applyAction(this.state, { type: 'powerUp', kind: act }).ok) {
        this.options.sfx.play('powerUp');
        this.buzz(8);
      }
    }
    this.updatePowerUpBar();
  }

  /** Show how often each power-up was used this attempt, and Pick Any's armed state. */
  private updatePowerUpBar(): void {
    for (const kind of POWER_UPS) {
      const btn = this.powerUpBar.querySelector<HTMLButtonElement>(`[data-act="${kind}"]`)!;
      const count = btn.querySelector<HTMLElement>('.pu-count')!;
      const used = this.state.powerUps[kind];
      count.hidden = used === 0;
      count.textContent = `×${used}`;
      btn.classList.toggle('armed', kind === 'pickAny' && this.picking);
      btn.disabled = kind === 'reveal' && this.state.revealAll;
    }
  }

  private onTap(x: number, y: number): void {
    if (this.paused || this.state.status !== 'playing' || !this.layout) return;
    const p = { x, y };
    let action: Action | undefined;
    // Where the deployed shooter's token flies from, and how big it starts.
    let from: { at: Point; size: number } | undefined;
    const slides: { from: number; to: number }[] = [];
    const slot = this.layout.buffer.findIndex((r) => contains(r, p));
    if (slot !== -1) {
      action = { type: 'deployBuffer', slot };
      // Shooters to the left of the one sent out slide right to close the gap.
      for (let i = 1; i <= slot; i++) {
        if (this.state.buffer[i - 1]) slides.push({ from: i - 1, to: i });
      }
      const r = this.layout.buffer[slot]!;
      from = { at: { x: r.x + r.w / 2, y: r.y + r.h / 2 }, size: r.w * 0.78 };
    }
    const column = this.layout.columns.findIndex((r) => contains(r, p));
    if (column !== -1) {
      const tiles = queueTiles(this.layout, this.state).tiles;
      const picked = this.picking ? tiles.find((t) => contains(t.rect, p)) : undefined;
      action = picked
        ? { type: 'deployQueue', column: picked.column, index: picked.index }
        : { type: 'deployQueue', column };
      const tile = picked ?? tiles.find((t) => t.column === column && t.index === 0);
      if (tile) {
        from = { at: { x: tile.rect.x + tile.rect.w / 2, y: tile.rect.y + tile.rect.h / 2 }, size: tile.rect.h * 0.8 };
      }
    }
    if (!action) return;

    const result = applyAction(this.state, action);
    if (result.ok) {
      const shooter = this.state.pending.at(-1);
      if (from && shooter) {
        const now = performance.now();
        this.effects.flights.push({
          from: from.at,
          to: this.layout.track[0]!,
          size: from.size,
          color: shooter.color,
          t: now,
        });
      }
      const now = performance.now();
      this.effects.slides = slides.map((sl) => ({ from: sl.from, to: sl.to, t: now }));
      this.options.sfx.play('deploy');
      this.buzz(8);
      if (action.type === 'deployQueue') this.picking = false;
      this.updatePowerUpBar();
    } else if (result.error === 'track-full') {
      this.flashUntil = performance.now() + 600;
      this.options.sfx.play('reject');
      this.buzz([20, 40, 20]);
    }
  }

  private buzz(pattern: number | number[]): void {
    if (!this.options.settings.get().haptics) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Not supported (e.g. desktop or iOS); haptics are optional.
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
        flashUntil: this.flashUntil,
        pickAny: this.picking,
        shakeUntil: this.shakeUntil,
      });
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private handle(events: GameEvent[], now: number): void {
    const { layout, level } = this;
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          this.options.sfx.play('shot', e.color);
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
          this.options.sfx.play('empty');
          const at = layout?.track[e.pos];
          if (at) this.effects.fades.push({ at, color: e.color, t: now });
          break;
        }
        case 'buffered':
          this.options.sfx.play('buffered');
          this.effects.landings = this.effects.landings.filter((l) => l.slot !== e.slot);
          this.effects.landings.push({ slot: e.slot, t: now });
          break;
        case 'won':
          this.options.sfx.play('win');
          this.buzz([30, 60, 30]);
          this.picking = false;
          this.launchConfetti(now);
          this.showWin();
          break;
        case 'lost':
          this.options.sfx.play('lose');
          this.buzz(120);
          this.shakeUntil = now + EFFECT_MS.shake;
          this.picking = false;
          this.showLoss(
            e.reason === 'overflow' ? 'Buffer overflow' : 'Out of moves',
            e.reason === 'overflow'
              ? 'A shooter finished its lap with the buffer full.'
              : 'Nothing left can hit the remaining pixels.',
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
    if (fx.flights.length) fx.flights = fx.flights.filter((f) => now - f.t < EFFECT_MS.flight);
    if (fx.landings.length) fx.landings = fx.landings.filter((l) => now - l.t < EFFECT_MS.landing);
    if (fx.slides.length) fx.slides = fx.slides.filter((sl) => now - sl.t < EFFECT_MS.slide);
    if (fx.confetti.length) fx.confetti = fx.confetti.filter((c) => now - c.t < EFFECT_MS.confetti);
  }

  /** A burst of pixels in the level's colours, from the top of the board. */
  private launchConfetti(now: number): void {
    if (!this.layout) return;
    const { board } = this.layout;
    const colours = this.level.palette.length;
    for (let i = 0; i < 90; i++) {
      this.effects.confetti.push({
        x: board.x + board.w * (0.2 + 0.6 * Math.random()),
        y: board.y + board.h * 0.35,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.25 - Math.random() * 0.45,
        size: 3 + Math.random() * 4,
        color: i % colours,
        t: now + Math.random() * 120,
      });
    }
  }

  private showWin(): void {
    const record: ClearRecord = {
      powerUps: { ...this.state.powerUps },
      ticks: this.state.tick,
      at: new Date().toISOString(),
    };
    const { isNewBest, previous } = this.options.progress.recordClear(this.level.id, record);
    const perfect = totalPowerUps(record) === 0;
    let bestLine: string;
    if (!previous) bestLine = 'First clear!';
    else if (isNewBest) bestLine = `New best! Previous: ${summarise(previous)}`;
    else bestLine = `Best: ${summarise(previous)}`;

    this.showCard(
      'won',
      perfect ? '⭐ Perfect!' : 'Cleared!',
      `<p class="used">${describePowerUps(record.powerUps)}</p>
       <p class="time">Time ${formatDuration(record.ticks * TICK_MS)}</p>
       <p class="best ${isNewBest ? 'new' : ''}">${bestLine}</p>`,
      `${this.options.hasNext ? '<button class="primary" data-act="next">Next level</button>' : ''}
       <button data-act="retry">${perfect ? 'Play again' : 'Retry for fewer power-ups'}</button>
       <button data-act="levels">Levels</button>`,
    );
  }

  private showLoss(title: string, detail: string): void {
    const best = this.options.progress.get(this.level.id)?.best;
    this.showCard(
      'lost',
      title,
      `<p>${detail}</p>${best ? `<p class="best">Best: ${summarise(best)}</p>` : ''}`,
      `<button class="primary" data-act="retry">Retry</button>
       <button data-act="levels">Levels</button>`,
    );
  }

  private showCard(kind: 'won' | 'lost', title: string, body: string, actions: string): void {
    this.resultTimer = window.setTimeout(() => {
      this.resultEl.innerHTML = `
        <div class="card ${kind}">
          <h2>${title}</h2>
          ${body}
          <div class="actions">${actions}</div>
        </div>`;
      this.resultEl.hidden = false;
    }, RESULT_DELAY_MS);
  }
}

const POWER_UP_ICONS: Record<PowerUpKind, string> = {
  extraSlot: '+1',
  pickAny: '☝',
  reveal: '👁',
};

/** "Perfect in 1:05" or "2 power-ups in 1:05" */
function summarise(record: ClearRecord): string {
  const total = totalPowerUps(record);
  return `${total ? plural(total, 'power-up') : 'Perfect'} in ${formatDuration(record.ticks * TICK_MS)}`;
}

/** The `data-act` value of the button (or its child) that was clicked. */
function actionOf(e: Event): string | undefined {
  return e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]')?.dataset['act'] : undefined;
}
