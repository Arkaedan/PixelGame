# PixelGame — Game Spec (v0.1 draft)

A phone-first puzzle game: clear a pixel-art grid by sending coloured shooters around a track that encircles it. No currency; power-ups are free but recorded against your best result for each level. Every level is beatable without power-ups.

---

## 1. Terminology

| Term               | Meaning                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| **Board**          | The W×H grid of cells. Each cell is either **empty** or a **pixel** of one colour. |
| **Track**          | The square loop around the board that shooters travel along, once.                 |
| **Shooter**        | A coloured unit with an **ammo** count. It shoots pixels of its own colour.        |
| **Queue**          | 5 columns of shooters waiting to be deployed.                                      |
| **Buffer**         | 5 slots that hold shooters which finished a lap with ammo left.                    |
| **Track capacity** | The maximum number of shooters on the track at once (default 5).                   |
| **Line**           | A row or column, seen from one side of the board. Each side has its own lines.     |

---

## 2. Core rules

### 2.1 Track

- The track has one position for each board column along the top and bottom sides, one for each board row along the left and right sides, plus 4 corners. Lap length = `2W + 2H + 4`.
- Shooters **enter at the bottom-left corner**, travel **clockwise** (right along the bottom, up the right side, left along the top, down the left side), and leave at the same corner.
- Shooters move at the same constant speed. A shooter can't be deployed while the entry position is occupied; the deploy waits until it's clear.
- Movement and shooting run on a **fixed-timestep, deterministic simulation** (integer ticks), and rendering interpolates between ticks for smooth motion. The same deploy timings always give the same result, which makes the solver, replays and tests possible.

### 2.2 Shooting (line of sight, one shot per line)

- When a shooter reaches a position facing a line (e.g. column 7 seen from below), it looks at the **first pixel** in that line from its side.
- If that pixel matches the shooter's colour and the shooter has ammo, the pixel is destroyed and ammo goes down by 1. Otherwise nothing happens.
- **At most one shot per line per pass.** In one lap, each column can be hit at most twice (from bottom and top) and each row at most twice (from left and right).
- Corners never shoot.
- If several shooters reach lines on the same tick, they resolve in order of track position.

### 2.3 Shooter lifecycle

1. **Queue → Track**: tap the front shooter of any column, if the number of shooters on the track is below capacity.
2. **On track**: shoots as above. When **ammo reaches 0 it disappears** at once.
3. **Lap complete with ammo left → Buffer**. If the buffer is **full (5)**, the level is **failed**.
4. **Buffer → Track**: tap a buffered shooter to redeploy it, which also needs a free track slot. It keeps its remaining ammo.

### 2.4 Win / lose

- **Win**: the board is empty.
- **Lose (overflow)**: a shooter finishes a lap while the buffer is full.
- **Lose (stuck)**: the queue is empty, the track is empty, and no buffered shooter has a reachable target. The game shows "Out of moves" so you're never left in a loop with no way forward.
- **Restart** is always available and free.

### 2.5 Ammo

- For each colour, **total ammo exactly equals the number of pixels** of that colour. Ammo is only spent on hits.
- Ammo values are round (multiples of 5 or 10) where possible. When a colour's pixel count doesn't divide evenly, one shooter of that colour holds the remainder.

### 2.6 Pacing

- Real-time, with a **speed toggle** (1× / 2× / 4×) and **pause**.
- The base speed is tuned so a lap on a 24×24 board takes about 8 s at 1×. Bigger boards have longer laps, so large levels are long, by design.

---

## 3. Queue visibility and mystery shooters

- Each column shows its **first 3 shooters** (a global setting, which levels can override). Deeper shooters appear as a count only, e.g. "+12".
- **Mystery shooters** (some levels only) appear as **"?"** until they reach the **front** of their column. Levels are fixed, not random each attempt, so retries let you learn them and a perfect run is always reachable.

---

## 4. Power-ups

Free and unlimited, but **every use is recorded** for the attempt. Restarting resets the count.

| Power-up       | Effect                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| **Extra Slot** | +1 track capacity for the rest of the attempt. Stackable (5 → 6 → 7 …). Each use counts 1.                  |
| **Pick Any**   | Your next deploy can be **any visible shooter** in the queue, not just a column's front. Each use counts 1. |
| **Reveal**     | Shows the whole queue (every depth, including mystery shooters) for the rest of the attempt. Counts 1.      |

Pick Any together with Reveal lets you take any shooter in the queue.

---

## 5. Records and progression

- Each level keeps your **best clear**, ranked by **total power-ups used** (fewer is better). Ties go to the faster clear time. A worse result never overwrites a better one.
- The breakdown is stored, e.g. `1× Extra Slot, 2× Pick Any`.
- Badges on level select: **⭐ Perfect** (0 power-ups), **✓ Clear** (any clear).
- **Linear unlock**: clearing a level with any number of power-ups unlocks the next. Any unlocked level can be replayed.
- Progress is saved locally on the device (`localStorage`). No accounts.

---

## 6. Levels

### 6.1 Size

- Boards range from **24×24 to 60×60**, not necessarily square. Empty background cells are allowed, so pixel art keeps its silhouette.
- Colours: about 2–3 on early levels, rising to roughly 8.

### 6.2 Level file (JSON)

