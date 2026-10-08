import type { ChatBroadcast } from '@homebound/shared';
import { createStore } from './createStore';

export interface ChatLine extends ChatBroadcast {
  id: number;
  mine: boolean;
}

/** Enough scrollback for a conversation; older lines drop off. */
const KEEP_LINES = 30;

const store = createStore<{ lines: ChatLine[] }>({ lines: [] });
export const useChat = store.use;

let nextId = 1;
export function addChatLine(message: ChatBroadcast, mine: boolean): void {
  const line = { ...message, id: nextId++, mine };
  store.update({ lines: [...store.get().lines, line].slice(-KEEP_LINES) });
}

/** A new home starts a new conversation. */
export function clearChat(): void {
  store.update({ lines: [] });
}
