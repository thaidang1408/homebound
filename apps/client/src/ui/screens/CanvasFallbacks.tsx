import { Component, type ReactNode } from 'react';
import styles from './CanvasFallbacks.module.css';

/** Shown behind the menus while the 3D world downloads. */
export function WorldLoading() {
  return (
    <div className={styles.backdrop} aria-hidden>
      <p className={styles.loading}>Đang tải thế giới…</p>
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
          <p className={styles.title}>Trình duyệt của bạn chưa mở được thế giới 3D.</p>
          <p>
            Hãy thử Chrome, Edge hoặc Firefox mới nhất, và bật tăng tốc phần cứng trong cài đặt
            trình duyệt.
          </p>
        </div>
      </div>
    );
  }
}
