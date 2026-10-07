import { getSettings } from '../state/settings';
import { localPose } from '../game/player/localPose';

/**
 * Tiny WebAudio mixer (ADR-019): master → { sfx, ambience } buses. Every sound is synthesized
 * (no asset files). The context starts on the first user gesture (browsers require it).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let ambienceBus: GainNode | null = null;
let noise: AudioBuffer | null = null;

/** Bus levels in dB (relative to master). */
const SFX_DB = -4;
const AMBIENCE_DB = -16;
/** Positional sounds fade with distance and are silent past this (m). */
const HEARING_RANGE = 40;
const ROLLOFF = 0.12;

const dbToGain = (db: number) => 10 ** (db / 20);

export interface Bus {
  ctx: AudioContext;
  out: GainNode;
  noise: AudioBuffer;
}

/** Call from a user gesture (click to play). Safe to call repeatedly. */
export function unlockAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return; // no audio on this device: the game stays silent
    }
    master = ctx.createGain();
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = dbToGain(SFX_DB);
    sfxBus.connect(master);
    ambienceBus = ctx.createGain();
    ambienceBus.gain.value = dbToGain(AMBIENCE_DB);
    ambienceBus.connect(master);
    // One second of white noise, reused by every noisy sound.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    applyVolume();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

/** Re-reads volume/mute from settings. */
export function applyVolume(): void {
  if (!ctx || !master) return;
  const { volume, muted } = getSettings();
  master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05);
}

function bus(node: GainNode | null): Bus | null {
  return ctx && node && noise && ctx.state === 'running' ? { ctx, out: node, noise } : null;
}

export const sfx = () => bus(sfxBus);
export const ambience = () => bus(ambienceBus);

/**
 * A bus routed through distance attenuation and stereo pan from the listener (the local
 * player), or null when it's too far to hear.
 */
export function sfxAt(x: number, z: number): Bus | null {
  const b = sfx();
  if (!b) return null;
  const dx = x - localPose.x;
  const dz = z - localPose.z;
  const distance = Math.hypot(dx, dz);
  if (distance > HEARING_RANGE) return null;
  const gain = b.ctx.createGain();
  gain.gain.value = 1 / (1 + distance * ROLLOFF);
  const pan = b.ctx.createStereoPanner();
  // Right vector of the listener: yaw 0 looks toward −Z, so right is +X.
  const rightX = Math.cos(localPose.yaw);
  const rightZ = -Math.sin(localPose.yaw);
  pan.pan.value = distance > 0.5 ? ((dx * rightX + dz * rightZ) / distance) * 0.8 : 0;
  gain.connect(pan).connect(b.out);
  // Detach the routing once every sound on it has ended.
  setTimeout(() => pan.disconnect(), 4000);
  return { ...b, out: gain };
}
