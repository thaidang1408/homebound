import { useEffect } from 'react';
import { ClientMessage, HOTBAR_SLOTS, findFurniture } from '@homebound/shared';
import { getSession } from '../../state/session';
import { getUi, showToast, updateUi, type Panel } from '../../state/ui';

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

function interact(): void {
  const room = getSession().room;
  const me = room?.state.players.get(room.sessionId);
  if (!room || !me) return;
  // In bed, [E] always means "get up".
  const focusId = me.sleeping ? 'bed' : getUi().focusId;
  const target = focusId ? findFurniture(focusId) : undefined;
  if (!target) return;

  switch (target.kind) {
    case 'chest':
      openPanel('storage');
      break;
    case 'workbench':
      showToast('Nothing to craft yet — bring materials back from the wild.');
      break;
    case 'stove':
    case 'bed':
      room.send(ClientMessage.Interact, { targetId: target.id });
      break;
    case 'decor':
      break;
  }
}

/** In-game keys: E interact, Tab inventory, 1–5 / wheel hotbar, Esc closes panels. */
export function useGameKeys(): void {
  useEffect(() => {
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
      if (e.code === 'KeyE') interact();
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
    window.addEventListener('wheel', onWheel);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
    };
  }, []);
}
