import { useEffect } from 'react';
import {
  ClientMessage,
  HARVEST_COOLDOWN_MS,
  HOTBAR_SLOTS,
  findInteractable,
} from '@homebound/shared';
import { getSession } from '../../state/session';
import { getUi, updateUi, type Panel } from '../../state/ui';

/** The canvas owns the mouse; panels release it. */
export function resumePlay(): void {
  void document.querySelector('canvas')?.requestPointerLock();
}

function openPanel(panel: Panel): void {
  updateUi({ panel });
  document.exitPointerLock();
}

export function closePanel(): void {
  updateUi({ panel: 'none' });
  resumePlay();
}

/** Holding [E] repeats at the harvest rhythm; also keeps a revive going (server timeout 900 ms). */
const HOLD_REPEAT_MS = HARVEST_COOLDOWN_MS + 40;

/** Returns true if holding [E] should repeat (harvesting a node, reviving a partner). */
function interact(): boolean {
  const room = getSession().room;
  const me = room?.state.players.get(room.sessionId);
  if (!room || !me) return false;
  // In bed, [E] always means "get up".
  const focusId = me.sleeping ? 'bed' : getUi().focusId;
  if (focusId && room.state.creatures.has(focusId)) {
    room.send(ClientMessage.Interact, { targetId: focusId }); // butcher a carcass
    return false;
  }
  if (focusId && room.state.players.has(focusId)) {
    room.send(ClientMessage.Interact, { targetId: focusId }); // reviving: keep holding E
    return true;
  }
  const target = focusId ? findInteractable(focusId) : undefined;
  if (!target) return false;

  switch (target.kind) {
    case 'chest':
      openPanel('storage');
      break;
    case 'workbench':
      openPanel('workbench');
      break;
    case 'stove':
    case 'bed':
      room.send(ClientMessage.Interact, { targetId: target.id });
      break;
    case 'tree':
    case 'rock':
    case 'bush':
      room.send(ClientMessage.Interact, { targetId: target.id });
      return true;
  }
  return false;
}

/** In-game keys: E interact (hold to keep harvesting), Tab inventory, 1–5 / wheel hotbar, Esc closes panels. */
export function useGameKeys(): void {
  useEffect(() => {
    let hold: ReturnType<typeof setInterval> | undefined;
    const stopHold = () => {
      clearInterval(hold);
      hold = undefined;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') stopHold();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const locked = document.pointerLockElement !== null;
      const { panel } = getUi();

      if (e.code === 'Tab') {
        e.preventDefault(); // never move browser focus while playing
        if (panel === 'none') openPanel('inventory');
        else closePanel();
        return;
      }
      if (panel !== 'none' && (e.code === 'Escape' || e.code === 'KeyE')) {
        closePanel();
        return;
      }
      if (!locked) return;
      if (e.code === 'KeyE' && interact() && !hold) {
        hold = setInterval(() => {
          if (document.pointerLockElement === null || !interact()) stopHold();
        }, HOLD_REPEAT_MS);
      }
      const digit = Number(e.code.replace('Digit', ''));
      if (e.code.startsWith('Digit') && digit >= 1 && digit <= HOTBAR_SLOTS) {
        updateUi({ selectedSlot: digit - 1 });
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement === null) return;
      const step = Math.sign(e.deltaY);
      const next = (getUi().selectedSlot + step + HOTBAR_SLOTS) % HOTBAR_SLOTS;
      updateUi({ selectedSlot: next });
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', stopHold);
    window.addEventListener('wheel', onWheel);
    return () => {
      stopHold();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', stopHold);
      window.removeEventListener('wheel', onWheel);
    };
  }, []);
}
