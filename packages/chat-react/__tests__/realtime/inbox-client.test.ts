import { describe, it, expect } from 'vitest';
import { InboxClient } from '../../src/realtime/inbox-client.js';
import { CHAT_CLOSE_CODES, type WireInboxSnapshot } from '../../src/realtime/wire.js';
import { createMockSocketHarness, createFakeClock } from './mock-socket.js';

function makeInbox() {
  const harness = createMockSocketHarness();
  const clock = createFakeClock();
  let grantSeq = 0;
  const client = new InboxClient({
    endpoint: 'wss://chat.example',
    currentUserId: 'u-me',
    grantProvider: () => {
      grantSeq += 1;
      return Promise.resolve(`inbox-grant-${grantSeq}`);
    },
    socketFactory: harness.factory,
    timers: clock,
    reconnect: { baseDelayMs: 100, maxDelayMs: 1000, random: () => 0 },
  });
  return { client, harness, clock };
}

const snap = (registry: WireInboxSnapshot['registry'], hasUnread: boolean): Record<string, unknown> => ({
  registry,
  hasUnread,
});

describe('InboxClient — connect to /inbox with inbox-scope grant', () => {
  it('opens the inbox endpoint with an inbox grant and sends resume', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const sock = harness.last();
    expect(sock.url).toBe('wss://chat.example/inbox');
    expect(sock.grantToken).toBe('inbox-grant-1');
    sock.serverOpen();
    expect(sock.sent.some((f) => f.type === 'resume')).toBe(true);
    expect(client.getState().status).toBe('open');
  });
});

describe('InboxClient — registry + unread projection (dots only)', () => {
  it('mirrors the snapshot registry (active only) + the dock unread dot', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame(
      'snapshot',
      snap(
        [
          { channelRef: 'ttt:test:channel:wp1:ch1', kind: 'channel', state: 'active', registryVersion: 3 },
          { channelRef: 'ttt:test:channel:wp1:ch2', kind: 'channel', state: 'tombstoned', registryVersion: 5 },
          { channelRef: 'ttt:test:invite:inv1', kind: 'invite', state: 'active', registryVersion: 1 },
        ],
        true,
      ),
    );
    const st = client.getState();
    // Tombstoned entries are filtered out — Chats-view visibility is active-only.
    expect(st.registry.map((e) => e.channelRef)).toEqual(['ttt:test:channel:wp1:ch1', 'ttt:test:invite:inv1']);
    expect(st.hasUnread).toBe(true);
  });

  it('updates on a live delta snapshot (the DO pushes a fresh snapshot on each apply)', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('snapshot', snap([{ channelRef: 'c1', kind: 'channel', state: 'active', registryVersion: 1 }], false));
    expect(client.getState().hasUnread).toBe(false);
    // A new message arrives in c1 → the DO pushes a new snapshot with hasUnread true.
    sock.serverFrame('snapshot', snap([{ channelRef: 'c1', kind: 'channel', state: 'active', registryVersion: 1 }], true));
    expect(client.getState().hasUnread).toBe(true);
  });

  it('surfaces per-channel unread when the snapshot carries an unread flag', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('snapshot', {
      registry: [
        { channelRef: 'c1', kind: 'channel', state: 'active', registryVersion: 1, unread: true },
        { channelRef: 'c2', kind: 'channel', state: 'active', registryVersion: 1, unread: false },
      ],
      hasUnread: true,
    } as unknown as Record<string, unknown>);
    expect(client.channelHasUnread('c1')).toBe(true);
    expect(client.channelHasUnread('c2')).toBe(false);
  });

  it('ignores a stray channel snapshot (guards inbox vs channel snapshot shape)', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('snapshot', snap([{ channelRef: 'c1', kind: 'channel', state: 'active', registryVersion: 1 }], true));
    // A channel snapshot ({ lastMessageSeq, readSeq }) must not clobber inbox state.
    sock.serverFrame('snapshot', { lastMessageSeq: 9, readSeq: 2 } as unknown as Record<string, unknown>);
    expect(client.getState().registry.map((e) => e.channelRef)).toEqual(['c1']);
    expect(client.getState().hasUnread).toBe(true);
  });
});

describe('InboxClient — auth expiry + revoke', () => {
  it('re-mints once on 4401', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverClose(CHAT_CLOSE_CODES.AUTH_EXPIRED, 'expired');
    await Promise.resolve();
    expect(harness.sockets[1]?.grantToken).toBe('inbox-grant-2');
  });

  it('closes permanently on 4403 (account revoked)', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverClose(CHAT_CLOSE_CODES.REVOKED, 'revoked');
    expect(client.getState().status).toBe('closed');
    expect(harness.sockets).toHaveLength(1);
  });
});

describe('InboxClient — teardown', () => {
  it('closes the inbox socket on close()', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.close();
    expect(sock.closed).toBe(true);
    expect(client.getState().status).toBe('closed');
  });
});
