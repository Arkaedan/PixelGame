import './style.css';
import type { Level } from './core/index.ts';
import { LEVELS } from './game/levels.ts';
import { GameScreen } from './game/screen.ts';

const app = document.querySelector<HTMLElement>('#app')!;
let current: GameScreen | undefined;

function showMenu(): void {
  current?.destroy();
  current = undefined;
  app.innerHTML = `
    <main class="menu">
      <h1>PixelGame</h1>
      <div class="levels">
        ${LEVELS.map(
          (level, i) => `
          <button class="level" data-index="${i}">
            <canvas width="${level.width}" height="${level.height}"></canvas>
            <span class="num">${i + 1}</span>
            <span class="name">${level.name}</span>
            <span class="size">${level.width}×${level.height}</span>
          </button>`,
        ).join('')}
      </div>
    </main>`;
  app.querySelectorAll<HTMLButtonElement>('.level').forEach((btn) => {
    const i = Number(btn.dataset['index']);
    drawThumbnail(btn.querySelector('canvas')!, LEVELS[i]!);
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
    onExit: () => history.back(),
    onNext: () => {
      history.replaceState({ level: index + 1 }, '');
      play(index + 1);
    },
  });
}

function drawThumbnail(canvas: HTMLCanvasElement, level: Level): void {
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(level.width, level.height);
  level.cells.forEach((v, i) => {
    if (v < 0) return;
    const n = parseInt(level.palette[v]!.slice(1), 16);
    image.data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i * 4);
  });
  ctx.putImageData(image, 0, 0);
}

/** Show whatever a history entry points at: a level, or the menu. */
function route(state: unknown): void {
  const level =
    state && typeof state === 'object' && 'level' in state && typeof state.level === 'number' ? state.level : -1;
  if (LEVELS[level]) play(level);
  else showMenu();
}

// The Android back button (and browser back) returns from a level to the menu. A reload keeps
// the entry's state, so start from it too.
window.addEventListener('popstate', (e: PopStateEvent) => route(e.state));
route(history.state);
