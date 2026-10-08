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
        <span className={styles.name}>Đang chờ bạn cùng chơi…</span>
        <span className={styles.status}>Gửi mã nhà cho bạn ấy</span>
      </li>
    );
  }
  const status = !player.connected
    ? 'Đang kết nối lại…'
    : player.ready
      ? 'Sẵn sàng'
      : 'Chưa sẵn sàng';
  return (
    <li className={styles.card} data-ready={player.ready}>
      <span className={styles.swatch} style={{ background: playerColor(player.slot) }} />
      <span className={styles.name}>
        {player.name}
        {isYou && <span className={styles.you}> (bạn)</span>}
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
    ? 'Bắt đầu ngay — bạn cùng chơi có thể vào bất cứ lúc nào bằng mã nhà.'
    : canStart
      ? 'Cả hai đã sẵn sàng — bắt đầu thôi!'
      : 'Cả hai người phải sẵn sàng.';

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
          <span className={styles.codeLabel}>Mã nhà</span>
          <button type="button" className={styles.code} onClick={() => void copyCode()}>
            {room.roomId}
          </button>
          <span className={styles.codeHint}>{copied ? 'Đã chép!' : 'Bấm để chép mã'}</span>
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
              {me?.ready ? 'Chưa sẵn sàng' : 'Tớ sẵn sàng'}
            </Button>
          )}
          <Button
            className={styles.grow}
            disabled={!canStart}
            onClick={() => room.send(ClientMessage.Start)}
          >
            Bắt đầu chơi
          </Button>
        </div>

        <p className={panel.muted}>{hint}</p>
        <Button variant="ghost" onClick={() => void leaveRoom()}>
          Rời nhà
        </Button>
      </main>
    </div>
  );
}
