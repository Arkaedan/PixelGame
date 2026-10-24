import type { Art } from './build.ts';

type Pt = [number, number];

/**
 * Tiny raster painter for level art. Coordinates are in cells; a cell is inside a shape when its
 * centre (x + 0.5, y + 0.5) is. Later shapes paint over earlier ones.
 */
export class Painter {
  readonly width: number;
  readonly height: number;
  private readonly cells: Int8Array;

  constructor(width: number, height = width) {
    this.width = width;
    this.height = height;
    this.cells = new Int8Array(width * height).fill(-1);
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    return this.cells[y * this.width + x]!;
  }

  set(x: number, y: number, c: number): this {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.cells[y * this.width + x] = c;
    return this;
  }

  /** Paint every cell whose centre passes `test`. `c` may depend on the cell. */
  fill(c: number | ((x: number, y: number) => number), test: (px: number, py: number) => boolean = () => true): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (test(x + 0.5, y + 0.5)) this.set(x, y, typeof c === 'number' ? c : c(x, y));
      }
    }
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: number): this {
    return this.fill(c, (px, py) => px >= x && px < x + w && py >= y && py < y + h);
  }

  circle(cx: number, cy: number, r: number, c: number): this {
    return this.ellipse(cx, cy, r, r, c);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: number): this {
    return this.fill(c, (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1);
  }

  /** Ring between two radii. */
  ring(cx: number, cy: number, inner: number, outer: number, c: number): this {
    return this.fill(c, (px, py) => {
      const d = Math.hypot(px - cx, py - cy);
      return d >= inner && d <= outer;
    });
  }

  polygon(points: Pt[], c: number): this {
    return this.fill(c, (px, py) => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i]!;
        const [xj, yj] = points[j]!;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    });
  }

  /** Recolour the outermost cells of the painted shape (those touching empty cells or the edge). */
  outline(c: number): this {
    const edge: number[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y) < 0) continue;
        if ([this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)].includes(-1)) {
          edge.push(y * this.width + x);
        }
      }
    }
    for (const i of edge) this.cells[i] = c;
    return this;
  }

  toArt(palette: string[]): Art {
    const grid: string[] = [];
    for (let y = 0; y < this.height; y++) {
      let row = '';
      for (let x = 0; x < this.width; x++) {
        const v = this.get(x, y);
        row += v < 0 ? '.' : v.toString(36);
      }
      grid.push(row);
    }
    return { palette, grid };
  }
}
