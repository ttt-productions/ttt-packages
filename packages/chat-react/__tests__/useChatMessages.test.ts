// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  firestoreTestWrapper,
  type FirestoreTestWrapper,
} from '@ttt-productions/query-core/react/testing';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import type { DocumentData } from 'firebase/firestore';
import {
  firestoreError,
  type ClientReadPredicate,
} from '@ttt-productions/firebase-helpers/firestore-client/testing';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import { useChatMessages } from '../src/hooks/useChatMessages.js';
import type { ChatCoreConfig } from '../src/types.js';
import { ChatNameResolverProvider } from '../src/context/ChatNameResolverContext.js';

function baseConfig(over: Partial<ChatCoreConfig> = {}): ChatCoreConfig {
  return {
    chatCollectionPath: 'chats',
    threadId: 't1',
    currentUserId: 'u1',
    allowed: true,
    ...over,
  } as ChatCoreConfig;
}

let wrapped: FirestoreTestWrapper;

const seedMessage = (id: string, data: DocumentData) => store.seed(`chats/t1/messages/${id}`, data);
const listens: ClientReadPredicate = (read) => read.listen;
const readsOlder: ClientReadPredicate = (read) => !read.listen;
const ids = (messages: Array<{ messageId: string }>) => messages.map((m) => m.messageId);

beforeEach(() => {
  store.reset();
  wrapped = firestoreTestWrapper(store.db);
});

