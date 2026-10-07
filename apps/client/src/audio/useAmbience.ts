import { useEffect } from 'react';
import type { Room } from '@colyseus/sdk';
import { dayPhase, type HomeState } from '@homebound/shared';
import { playAmbientCall, playWindGust } from './sounds';

const CHECK_MS = 500;
/** Seconds between calls: birds by day, crickets at night, wind gusts any time. */
const BIRDS: readonly [number, number] = [3, 8];
const CRICKETS: readonly [number, number] = [1, 3];
const WIND: readonly [number, number] = [9, 18];

const later = ([min, max]: readonly [number, number]) =>
  performance.now() + (min + Math.random() * (max - min)) * 1000;

/** Background life that follows the time of day. Silent while the tab is hidden. */
export function useAmbience(room: Room<HomeState> | null): void {
  useEffect(() => {
    if (!room) return;
    let nextCall = later(BIRDS);
    let nextWind = later(WIND);
    const timer = setInterval(() => {
      if (document.hidden) return;
      const now = performance.now();
      const phase = dayPhase(room.state.timeOfDay);
      const night = phase === 'night';
      if (now >= nextCall) {
        if (phase !== 'evening') playAmbientCall(night); // dusk is quiet
        nextCall = later(night ? CRICKETS : BIRDS);
      }
      if (now >= nextWind) {
        playWindGust();
        nextWind = later(WIND);
      }
    }, CHECK_MS);
    return () => clearInterval(timer);
  }, [room]);
}
