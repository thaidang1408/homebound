import { useEffect, useState } from 'react';
import { HEALTH_PATH } from '@homebound/shared';
import { serverUrl } from '../../config/env';
import styles from './ServerStatus.module.css';

type Status = 'checking' | 'waking' | 'online' | 'offline';

const LABELS: Record<Status, string> = {
  checking: 'Connecting to server…',
  waking: 'Waking up the server… (up to a minute)',
  online: 'Server online',
  offline: 'Server unreachable',
};

/** A free host sleeps when nobody plays; its first answer can take ~50 s (ADR-020). */
const WAKING_AFTER_MS = 3000;
const RETRY_MS = 5000;
const GIVE_UP_MS = 90_000;

/** Pings the game server's health route until it answers (or clearly won't). */
export function ServerStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const controller = new AbortController();
    const started = Date.now();
    const waking = setTimeout(() => setStatus('waking'), WAKING_AFTER_MS);
    let retry: ReturnType<typeof setTimeout> | undefined;
    const ping = () => {
      fetch(`${serverUrl}${HEALTH_PATH}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          clearTimeout(waking);
          setStatus('online');
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          if (Date.now() - started < GIVE_UP_MS) retry = setTimeout(ping, RETRY_MS);
          else {
            clearTimeout(waking);
            setStatus('offline');
          }
        });
    };
    ping();
    return () => {
      controller.abort();
      clearTimeout(waking);
      clearTimeout(retry);
    };
  }, []);

  return (
    <div className={styles.pill} data-status={status} role="status">
      <span className={styles.dot} />
      {LABELS[status]}
    </div>
  );
}
