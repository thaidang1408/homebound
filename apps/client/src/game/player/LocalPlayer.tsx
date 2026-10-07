import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Room } from '@colyseus/sdk';
import {
  ClientMessage,
  MAX_PITCH,
  MOVE_SEND_INTERVAL_MS,
  PLAYER_EYE_HEIGHT,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
  ServerMessage,
  clampToWorld,
  type HomeState,
  type MovePayload,
  type TeleportPayload,
} from '@homebound/shared';
import { MAX_FRAME_DT, MOUSE_SENSITIVITY, MOVE_EPSILON } from '../../config/controls';
import { useHeldKeys } from './keyboard';

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
    canvas.addEventListener('click', lock);
    document.addEventListener('mousemove', look);
    return () => {
      canvas.removeEventListener('click', lock);
      document.removeEventListener('mousemove', look);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [canvas]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, MAX_FRAME_DT);
    const p = pose.current;
    const held = keys.current;

    if (document.pointerLockElement === canvas) {
      const forward = Number(held.has('KeyW')) - Number(held.has('KeyS'));
      const strafe = Number(held.has('KeyD')) - Number(held.has('KeyA'));
      const length = Math.hypot(forward, strafe);
      if (length > 0) {
        const sprinting = held.has('ShiftLeft') || held.has('ShiftRight');
        const step = ((sprinting ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED) * dt) / length;
        // yaw 0 looks toward -Z; right vector is +X.
        const sin = Math.sin(p.yaw);
        const cos = Math.cos(p.yaw);
        const next = clampToWorld(
          p.x + (-sin * forward + cos * strafe) * step,
          p.z + (-cos * forward - sin * strafe) * step,
        );
        p.x = next.x;
        p.z = next.z;
      }
    }

    camera.position.set(p.x, PLAYER_EYE_HEIGHT, p.z);
    camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');

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
