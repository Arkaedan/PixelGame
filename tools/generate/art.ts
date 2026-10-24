/** Source pixel art for levels. Each grid cell is a palette index, or -1 for empty. */
export interface Art {
  id: string;
  name: string;
  palette: string[];
  grid: string[];
}

function paint(width: number, height: number, colourAt: (x: number, y: number) => number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const c = colourAt(x, y);
      row += c < 0 ? '.' : c.toString(36);
    }
    rows.push(row);
  }
  return rows;
}

/** Cells inside `inside` that touch an outside cell (4-neighbourhood) form its outline. */
function onEdge(inside: (x: number, y: number) => boolean, x: number, y: number): boolean {
  return !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
}

function heart(): Art {
  const size = 24;
  const inside = (x: number, y: number): boolean => {
    // classic heart curve (x²+y²-1)³ - x²y³ <= 0, sampled at cell centres
    const u = ((x + 0.5) / size) * 2.6 - 1.3;
    const v = 1.25 - ((y + 0.5) / size) * 2.5;
    return (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0;
  };
  return {
    id: '001',
    name: 'Heart',
    palette: ['#e53935', '#ff8a80', '#8e1b1b'],
    grid: paint(size, size, (x, y) => {
      if (!inside(x, y)) return -1;
      if (onEdge(inside, x, y)) return 2;
      return Math.hypot(x - 7, y - 7) < 2.6 ? 1 : 0;
    }),
  };
}

function smiley(): Art {
  const size = 28;
  const c = (size - 1) / 2;
  const inside = (x: number, y: number): boolean => Math.hypot(x - c, y - c) <= 13.2;
  return {
    id: '002',
    name: 'Smiley',
    palette: ['#fdd835', '#3e2723', '#fb8c00'],
    grid: paint(size, size, (x, y) => {
      if (!inside(x, y)) return -1;
      if (Math.hypot(x - c, y - c) > 11.8) return 2;
      const eye = (ex: number): boolean => ((x - ex) / 1.6) ** 2 + ((y - 9.5) / 2.6) ** 2 <= 1;
      if (eye(c - 4.5) || eye(c + 4.5)) return 1;
      const d = Math.hypot(x - c, y - (c - 1));
      if (d >= 6.6 && d <= 8.2 && y > c + 2) return 1;
      return 0;
    }),
  };
}

function sunset(): Art {
  const size = 32;
  const horizon = 20;
  const sky = [3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6];
  return {
    id: '003',
    name: 'Sunset',
    palette: ['#1565c0', '#1e88e5', '#fff176', '#4527a0', '#c2185b', '#ff7043', '#ffb74d'],
    grid: paint(size, size, (x, y) => {
      if (y < horizon) {
        if (Math.hypot(x - 15.5, y - horizon) <= 7.5) return 2;
        return sky[y]!;
      }
      // shimmering reflection of the sun, narrowing with depth
      const half = 7 - (y - horizon) / 2;
      if ((y - horizon) % 2 === 0 && Math.abs(x - 15.5) <= half) return 2;
      return (y - horizon) % 4 < 2 ? 1 : 0;
    }),
  };
}

function checkers(): Art {
  const size = 40;
  const tile = 8;
  return {
    id: '004',
    name: 'Checkers',
    palette: ['#43a047', '#fdd835', '#1e88e5', '#e53935'],
    grid: paint(size, size, (x, y) => {
      const tx = Math.floor(x / tile);
      const ty = Math.floor(y / tile);
      return (tx + ty) % 2 === 0 ? ((tx + ty) % 4 === 0 ? 0 : 2) : tx % 2 === 0 ? 1 : 3;
    }),
  };
}

export const ARTS: Art[] = [heart(), smiley(), sunset(), checkers()];
