import { useState, type KeyboardEvent } from 'react';
import { CHAT_MAX_LENGTH, ClientMessage } from '@homebound/shared';
import { useChat } from '../../state/chat';
import { getSession } from '../../state/session';
import { getUi, updateUi, useUi } from '../../state/ui';
import { closePanel } from './useGameKeys';
import styles from './ChatBox.module.css';

/** Lines shown while playing (they fade out); more while the box is open. */
const RECENT_LINES = 5;
const OPEN_LINES = 12;

/** Bottom-left chat. Enter opens it (see useGameKeys), Enter sends, Esc cancels. */
export function ChatBox() {
  const { lines } = useChat();
  const open = useUi().panel === 'chat';
  const [draft, setDraft] = useState('');
  const shown = lines.slice(open ? -OPEN_LINES : -RECENT_LINES);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Vietnamese/IME input: Enter that confirms a composed word must not send.
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const text = draft.trim();
      if (text) getSession().room?.send(ClientMessage.Chat, { text });
      setDraft('');
      closePanel(); // back to playing (a key press may take the mouse back)
    }
  };

  if (shown.length === 0 && !open) return null;
  return (
    <div className={styles.chat} data-open={open}>
      <ul className={styles.lines} aria-live="polite">
        {shown.map((l) => (
          <li key={l.id} className={styles.line}>
            <span className={styles.name} data-mine={l.mine}>
              {l.name}
            </span>{' '}
            {l.text}
          </li>
        ))}
      </ul>
      {open && (
        <input
          className={styles.input}
          // Opened on purpose with Enter: typing starts right away.
          autoFocus
          value={draft}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Nói gì đó… (Enter để gửi, Esc để hủy)"
          aria-label="Tin nhắn"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          // Clicking back into the world closes the box without sending.
          onBlur={() => getUi().panel === 'chat' && updateUi({ panel: 'none' })}
        />
      )}
    </div>
  );
}
