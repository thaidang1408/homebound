import { useEffect, useState } from 'react';
import { leaveRoom } from '../../networking/connection';
import { useSession } from '../../state/session';
import { Button } from '../components/Button';
import panel from '../components/Panel.module.css';
import styles from './GameHud.module.css';

/** Tracks whether the mouse is captured by the game canvas (low-frequency React state). */
function usePointerLocked(): boolean {
  const [locked, setLocked] = useState(() => document.pointerLockElement !== null);
  useEffect(() => {
    const update = () => setLocked(document.pointerLockElement !== null);
    document.addEventListener('pointerlockchange', update);
    return () => document.removeEventListener('pointerlockchange', update);
  }, []);
  return locked;
}

const CONTROLS: readonly [string, string][] = [
  ['WASD', 'Move'],
  ['Mouse', 'Look'],
  ['Shift', 'Sprint'],
  ['Esc', 'Menu'],
];

/** The paused overlay covers the canvas, so clicking it must capture the mouse itself. */
function resumePlay() {
  void document.querySelector('canvas')?.requestPointerLock();
}

export function GameHud() {
  const { room, connection } = useSession();
  const locked = usePointerLocked();
  if (!room) return null;

  const partner = [...room.state.players.entries()].find(([id]) => id !== room.sessionId)?.[1];
  const partnerStatus = !partner
    ? 'Partner left the house'
    : partner.connected
      ? `${partner.name} is here`
      : `${partner.name} disconnected — waiting…`;

  return (
    <div className={styles.hud}>
      <div className={styles.topLeft}>
        <span className={styles.pill}>Room {room.roomId}</span>
        <span className={styles.pill} data-tone={partner?.connected ? 'ok' : 'warn'}>
          {partnerStatus}
        </span>
      </div>

      {connection === 'reconnecting' && (
        <div className={styles.banner} role="alert">
          Connection lost. Trying to reconnect…
        </div>
      )}

      {locked && <div className={styles.crosshair} aria-hidden />}

      {!locked && (
        <div className={`${panel.overlay} ${styles.interactive}`} onClick={resumePlay}>
          <div className={panel.panel}>
            <h2 className={panel.title}>Paused</h2>
            <p className={panel.subtitle}>Click the world to play.</p>
            <ul className={styles.controls}>
              {CONTROLS.map(([key, action]) => (
                <li key={key}>
                  <kbd className={styles.key}>{key}</kbd> {action}
                </li>
              ))}
            </ul>
            <Button
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                void leaveRoom();
              }}
            >
              Leave room
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
