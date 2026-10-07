import { useEffect, useState } from 'react';
import { HOTBAR_SLOTS, HUNGER_MAX, NEW_DAY_DELAY_MS } from '@homebound/shared';
import { promptFor } from '../../game/interaction/prompt';
import { leaveRoom } from '../../networking/connection';
import { useSession } from '../../state/session';
import { useUi } from '../../state/ui';
import { Button } from '../components/Button';
import { ItemSlot } from '../components/ItemSlot';
import panel from '../components/Panel.module.css';
import { InventoryPanel, StoragePanel } from '../panels/InventoryPanels';
import styles from './GameHud.module.css';
import { resumePlay, useGameKeys } from './useGameKeys';

/** Below this, hunger shows a warning. */
const HUNGRY_AT = 25;

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
  ['E', 'Interact'],
  ['Click', 'Eat held food'],
  ['1–5', 'Hotbar'],
  ['Tab', 'Backpack'],
  ['Esc', 'Pause'],
];

export function GameHud() {
  const { room, connection } = useSession();
  const { focusId, panel: openPanel, selectedSlot, toasts } = useUi();
  const locked = usePointerLocked();
  useGameKeys();
  if (!room) return null;

  const me = room.state.players.get(room.sessionId);
  const partner = [...room.state.players.entries()].find(([id]) => id !== room.sessionId)?.[1];
  const partnerStatus = !partner
    ? 'Partner left the house'
    : !partner.connected
      ? `${partner.name} disconnected — waiting…`
      : partner.sleeping
        ? `${partner.name} is in bed`
        : `${partner.name} is here`;
  const prompt = focusId && locked ? promptFor(focusId, room.state, room.sessionId) : null;
  const hunger = me?.hunger ?? HUNGER_MAX;
  const bothAsleep = !!me?.sleeping && !!partner?.sleeping;

  return (
    <div className={styles.hud}>
      <div className={styles.topLeft}>
        <div className={styles.meter} data-warn={hunger < HUNGRY_AT}>
          <span className={styles.meterLabel}>🍖 Hunger</span>
          <span className={styles.meterTrack}>
            <span
              className={styles.meterFill}
              style={{ width: `${(hunger / HUNGER_MAX) * 100}%` }}
            />
          </span>
          <span className={styles.meterValue}>{hunger}</span>
        </div>
        <span className={styles.pill} data-tone={partner?.connected ? 'ok' : 'warn'}>
          {partnerStatus}
        </span>
      </div>

      <div className={styles.topRight}>
        <span className={styles.day}>☀️ Day {room.state.day}</span>
        <span className={styles.pill}>Room {room.roomId}</span>
      </div>

      {connection === 'reconnecting' && (
        <div className={styles.banner} role="alert">
          Connection lost. Trying to reconnect…
        </div>
      )}

      <div className={styles.toasts} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={styles.toast}>
            {t.text}
          </div>
        ))}
      </div>

      {locked && !me?.sleeping && <div className={styles.crosshair} aria-hidden />}
      {prompt && (
        <div className={styles.prompt} data-actionable={prompt.actionable}>
          {prompt.actionable && <kbd className={styles.key}>E</kbd>}
          {prompt.text}
        </div>
      )}

      {me && (
        <div className={styles.hotbar}>
          {[...me.inventory].slice(0, HOTBAR_SLOTS).map((s, i) => (
            <ItemSlot
              key={i}
              itemId={s.itemId}
              qty={s.qty}
              hint={String(i + 1)}
              selected={i === selectedSlot}
            />
          ))}
        </div>
      )}

      {me?.sleeping && (
        <div
          className={styles.sleep}
          data-deep={bothAsleep}
          style={{ transitionDuration: `${bothAsleep ? NEW_DAY_DELAY_MS : 400}ms` }}
        >
          <p className={styles.sleepText}>
            {bothAsleep
              ? 'Good night…'
              : `Sleeping… waiting for ${partner?.name ?? 'your partner'}`}
          </p>
          <p className={styles.sleepHint}>
            <kbd className={styles.key}>E</kbd> Get up
          </p>
        </div>
      )}

      {openPanel === 'inventory' && <InventoryPanel />}
      {openPanel === 'storage' && <StoragePanel />}

      {!locked && openPanel === 'none' && (
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
