import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Room } from '@colyseus/sdk';
import {
  ClientMessage,
  INTERACT_RANGE,
  WORLD_COLLIDERS,
  MAX_PITCH,
  MOVE_SEND_INTERVAL_MS,
  PLAYER_EYE_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
  ServerMessage,
  clampToWorld,
  getWeapon,
  getItem,
  isItemId,
  resolveCircle,
  terrainHeight,
  type HomeState,
  type MovePayload,
  type TeleportPayload,
} from '@homebound/shared';
import { MAX_FRAME_DT, MOUSE_SENSITIVITY, MOVE_EPSILON } from '../../config/controls';
import { getSettings } from '../../state/settings';
import { getUi, showToast, updateUi } from '../../state/ui';
import { findCreature, findDownedPartner, findFocus, isAvailable } from '../interaction/focus';
import { heldItem, heldWeaponId } from './held';
import { playFootstep, playSwing } from '../../audio/sounds';
import { autopilot, yawToward } from './autopilot';
import { useHeldKeys } from './keyboard';
import { localPose } from './localPose';

/** Dev-only: turn toward the next autopilot waypoint; returns 1 to walk forward, 0 when done. */
function steerAutopilot(p: MovePayload, stepLength: number): number {
  const next = autopilot.path[0];
  if (!next) {
    if (autopilot.lookAt) {
      p.yaw = yawToward(p, autopilot.lookAt);
      autopilot.lookAt = null;
    }
    return 0;
  }
  // Close enough to land on it this frame: arrive exactly instead of overshooting.
  if (Math.hypot(next.x - p.x, next.z - p.z) <= stepLength) {
    p.x = next.x;
    p.z = next.z;
    autopilot.path.shift();
    return 0;
  }
  p.yaw = yawToward(p, next);
  return 1;
}

/** Lying in bed: eyes on the pillow, looking at the ceiling. */
const SLEEP_EYE_HEIGHT = 0.9;
const SLEEP_HEAD_OFFSET = 0.55; // toward the headboard (−Z)
const SLEEP_PITCH = 1.25;

/** A strike nods the view down a touch: you feel the swing even when it misses. */
const SWING_MS = 160;
const SWING_PITCH = 0.05;
/** One footstep sound per this much ground covered (m). */
const STEP_LENGTH = 1.7;
/** Head bob: one up-down per step, this high (m). */
const BOB_HEIGHT = 0.035;
/** Inside these bounds you walk on floorboards (house footprint, see world/house.ts). */
const HOUSE_HALF = { x: 6, z: 5 };

/** Taking a hit shakes the view briefly. */
const SHAKE_MS = 220;
const SHAKE_ANGLE = 0.035;
/** Downed: eyes just above the grass, head tilted. */
const DOWNED_EYE_HEIGHT = 0.45;
const DOWNED_ROLL = 0.35;

/**
 * First-person controller. Movement is predicted locally (instant response) and sent to the
 * server, which validates it and may answer with a Teleport correction (ADR-007).
 */
