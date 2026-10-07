import { ambience, sfx, sfxAt, type Bus } from './engine';

/**
 * Every game sound, synthesized from oscillators and noise (ADR-019). Each call randomizes pitch
 * a little so repeats don't sound mechanical. Positional sounds take the world position.
 */

const vary = (amount = 0.08) => 1 + (Math.random() * 2 - 1) * amount;

interface Tone {
  type?: OscillatorType;
  from: number;
  to?: number;
  /** Seconds. */
  length: number;
  gain: number;
  delay?: number;
  attack?: number;
  /** Optional lowpass cutoff (Hz). */
  lowpass?: number;
}

function tone(b: Bus | null, t: Tone): void {
  if (!b) return;
  const { ctx } = b;
  const start = ctx.currentTime + (t.delay ?? 0);
  const osc = ctx.createOscillator();
  osc.type = t.type ?? 'sine';
  osc.frequency.setValueAtTime(t.from, start);
  if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.length);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(t.gain, start + (t.attack ?? 0.005));
  env.gain.exponentialRampToValueAtTime(0.0001, start + t.length);
  let out: AudioNode = osc;
  if (t.lowpass) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = t.lowpass;
    out = osc.connect(filter);
  }
  out.connect(env).connect(b.out);
  osc.start(start);
  osc.stop(start + t.length + 0.02);
}

interface Noise {
  length: number;
  gain: number;
  /** Band centre (Hz) and width (Q). */
  freq: number;
  q?: number;
  /** Sweep the band to this frequency over the sound. */
  sweepTo?: number;
  delay?: number;
}

