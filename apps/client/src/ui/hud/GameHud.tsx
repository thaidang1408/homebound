import { useEffect, useState } from 'react';
import {
  CREATURES,
  HEALTH_MAX,
  HOTBAR_SLOTS,
  HUNGER_MAX,
  NEW_DAY_DELAY_MS,
  clockLabel,
  dayPhase,
  isCreatureKind,
  levelForXp,
  type DayPhase,
} from '@homebound/shared';
import { promptFor } from '../../game/interaction/prompt';
import { heldWeaponId } from '../../game/player/held';
import { leaveRoom } from '../../networking/connection';
import { useSession } from '../../state/session';
import { useUi } from '../../state/ui';
import { Button } from '../components/Button';
import { ItemSlot } from '../components/ItemSlot';
import panel from '../components/Panel.module.css';
import { InventoryPanel, StoragePanel, WorkbenchPanel } from '../panels/InventoryPanels';
import { Compass } from './Compass';
import styles from './GameHud.module.css';
import { resumePlay, useGameKeys } from './useGameKeys';

const PHASE_ICON: Record<DayPhase, string> = {
  morning: '🌅',
  day: '☀️',
  evening: '🌇',
  night: '🌙',
};

/** Below these, the meters show a warning. */
const HUNGRY_AT = 25;
const WOUNDED_AT = 30;

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
  ['Click', 'Use held item (attack / shoot / eat)'],
  ['1–5', 'Hotbar'],
  ['Tab', 'Backpack'],
  ['Esc', 'Pause'],
];

export function GameHud() {
  const { room, connection } = useSession();
  const {
    focusId,
    preyId,
    hurtCount,
    hitCount,
    lastHitKilled,
    panel: openPanel,
    selectedSlot,
    toasts,
  } = useUi();
  const locked = usePointerLocked();
  useGameKeys();
  if (!room) return null;

  const me = room.state.players.get(room.sessionId);
  const partner = [...room.state.players.entries()].find(([id]) => id !== room.sessionId)?.[1];
  const partnerStatus = !partner
    ? `Home alone — share code ${room.roomId}`
    : !partner.connected
      ? `${partner.name} disconnected — waiting…`
      : partner.downed
        ? `${partner.name} is DOWN — go help!`
        : partner.sleeping
          ? `${partner.name} is in bed`
          : `${partner.name} is here`;
  const prompt = focusId && locked ? promptFor(focusId, room.state, room.sessionId) : null;
  const hunger = me?.hunger ?? HUNGER_MAX;
  const health = me?.health ?? HEALTH_MAX;
  const prey = preyId ? room.state.creatures.get(preyId) : undefined;
  const preyDef = prey && isCreatureKind(prey.kind) ? CREATURES[prey.kind] : undefined;
  const preyName = preyDef?.name;
  const preyHealth = prey && preyDef ? prey.health / preyDef.maxHealth : 1;
  const bothAsleep = !!me?.sleeping && !!partner?.sleeping;
  const progress = levelForXp(me?.xp ?? 0);
  const xpShare = progress.needed ? progress.intoLevel / progress.needed : 1;

  return (
    <div className={styles.hud}>
      <div className={styles.topLeft}>
        <div className={styles.meter} data-warn={health < WOUNDED_AT}>
          <span className={styles.meterLabel}>❤️ Health</span>
          <span className={styles.meterTrack}>
            <span
              className={styles.meterFill}
              data-kind="health"
              style={{ width: `${(health / HEALTH_MAX) * 100}%` }}
            />
          </span>
          <span className={styles.meterValue}>{health}</span>
        </div>
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
        <div className={styles.meter} title={`${progress.intoLevel} / ${progress.needed} XP`}>
          <span className={styles.meterLabel}>⭐ Level {progress.level}</span>
          <span className={styles.meterTrack}>
            <span className={styles.xpFill} style={{ width: `${xpShare * 100}%` }} />
          </span>
          <span className={styles.meterValue}>{progress.intoLevel}</span>
        </div>
        <span
          className={styles.pill}
          data-tone={partner?.downed ? 'danger' : partner?.connected ? 'ok' : 'warn'}
        >
          {partnerStatus}
        </span>
      </div>

      <div className={styles.topRight}>
        <span className={styles.day} data-phase={dayPhase(room.state.timeOfDay)}>
          {PHASE_ICON[dayPhase(room.state.timeOfDay)]} Day {room.state.day}
          <span className={styles.clock}>{clockLabel(room.state.timeOfDay)}</span>
        </span>
        <span className={styles.pill}>Room {room.roomId}</span>
      </div>

      <Compass room={room} />

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

      {/* Re-keyed on every hit so the flash animation restarts. */}
      {hurtCount > 0 && <div key={hurtCount} className={styles.hurt} aria-hidden />}

      {locked && !me?.sleeping && !me?.downed && (
        <div className={styles.crosshair} data-prey={preyName !== undefined} aria-hidden />
      )}
      {/* Re-keyed per confirmed hit so the hitmarker animation restarts. */}
      {hitCount > 0 && (
        <div
          key={`hit-${hitCount}`}
          className={styles.hitmarker}
          data-kill={lastHitKilled}
          aria-hidden
        />
      )}
      {locked && preyName && !prompt && (
        <div className={styles.prompt} data-actionable>
          <kbd className={styles.key}>Click</kbd>
          {heldWeaponId(room) === 'spear' ? 'Stab' : 'Punch'} {preyName.toLowerCase()}
          <span className={styles.preyTrack} aria-label="Creature health">
            <span className={styles.preyFill} style={{ width: `${preyHealth * 100}%` }} />
          </span>
        </div>
      )}
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

      {me?.downed && (
        <div className={styles.downed} role="alert">
          <p className={styles.sleepText}>You’re down!</p>
          <p className={styles.sleepHint}>
            {partner?.connected
              ? me.revive > 0
                ? `${partner.name} is reviving you…`
                : `Hang on — ${partner.name} can revive you`
              : 'Hang on…'}
          </p>
          <span className={styles.bleedTrack}>
            <span
              className={styles.bleedFill}
              style={{ width: `${(me.revive > 0 ? me.revive : me.bleedOut) * 100}%` }}
              data-reviving={me.revive > 0}
            />
          </span>
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
      {openPanel === 'workbench' && <WorkbenchPanel />}

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