```jsonc
{
  "id": "001",
  "name": "Heart",
  "width": 24,
  "height": 24,
  "palette": ["#e53935", "#fdd835", "#1e88e5"],
  "grid": ["....000....", "..00110...", "..."], // one string per row; '.' = empty, digit/char = palette index
  "queue": [
    // 5 columns, front first
    [
      { "c": 0, "a": 20 },
      { "c": 1, "a": 10, "hidden": true },
    ],
    [],
  ],
  "trackCapacity": 5, // optional overrides
  "bufferSize": 5,
  "visibleRows": 3,
  "solution": [/* deploy events (tick, source) — proof it's solvable with no power-ups */],
}
```

### 6.3 Generator and solver (dev tooling, not in the game)

- **Input**: pixel art, either a PNG (colour-quantised, transparency = empty) or a JSON grid.
- **Construction**: simulate a no-power-up playthrough with a heuristic player, record the order of deploys, then split that order across 5 columns in a way the front-of-column rule allows. Every generated level is **solvable by construction**, and the solution is stored in the file.
- **Verification**: replay the stored solution in the shared simulation. It must clear the board with no power-ups and no overflow. CI or the tests run this on every level file.
- **Difficulty settings**: how far the column layout strays from the obvious order, buffer pressure, number of mystery shooters, and shooter count and size.
- Claude can generate levels directly with the CLI, using original pixel art (shapes, fruit, animals, flags and so on), so you can play-test quickly.

### 6.4 Editor (PC dev tool, later milestone)

A separate page, not shipped in the game: import a PNG or draw a grid, generate, verify, play-test, and export JSON. It's built on the same core modules so it can move into the game later.

---

## 7. Screen layout (portrait)

```
┌───────────────────────────┐
│ Lv 12   ⏸  ↻  1×▸   ⚡⚡⚡ │  HUD: level, pause, restart, speed, power-ups (+use counts)
│ ┌───────────────────────┐ │
│ │ track ┌───────────┐   │ │
│ │       │   BOARD   │   │ │  Board fits the width; 60×60 gives roughly 5–6 px cells
│ │       └───────────┘   │ │
│ └───────────────────────┘ │
│ Buffer: [ ][ ][ ][ ][ ]   │  5 slots (tap to redeploy)
│ Track: 3/5                │
│ ┌──┬──┬──┬──┬──┐          │
│ │■ │■ │■ │■ │■ │ ← front  │  Queue: 5 columns, 3 visible rows
│ │■ │? │■ │■ │■ │          │
│ │■ │■ │■ │  │■ │          │
│ │+8│+5│+9│  │+7│          │
│ └──┴──┴──┴──┴──┘          │
└───────────────────────────┘
```

Other screens: **Level select** (numbered tiles with badges), **Result** (clear or fail, power-ups used compared with your best, Retry / Next), **Settings** (sound, haptics, default speed).

Feel: pixel "pop" particles, shot tracer, haptic tick on hits (`navigator.vibrate` on Android), simple Web Audio sounds.

---

## 8. Tech stack

- **TypeScript + Vite**, rendering with **HTML Canvas 2D** (no engine; 3,600 rectangles plus a few sprites is light work).
- **PWA** via `vite-plugin-pwa`: installable from Chrome on Android, full-screen, works offline.
- **Vitest** for simulation and level-verification tests.
- **Node CLI** for the generator and solver, sharing the core simulation code.
- Hosting on **GitHub Pages**. Installing as a PWA needs HTTPS. During development, test on the phone over Wi-Fi with `vite --host`.
- Optional later: wrap with **Capacitor** to get an APK or Play Store build.

### Project structure

```
src/core/        simulation, rules, types, level loading (pure TS, no DOM)
src/game/        rendering, input, screens, animation
src/storage/     progress and records
tools/generate/  CLI: art → level JSON (+ solution)
tools/editor/    PC editor page (later)
levels/          level JSON files + order manifest
tests/           sim unit tests + verify every level
```

---

## 9. Milestones

1. **Core simulation**: headless rules engine with full unit tests (shooting, lifecycle, overflow, stuck detection, determinism).
2. **Playable prototype**: board, track, buffer and queue rendering; tap to deploy; win and lose; 3 hand-made levels; runs on your phone.
3. **Generator CLI**: art to level with a verified solution; about 15 starter levels from 24×24 to 60×60.
4. **Power-ups and records**: the three power-ups, result screen, best-record logic, level select with linear unlock, saved progress.
5. **PWA and polish**: install and offline support, animations, sound, haptics, speed toggle; deploy to GitHub Pages.
6. **PC editor**: PNG import, draw, generate, verify, play-test, export.

Later ideas: in-game editor, level share codes, more power-ups or mechanics, Capacitor APK.

---

## 10. Defaults chosen (confirm or change)

- Entry at the bottom-left corner, clockwise travel.
- Lap of about 8 s at 1× on 24×24; speed per cell is fixed, so bigger boards have longer laps.
- Pick Any covers **visible** shooters only (combine with Reveal for deeper ones).
- Mystery shooters reveal on reaching the front row.
- A blocked deploy (entry occupied) waits rather than being refused.
- Ammo uses round numbers, with one remainder shooter per colour when needed.
- Ties on best record go to the faster time.
