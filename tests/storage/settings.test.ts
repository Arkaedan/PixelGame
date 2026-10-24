import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../../src/storage/progress.ts';
import { DEFAULT_SETTINGS, SettingsStore } from '../../src/storage/settings.ts';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe('SettingsStore', () => {
  it('starts with defaults and persists changes', () => {
    const store = memoryStore();
    expect(new SettingsStore(store).get()).toEqual(DEFAULT_SETTINGS);
    new SettingsStore(store).update({ sound: false, speed: 4 });
    expect(new SettingsStore(store).get()).toEqual({ sound: false, haptics: true, speed: 4 });
  });

  it('falls back to defaults for missing, invalid or corrupt values', () => {
    const bad = memoryStore({ 'pixelgame.settings.v1': '{"sound":"yes","speed":3}' });
    expect(new SettingsStore(bad).get()).toEqual(DEFAULT_SETTINGS);
    const corrupt = memoryStore({ 'pixelgame.settings.v1': '{oops' });
    expect(new SettingsStore(corrupt).get()).toEqual(DEFAULT_SETTINGS);
    expect(new SettingsStore(undefined).update({ haptics: false }).haptics).toBe(false);
  });
});
