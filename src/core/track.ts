import { EMPTY, type TrackSlot } from './types.ts';

/**
 * Track layout, clockwise from the entry at the bottom-left corner:
 *   0                      corner (entry/exit)
 *   1 .. W                 bottom side, columns 0..W-1, facing up
 *   W+1                    corner
 *   W+2 .. W+H+1           right side, rows H-1..0, facing left
 *   W+H+2                  corner
 *   W+H+3 .. 2W+H+2        top side, columns W-1..0, facing down
 *   2W+H+3                 corner
 *   2W+H+4 .. 2W+2H+3      left side, rows 0..H-1, facing right
 */
export function trackLength(width: number, height: number): number {
  return 2 * width + 2 * height + 4;
}

export function buildSlots(width: number, height: number): TrackSlot[] {
  const corner: TrackSlot = { kind: 'corner' };
  const slots: TrackSlot[] = [corner];
  for (let x = 0; x < width; x++) slots.push({ kind: 'line', side: 'bottom', index: x });
  slots.push(corner);
  for (let y = height - 1; y >= 0; y--) slots.push({ kind: 'line', side: 'right', index: y });
  slots.push(corner);
  for (let x = width - 1; x >= 0; x--) slots.push({ kind: 'line', side: 'top', index: x });
  slots.push(corner);
  for (let y = 0; y < height; y++) slots.push({ kind: 'line', side: 'left', index: y });
  return slots;
}

/** Index of the first non-empty cell seen from a track slot, or -1. */
export function firstPixel(cells: Int16Array, width: number, height: number, slot: TrackSlot): number {
  if (slot.kind === 'corner') return -1;
  const i = slot.index;
  switch (slot.side) {
    case 'bottom':
      for (let y = height - 1; y >= 0; y--) if (cells[y * width + i] !== EMPTY) return y * width + i;
      return -1;
    case 'top':
      for (let y = 0; y < height; y++) if (cells[y * width + i] !== EMPTY) return y * width + i;
      return -1;
    case 'right':
      for (let x = width - 1; x >= 0; x--) if (cells[i * width + x] !== EMPTY) return i * width + x;
      return -1;
    case 'left':
      for (let x = 0; x < width; x++) if (cells[i * width + x] !== EMPTY) return i * width + x;
      return -1;
  }
}
