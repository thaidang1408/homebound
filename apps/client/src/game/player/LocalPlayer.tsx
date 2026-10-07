import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Room } from '@colyseus/sdk';
import {
  ClientMessage,
  WORLD_COLLIDERS,
  MAX_PITCH,
  MOVE_SEND_INTERVAL_MS,
  PLAYER_EYE_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
  ServerMessage,
  clampToWorld,
  getItem,
  isItemId,
  resolveCircle,
  terrainHeight,
  type HomeState,
  type MovePayload,
  type TeleportPayload,
} from '@homebound/shared';
import { MAX_FRAME_DT, MOUSE_SENSITIVITY, MOVE_EPSILON } from '../../config/controls';
import { getUi, updateUi } from '../../state/ui';
import { findFocus, isAvailable } from '../interaction/focus';
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
      p.yaw -= e.movementX * MOUSE_SENSITIVITY;
      p.pitch = Math.max(
        -MAX_PITCH,
        Math.min(MAX_PITCH, p.pitch - e.movementY * MOUSE_SENSITIVITY),
      );
    };
    /** Left click uses the selected hotbar item (eat food). The server checks it. */
    const use = (e: MouseEvent) => {
      if (e.button !== 0 || document.pointerLockElement !== canvas) return;
      const slot = getUi().selectedSlot;
      const stack = room.state.players.get(room.sessionId)?.inventory.at(slot);
      if (!stack || !isItemId(stack.itemId) || getItem(stack.itemId).hunger === undefined) return;
      room.send(ClientMessage.UseItem, { slot });
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

    const sleeping = room.state.players.get(room.sessionId)?.sleeping ?? false;
    if (sleeping) {
      camera.position.set(p.x, SLEEP_EYE_HEIGHT, p.z - SLEEP_HEAD_OFFSET);
      camera.rotation.set(SLEEP_PITCH, 0, 0, 'YXZ');
      if (getUi().focusId !== 'bed') updateUi({ focusId: 'bed' });
      return; // no movement or move messages while in bed
    }

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
      p.x = next.x;
      p.z = next.z;
    }

    camera.position.set(p.x, terrainHeight(p.x, p.z) + PLAYER_EYE_HEIGHT, p.z);
    camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');

    localPose.x = p.x;
    localPose.z = p.z;
    localPose.yaw = p.yaw;

    const focus = findFocus(p.x, p.z, p.yaw, (id) => isAvailable(room, id));
    if (focus !== getUi().focusId) updateUi({ focusId: focus });

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
