// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  useFirestoreLiveInfinite: vi.fn(),
}));

vi.mock('@ttt-productions/query-core/react', () => ({
  useFirestoreLiveInfinite: mocks.useFirestoreLiveInfinite,
}));
vi.mock('@ttt-productions/firebase-helpers', () => ({
  toMillis: (v: unknown) => (typeof v === 'number' ? v : 0),
}));

import { useChatMessages } from '../src/hooks/useChatMessages.js';
import type { ChatCoreConfig } from '../src/types.js';

function baseConfig(over: Partial<ChatCoreConfig> = {}): ChatCoreConfig {
  return {
    chatCollectionPath: 'chats',
    threadId: 't1',
    currentUserId: 'u1',
    isAdmin: false,
    accessMode: 'firestore-rules',
    ...over,
  } as ChatCoreConfig;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useFirestoreLiveInfinite.mockReturnValue({
    items: [],
    isInitialLoading: true,
    fetchOlder: vi.fn(),
    hasOlder: false,
    isFetchingOlder: false,
  });
});

describe('useChatMessages', () => {
  it('drives the generic live-infinite hook with the messages collection path + ascending order', () => {
    renderHook(() => useChatMessages(baseConfig()));
    const opts = mocks.useFirestoreLiveInfinite.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(opts.collectionPath).toBe('chats/t1/messages');
    expect(opts.orderByField).toBe('createdAt');
    expect(opts.sort).toBe('asc');
    expect(opts.enabled).toBe(true);
  });

  it('maps raw docs to ChatMessageV1 via select', () => {
    renderHook(() => useChatMessages(baseConfig()));
    const opts = mocks.useFirestoreLiveInfinite.mock.calls.at(-1)![0] as {
      select: (d: Record<string, unknown>) => { messageId: string; threadId: string; createdAt: number };
    };
    const msg = opts.select({ id: 'm1', createdAt: 123, senderId: 's1', text: 'hi', type: 'text' });
    expect(msg).toMatchObject({
      messageId: 'm1',
      threadId: 't1',
      createdAt: 123,
      senderId: 's1',
      text: 'hi',
    });
  });

  it('blocks access (disabled) in explicit-allowlist mode when the user is not allowed', () => {
    const { result } = renderHook(() =>
      useChatMessages(baseConfig({ accessMode: 'explicit-allowlist', threadAllowedUserIds: ['other'] })),
    );
    expect(result.current.allowed).toBe(false);
    const opts = mocks.useFirestoreLiveInfinite.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(opts.enabled).toBe(false);
    expect(result.current.messages).toEqual([]);
  });

  it('exposes the generic hook items as messages', () => {
    mocks.useFirestoreLiveInfinite.mockReturnValue({
      items: [{ messageId: 'a' }, { messageId: 'b' }],
      isInitialLoading: false,
      fetchOlder: vi.fn(),
      hasOlder: true,
      isFetchingOlder: false,
    } as never);
    const { result } = renderHook(() => useChatMessages(baseConfig()));
    expect(result.current.messages.map((m) => m.messageId)).toEqual(['a', 'b']);
    expect(result.current.hasOlder).toBe(true);
  });
});
