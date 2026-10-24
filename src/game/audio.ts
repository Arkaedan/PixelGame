/**
 * Small synthesised sound effects (Web Audio, no files). The audio context starts on the first
 * tap, as browsers require; until then, and whenever sound is off, every call does nothing.
 */
export type Sound = 'deploy' | 'shot' | 'empty' | 'buffered' | 'reject' | 'powerUp' | 'win' | 'lose';

/** A pentatonic scale, so rapid shots of different colours never clash. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
/** At most one shot sound per this many ms; at 4× there can be dozens per second. */
const SHOT_GAP_MS = 35;

export class Sfx {
  enabled: boolean;
  private ctx: AudioContext | undefined;
  private master: GainNode | undefined;
  private lastShot = 0;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /** Call from a user gesture (e.g. pointerdown) so the browser allows audio. */
  unlock(): void {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.22;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = undefined;
    }
  }

  play(sound: Sound, colour = 0): void {
    const { ctx } = this;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    switch (sound) {
      case 'shot': {
        const now = performance.now();
        if (now - this.lastShot < SHOT_GAP_MS) return;
        this.lastShot = now;
        this.tone(SCALE[colour % SCALE.length]!, t, 0.05, 'triangle', 0.5);
        break;
      }
      case 'deploy':
        this.sweep(300, 600, t, 0.08, 'square', 0.25);
        break;
      case 'empty':
        this.sweep(700, 250, t, 0.12, 'sine', 0.5);
        break;
      case 'buffered':
        this.sweep(220, 140, t, 0.14, 'triangle', 0.6);
        break;
      case 'reject':
        this.tone(110, t, 0.12, 'sawtooth', 0.25);
        break;
      case 'powerUp':
        [784, 988, 1319].forEach((f, i) => this.tone(f, t + i * 0.06, 0.08, 'triangle', 0.4));
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.11, 0.22, 'triangle', 0.55));
        break;
      case 'lose':
        [392, 330, 262].forEach((f, i) => this.tone(f, t + i * 0.16, 0.25, 'sine', 0.55));
        break;
    }
  }

  private tone(freq: number, at: number, duration: number, type: OscillatorType, volume: number): void {
    this.sweep(freq, freq, at, duration, type, volume);
  }

  private sweep(from: number, to: number, at: number, duration: number, type: OscillatorType, volume: number): void {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }
}
