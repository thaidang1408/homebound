import { useEffect, useRef } from 'react';
import type { Room } from '@colyseus/sdk';
import { STAMINA_MAX, type HomeState } from '@homebound/shared';
import styles from './GameHud.module.css';

/**
 * Stamina changes every tick while sprinting or resting, so this meter writes its width straight
 * to the DOM each animation frame instead of re-rendering the HUD (like the compass).
 */
export function StaminaMeter({ room }: { room: Room<HomeState> }) {
  const meter = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const value = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const me = room.state.players.get(room.sessionId);
      if (me && meter.current && fill.current && value.current) {
        fill.current.style.width = `${(me.stamina / STAMINA_MAX) * 100}%`;
        value.current.textContent = String(me.stamina);
        meter.current.dataset.warn = String(me.winded);
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [room]);

  return (
    <div className={styles.meter} ref={meter} title="Sprint (Shift) and dodge (Q) use stamina">
      <span className={styles.meterLabel}>💨 Stamina</span>
      <span className={styles.meterTrack}>
        <span className={styles.meterFill} data-kind="stamina" ref={fill} />
      </span>
      <span className={styles.meterValue} ref={value} />
    </div>
  );
}