function burst(b: Bus | null, n: Noise): void {
  if (!b) return;
  const { ctx } = b;
  const start = ctx.currentTime + (n.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = b.noise;
  src.loop = true; // the buffer is 1 s; longer sounds (wind) loop it
  src.playbackRate.value = vary(0.15);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = n.q ?? 1.2;
  filter.frequency.setValueAtTime(n.freq, start);
  if (n.sweepTo) filter.frequency.exponentialRampToValueAtTime(n.sweepTo, start + n.length);
  const env = ctx.createGain();
  env.gain.setValueAtTime(n.gain, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + n.length);
  src.connect(filter).connect(env).connect(b.out);
  src.start(start, Math.random() * 0.5);
  src.stop(start + n.length + 0.02);
}

// --- Player actions ---

export function playSwing(): void {
  burst(sfx(), { length: 0.16, gain: 0.5, freq: 900 * vary(), sweepTo: 2600, q: 0.8 });
}

export function playBowAt(x: number, z: number): void {
  const b = sfxAt(x, z);
  tone(b, { type: 'triangle', from: 210 * vary(), to: 150, length: 0.22, gain: 0.5 });
  burst(b, { length: 0.08, gain: 0.35, freq: 3000, q: 2 });
}

/** Your hit landed; a kill is deeper and longer. */
export function playHit(killed: boolean): void {
  const b = sfx();
  tone(b, { from: (killed ? 140 : 190) * vary(), to: 55, length: killed ? 0.35 : 0.14, gain: 0.8 });
  burst(b, { length: 0.07, gain: 0.5, freq: 1800 * vary() });
  if (killed)
    tone(b, { type: 'triangle', from: 660, to: 990, length: 0.25, gain: 0.25, delay: 0.12 });
}

export function playHurt(): void {
  const b = sfx();
  tone(b, { from: 120 * vary(), to: 50, length: 0.25, gain: 0.9 });
  burst(b, { length: 0.18, gain: 0.45, freq: 500, sweepTo: 200 });
}

export function playFootstep(onWood: boolean): void {
  burst(sfx(), {
    length: onWood ? 0.07 : 0.1,
    gain: onWood ? 0.18 : 0.12,
    freq: (onWood ? 700 : 350) * vary(0.2),
    q: onWood ? 3 : 0.9,
  });
}

// --- World ---

export function playHarvestAt(kind: 'tree' | 'rock' | 'bush', x: number, z: number): void {
  const b = sfxAt(x, z);
  if (kind === 'tree') {
    tone(b, { from: 160 * vary(), to: 90, length: 0.12, gain: 0.7 });
    burst(b, { length: 0.12, gain: 0.5, freq: 1100 * vary(), q: 2 });
  } else if (kind === 'rock') {
    tone(b, {
      type: 'square',
      from: 900 * vary(),
      to: 500,
      length: 0.06,
      gain: 0.25,
      lowpass: 2500,
    });
    burst(b, { length: 0.1, gain: 0.5, freq: 2600 * vary(), q: 3 });
  } else {
    burst(b, { length: 0.18, gain: 0.35, freq: 1500 * vary(), sweepTo: 800, q: 0.7 });
  }
}

export function playGruntAt(kind: string, x: number, z: number): void {
  const b = sfxAt(x, z);
  if (kind === 'wolf') {
    tone(b, { type: 'sawtooth', from: 95 * vary(), to: 75, length: 0.5, gain: 0.35, lowpass: 500 });
  } else {
    tone(b, {
      type: 'sawtooth',
      from: 120 * vary(),
      to: 85,
      length: 0.28,
      gain: 0.45,
      lowpass: 420,
    });
    tone(b, {
      type: 'sawtooth',
      from: 110 * vary(),
      to: 80,
      length: 0.2,
      gain: 0.35,
      lowpass: 420,
      delay: 0.16,
    });
  }
}

export function playThudAt(x: number, z: number): void {
  const b = sfxAt(x, z);
  tone(b, { from: 90, to: 40, length: 0.4, gain: 0.8 });
  burst(b, { length: 0.25, gain: 0.3, freq: 300 });
}

/** Distant howl at nightfall (two wolves answering each other). */
export function playHowl(): void {
  const b = sfx();
  tone(b, { from: 380, to: 560, length: 1.4, gain: 0.18, attack: 0.4, lowpass: 1400 });
  tone(b, { from: 340, to: 500, length: 1.2, gain: 0.12, attack: 0.4, lowpass: 1200, delay: 1.1 });
}

// --- Feedback ---

export function playPickup(): void {
  const b = sfx();
  tone(b, { from: 660 * vary(0.03), length: 0.08, gain: 0.25 });
  tone(b, { from: 990 * vary(0.03), length: 0.12, gain: 0.22, delay: 0.06 });
}

export function playEat(): void {
  const b = sfx();
  for (let i = 0; i < 3; i++)
    burst(b, { length: 0.06, gain: 0.4, freq: 1300 * vary(0.3), q: 2, delay: i * 0.11 });
}

export function playBell(): void {
  const b = sfx();
  tone(b, { from: 880, length: 0.9, gain: 0.3 });
  tone(b, { from: 1320, length: 0.7, gain: 0.15 });
}

/** Goal done / level up: a short rising arpeggio. */
export function playFanfare(): void {
  const b = sfx();
  [523, 659, 784, 1047].forEach((f, i) =>
    tone(b, { type: 'triangle', from: f, length: 0.3, gain: 0.22, delay: i * 0.09 }),
  );
}

export function playDowned(): void {
  tone(sfx(), { type: 'triangle', from: 440, to: 110, length: 1.1, gain: 0.3 });
}

export function playRevived(): void {
  tone(sfx(), { type: 'triangle', from: 220, to: 660, length: 0.6, gain: 0.3 });
}

export function playUiClick(): void {
  tone(sfx(), { type: 'triangle', from: 1200, length: 0.04, gain: 0.12 });
}

// --- Ambience ---

/** One ambient event: a bird by day, a cricket chirp at night. Called on a loose timer. */
export function playAmbientCall(night: boolean): void {
  const b = ambience();
  if (night) {
    const f = 4200 * vary(0.05);
    for (let i = 0; i < 3; i++) tone(b, { from: f, length: 0.03, gain: 0.5, delay: i * 0.06 });
  } else {
    const f = 2200 * vary(0.2);
    tone(b, { from: f, to: f * 1.4, length: 0.12, gain: 0.5 });
    tone(b, { from: f * 1.2, to: f * 0.9, length: 0.1, gain: 0.4, delay: 0.15 });
  }
}

/** Soft wind: filtered noise that rises and falls. */
export function playWindGust(): void {
  burst(ambience(), { length: 3.5, gain: 0.6, freq: 400 * vary(0.3), sweepTo: 250, q: 0.5 });
}
