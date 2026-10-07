import { PALETTE } from '../world/palette';

/** Primitive weapon models, modelled pointing toward −Z. Shared by the view model and partners. */

export function SpearModel() {
  return (
    <>
      <mesh rotation-x={Math.PI / 2} position-z={-0.25}>
        <cylinderGeometry args={[0.018, 0.022, 1.3, 5]} />
        <meshStandardMaterial color={PALETTE.wood} flatShading />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-z={-0.98}>
        <coneGeometry args={[0.045, 0.16, 4]} />
        <meshStandardMaterial color={PALETTE.rock} flatShading />
      </mesh>
    </>
  );
}

/** Upright bow, string toward the holder, an arrow nocked. */
export function BowModel() {
  return (
    <>
      <mesh rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.28, 0.014, 4, 12, Math.PI * 0.9]} />
        <meshStandardMaterial color={PALETTE.woodDark} flatShading />
      </mesh>
      <mesh position-z={0.12}>
        <boxGeometry args={[0.004, 0.5, 0.004]} />
        <meshBasicMaterial color={PALETTE.bowString} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-z={-0.1}>
        <cylinderGeometry args={[0.008, 0.008, 0.5, 4]} />
        <meshStandardMaterial color={PALETTE.wood} />
      </mesh>
    </>
  );
}
