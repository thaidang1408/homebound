import type { Room } from '@colyseus/sdk';
import { isCreatureKind, isPetKind, type HomeState } from '@homebound/shared';
import { WildPet } from '../pets/Pets';
import { Beast, type BeastKind } from './Beast';

/** Every creature in the room. The set of ids is fixed when the room is created. */
export function Creatures({ room }: { room: Room<HomeState> }) {
  return (
    <>
      {[...room.state.creatures.entries()].map(([id, c]) =>
        isPetKind(c.kind) ? (
          <WildPet key={id} room={room} id={id} kind={c.kind} />
        ) : isCreatureKind(c.kind) ? (
          // Not a pet kind (checked above), so a beast.
          <Beast key={id} room={room} id={id} kind={c.kind as BeastKind} />
        ) : null,
      )}
    </>
  );
}
