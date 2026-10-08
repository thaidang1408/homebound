import { applyVolume } from '../../audio/engine';
import { SENSITIVITY_RANGE, updateSettings, useSettings } from '../../state/settings';
import styles from './SettingsPanel.module.css';

/** Mouse sensitivity, volume and mute: shown in the pause menu, remembered in this browser. */
export function SettingsPanel() {
  const { sensitivity, volume, muted, hints } = useSettings();
  return (
    <div className={styles.settings} onClick={(e) => e.stopPropagation()}>
      <label className={styles.row}>
        <span>Mouse sensitivity</span>
        <input
          type="range"
          min={SENSITIVITY_RANGE.min}
          max={SENSITIVITY_RANGE.max}
          step={0.05}
          value={sensitivity}
          onChange={(e) => updateSettings({ sensitivity: Number(e.target.value) })}
        />
        <span className={styles.value}>{sensitivity.toFixed(2)}×</span>
      </label>
      <label className={styles.row}>
        <span>Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => {
            updateSettings({ volume: Number(e.target.value) });
            applyVolume();
          }}
        />
        <span className={styles.value}>{Math.round(volume * 100)}%</span>
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={muted}
          onChange={(e) => {
            updateSettings({ muted: e.target.checked });
            applyVolume();
          }}
        />
        Mute (N)
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={hints}
          onChange={(e) => updateSettings({ hints: e.target.checked })}
        />
        Key hints on screen (H)
      </label>
    </div>
  );
}
