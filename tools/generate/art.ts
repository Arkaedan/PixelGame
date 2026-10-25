// Original pixel art for the starter levels, drawn with Painter. Palette index 0 is listed first.
// Boards are 30, 40, 50 or 60 cells square; some drawings were designed on another grid and are
// scaled to fit (the third Painter argument).
import type { Art } from './build.ts';
import { Painter } from './paint.ts';
import { createRng, randomInt } from './rng.ts';

const C = {
  red: '#e53935',
  darkRed: '#8e1b1b',
  pink: '#ff8a80',
  orange: '#fb8c00',
  yellow: '#fdd835',
  cream: '#fff3c4',
  green: '#43a047',
  darkGreen: '#1b5e20',
  lime: '#9ccc65',
  blue: '#1e88e5',
  navy: '#283593',
  sky: '#81d4fa',
  purple: '#8e24aa',
  brown: '#6d4c41',
  darkBrown: '#3e2723',
  white: '#f5f5f5',
  grey: '#90a4ae',
  black: '#455a64',
  teal: '#00897b',
  magenta: '#d81b60',
};

export function heart(): Art {
  const size = 24; // design grid
  return new Painter(30, 30, size)
    .fill(0, (px, py) => {
      const u = (px / size) * 2.5 - 1.25;
      const v = 1.2 - (py / size) * 2.45;
      return (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0;
    })
    .outline(2)
    .circle(7.5, 7.5, 2.6, 1)
    .toArt([C.red, C.pink, C.darkRed]);
}

export function smiley(): Art {
  const c = 14;
  return new Painter(30, 30, 28)
    .circle(c, c, 13.6, 2)
    .circle(c, c, 12.2, 0)
    .ellipse(c - 4.5, 10, 1.6, 2.6, 1)
    .ellipse(c + 4.5, 10, 1.6, 2.6, 1)
    .fill(1, (px, py) => {
      const d = Math.hypot(px - c, py - (c - 1));
      return d >= 6.6 && d <= 8.2 && py > c + 2;
    })
    .toArt([C.yellow, C.darkBrown, C.orange]);
}

/** 10×10 blocks, each four 5×5 squares in two colours on the diagonals (50 pixels per colour pair). */
export function quilt(): Art {
  return new Painter(30)
    .fill((x, y) => {
      const a = (Math.floor(x / 10) + 2 * Math.floor(y / 10)) % 4;
      const sameDiagonal = Math.floor(x / 5) % 2 === Math.floor(y / 5) % 2;
      return sameDiagonal ? a : (a + 2) % 4;
    })
    .toArt([C.blue, C.yellow, C.red, C.green]);
}

export function sunset(): Art {
  const horizon = 20;
  const sky = [3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6];
  return new Painter(30, 30, 32)
    .fill((_x, _y, _px, py) => {
      const y = Math.floor(py);
      if (y < horizon) return sky[y]!;
      return (y - horizon) % 4 < 2 ? 1 : 0;
    })
    .fill(2, (px, py) => py < horizon && Math.hypot(px - 16, py - horizon) <= 7.5)
    .fill(2, (px, py) => {
      const depth = Math.floor(py) - horizon;
      return depth >= 0 && depth % 2 === 0 && Math.abs(px - 16) <= 7 - depth / 2;
    })
    .toArt(['#1565c0', C.blue, '#fff176', '#4527a0', '#c2185b', '#ff7043', '#ffb74d']);
}

export function mushroom(): Art {
  return new Painter(40, 40, 32)
    .rect(0, 29, 32, 3, 4)
    .ellipse(16, 15, 14, 11.5, 0)
    .fill(-1, (_, py) => py > 15 && py < 29)
    .rect(11, 15, 10, 13, 2)
    .ellipse(16, 27.5, 5, 1.5, 2)
    .outline(3)
    .rect(0, 29, 32, 3, 4)
    .circle(10, 9, 2.6, 1)
    .circle(19, 6, 2.2, 1)
    .circle(23, 11.5, 2.4, 1)
    .circle(14.5, 13, 1.6, 1)
    .toArt([C.red, C.white, C.cream, C.darkBrown, C.green]);
}

export function rainbow(): Art {
  const bands = [C.purple, C.blue, C.green, C.yellow, C.orange, C.red];
  const p = new Painter(40, 40, 36);
  // Outermost band first, so each smaller band paints over the inside of the previous one.
  for (let i = bands.length - 1; i >= 0; i--) {
    p.fill(i, (px, py) => py < 29 && Math.hypot(px - 18, py - 29) <= 6 + (i + 1) * 2);
  }
  p.fill(-1, (px, py) => py < 29 && Math.hypot(px - 18, py - 29) <= 6);
  for (const [cx, cy, r] of [
    [5, 28, 4],
    [9.5, 29.5, 3.5],
    [2, 31, 2.5],
    [31, 28, 4],
    [26.5, 29.5, 3.5],
    [34, 31, 2.5],
  ] as const) {
    p.circle(cx, cy, r, 6);
  }
  return p.toArt([...bands, C.white]);
}

export function cat(): Art {
  return new Painter(40, 40, 36)
    .polygon(
      [
        [5, 17],
        [8, 3],
        [17, 11],
      ],
      0,
    )
    .polygon(
      [
        [31, 17],
        [28, 3],
        [19, 11],
      ],
      0,
    )
    .ellipse(18, 21, 13.5, 11.5, 0)
    .outline(3)
    .polygon(
      [
        [8, 12],
        [9, 6],
        [13.5, 10.5],
      ],
      1,
    )
    .polygon(
      [
        [28, 12],
        [27, 6],
        [22.5, 10.5],
      ],
      1,
    )
    .ellipse(18, 27, 5.5, 3.5, 4)
    .ellipse(12.5, 19, 2.4, 3.2, 2)
    .ellipse(23.5, 19, 2.4, 3.2, 2)
    .ellipse(12.5, 19, 0.8, 2.6, 3)
    .ellipse(23.5, 19, 0.8, 2.6, 3)
    .polygon(
      [
        [16, 24],
        [20, 24],
        [18, 26.5],
      ],
      1,
    )
    .toArt([C.grey, C.pink, C.lime, C.black, C.white]);
}

export function tree(): Art {
  const p = new Painter(40).rect(0, 36, 40, 4, 4).rect(17, 30, 6, 7, 2);
  const layers: [number, number, number][] = [
    [16, 33, 17],
    [10, 26, 14],
    [4, 18, 10],
  ];
  layers.forEach(([top, bottom, half], i) =>
    p.polygon(
      [
        [20, top],
        [20 - half, bottom],
        [20 + half, bottom],
      ],
      i % 2,
    ),
  );
  for (const [x, y] of [
    [14, 29],
    [25, 27],
    [19, 22],
    [13, 22],
    [24, 17],
    [17, 13],
  ] as const) {
    p.circle(x, y, 1.3, 5);
  }
  return p
    .polygon(
      [
        [20, 0.5],
        [22, 5],
        [18, 5],
      ],
      3,
    )
    .toArt([C.green, C.darkGreen, C.brown, C.yellow, C.white, C.red]);
}

export function fish(): Art {
  return new Painter(40)
    .polygon(
      [
        [28, 20],
        [38, 10],
        [36, 20],
        [38, 30],
      ],
      1,
    )
    .polygon(
      [
        [14, 12],
        [22, 5],
        [24, 13],
      ],
      1,
    )
    .ellipse(17, 20, 14, 9, 0)
    .fill(2, (px, py) => ((px - 17) / 14) ** 2 + ((py - 20) / 9) ** 2 <= 1 && Math.abs(Math.abs(px - 18) - 4) < 1.4)
    .circle(8.5, 18, 2.4, 2)
    .circle(8.5, 18, 1.1, 3)
    .circle(35, 5, 1.6, 4)
    .circle(38, 1.5, 1.1, 4)
    .toArt([C.orange, '#e65100', C.white, C.black, C.sky]);
}

export function target(): Art {
  const size = 50;
  const ring = 5;
  const centre = size / 2;
  return new Painter(size)
    .fill((x, y) => Math.floor(Math.max(Math.abs(x + 0.5 - centre), Math.abs(y + 0.5 - centre)) / ring) % 5)
    .toArt([C.red, C.white, C.blue, C.yellow, C.black]);
}

/** The planet's ring: between two flattened ellipses. */
function planetRing(px: number, py: number): boolean {
  const outer = ((px - 24) / 23) ** 2 + ((py - 25) / 6.5) ** 2 <= 1;
  const inner = ((px - 24) / 17.5) ** 2 + ((py - 25) / 4) ** 2 <= 1;
  return outer && !inner;
}

export function planet(): Art {
  const rng = createRng(48);
  const p = new Painter(50, 50, 48);
  for (let i = 0; i < 40; i++) p.set(randomInt(rng, 0, 49), randomInt(rng, 0, 49), i % 3 === 0 ? 5 : 4);
  p.fill(3, (px, py) => planetRing(px, py) && py < 25);
  p.fill(
    (_x, _y, _px, py) => [0, 1, 2][Math.floor((py - 11) / 4) % 3]!,
    (px, py) => Math.hypot(px - 24, py - 25) <= 13.5,
  );
  p.fill(3, (px, py) => planetRing(px, py) && py >= 25);
  return p.toArt([C.orange, C.cream, C.brown, C.sky, C.white, C.yellow]);
}

export function argyle(): Art {
  const d = 10;
  return new Painter(50)
    .fill((x, y) => {
      const u = Math.floor((x + 0.5 + y + 0.5) / d);
      const v = Math.floor((x + 0.5 - (y + 0.5) + 50) / d);
      if ((x + y + d / 2) % d === 0 || (x - y + 50 + d / 2) % d === 0) return 2;
      return (u + v) % 2;
    })
    .toArt([C.navy, C.teal, C.yellow]);
}

export function house(): Art {
  return new Painter(50, 50, 52)
    .circle(45, 7, 4.5, 6)
    .rect(0, 44, 52, 8, 0)
    .rect(34, 9, 5, 12, 4)
    .polygon(
      [
        [5, 26],
        [26, 8],
        [47, 26],
      ],
      1,
    )
    .rect(10, 25, 32, 19, 2)
    .rect(22, 31, 8, 13, 4)
    .rect(13, 29, 7, 7, 3)
    .rect(32, 29, 7, 7, 3)
    .rect(16, 29, 1, 7, 2)
    .rect(13, 32, 7, 1, 2)
    .rect(35, 29, 1, 7, 2)
    .rect(32, 32, 7, 1, 2)
    .polygon(
      [
        [22, 44],
        [30, 44],
        [34, 52],
        [18, 52],
      ],
      5,
    )
    .toArt([C.green, C.red, C.cream, C.sky, C.brown, C.grey, C.yellow]);
}

export function stainedGlass(): Art {
  const size = 60;
  const rng = createRng(60);
  const seeds = Array.from({ length: 34 }, (_, i) => ({
    x: rng() * size,
    y: rng() * size,
    c: i % 7,
  }));
  return new Painter(size)
    .fill((x, y) => {
      const ds = seeds
        .map((s) => ({ c: s.c, d: Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) }))
        .toSorted((a, b) => a.d - b.d);
      return ds[1]!.d - ds[0]!.d < 1.1 ? 7 : ds[0]!.c;
    })
    .toArt([C.red, C.blue, C.yellow, C.green, C.purple, C.orange, C.sky, C.black]);
}
