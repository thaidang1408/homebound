import { House } from './House';
import { FocusMarker } from '../interaction/FocusMarker';
import { PALETTE } from './palette';

/** The playable world: ground, sky, sun and the home. Phase 3 adds the forest around it. */
export function World() {
  return (
    <>
      <color attach="background" args={[PALETTE.sky]} />
      <hemisphereLight args={[PALETTE.hemiSky, PALETTE.hemiGround, 0.9]} />
      <directionalLight position={[8, 12, 5]} intensity={1.6} color={PALETTE.sun} />

      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[30, 12]} />
        <meshStandardMaterial color={PALETTE.grass} flatShading />
      </mesh>

      <House />
      <FocusMarker />
    </>
  );
}
