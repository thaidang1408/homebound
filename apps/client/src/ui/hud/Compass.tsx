import { useEffect, useRef } from 'react';
import type { Room } from '@colyseus/sdk';
import type { HomeState } from '@homebound/shared';
import { localPose } from '../../game/player/localPose';
import { playerColor } from '../../game/player/playerColors';
import styles from './Compass.module.css';

/** The strip shows ±90° around where you look. */
const HALF_FOV = Math.PI / 2;
const HOME = { x: 0, z: 0 };

const CARDINALS: readonly [string, number][] = [
  ['N', 0],
  ['E', -Math.PI / 2],
  ['S', Math.PI],
  ['W', Math.PI / 2],
];

/** Bearing in "yaw" terms (yaw 0 looks toward −Z = north). */
function bearing(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

/** Signed angle in [−π, π]; positive = to the right of where you look. */
function relative(yaw: number, target: number): number {
  const d = (yaw - target) % (Math.PI * 2);
  return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
}

/**
 * Compass bar: cardinal points, the house and your partner. Updated every animation frame by
 * writing styles directly (no React re-render). Home and partner stick to the edge when behind you.
 */
export function Compass({ room }: { room: Room<HomeState> }) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const marks = new Map<string, HTMLElement>();
    bar.current?.querySelectorAll<HTMLElement>('[data-mark]').forEach((el) => {
      if (el.dataset.mark) marks.set(el.dataset.mark, el);
    });
    let frame = 0;
    const place = (key: string, angle: number, pin: boolean) => {
      const el = marks.get(key);
      const width = bar.current?.clientWidth ?? 0;
      if (!el) return;
      const rel = relative(localPose.yaw, angle);
      const outside = Math.abs(rel) > HALF_FOV;
      el.hidden = outside && !pin;
      const clamped = Math.max(-HALF_FOV, Math.min(HALF_FOV, rel));
      el.style.transform = `translateX(${(clamped / HALF_FOV) * (width / 2)}px)`;
      el.dataset.edge = String(outside);
    };
    const update = () => {
      for (const [label, angle] of CARDINALS) place(label, angle, false);
      place('home', bearing(localPose.x, localPose.z, HOME.x, HOME.z), true);
      const partner = [...room.state.players.entries()].find(([id]) => id !== room.sessionId)?.[1];
      const partnerMark = marks.get('partner');
      if (partnerMark) partnerMark.hidden = !partner;
      if (partner && partnerMark) {
        partnerMark.style.color = playerColor(partner.slot); // same color as their body
        place('partner', bearing(localPose.x, localPose.z, partner.x, partner.z), true);
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [room]);

  return (
    <div className={styles.compass} ref={bar} aria-hidden>
      {CARDINALS.map(([label]) => (
        <span key={label} data-mark={label} className={styles.cardinal}>
          {label}
        </span>
      ))}
      <span data-mark="home" className={styles.marker} title="Home">
        🏠
      </span>
      <span data-mark="partner" className={styles.marker} title="Partner">
        ●
      </span>
    </div>
  );
}
