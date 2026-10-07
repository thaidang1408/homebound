import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { Room } from '@colyseus/sdk';
import type { HomeState, WeaponId } from '@homebound/shared';
import { heldWeaponId } from '../player/held';
import { localPose } from '../player/localPose';
import { PALETTE } from '../world/palette';
import { BowModel, SpearModel } from './WeaponModels';

/** Where the held item sits in view space (right hand, below the crosshair). */
const REST = { x: 0.32, y: -0.3, z: -0.55 };
const ATTACK_MS = 220;
/** How far each weapon moves on use: thrust/punch forward (−z), bow kicks back (+z). */
const KICK: Record<WeaponId, number> = { fists: -0.22, spear: -0.4, bow: 0.08 };

/**
 * First-person view model: follows the camera every frame and plays a short thrust, punch or
 * recoil whenever LocalPlayer records an attack. Rendered after LocalPlayer so the camera is final.
 */
export function HeldItem({ room }: { room: Room<HomeState> }) {
  const root = useRef<Group>(null);
  const hand = useRef<Group>(null);
  const fist = useRef<Group>(null);
  const spear = useRef<Group>(null);
  const bow = useRef<Group>(null);

  useFrame(({ camera }) => {
    const g = root.current;
    if (!g || !hand.current) return;
    const me = room.state.players.get(room.sessionId);
    g.visible = !!me && !me.sleeping && !me.downed;
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);

    const weapon = heldWeaponId(room);
    if (fist.current) fist.current.visible = weapon === 'fists';
    if (spear.current) spear.current.visible = weapon === 'spear';
    if (bow.current) bow.current.visible = weapon === 'bow';

    const t = (performance.now() - localPose.attackAt) / ATTACK_MS;
    const swing = t < 1 ? Math.sin(t * Math.PI) : 0;
    hand.current.position.set(
      REST.x - swing * 0.08,
      REST.y + swing * 0.04,
      REST.z + swing * KICK[weapon],
    );
    hand.current.rotation.x = weapon === 'spear' ? -swing * 0.15 : 0;
  });

  return (
    <group ref={root}>
      <group ref={hand}>
        {/* Fist */}
        <group ref={fist} position={[0.04, -0.06, 0.02]}>
          <mesh>
            <boxGeometry args={[0.07, 0.07, 0.1]} />
            <meshStandardMaterial color={PALETTE.skin} flatShading />
          </mesh>
        </group>
        <group ref={spear} position-x={0.06} rotation-y={0.1} scale={0.8}>
          <SpearModel />
        </group>
        <group ref={bow} position={[0.02, 0.04, -0.15]} rotation-z={-0.35} scale={0.55}>
          <BowModel />
        </group>
      </group>
    </group>
  );
}
