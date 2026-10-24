import type { Settings, SettingsStore } from '../storage/settings.ts';
import type { Sfx } from './audio.ts';

/** Sound and vibration switches, shared by the settings sheet and the pause menu. */
export function soundAndVibrationRows(s: Settings): string {
  const row = (key: 'sound' | 'haptics', label: string): string => `
    <label class="row">
      <span>${label}</span>
      <input type="checkbox" data-key="${key}" ${s[key] ? 'checked' : ''} />
    </label>`;
  return row('sound', 'Sound') + row('haptics', 'Vibration');
}

/** Save switch changes made inside `root`, and apply sound changes straight away. */
export function bindSoundAndVibration(root: HTMLElement, store: SettingsStore, sfx: Sfx): void {
  root.addEventListener('change', (e) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    const key = e.target.dataset['key'];
    if (key !== 'sound' && key !== 'haptics') return;
    const updated = store.update({ [key]: e.target.checked });
    sfx.enabled = updated.sound;
    if (key === 'sound' && updated.sound) {
      sfx.unlock();
      sfx.play('deploy');
    }
  });
}
