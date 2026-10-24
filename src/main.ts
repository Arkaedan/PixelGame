import './style.css';
import type { Level } from './core/index.ts';
import { LEVELS } from './game/levels.ts';
import { Sfx } from './game/audio.ts';
import { GameScreen } from './game/screen.ts';
import { escapeHtml, plural } from './game/text.ts';
import { ProgressStore, totalPowerUps } from './storage/progress.ts';
import { SettingsStore, type Settings } from './storage/settings.ts';

const app = document.querySelector<HTMLElement>('#app')!;
const progress = ProgressStore.browser();
const settings = SettingsStore.browser();
const sfx = new Sfx(settings.get().sound);
const levelIds = LEVELS.map((l) => l.id);
/** `?all` in the URL opens every level, for testing. */
const unlockAll = new URLSearchParams(location.search).has('all');
let current: GameScreen | undefined;

const isUnlocked = (index: number): boolean => unlockAll || progress.isUnlocked(levelIds, index);

function showMenu(): void {
  current?.destroy();
  current = undefined;
  app.innerHTML = `
    <main class="menu">
      <header class="menu-head">
        <h1>PixelGame</h1>
        <button class="icon" data-act="settings" aria-label="Settings">⚙</button>
      </header>
      <div class="levels">
        ${LEVELS.map((level, i) => {
          const locked = !isUnlocked(i);
          const best = progress.get(level.id)?.best;
          const total = best ? totalPowerUps(best) : 0;
          let badge = '';
          if (locked) badge = '<span class="badge locked">🔒 Locked</span>';
          else if (best && total === 0) badge = '<span class="badge perfect">⭐ Perfect</span>';
          else if (best) badge = `<span class="badge cleared">✓ ${plural(total, 'power-up')}</span>`;
          return `
          <button class="level${locked ? ' is-locked' : ''}" data-index="${i}" ${locked ? 'disabled' : ''}>
            <canvas width="${level.width}" height="${level.height}"></canvas>
            <span class="num">${i + 1}</span>
            <span class="name">${escapeHtml(level.name)}</span>
            <span class="size">${level.width}×${level.height}${level.difficulty ? ` · <b class="${level.difficulty}">${level.difficulty}</b>` : ''}</span>
            ${badge}
          </button>`;
        }).join('')}
      </div>
    </main>`;
  app.querySelector('[data-act="settings"]')!.addEventListener('click', showSettings);
  app.querySelectorAll<HTMLButtonElement>('.level').forEach((btn) => {
    const i = Number(btn.dataset['index']);
    drawThumbnail(btn.querySelector('canvas')!, LEVELS[i]!, btn.disabled);
    btn.addEventListener('click', () => {
      history.pushState({ level: i }, '');
      play(i);
    });
  });
}

function play(index: number): void {
  const level = LEVELS[index]!;
  current?.destroy();
  app.innerHTML = '';
  current = new GameScreen(app, level, {
    levelNumber: index + 1,
    hasNext: index + 1 < LEVELS.length,
    progress,
    settings: settings.get(),
    sfx,
    onExit: () => history.back(),
    onNext: () => {
      history.replaceState({ level: index + 1 }, '');
      play(index + 1);
    },
  });
}

/** A sheet over the level list with sound, vibration and starting speed. */
function showSettings(): void {
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  const render = (s: Settings): void => {
    const toggle = (key: 'sound' | 'haptics', label: string): string => `
      <label class="row">
        <span>${label}</span>
        <input type="checkbox" data-key="${key}" ${s[key] ? 'checked' : ''} />
      </label>`;
    sheet.innerHTML = `
      <div class="card settings" role="dialog" aria-label="Settings">
        <h2>Settings</h2>
        ${toggle('sound', 'Sound')}
        ${toggle('haptics', 'Vibration')}
        <div class="row">
          <span>Starting speed</span>
          <div class="segmented">
            ${([1, 2, 4] as const)
              .map((v) => `<button data-speed="${v}" class="${s.speed === v ? 'on' : ''}">${v}×</button>`)
              .join('')}
          </div>
        </div>
        <div class="actions"><button class="primary" data-act="close">Done</button></div>
      </div>`;
  };
  render(settings.get());
  sheet.addEventListener('change', (e) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    const key = e.target.dataset['key'];
    if (key !== 'sound' && key !== 'haptics') return;
    const updated = settings.update({ [key]: e.target.checked });
    sfx.enabled = updated.sound;
    if (key === 'sound' && updated.sound) {
      sfx.unlock();
      sfx.play('deploy');
    }
  });
  sheet.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const speed = e.target.closest<HTMLElement>('[data-speed]')?.dataset['speed'];
    const chosen = speed === '1' ? 1 : speed === '2' ? 2 : speed === '4' ? 4 : undefined;
    if (chosen) render(settings.update({ speed: chosen }));
    if (e.target === sheet || e.target.closest('[data-act="close"]')) sheet.remove();
  });
  app.append(sheet);
}

/** Level art at one pixel per cell; locked levels show only a silhouette. */
function drawThumbnail(canvas: HTMLCanvasElement, level: Level, silhouette: boolean): void {
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(level.width, level.height);
  level.cells.forEach((v, i) => {
    if (v < 0) return;
    const n = silhouette ? 0x3a4050 : parseInt(level.palette[v]!.slice(1), 16);
    image.data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i * 4);
  });
  ctx.putImageData(image, 0, 0);
}

/** Show whatever a history entry points at: an unlocked level, or the menu. */
function route(state: unknown): void {
  const level =
    state && typeof state === 'object' && 'level' in state && typeof state.level === 'number' ? state.level : -1;
  if (LEVELS[level] && isUnlocked(level)) play(level);
  else showMenu();
}

// The Android back button (and browser back) returns from a level to the menu. A reload keeps
// the entry's state, so start from it too.
window.addEventListener('popstate', (e: PopStateEvent) => route(e.state));
route(history.state);
