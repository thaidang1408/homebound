import { Particles } from '../fx/Particles';
import { FocusMarker } from '../interaction/FocusMarker';
import { DayNight } from './DayNight';
import { Decorations } from './Decorations';
import { House } from './House';
import { Resources } from './Resources';
import { Terrain } from './Terrain';

/** The playable world: sky and light, terrain, the home, the forest and its resources. */
export function World() {
  return (
    <>
      <DayNight />
      <Terrain />
      <Decorations />
      <Resources />
      <House />
      <FocusMarker />
      <Particles />
    </>
  );
}
