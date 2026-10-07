import { useEffect } from 'react';
import { GameCanvas } from './game/GameCanvas';
import { resumeSession } from './networking/connection';
import { useSession } from './state/session';
import { GameHud } from './ui/hud/GameHud';
import { LandingScreen } from './ui/screens/LandingScreen';
import { LobbyScreen } from './ui/screens/LobbyScreen';

export function App() {
  const { screen } = useSession();

  useEffect(() => {
    void resumeSession();
  }, []);

  return (
    <>
      <GameCanvas />
      {screen === 'landing' && <LandingScreen />}
      {screen === 'lobby' && <LobbyScreen />}
      {screen === 'game' && <GameHud />}
    </>
  );
}
