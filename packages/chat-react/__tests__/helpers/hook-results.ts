import { vi } from 'vitest';
import type { UseChatMessagesResult } from '../../src/hooks/useChatMessages.js';
import type { UseRealtimeChatMessagesResult } from '../../src/realtime/useRealtimeChatMessages.js';

export function realtimeMessagesResult(
  over: Partial<UseRealtimeChatMessagesResult> = {},
): UseRealtimeChatMessagesResult {
  return {
    allowed: true,
    isInitialLoading: false,
    messages: [],
    fetchOlder: async () => {},
    hasOlder: false,
    isFetchingOlder: false,
    initialLoadFailed: false,
    isSynced: true,
    retry: vi.fn(),
    status: 'open',
    lastErrorCode: null,
    typing: [],
    presence: [],
    send: () => true,
    retrySend: () => true,
    readAck: () => true,
    signalTyping: () => {},
    presenceSubscribe: () => {},
    presenceUnsubscribe: () => {},
    ...over,
  };
}

export function chatMessagesResult(
  over: Partial<UseChatMessagesResult> = {},
): UseChatMessagesResult {
  return {
    allowed: true,
    isInitialLoading: false,
    messages: [],
    fetchOlder: async () => {},
    hasOlder: false,
    isFetchingOlder: false,
    sourceState: 'live',
    error: null,
    olderError: null,
    retry: vi.fn(),
    ...over,
  };
}
