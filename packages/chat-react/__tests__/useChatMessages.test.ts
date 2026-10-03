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
    allowed: true,
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
    sourceState: 'connecting',
    error: null,
    olderError: null,
    retry: vi.fn(),
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

  it('reads nothing when the app says the user may not read the conversation', () => {
    const { result } = renderHook(() => useChatMessages(baseConfig({ allowed: false })));
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
      sourceState: 'live',
      error: null,
      olderError: null,
      retry: vi.fn(),
    } as never);
    const { result } = renderHook(() => useChatMessages(baseConfig()));
    expect(result.current.messages.map((m) => m.messageId)).toEqual(['a', 'b']);
    expect(result.current.hasOlder).toBe(true);
  });

  it('passes the listener failure, the older-page failure, and the retry through to the shell', () => {
    const listenerError = new Error('listen failed');
    const olderError = new Error('older failed');
    const retry = vi.fn();
    mocks.useFirestoreLiveInfinite.mockReturnValue({
      items: [{ messageId: 'a' }],
      isInitialLoading: false,
      fetchOlder: vi.fn(),
      hasOlder: true,
      isFetchingOlder: false,
      sourceState: 'error',
      error: listenerError,
      olderError,
      retry,
    } as never);
    const { result } = renderHook(() => useChatMessages(baseConfig()));
    expect(result.current.error).toBe(listenerError);
    expect(result.current.olderError).toBe(olderError);
    expect(result.current.sourceState).toBe('error');
    // The rows already loaded stay beside the failure.
    expect(result.current.messages.map((m) => m.messageId)).toEqual(['a']);
    result.current.retry();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keys the read to the signed-in user, so another account never reuses this window', () => {
    renderHook(() => useChatMessages(baseConfig({ currentUserId: 'u1' })));
    const first = (mocks.useFirestoreLiveInfinite.mock.calls.at(-1)![0] as { queryKey: unknown[] }).queryKey;
    renderHook(() => useChatMessages(baseConfig({ currentUserId: 'u2' })));
    const second = (mocks.useFirestoreLiveInfinite.mock.calls.at(-1)![0] as { queryKey: unknown[] }).queryKey;
    expect(first).not.toEqual(second);
  });
});

describe('useChatMessages prewarms every account a message names', () => {
  it('asks the app for the senders and the referenced accounts of server-written lines', async () => {
    const { ChatNameResolverProvider } = await import('../src/context/ChatNameResolverContext.js');
    const React = await import('react');
    mocks.useFirestoreLiveInfinite.mockReturnValue({
      items: [
        { messageId: 'a', senderId: 'u1' },
        { messageId: 'b', senderId: 'system', referencedUids: ['u2'] },
      ],
      isInitialLoading: false,
      fetchOlder: vi.fn(),
      hasOlder: false,
      isFetchingOlder: false,
      sourceState: 'live',
      error: null,
      olderError: null,
      retry: vi.fn(),
    } as never);
    const prewarm = vi.fn();
    renderHook(() => useChatMessages(baseConfig()), {
      wrapper: ({ children }) =>
        React.createElement(
          ChatNameResolverProvider,
          { resolveName: () => ({ status: 'pending' as const }), prewarm, children },
        ),
    });
    expect(prewarm).toHaveBeenCalledWith(expect.arrayContaining(['u1', 'u2']));
  });
});
