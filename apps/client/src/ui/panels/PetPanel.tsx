import { useState } from 'react';
import {
  ClientMessage,
  PETS,
  PET_NAME_MAX_LENGTH,
  isPetKind,
  type PetCommand,
} from '@homebound/shared';
import { useSession } from '../../state/session';
import { useUi } from '../../state/ui';
import { Button } from '../components/Button';
import panel from '../components/Panel.module.css';
import { TextInput } from '../components/TextInput';
import { closePanel } from '../hud/useGameKeys';
import styles from './PetPanel.module.css';

const ORDERS: readonly { command: PetCommand; label: string }[] = [
  { command: 'follow', label: 'Đi theo tớ' },
  { command: 'stay', label: 'Ở yên đây' },
  { command: 'home', label: 'Về nhà' },
];

/** [E] on your own pet: name it, tell it what to do, give it a pat. */
export function PetPanel() {
  const { room } = useSession();
  const { petId } = useUi();
  const pet = petId ? room?.state.pets.get(petId) : undefined;
  const [name, setName] = useState(pet?.name ?? '');
  if (!room || !petId || !pet || !isPetKind(pet.kind)) return null;
  const def = PETS[pet.kind];
  const send = (command: PetCommand) => room.send(ClientMessage.PetCommand, { petId, command });

  return (
    <div className={panel.overlay} onClick={closePanel}>
      <div className={panel.panel} onClick={(e) => e.stopPropagation()}>
        <h2 className={panel.title}>
          {def.icon} {pet.name}
        </h2>
        <p className={panel.subtitle}>
          {def.name}. {def.role}
        </p>
        <form
          className={styles.rename}
          onSubmit={(e) => {
            e.preventDefault();
            room.send(ClientMessage.PetName, { petId, name });
          }}
        >
          <TextInput
            label="Tên"
            value={name}
            maxLength={PET_NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={!name.trim() || name === pet.name}>
            Đổi tên
          </Button>
        </form>
        <div className={styles.orders} role="group" aria-label="Ra lệnh">
          {ORDERS.map(({ command, label }) => (
            <Button
              key={command}
              variant={pet.order === command ? 'primary' : 'secondary'}
              aria-pressed={pet.order === command}
              onClick={() => send(command)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button variant="secondary" onClick={() => send('pat')}>
          💕 Vuốt ve
        </Button>
        <Button variant="ghost" onClick={closePanel}>
          Quay lại chơi
        </Button>
      </div>
    </div>
  );
}
