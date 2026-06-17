import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealtimeChatMessages } from '../../src/realtime/useRealtimeChatMessages.js';
import { createRealtimeChatClient, type RealtimeChatClient } from '../../src/realtime/transport.js';
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

describe('useRealtimeChatMessages', () => {
  it('connects on mount and exposes connecting → open status + messages', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();
    const client = makeClient('u-1', harness, clock, 'g1');

    const { result } = renderHook(() => useRealtimeChatMessages(client));
    // connect() is async (awaits the grant); flush the microtask then open the socket.
    await act(async () => {
      await Promise.resolve();
    });
    expect(harness.sockets).toHaveLength(1);

    await act(async () => {
      harness.last().serverOpen();
    });
    expect(result.current.status).toBe('open');
    expect(result.current.isInitialLoading).toBe(false);

    await act(async () => {
      harness.last().serverFrame('message', {
        message: {
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
      });
    });
    expect(result.current.messages.map((m) => m.text)).toEqual(['hi']);
  });

  it('send() emits an optimistic echo through the hook', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();
    const client = makeClient('u-1', harness, clock, 'g1');
    const { result } = renderHook(() => useRealtimeChatMessages(client));
    await act(async () => {
      await Promise.resolve();
      harness.last().serverOpen();
    });
    await act(async () => {
      result.current.send('typed message');
    });
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('typed message');
    expect(result.current.messages[0].meta?.optimistic).toBe(true);
    expect(harness.last().sent.some((f) => f.type === 'send')).toBe(true);
  });

  it('tears down the socket on unmount (auth-user switch teardown path)', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();
    const client = makeClient('u-1', harness, clock, 'g1');
    const { unmount } = renderHook(() => useRealtimeChatMessages(client));
    await act(async () => {
      await Promise.resolve();
      harness.last().serverOpen();
    });
    const sock = harness.last();
    expect(sock.closed).toBe(false);
    unmount();
    expect(sock.closed).toBe(true);
  });

  it('switching the client (new uid) closes the old socket and opens a new one', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();
    const clientA = makeClient('u-A', harness, clock, 'grant-A');
    const { result, rerender } = renderHook(({ c }: { c: RealtimeChatClient }) => useRealtimeChatMessages(c), {
      initialProps: { c: clientA },
    });
    await act(async () => {
      await Promise.resolve();
      harness.last().serverOpen();
    });
    const aSock = harness.sockets[0];
    expect(aSock.grantToken).toBe('grant-A');

    // Auth switches to user B → a NEW client instance is passed; the effect cleanup
    // closes user A's socket, then connects user B.
    const clientB = makeClient('u-B', harness, clock, 'grant-B');
    rerender({ c: clientB });
    await act(async () => {
      await Promise.resolve();
    });
    expect(aSock.closed).toBe(true);
    const bSock = harness.last();
    expect(bSock.grantToken).toBe('grant-B');
    await act(async () => {
      bSock.serverOpen();
    });
    expect(result.current.status).toBe('open');
  });
});
