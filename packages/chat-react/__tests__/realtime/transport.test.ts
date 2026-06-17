import { describe, it, expect } from 'vitest';
import { createRealtimeChatClient, createInboxClient } from '../../src/realtime/transport.js';
import type { ChannelRefTuple } from '../../src/realtime/wire.js';
import { createMockSocketHarness, createFakeClock } from './mock-socket.js';

const CHANNEL_REF: ChannelRefTuple = { scope: 'channel', workProjectId: 'wp1', guildChatChannelId: 'ch1' };

describe('createRealtimeChatClient — handle wiring', () => {
  it('exposes the channelRef + uid and drives the channel socket', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();
    const client = createRealtimeChatClient({
      endpoint: 'wss://chat.example',
      channelRef: CHANNEL_REF,
      threadId: 'wp1:ch1',
      currentUserId: 'u-1',
      grantProvider: () => Promise.resolve('g1'),
      socketFactory: harness.factory,
      timers: clock,
    });
    expect(client.channelRef).toEqual(CHANNEL_REF);
    expect(client.currentUserId).toBe('u-1');
    await client.connect();
    harness.last().serverOpen();
    expect(client.getState().status).toBe('open');
  });
});

describe('auth-user switch — tear down every socket before connecting as the new uid', () => {
  it('closes the old uid channel + inbox sockets; the new uid opens fresh sockets', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();

    // --- user A: a channel client + an inbox client are live ---
    const channelA = createRealtimeChatClient({
      endpoint: 'wss://chat.example',
      channelRef: CHANNEL_REF,
      threadId: 'wp1:ch1',
      currentUserId: 'u-A',
      grantProvider: () => Promise.resolve('grant-A-channel'),
      socketFactory: harness.factory,
      timers: clock,
    });
    const inboxA = createInboxClient({
      endpoint: 'wss://chat.example',
      currentUserId: 'u-A',
      grantProvider: () => Promise.resolve('grant-A-inbox'),
      socketFactory: harness.factory,
      timers: clock,
    });
    await channelA.connect();
    await inboxA.connect();
    const aChannelSock = harness.sockets[0];
    const aInboxSock = harness.sockets[1];
    aChannelSock.serverOpen();
    aInboxSock.serverOpen();
    expect(aChannelSock.grantToken).toBe('grant-A-channel');
    expect(aInboxSock.grantToken).toBe('grant-A-inbox');

    // --- auth switches to user B: tear down EVERY socket first ---
    channelA.close();
    inboxA.close();
    expect(aChannelSock.closed).toBe(true);
    expect(aInboxSock.closed).toBe(true);

    // --- user B connects fresh (new clients, new grants, new sockets) ---
    const channelB = createRealtimeChatClient({
      endpoint: 'wss://chat.example',
      channelRef: CHANNEL_REF,
      threadId: 'wp1:ch1',
      currentUserId: 'u-B',
      grantProvider: () => Promise.resolve('grant-B-channel'),
      socketFactory: harness.factory,
      timers: clock,
    });
    await channelB.connect();
    const bChannelSock = harness.last();
    bChannelSock.serverOpen();
    expect(bChannelSock.grantToken).toBe('grant-B-channel');
    expect(channelB.currentUserId).toBe('u-B');

    // The torn-down user-A sockets never receive user-B traffic.
    expect(aChannelSock.closed).toBe(true);
    expect(aInboxSock.closed).toBe(true);
    // 4 sockets created total: A-channel, A-inbox, B-channel (+ none for B-inbox in this test).
    expect(harness.sockets).toHaveLength(3);
  });

  it('a torn-down channel client does not reconnect even after the backoff window', async () => {
    const harness = createMockSocketHarness();
    const clock = createFakeClock();
    const client = createRealtimeChatClient({
      endpoint: 'wss://chat.example',
      channelRef: CHANNEL_REF,
      threadId: 'wp1:ch1',
      currentUserId: 'u-A',
      grantProvider: () => Promise.resolve('g'),
      socketFactory: harness.factory,
      timers: clock,
      reconnect: { baseDelayMs: 100, random: () => 0 },
    });
    await client.connect();
    harness.last().serverOpen();
    client.close();
    clock.tick(10_000);
    await Promise.resolve();
    expect(harness.sockets).toHaveLength(1);
  });
});
