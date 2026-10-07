import { useEffect, useState } from 'react';
import { HEALTH_PATH } from '@homebound/shared';
import { serverUrl } from '../../config/env';
import styles from './ServerStatus.module.css';

type Status = 'checking' | 'online' | 'offline';

const LABELS: Record<Status, string> = {
  checking: 'Connecting to server…',
  online: 'Server online',
  offline: 'Server unreachable',
};

/** Phase 0 smoke check that the client can reach the game server over HTTP. */
export function ServerStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${serverUrl}${HEALTH_PATH}`, { signal: controller.signal })
      .then((res) => setStatus(res.ok ? 'online' : 'offline'))
      .catch(() => {
        if (!controller.signal.aborted) setStatus('offline');
      });
    return () => controller.abort();
  }, []);

  return (
    <div className={styles.pill} data-status={status} role="status">
      <span className={styles.dot} />
      {LABELS[status]}
    </div>
  );
}