export function LocalPlayer({ room }: { room: Room<HomeState> }) {
  const camera = useThree((s) => s.camera);
  const canvas = useThree((s) => s.gl.domElement);
  const keys = useHeldKeys();

  // Mutable per-frame state lives in refs, never React state.
  const pose = useRef<MovePayload>({ x: 0, z: 0, yaw: 0, pitch: 0 });
  const lastSent = useRef<MovePayload>({ x: 0, z: 0, yaw: 0, pitch: 0 });
  const sinceSend = useRef(0);
  const swingAt = useRef(-1e9);
  const stride = useRef(0);
  const bob = useRef({ phase: 0, amount: 0 });
  const sentSlot = useRef(-1);
  const shake = useRef({ seen: 0, at: -1e9 });

  useEffect(() => {
    const self = room.state.players.get(room.sessionId);
    if (self) pose.current = { x: self.x, z: self.z, yaw: self.yaw, pitch: self.pitch };
    lastSent.current = { ...pose.current };

    return room.onMessage(ServerMessage.Teleport, (p: TeleportPayload) => {
      pose.current.x = p.x;
      pose.current.z = p.z;
    });
  }, [room]);

  useEffect(() => {
    const lock = () => {
      if (document.pointerLockElement !== canvas) void canvas.requestPointerLock();
    };
    const look = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const p = pose.current;
      const k = MOUSE_SENSITIVITY * getSettings().sensitivity;
      p.yaw -= e.movementX * k;
      p.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, p.pitch - e.movementY * k));
    };
    /**
     * Left click uses what you hold: food is eaten, anything else attacks with its weapon (fists
     * for empty hands / materials). The server checks everything.
     */
    const use = (e: MouseEvent) => {
      if (e.button !== 0 || document.pointerLockElement !== canvas) return;
      const me = room.state.players.get(room.sessionId);
      if (!me || me.downed || me.sleeping) return;
      const h = heldItem(room);
      // Food is eaten, unless a creature is in your face: then you punch (loot lands in the
      // selected slot mid-hunt, and eating it instead of fighting back gets you killed).
      if (isItemId(h.itemId) && getItem(h.itemId).hunger !== undefined && !getUi().preyId) {
        room.send(ClientMessage.UseItem, { slot: h.slot });
        return;
      }
      const now = performance.now();
      if (now - swingAt.current < h.weapon.cooldownMs) return;
      const { weapon } = h;
      if (weapon.kind === 'ranged') {
        const ammo = [...me.inventory].some((s) => s.itemId === weapon.ammo && s.qty > 0);
        if (!ammo) {
          showToast('No arrows — craft some at the workbench.');
          return;
        }
      }
      swingAt.current = now;
      localPose.attackAt = now;
      if (weapon.kind === 'melee') playSwing();
      const p = pose.current;
      room.send(ClientMessage.Attack, {
        slot: h.slot,
        targetId: h.weapon.kind === 'melee' ? (getUi().preyId ?? '') : '',
        yaw: p.yaw,
        pitch: p.pitch,
      });
    };
    canvas.addEventListener('click', lock);
    document.addEventListener('mousemove', look);
    document.addEventListener('mousedown', use);
    return () => {
      canvas.removeEventListener('click', lock);
      document.removeEventListener('mousemove', look);
      document.removeEventListener('mousedown', use);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [canvas, room]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, MAX_FRAME_DT);
    const p = pose.current;
    const held = keys.current;

    const me = room.state.players.get(room.sessionId);
    const sleeping = me?.sleeping ?? false;
    if (me?.downed) {
      camera.position.set(p.x, terrainHeight(p.x, p.z) + DOWNED_EYE_HEIGHT, p.z);
      camera.rotation.set(p.pitch, p.yaw, DOWNED_ROLL, 'YXZ');
      if (getUi().focusId || getUi().preyId) updateUi({ focusId: null, preyId: null });
      return; // can look around, nothing else
    }
    if (sleeping) {
      camera.position.set(p.x, SLEEP_EYE_HEIGHT, p.z - SLEEP_HEAD_OFFSET);
      camera.rotation.set(SLEEP_PITCH, 0, 0, 'YXZ');
      if (getUi().focusId !== 'bed' || getUi().preyId) updateUi({ focusId: 'bed', preyId: null });
      return; // no movement or move messages while in bed
    }

    let walked = 0;
    let forward = 0;
    let strafe = 0;
    if (document.pointerLockElement === canvas) {
      forward = Number(held.has('KeyW')) - Number(held.has('KeyS'));
      strafe = Number(held.has('KeyD')) - Number(held.has('KeyA'));
    }
    if (import.meta.env.DEV) forward ||= steerAutopilot(p, PLAYER_WALK_SPEED * dt);

    const length = Math.hypot(forward, strafe);
    if (length > 0) {
      const sprinting = held.has('ShiftLeft') || held.has('ShiftRight');
      const step = ((sprinting ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED) * dt) / length;
      // yaw 0 looks toward -Z; right vector is +X.
      const sin = Math.sin(p.yaw);
      const cos = Math.cos(p.yaw);
      const wanted = clampToWorld(
        p.x + (-sin * forward + cos * strafe) * step,
        p.z + (-cos * forward - sin * strafe) * step,
      );
      // Push out of walls/furniture: the player slides along them.
      const next = resolveCircle(wanted, PLAYER_RADIUS, WORLD_COLLIDERS);
      walked = Math.hypot(next.x - p.x, next.z - p.z);
      stride.current += walked;
      if (stride.current > STEP_LENGTH) {
        stride.current = 0;
        playFootstep(Math.abs(next.x) < HOUSE_HALF.x && Math.abs(next.z) < HOUSE_HALF.z);
      }
      p.x = next.x;
      p.z = next.z;
    }

    // Bob while walking, ease back to still when stopping.
    const b = bob.current;
    b.phase += (walked / STEP_LENGTH) * Math.PI;
    b.amount += ((walked > 0 ? 1 : 0) - b.amount) * Math.min(1, dt * 8);
    const bobY = Math.abs(Math.sin(b.phase)) * BOB_HEIGHT * b.amount;
    camera.position.set(p.x, terrainHeight(p.x, p.z) + PLAYER_EYE_HEIGHT + bobY, p.z);
    const swing = (performance.now() - swingAt.current) / SWING_MS;
    const nod = swing < 1 ? -Math.sin(swing * Math.PI) * SWING_PITCH : 0;
    const { hurtCount } = getUi();
    if (hurtCount !== shake.current.seen)
      shake.current = { seen: hurtCount, at: performance.now() };
    const shaking = (performance.now() - shake.current.at) / SHAKE_MS;
    const jolt = shaking < 1 ? Math.sin(shaking * 40) * SHAKE_ANGLE * (1 - shaking) : 0;
    camera.rotation.set(p.pitch + nod + jolt, p.yaw + jolt * 0.5, 0, 'YXZ');

    localPose.x = p.x;
    localPose.z = p.z;
    localPose.yaw = p.yaw;
    localPose.pitch = p.pitch;

    const focus =
      findDownedPartner(room, p.x, p.z) ??
      findCreature(room, p.x, p.z, p.yaw, INTERACT_RANGE, true) ??
      findFocus(p.x, p.z, p.yaw, (id) => isAvailable(room, id));
    if (focus !== getUi().focusId) updateUi({ focusId: focus });
    const weapon = getWeapon(heldWeaponId(room));
    const prey =
      weapon.kind === 'melee' ? findCreature(room, p.x, p.z, p.yaw, weapon.range, false) : null;
    if (prey !== getUi().preyId) updateUi({ preyId: prey });

    const { selectedSlot } = getUi();
    if (selectedSlot !== sentSlot.current) {
      sentSlot.current = selectedSlot;
      room.send(ClientMessage.SelectSlot, { slot: selectedSlot });
    }

    sinceSend.current += dt * 1000;
    if (sinceSend.current < MOVE_SEND_INTERVAL_MS) return;
    sinceSend.current = 0;
    const s = lastSent.current;
    const changed =
      Math.abs(p.x - s.x) > MOVE_EPSILON ||
      Math.abs(p.z - s.z) > MOVE_EPSILON ||
      Math.abs(p.yaw - s.yaw) > MOVE_EPSILON ||
      Math.abs(p.pitch - s.pitch) > MOVE_EPSILON;
    if (!changed) return;
    room.send(ClientMessage.Move, p);
    s.x = p.x;
    s.z = p.z;
    s.yaw = p.yaw;
    s.pitch = p.pitch;
  });

  return null;
}
