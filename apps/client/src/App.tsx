import { Suspense, lazy, useEffect } from 'react';
import { CanvasBoundary, WorldLoading } from './ui/screens/CanvasFallbacks';
import { resumeSession } from './networking/connection';
import { useSession } from './state/session';
import { GameHud } from './ui/hud/GameHud';
import { LandingScreen } from './ui/screens/LandingScreen';
import { LobbyScreen } from './ui/screens/LobbyScreen';

// three.js + R3F load as their own chunk: the menus are usable before the 3D world arrives.
const GameCanvas = lazy(() => import('./game/GameCanvas').then((m) => ({ default: m.GameCanvas })));

export function App() {
  const { screen } = useSession();

  useEffect(() => {
    void resumeSession();
  }, []);

  return (
    <>
      <CanvasBoundary>
        <Suspense fallback={<WorldLoading />}>
          <GameCanvas />
        </Suspense>
      </CanvasBoundary>
      {screen === 'landing' && <LandingScreen />}
      {screen === 'lobby' && <LobbyScreen />}
      {screen === 'game' && <GameHud />}
    </>
  );
}
