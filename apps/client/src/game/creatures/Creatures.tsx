import type { Room } from '@colyseus/sdk';
import { isCreatureKind, type HomeState } from '@homebound/shared';
import { Beast } from './Beast';

/** Every creature in the room. The set of ids is fixed when the room is created. */
export function Creatures({ room }: { room: Room<HomeState> }) {
  return (
    <>
      {[...room.state.creatures.entries()].map(([id, c]) =>
        isCreatureKind(c.kind) ? <Beast key={id} room={room} id={id} kind={c.kind} /> : null,
      )}
    </>
  );
}
