/** Phase 0 scene: proves the R3F pipeline renders. Replaced by the real world in later phases. */
export function PlaceholderScene() {
  return (
    <>
      <color attach="background" args={['#a9d4e8']} />
      <hemisphereLight args={['#fff4e0', '#4a6b3a', 0.9]} />
      <directionalLight position={[8, 12, 5]} intensity={1.6} />

      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[30, 12]} />
        <meshStandardMaterial color="#6d9a4f" flatShading />
      </mesh>

      {/* House placeholder: walls + roof */}
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[4, 2.5, 4]} />
        <meshStandardMaterial color="#c98f5a" flatShading />
      </mesh>
      <mesh position={[0, 3.3, 0]} rotation-y={Math.PI / 4}>
        <coneGeometry args={[3.4, 1.6, 4]} />
        <meshStandardMaterial color="#8c4a3a" flatShading />
      </mesh>
    </>
  );
}
