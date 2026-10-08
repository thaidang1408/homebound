import { useEffect } from 'react';
import {
  ClientMessage,
  HARVEST_COOLDOWN_MS,
  HOTBAR_SLOTS,
  findInteractable,
} from '@homebound/shared';
import { isTyping } from '../../game/player/keyboard';
import { localAction } from '../../game/player/localPose';
import { pingTarget } from '../../game/player/pingTarget';
import { getSession } from '../../state/session';
import { applyVolume } from '../../audio/engine';
import { getSettings, updateSettings } from '../../state/settings';
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

const HARVEST_ACTION = {
  tree: 'chop',
  rock: 'mine',
  bush: 'pick',
  mushroom: 'pick',
  nest: 'pick',
} as const;

/** [F]: mark where the crosshair meets the ground for the partner. */
function ping(): void {
  const room = getSession().room;
  const spot = pingTarget();
  if (!room) return;
  if (!spot) {
    showToast('Nhìn xuống đất để đánh dấu.');
    return;
  }
  room.send(ClientMessage.Ping, spot);
  localAction('point');
}

/** Holding [E] repeats at the harvest rhythm; also keeps a revive going (well inside REVIVE_PING_TIMEOUT_MS). */
const HOLD_REPEAT_MS = HARVEST_COOLDOWN_MS + 40;

/** Returns true if holding [E] should repeat (harvesting a node, reviving a partner). */
function interact(): boolean {
  const room = getSession().room;
  const me = room?.state.players.get(room.sessionId);
  if (!room || !me) return false;
  // In bed, [E] always means "get up".
  const focusId = me.sleeping ? 'bed' : getUi().focusId;
  if (focusId && room.state.creatures.has(focusId)) {
    room.send(ClientMessage.Interact, { targetId: focusId }); // butcher a carcass / feed a wild pet
    return false;
  }
  const pet = focusId ? room.state.pets.get(focusId) : undefined;
  if (focusId && pet) {
    if (pet.hatch < 1) return false; // still an egg
    if (pet.ownerSession === room.sessionId) {
      updateUi({ petId: focusId });
      openPanel('pet');
    } else room.send(ClientMessage.PetCommand, { petId: focusId, command: 'pat' });
    return false;
  }
  if (focusId && (room.state.traps.has(focusId) || room.state.drops.has(focusId))) {
    room.send(ClientMessage.Interact, { targetId: focusId }); // pick the trap / bag back up
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
    case 'waystone':
      updateUi({ waystoneId: target.id });
      openPanel('travel');
      break;
    case 'tower':
      showToast('Trên này nhìn được thật xa — bản đồ đã hiện thêm. Nhấn [M] để xem.');
      room.send(ClientMessage.Interact, { targetId: target.id });
      break;
    case 'dom':
      updateUi({ domFrom: { chapter: room.state.quest.chapter, step: room.state.quest.step } });
      room.send(ClientMessage.Interact, { targetId: target.id });
      openPanel('dom');
      break;
    case 'stove':
    case 'bed':
    case 'cache':
    case 'shrine':
    case 'lantern':
      room.send(ClientMessage.Interact, { targetId: target.id });
      break;
    case 'tree':
    case 'rock':
    case 'bush':
    case 'mushroom':
    case 'nest':
      room.send(ClientMessage.Interact, { targetId: target.id });
      localAction(HARVEST_ACTION[target.kind]);
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
      if (e.repeat || isTyping(e)) return;
      const locked = document.pointerLockElement !== null;
      const { panel } = getUi();

      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (panel === 'none') {
          e.preventDefault();
          openPanel('chat');
        }
        return;
      }
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
      if (e.code === 'KeyN') {
        const muted = !getSettings().muted;
        updateSettings({ muted });
        applyVolume();
        showToast(muted ? '🔇 Đã tắt tiếng (N)' : '🔊 Đã bật tiếng (N)');
        return;
      }
      if (e.code === 'KeyH') {
        updateSettings({ hints: !getSettings().hints });
        return;
      }
      if (e.code === 'KeyJ') {
        if (panel === 'none') openPanel('journal');
        else if (panel === 'journal') closePanel();
        return;
      }
      if (e.code === 'KeyM') {
        if (panel === 'none') openPanel('map');
        else if (panel === 'map') closePanel();
        return;
      }
      if (!locked) return;
      if (e.code === 'Space') e.preventDefault(); // jump (LocalPlayer), never "click" a button
      if (e.code === 'KeyF') ping();
      // [R] at the stove: the combination dishes.
      if (e.code === 'KeyR' && findInteractable(getUi().focusId ?? '')?.kind === 'stove') {
        openPanel('stove');
      }
      if (e.code === 'KeyG') {
        getSession().room?.send(ClientMessage.Emote, { kind: 'wave' });
        localAction('wave');
      }
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
