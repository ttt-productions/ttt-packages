import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealtimeChatMessages } from '../../src/realtime/useRealtimeChatMessages.js';
import { createRealtimeChatClient, type RealtimeChatClient } from '../../src/realtime/transport.js';
import { ChatAccessDeniedError } from '../../src/realtime/shared.js';
import type { ChannelRefTuple } from '../../src/realtime/wire.js';
import { createMockSocketHarness, createFakeClock, type MockSocketHarness, type FakeClock } from './mock-socket.js';

const CHANNEL_REF: ChannelRefTuple = { scope: 'channel', workProjectId: 'wp1', guildChatChannelId: 'ch1' };

function makeClient(uid: string, harness: MockSocketHarness, clock: FakeClock, grant: string): RealtimeChatClient {
  return createRealtimeChatClient({
    endpoint: 'wss://chat.example',
    channelRef: CHANNEL_REF,
    threadId: 'wp1:ch1',
    currentUserId: uid,
    grantProvider: () => Promise.resolve(grant),
    socketFactory: harness.factory,
    timers: clock,
  });
}

// C-B7: the hook is a pure SUBSCRIBER — the owning hook (e.g. useRealtimeChannelClient)
// is the single connect/close owner. These tests drive connect/close as that owner would.
describe('useRealtimeChatMessages', () => {
  it('reflects the owner-connected client state and opens NO socket of its own (C-B7)', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();
    const client = makeClient('u-1', harness, clock, 'g1');

    // The OWNER connects the client; THEN the view mounts the hook.
    await act(async () => {
      await client.connect();
    });
    const { result } = renderHook(() => useRealtimeChatMessages(client));
    // The hook must not open a second socket — exactly one exists (the owner's).
    expect(harness.sockets).toHaveLength(1);

    await act(async () => {
      harness.last().serverOpen();
    });
    expect(result.current.status).toBe('open');
    // Socket `open` ALONE does not end initial loading — an authoritative snapshot must land.
    expect(result.current.isInitialLoading).toBe(true);

    await act(async () => {
      harness.last().serverFrame('snapshot', {
        lastMessageSeq: 1,
        readSeq: 0,
        resync: false,
        delta: [
          {
            seq: 1,
            senderUid: 'u-2',
            clientMessageId: 's1',
            text: 'hi',
            replyTo: null,
            attachmentState: null,
            attachmentMeta: null,
            createdAt: 100,
            epoch: 1,
          },
        ],
      });
    });
    // The authoritative non-resync snapshot both ends initial loading and delivers the row.
    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.messages.map((m) => m.text)).toEqual(['hi']);
  });

  it('keeps isInitialLoading until an authoritative empty snapshot, then clears it', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();
    const client = makeClient('u-1', harness, clock, 'g1');
    const { result } = renderHook(() => useRealtimeChatMessages(client));
    // A brand-new (unconnected) client is in initial loading.
    expect(result.current.isInitialLoading).toBe(true);

    await act(async () => {
      await client.connect();
    });
    await act(async () => {
      harness.last().serverOpen();
    });
    // Open, no snapshot → still loading.
    expect(result.current.isInitialLoading).toBe(true);

    await act(async () => {
      harness.last().serverFrame('snapshot', { lastMessageSeq: 0, readSeq: 0, resync: false, delta: [] });
    });
    // A loaded, authoritative empty chat — not an eternal loader. allowed stays true.
    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.allowed).toBe(true);
    expect(result.current.messages).toHaveLength(0);
  });

  it('maps a terminal grant denial to allowed:false and surfaces access-denied', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();
    const client = createRealtimeChatClient({
      endpoint: 'wss://chat.example',
      channelRef: CHANNEL_REF,
      threadId: 'wp1:ch1',
      currentUserId: 'u-1',
      grantProvider: () => Promise.reject(new ChatAccessDeniedError()),
      socketFactory: harness.factory,
      timers: clock,
    });
    const { result } = renderHook(() => useRealtimeChatMessages(client));
    await act(async () => {
      await client.connect();
    });
    expect(result.current.allowed).toBe(false);
    expect(result.current.lastErrorCode).toBe('access-denied');
    expect(result.current.status).toBe('closed');
    // Denied at mint → no socket ever opened.
    expect(harness.sockets).toHaveLength(0);
  });

  it('send() emits an optimistic echo and reports success through the hook', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();
    const client = makeClient('u-1', harness, clock, 'g1');
    await act(async () => {
      await client.connect();
    });
    const { result } = renderHook(() => useRealtimeChatMessages(client));
    await act(async () => {
      harness.last().serverOpen();
    });
    let ok = false;
    await act(async () => {
      ok = result.current.send('typed message');
    });
    expect(ok).toBe(true);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('typed message');
    expect(result.current.messages[0].meta?.optimistic).toBe(true);
    expect(harness.last().sent.some((f) => f.type === 'send')).toBe(true);
  });

  it('does NOT close the socket on unmount — the owner owns teardown (C-B7)', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();
    const client = makeClient('u-1', harness, clock, 'g1');
    await act(async () => {
      await client.connect();
    });
    const { unmount } = renderHook(() => useRealtimeChatMessages(client));
    await act(async () => {
      harness.last().serverOpen();
    });
    const sock = harness.last();
    expect(sock.closed).toBe(false);
    unmount();
    // The hook only unsubscribes; the owning hook closes the socket.
    expect(sock.closed).toBe(false);
  });

  it('re-subscribes to a new client on identity change (auth-user switch)', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();
    const clientA = makeClient('u-A', harness, clock, 'grant-A');
    await act(async () => {
      await clientA.connect();
    });
    const { result, rerender } = renderHook(({ c }: { c: RealtimeChatClient }) => useRealtimeChatMessages(c), {
      initialProps: { c: clientA },
    });
    await act(async () => {
      harness.last().serverOpen();
    });
    expect(harness.sockets[0].grantToken).toBe('grant-A');

    // Auth switches to user B: the OWNER closes A + connects B; the hook re-subscribes.
    clientA.close();
    const clientB = makeClient('u-B', harness, clock, 'grant-B');
    await act(async () => {
      await clientB.connect();
    });
    rerender({ c: clientB });
    await act(async () => {
      harness.last().serverOpen();
    });
    expect(result.current.status).toBe('open');
    expect(harness.last().grantToken).toBe('grant-B');
  });
});
