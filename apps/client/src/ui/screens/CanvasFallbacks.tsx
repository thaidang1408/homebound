import { Component, type ReactNode } from 'react';
import styles from './CanvasFallbacks.module.css';

/** Shown behind the menus while the 3D world downloads. */
export function WorldLoading() {
  return (
    <div className={styles.backdrop} aria-hidden>
      <p className={styles.loading}>Loading the world…</p>
    </div>
  );
}

/** If WebGL can't start (old GPU, blocked hardware acceleration), say so in plain words. */
export class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={styles.backdrop} role="alert">
        <div className={styles.error}>
          <p className={styles.title}>Your browser couldn’t start the 3D world.</p>
          <p>
            Try the latest Chrome, Edge or Firefox, and make sure hardware acceleration is turned on
            in the browser settings.
          </p>
        </div>
      </div>
    );
  }
}