describe('useChatMessages', () => {
  it('drives the generic live-infinite hook with the messages collection path + ascending order', async () => {
    seedMessage('m2', { createdAt: 2, senderId: 's1', text: 'later' });
    seedMessage('m1', { createdAt: 1, senderId: 's1', text: 'earlier' });
    const { result } = renderHook(() => useChatMessages(baseConfig()), {
      wrapper: wrapped.Wrapper,
    });
    await waitFor(() => expect(ids(result.current.messages)).toEqual(['m1', 'm2']));
    expect(store.queries()[0]).toMatchObject({
      listen: true,
      path: 'chats/t1/messages',
      orders: [{ field: 'createdAt', direction: 'desc' }],
    });
  });

  it('maps raw docs to ChatMessageV1 via select', async () => {
    seedMessage('m1', { createdAt: 123, senderId: 's1', text: 'hi', type: 'text' });
    const { result } = renderHook(() => useChatMessages(baseConfig()), {
      wrapper: wrapped.Wrapper,
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0]).toMatchObject({
      messageId: 'm1',
      threadId: 't1',
      createdAt: 123,
      senderId: 's1',
      text: 'hi',
    });
  });

  it("merges the app's own facts from the stored doc onto the message meta", async () => {
    seedMessage('m1', {
      createdAt: 1,
      senderId: 's1',
      text: 'a',
      sentAs: 'admin',
      meta: { kept: 1 },
    });
    seedMessage('m2', { createdAt: 2, senderId: 's1', text: 'b' });
    const messageMeta = (doc: Record<string, unknown>) =>
      doc.sentAs === 'admin' ? { official: true } : undefined;
    const { result } = renderHook(() => useChatMessages(baseConfig({ messageMeta })), {
      wrapper: wrapped.Wrapper,
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.messages[0].meta).toEqual({ kept: 1, official: true });
    expect(result.current.messages[1].meta).toBeUndefined();
  });

  it('never carries an app field it was not told to read', async () => {
    seedMessage('m1', { createdAt: 1, senderId: 's1', text: 'a', sentAs: 'admin' });
    const { result } = renderHook(() => useChatMessages(baseConfig()), {
      wrapper: wrapped.Wrapper,
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    const [mapped] = result.current.messages;
    expect(mapped).not.toHaveProperty('sentAs');
    expect(mapped.meta).toBeUndefined();
  });

  it('reads nothing when the app says the user may not read the conversation', async () => {
    seedMessage('m1', { createdAt: 1, senderId: 's1', text: 'a' });
    const { result } = renderHook(() => useChatMessages(baseConfig({ allowed: false })), {
      wrapper: wrapped.Wrapper,
    });
    await act(async () => {});
    expect(result.current.allowed).toBe(false);
    expect(store.queries()).toEqual([]);
    expect(result.current.messages).toEqual([]);
  });

  it('exposes the generic hook items as messages', async () => {
    seedMessage('z', { createdAt: 1, senderId: 's1', text: 'oldest' });
    seedMessage('a', { createdAt: 2, senderId: 's1', text: 'a' });
    seedMessage('b', { createdAt: 3, senderId: 's1', text: 'b' });
    const { result } = renderHook(() => useChatMessages(baseConfig({ pageSize: 2 })), {
      wrapper: wrapped.Wrapper,
    });
    await waitFor(() => expect(ids(result.current.messages)).toEqual(['a', 'b']));
    expect(result.current.hasOlder).toBe(true);
  });

  it('passes the listener failure and the older-page failure to the shell, and its retry recovers both', async () => {
    seedMessage('z', { createdAt: 1, senderId: 's1', text: 'oldest' });
    seedMessage('a', { createdAt: 2, senderId: 's1', text: 'a' });
    const listenerError = firestoreError('unavailable', 'listen failed');
    const olderError = firestoreError('unavailable', 'older failed');
    const { result } = renderHook(() => useChatMessages(baseConfig({ pageSize: 1 })), {
      wrapper: wrapped.Wrapper,
    });
    await waitFor(() => expect(result.current.hasOlder).toBe(true));

    let olderFailing = true;
    store.failReads((read) => olderFailing && readsOlder(read), olderError);
    await act(async () => {
      await result.current.fetchOlder();
    });
    await act(async () => store.failListeners(listens, listenerError));

    await waitFor(() => expect(result.current.olderError).toBe(olderError));
    expect(result.current.error).toBe(listenerError);
    expect(result.current.sourceState).toBe('error');
    expect(ids(result.current.messages)).toEqual(['a']);

    olderFailing = false;
    act(() => result.current.retry());
    await waitFor(() => expect(ids(result.current.messages)).toEqual(['z', 'a']));
    expect(result.current.error).toBeNull();
    expect(result.current.olderError).toBeNull();
    expect(result.current.sourceState).toBe('live');
  });

  it('keys the read to the signed-in user, so another account never reuses this window', async () => {
    const keysNaming = (uid: string) =>
      wrapped.queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey)
        .filter((key) => key.includes(uid));
    renderHook(() => useChatMessages(baseConfig({ currentUserId: 'u1' })), {
      wrapper: wrapped.Wrapper,
    });
    await waitFor(() => expect(keysNaming('u1')).not.toEqual([]));
    renderHook(() => useChatMessages(baseConfig({ currentUserId: 'u2' })), {
      wrapper: wrapped.Wrapper,
    });
    await waitFor(() => expect(keysNaming('u2')).not.toEqual([]));
    for (const key of keysNaming('u2')) expect(keysNaming('u1')).not.toContainEqual(key);
  });
});

describe('useChatMessages prewarms every account a message names', () => {
  it('asks the app for the senders and the referenced accounts of server-written lines', async () => {
    seedMessage('a', { createdAt: 1, senderId: 'u1', text: 'hello' });
    seedMessage('b', { createdAt: 2, senderId: 'system', text: 'joined', referencedUids: ['u2'] });
    const prewarm = vi.fn();
    renderHook(() => useChatMessages(baseConfig()), {
      wrapper: ({ children }) =>
        wrapped.Wrapper({
          children: React.createElement(ChatNameResolverProvider, {
            resolveName: () => ({ status: 'pending' as const }),
            prewarm,
            children,
          }),
        }),
    });
    await waitFor(() => expect(prewarm).toHaveBeenCalledWith(expect.arrayContaining(['u1', 'u2'])));
  });
});
