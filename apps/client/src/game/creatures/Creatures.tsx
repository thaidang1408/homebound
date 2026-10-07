import type { Room } from '@colyseus/sdk';
import type { HomeState } from '@homebound/shared';
import { Boar } from './Boar';

/** Every creature in the room. The set of ids is fixed when the room is created. */
export function Creatures({ room }: { room: Room<HomeState> }) {
  return (
    <>
      {[...room.state.creatures.entries()].map(([id, c]) =>
        c.kind === 'boar' ? <Boar key={id} room={room} id={id} /> : null,
      )}
    </>
  );
}
