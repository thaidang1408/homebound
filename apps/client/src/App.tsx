import { Canvas } from '@react-three/fiber';
import { PlaceholderScene } from './game/world/PlaceholderScene';
import { ServerStatus } from './ui/components/ServerStatus';

export function App() {
  return (
    <>
      <Canvas camera={{ position: [7, 4, 9], fov: 60 }} dpr={[1, 2]}>
        <PlaceholderScene />
      </Canvas>
      <ServerStatus />
    </>
  );
}
