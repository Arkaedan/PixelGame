import { describe, expect, it } from 'vitest';
import { isBetter, ProgressStore, type ClearRecord, type KeyValueStore } from '../../src/storage/progress.ts';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const record = (extraSlot: number, pickAny: number, ticks: number): ClearRecord => ({
  powerUps: { extraSlot, pickAny, reveal: 0 },
  ticks,
  at: '2026-10-24T00:00:00.000Z',
});

describe('isBetter', () => {
  it('prefers fewer power-ups, then the faster clear', () => {
    expect(isBetter(record(0, 0, 900), record(1, 0, 100))).toBe(true);
    expect(isBetter(record(1, 1, 100), record(0, 1, 900))).toBe(false);
    expect(isBetter(record(1, 0, 100), record(0, 1, 200))).toBe(true);
    expect(isBetter(record(1, 0, 200), record(1, 0, 200))).toBe(false);
  });
});

describe('ProgressStore', () => {
  it('keeps the best clear and counts every clear', () => {
    const progress = new ProgressStore(memoryStore());
    expect(progress.recordClear('001', record(2, 0, 500))).toEqual({ isNewBest: true, previous: undefined });
    expect(progress.recordClear('001', record(3, 0, 100)).isNewBest).toBe(false);
    const third = progress.recordClear('001', record(0, 0, 900));
    expect(third.isNewBest).toBe(true);
    expect(third.previous).toEqual(record(2, 0, 500));
    expect(progress.get('001')).toEqual({ best: record(0, 0, 900), clears: 3 });
  });

  it('persists to and reloads from storage', () => {
    const store = memoryStore();
    new ProgressStore(store).recordClear('002', record(1, 0, 300));
    expect(new ProgressStore(store).get('002')?.best).toEqual(record(1, 0, 300));
  });

  it('unlocks levels in order', () => {
    const ids = ['001', '002', '003'];
    const progress = new ProgressStore(memoryStore());
    expect([0, 1, 2].map((i) => progress.isUnlocked(ids, i))).toEqual([true, false, false]);
    progress.recordClear('001', record(4, 4, 999));
    expect([0, 1, 2].map((i) => progress.isUnlocked(ids, i))).toEqual([true, true, false]);
  });

  it('ignores corrupt or unexpected saved data', () => {
    for (const raw of ['not json', '{"version":2,"levels":{}}', '{"version":1,"levels":{"001":{"clears":"x"}}}']) {
      const progress = new ProgressStore(memoryStore({ 'pixelgame.progress.v1': raw }));
      expect(progress.get('001')).toBeUndefined();
    }
  });

  it('works without storage, and survives storage that throws', () => {
    const memoryOnly = new ProgressStore(undefined);
    memoryOnly.recordClear('001', record(0, 0, 10));
    expect(memoryOnly.get('001')?.clears).toBe(1);

    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const progress = new ProgressStore(broken);
    expect(() => progress.recordClear('001', record(0, 0, 10))).not.toThrow();
    expect(progress.get('001')?.clears).toBe(1);
  });
});
