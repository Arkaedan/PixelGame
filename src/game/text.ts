import { POWER_UPS, type PowerUpKind } from '../core/index.ts';

export const POWER_UP_NAMES: Record<PowerUpKind, string> = {
  extraSlot: 'Extra Slot',
  pickAny: 'Pick Any',
  reveal: 'Reveal',
};

/** "1:05" */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** "Perfect, no power-ups" or "2 power-ups: 1× Extra Slot, 1× Pick Any" */
export function describePowerUps(powerUps: Record<PowerUpKind, number>): string {
  const used = POWER_UPS.filter((k) => powerUps[k] > 0);
  const total = used.reduce((n, k) => n + powerUps[k], 0);
  if (!total) return 'Perfect, no power-ups';
  return `${plural(total, 'power-up')}: ${used.map((k) => `${powerUps[k]}× ${POWER_UP_NAMES[k]}`).join(', ')}`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
