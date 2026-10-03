import { describe, it, expect } from 'vitest';
import { ChannelClient } from '../../src/realtime/channel-client.js';
import { InboxClient } from '../../src/realtime/inbox-client.js';
import { createMockSocketHarness, createFakeClock } from './mock-socket.js';

/** A grant provider whose every mint waits until the test resolves it, in any order. */
function deferredGrants() {
  const pending: Array<(token: string) => void> = [];
  return {
    provider: () => new Promise<string>((resolve) => pending.push(resolve)),
    resolve(index: number, token: string) {
      pending[index](token);
    },
    get count() {
      return pending.length;
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('a grant from a closed lifecycle never opens a socket (channel client)', () => {
  function makeChannel(grants: ReturnType<typeof deferredGrants>) {
    const harness = createMockSocketHarness();
    const client = new ChannelClient({
      endpoint: 'wss://chat.example',
      threadId: 't1',
      currentUserId: 'u-me',
      grantProvider: grants.provider,
      socketFactory: harness.factory,
      timers: createFakeClock(),
      reconnect: { baseDelayMs: 100, maxDelayMs: 1000, random: () => 0 },
    });
    return { client, harness };
  }

  it('close → connect with grant A still minting: B opens the one socket, late A opens nothing', async () => {
    const grants = deferredGrants();
    const { client, harness } = makeChannel(grants);
    void client.connect(); // lifecycle A — its grant hangs
    client.close();
    void client.connect(); // lifecycle B
    expect(grants.count).toBe(2);

    grants.resolve(1, 'grant-B');
    await flush();
    grants.resolve(0, 'grant-A'); // late completion of the closed lifecycle
    await flush();

    expect(harness.sockets).toHaveLength(1);
    expect(harness.sockets[0].grantToken).toBe('grant-B');
  });

  it('a superseded socket\'s late frames and close never touch the current lifecycle', async () => {
    const grants = deferredGrants();
    const { client, harness } = makeChannel(grants);
    void client.connect();
    grants.resolve(0, 'grant-A');
    await flush();
    const socketA = harness.sockets[0];
    socketA.serverOpen();

    client.close();
    void client.connect();
    grants.resolve(1, 'grant-B');
    await flush();
    const socketB = harness.sockets[1];
    socketB.serverOpen();

    // The old socket speaks after it was replaced: none of it may land.
    socketA.serverFrame('snapshot', { lastMessageSeq: 7, readSeq: 0, resync: false, delta: [] });
    socketA.serverFrame('message', {
      message: { seq: 5, senderUid: 'x', clientMessageId: 'c', text: 'from A', createdAt: 1, epoch: 1 },
    });
    socketA.serverClose(1006, 'late');

    const state = client.getState();
    expect(state.messages).toEqual([]);
    expect(state.hasLoadedInitialData).toBe(false);
    expect(state.status).toBe('open');
    expect(harness.sockets).toHaveLength(2);
  });
});

describe('a grant from a closed lifecycle never opens a socket (inbox client)', () => {
  function makeInbox(grants: ReturnType<typeof deferredGrants>) {
    const harness = createMockSocketHarness();
    const client = new InboxClient({
      endpoint: 'wss://chat.example',
      currentUserId: 'u-me',
      grantProvider: grants.provider,
      socketFactory: harness.factory,
      timers: createFakeClock(),
      reconnect: { baseDelayMs: 100, maxDelayMs: 1000, random: () => 0 },
    });
    return { client, harness };
  }

  it('close → connect with grant A still minting: only B\'s socket and B\'s state', async () => {
    const grants = deferredGrants();
    const { client, harness } = makeInbox(grants);
    void client.connect();
    client.close();
    void client.connect();

    grants.resolve(1, 'grant-B');
    await flush();
    grants.resolve(0, 'grant-A');
    await flush();

    expect(harness.sockets).toHaveLength(1);
    expect(harness.sockets[0].grantToken).toBe('grant-B');
    harness.sockets[0].serverOpen();
    harness.sockets[0].serverFrame('snapshot', {
      registry: [{ channelRef: 'b', kind: 'k', state: 'active', registryVersion: 1, unread: true }],
      hasUnread: true,
    });
    expect(client.getState().registry.map((e) => e.channelRef)).toEqual(['b']);
  });

  it('a superseded socket\'s late snapshot never replaces the current one', async () => {
    const grants = deferredGrants();
    const { client, harness } = makeInbox(grants);
    void client.connect();
    grants.resolve(0, 'grant-A');
    await flush();
    const socketA = harness.sockets[0];
    socketA.serverOpen();
    client.close();
    void client.connect();
    grants.resolve(1, 'grant-B');
    await flush();
    harness.sockets[1].serverOpen();

    socketA.serverFrame('snapshot', {
      registry: [{ channelRef: 'stale', kind: 'k', state: 'active', registryVersion: 1 }],
      hasUnread: true,
    });
    expect(client.getState().registry).toEqual([]);
    expect(client.getState().hasLoadedInitialData).toBe(false);
  });
});
