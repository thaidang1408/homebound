import { useEffect, useRef } from 'react';

/** Keys typed into a text field (chat) are text, not game controls. */
export const isTyping = (e: KeyboardEvent): boolean =>
  e.target instanceof HTMLInputElement && e.target.type === 'text';

/** Set of currently held `KeyboardEvent.code`s, kept in a ref (no re-renders). */
export function useHeldKeys() {
  const held = useRef(new Set<string>());

  useEffect(() => {
    const keys = held.current;
    const down = (e: KeyboardEvent) => {
      if (!isTyping(e)) keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    const clear = () => keys.clear();
    // Only on losing the lock: gaining it is async and would drop a key pressed meanwhile.
    const onLockChange = () => {
      if (document.pointerLockElement === null) keys.clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }, []);

  return held;
}
