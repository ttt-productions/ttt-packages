import { describe, it, expect, vi } from 'vitest';
import { InboxClient } from '../../src/realtime/inbox-client.js';
import { CHAT_CLOSE_CODES, type WireInboxSnapshot } from '../../src/realtime/wire.js';
import { ChatAccessDeniedError } from '../../src/realtime/shared.js';
import { createMockSocketHarness, createFakeClock } from './mock-socket.js';

function makeInbox(overrides?: { grantProvider?: () => Promise<string> }) {
  const harness = createMockSocketHarness();
  const clock = createFakeClock();
  let grantSeq = 0;
  const grantProvider =
    overrides?.grantProvider ??
    (() => {
      grantSeq += 1;
      return Promise.resolve(`inbox-grant-${grantSeq}`);
    });
  const client = new InboxClient({
    endpoint: 'wss://chat.example',
    currentUserId: 'u-me',
    grantProvider,
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

  it('keeps ARCHIVED rows in the registry (Chats view renders them under the Archived toggle)', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('snapshot', {
      registry: [
        { channelRef: 'c1', kind: 'channel', state: 'active', registryVersion: 1 },
        { channelRef: 'c2', kind: 'channel', state: 'active', registryVersion: 1, archived: true },
        { channelRef: 'c3', kind: 'channel', state: 'tombstoned', registryVersion: 1 },
      ],
      hasUnread: false,
    } as unknown as Record<string, unknown>);
    // Active + archived pass through; tombstoned is filtered out.
    expect(client.getState().registry.map((e) => e.channelRef)).toEqual(['c1', 'c2']);
    expect(client.getState().registry.find((e) => e.channelRef === 'c2')?.archived).toBe(true);
  });

  it('excludes ARCHIVED rows from the per-row unread set (archive = done)', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('snapshot', {
      registry: [
        { channelRef: 'c1', kind: 'channel', state: 'active', registryVersion: 1, unread: true },
        { channelRef: 'c2', kind: 'channel', state: 'active', registryVersion: 1, unread: true, archived: true },
      ],
      hasUnread: true,
    } as unknown as Record<string, unknown>);
    expect(client.channelHasUnread('c1')).toBe(true);
    // c2 carries unread:true but is archived — it must NOT show a dot.
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
    expect(client.getState().lastErrorCode).toBe('revoked');
    expect(harness.sockets).toHaveLength(1);
  });
});

describe('InboxClient — terminal access denial (ChatAccessDeniedError)', () => {
  it('stops reconnecting, surfaces access-denied, opens no socket, and never re-mints', async () => {
    const grant = vi.fn().mockRejectedValue(new ChatAccessDeniedError());
    const { client, harness, clock } = makeInbox({ grantProvider: grant });
    await client.connect();
    expect(client.getState().status).toBe('closed');
    expect(client.getState().lastErrorCode).toBe('access-denied');
    // Denied at mint → no socket was ever built and no reconnect is scheduled.
    expect(harness.sockets).toHaveLength(0);
    // No reconnect loop: the clock advancing does not trigger further mint attempts.
    clock.tick(60_000);
    await Promise.resolve();
    expect(grant).toHaveBeenCalledTimes(1);
    expect(harness.sockets).toHaveLength(0);
  });

  it('recognizes a duck-typed access-denial marker (cross-realm safe)', async () => {
    const grant = vi.fn().mockRejectedValue({ isChatAccessDenied: true });
    const { client } = makeInbox({ grantProvider: grant });
    await client.connect();
    expect(client.getState().status).toBe('closed');
    expect(client.getState().lastErrorCode).toBe('access-denied');
  });

  it('a transient grant error still reconnects (not terminal)', async () => {
    const grant = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue('inbox-grant-ok');
    const { client, clock } = makeInbox({ grantProvider: grant });
    await client.connect();
    expect(client.getState().status).toBe('reconnecting');
    expect(client.getState().lastErrorCode).not.toBe('access-denied');
    clock.tick(200);
    await Promise.resolve();
    await Promise.resolve();
    expect(grant).toHaveBeenCalledTimes(2);
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

describe('InboxClient — markRead (tray clear without opening the chat)', () => {
  it('sends a mark-read frame with the channelRef and does NOT optimistically clear local state', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame(
      'snapshot',
      snap([{ channelRef: 'c1', kind: 'channel', state: 'active', registryVersion: 1, unread: true }], true),
    );
    expect(client.markRead('c1')).toBe(true);
    const frame = sock.sent.find((f) => f.type === 'mark-read');
    expect(frame?.payload).toEqual({ channelRef: 'c1' });
    // No optimistic clear — only the DO's pushed snapshot removes the dot.
    expect(client.channelHasUnread('c1')).toBe(true);
    expect(client.getState().hasUnread).toBe(true);
    // The DO applies the cursor advance and pushes the authoritative snapshot.
    sock.serverFrame(
      'snapshot',
      snap([{ channelRef: 'c1', kind: 'channel', state: 'active', registryVersion: 1, unread: false }], false),
    );
    expect(client.channelHasUnread('c1')).toBe(false);
    expect(client.getState().hasUnread).toBe(false);
  });

  it('returns false when the socket is not open', async () => {
    const { client } = makeInbox();
    // Never connected — no socket to send on.
    expect(client.markRead('c1')).toBe(false);
  });
});

describe('InboxClient — standalone unread frame (C-M2)', () => {
  it('applies a full inbox snapshot delivered as an `unread` frame', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame(
      'unread',
      snap([{ channelRef: 'c1', kind: 'channel', state: 'active', registryVersion: 1, unread: true }], true),
    );
    expect(client.getState().hasUnread).toBe(true);
    expect(client.channelHasUnread('c1')).toBe(true);
  });

  it('patches only the dock dot for a lightweight `{ hasUnread }` unread frame', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('snapshot', snap([{ channelRef: 'c1', kind: 'channel', state: 'active', registryVersion: 1 }], false));
    expect(client.getState().hasUnread).toBe(false);
    sock.serverFrame('unread', { hasUnread: true });
    expect(client.getState().hasUnread).toBe(true);
    // The lightweight patch touches only the dock dot — the registry is preserved.
    expect(client.getState().registry.map((e) => e.channelRef)).toEqual(['c1']);
  });
});
