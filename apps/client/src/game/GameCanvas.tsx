import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CAMERA_FOV } from '../config/controls';
import { useSession } from '../state/session';
import { LocalPlayer } from './player/LocalPlayer';
import { RemotePlayer } from './player/RemotePlayer';
import { World } from './world/World';

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
      {partners.map(([id, p]) => (
        <RemotePlayer
          key={id}
          room={room}
          sessionId={id}
          name={p.name}
          slot={p.slot}
          connected={p.connected}
          sleeping={p.sleeping}
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
    </Canvas>
  );
}
