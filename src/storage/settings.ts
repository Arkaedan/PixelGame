import type { KeyValueStore } from './progress.ts';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** Speed a level starts at: 1×, 2× or 4×. */
  speed: 1 | 2 | 4;
}

const KEY = 'pixelgame.settings.v1';
export const DEFAULT_SETTINGS: Settings = { sound: true, haptics: true, speed: 1 };

/** Player preferences, saved per device. Unknown or broken saved values fall back to defaults. */
export class SettingsStore {
  private readonly store: KeyValueStore | undefined;
  private current: Settings;

  constructor(store: KeyValueStore | undefined) {
    this.store = store;
    this.current = load(store);
  }

  static browser(): SettingsStore {
    let store: KeyValueStore | undefined;
    try {
      store = window.localStorage;
    } catch {
      store = undefined;
    }
    return new SettingsStore(store);
  }

  get(): Settings {
    return { ...this.current };
  }

  update(changes: Partial<Settings>): Settings {
    this.current = { ...this.current, ...changes };
    try {
      this.store?.setItem(KEY, JSON.stringify(this.current));
    } catch {
      // Storage blocked: the change lasts for this session.
    }
    return this.get();
  }

  /** Back to the defaults, here and in storage. */
  clear(): Settings {
    this.current = { ...DEFAULT_SETTINGS };
    try {
      this.store?.removeItem(KEY);
    } catch {
      // Storage blocked: nothing was saved there anyway.
    }
    return this.get();
  }
}

function load(store: KeyValueStore | undefined): Settings {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    const v: Record<string, unknown> = { ...parsed };
    return {
      sound: typeof v['sound'] === 'boolean' ? v['sound'] : DEFAULT_SETTINGS.sound,
      haptics: typeof v['haptics'] === 'boolean' ? v['haptics'] : DEFAULT_SETTINGS.haptics,
      speed: v['speed'] === 2 || v['speed'] === 4 ? v['speed'] : 1,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
