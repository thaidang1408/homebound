import { useState, type FormEvent } from 'react';
import {
  PLAYER_NAME_MAX_LENGTH,
  ROOM_CODE_LENGTH,
  isValidRoomCode,
  normalizeRoomCode,
} from '@homebound/shared';
import { continueHome, createHome, joinHome } from '../../networking/connection';
import { getLastHome } from '../../networking/identity';
import { useSession } from '../../state/session';
import { Button } from '../components/Button';
import { ServerStatus } from '../components/ServerStatus';
import { TextInput } from '../components/TextInput';
import panel from '../components/Panel.module.css';
import styles from './LandingScreen.module.css';

const NAME_KEY = 'homebound:name';

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage unavailable: the name just won't be remembered.
  }
}

export function LandingScreen() {
  const { busy, error } = useSession();
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');
  const normalized = normalizeRoomCode(code);
  const canJoin = isValidRoomCode(normalized) && !busy;

  const lastHome = getLastHome();

  /** Remembers the name and returns it for the request. */
  const playerName = () => {
    saveName(name);
    return name;
  };

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    if (canJoin) void joinHome(normalized, playerName());
  };

  return (
    <div className={panel.overlay}>
      <ServerStatus />
      <main className={panel.panel}>
        <header className={styles.brand}>
          <h1 className={styles.logo}>Homebound</h1>
          <p className={styles.tagline}>Sống cùng nhau. Săn cùng nhau. Sinh tồn cùng nhau.</p>
        </header>

        <TextInput
          label="Tên của bạn"
          value={name}
          maxLength={PLAYER_NAME_MAX_LENGTH}
          placeholder="Nhập tên bé vào"
          onChange={(e) => setName(e.target.value)}
        />

        {lastHome && isValidRoomCode(lastHome) && (
          <Button disabled={!!busy} onClick={() => void continueHome(lastHome, playerName())}>
            Về nhà cũ {lastHome}
          </Button>
        )}
        <Button
          variant={lastHome ? 'secondary' : 'primary'}
          disabled={!!busy}
          onClick={() => void createHome(playerName())}
        >
          Xây nhà mới
        </Button>

        <div className={styles.divider}>hoặc nhập mã nhà</div>

        <form className={panel.row} onSubmit={onJoin}>
          <TextInput
            label="Mã nhà"
            value={code}
            maxLength={ROOM_CODE_LENGTH + 2}
            placeholder="ABC23"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className={styles.codeInput}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={!canJoin}>
            Vào nhà
          </Button>
        </form>

        {busy && <p className={panel.muted}>{busy}</p>}
        {error && (
          <p className={panel.error} role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
