import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { weaponOf } from '@homebound/shared';
import { CAMERA_FOV } from '../config/controls';
import { useSession } from '../state/session';
import { Arrows } from './combat/Arrows';
import { HeldItem } from './combat/HeldItem';
import { Creatures } from './creatures/Creatures';
import { LocalPlayer } from './player/LocalPlayer';
import { RemotePlayer } from './player/RemotePlayer';
import { World } from './world/World';
import { devRenderer } from './devRenderer';

/** Dev-only: hands the renderer to devtools (draw-call / triangle profiling). */
function ExposeRenderer() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    devRenderer.gl = gl;
    return () => {
      devRenderer.gl = null;
    };
  }, [gl]);
  return null;
}

/** Menu backdrop: a fixed shot of the house. */
function MenuCamera() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.set(11, 6, 15);
    camera.lookAt(0, 1.2, 0);
  }, [camera]);
  return null;
}

function Players() {
  const { room, screen } = useSession();
  if (!room || screen !== 'game') return null;

  const partners = [...room.state.players.entries()].filter(([id]) => id !== room.sessionId);
  return (
    <>
      <LocalPlayer room={room} />
      <Creatures room={room} />
      <Arrows room={room} />
      <HeldItem room={room} />
      {partners.map(([id, p]) => (
        <RemotePlayer
          key={id}
          room={room}
          sessionId={id}
          name={p.name}
          slot={p.slot}
          connected={p.connected}
          sleeping={p.sleeping}
          downed={p.downed}
          holding={weaponOf(p.inventory.at(p.selectedSlot)?.itemId ?? '')}
          level={p.level}
        />
      ))}
    </>
  );
}

export function GameCanvas() {
  const { screen } = useSession();
  return (
    <Canvas camera={{ fov: CAMERA_FOV, near: 0.05, far: 200 }} dpr={[1, 2]}>
      <World />
      {screen !== 'game' && <MenuCamera />}
      <Players />
      {import.meta.env.DEV && <ExposeRenderer />}
    </Canvas>
  );
}
