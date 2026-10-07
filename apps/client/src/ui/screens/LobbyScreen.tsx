import { useState } from 'react';
import { ClientMessage, type PlayerState } from '@homebound/shared';
import { playerColor } from '../../game/player/playerColors';
import { leaveRoom } from '../../networking/connection';
import { useSession } from '../../state/session';
import { Button } from '../components/Button';
import panel from '../components/Panel.module.css';
import styles from './LobbyScreen.module.css';

const COPIED_FEEDBACK_MS = 1500;

function PlayerCard({ player, isYou }: { player: PlayerState | undefined; isYou: boolean }) {
  if (!player) {
    return (
      <li className={`${styles.card} ${styles.empty}`}>
        <span className={styles.name}>Waiting for partner…</span>
        <span className={styles.status}>Share the room code</span>
      </li>
    );
  }
  const status = !player.connected ? 'Reconnecting…' : player.ready ? 'Ready' : 'Not ready';
  return (
    <li className={styles.card} data-ready={player.ready}>
      <span className={styles.swatch} style={{ background: playerColor(player.slot) }} />
      <span className={styles.name}>
        {player.name}
        {isYou && <span className={styles.you}> (you)</span>}
      </span>
      <span className={styles.status}>{status}</span>
    </li>
  );
}

export function LobbyScreen() {
  const { room } = useSession();
  const [copied, setCopied] = useState(false);
  if (!room) return null;

  const players = [...room.state.players.entries()];
  const me = room.state.players.get(room.sessionId);
  const bySlot = (slot: number) => players.find(([, p]) => p.slot === slot);
  // Mirrors the server rule: alone you can start right away; together, both must be ready.
  const alone = players.length === 1;
  const canStart =
    players.every(([, p]) => p.connected) && (alone || players.every(([, p]) => p.ready));
  const hint = alone
    ? 'Start now — your partner can join any time with the code.'
    : canStart
      ? 'Both ready — start when you are!'
      : 'Both players must be ready.';

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Clipboard blocked (e.g. plain http on LAN): the code is visible to read out.
    }
  };

  return (
    <div className={panel.overlay}>
      <main className={panel.panel}>
        <div className={styles.codeBlock}>
          <span className={styles.codeLabel}>Room code</span>
          <button type="button" className={styles.code} onClick={() => void copyCode()}>
            {room.roomId}
          </button>
          <span className={styles.codeHint}>{copied ? 'Copied!' : 'Click to copy'}</span>
        </div>

        <ul className={styles.players}>
          {[1, 2].map((slot) => {
            const entry = bySlot(slot);
            return (
              <PlayerCard key={slot} player={entry?.[1]} isYou={entry?.[0] === room.sessionId} />
            );
          })}
        </ul>

        <div className={panel.row}>
          {!alone && (
            <Button
              variant="secondary"
              className={styles.grow}
              onClick={() => room.send(ClientMessage.Ready, { ready: !me?.ready })}
            >
              {me?.ready ? 'Not ready' : "I'm ready"}
            </Button>
          )}
          <Button
            className={styles.grow}
            disabled={!canStart}
            onClick={() => room.send(ClientMessage.Start)}
          >
            Start game
          </Button>
        </div>

        <p className={panel.muted}>{hint}</p>
        <Button variant="ghost" onClick={() => void leaveRoom()}>
          Leave room
        </Button>
      </main>
    </div>
  );
}
