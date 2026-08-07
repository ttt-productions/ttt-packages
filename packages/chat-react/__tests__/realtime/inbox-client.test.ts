import { describe, it, expect, vi, afterEach } from 'vitest';
import { InboxClient } from '../../src/realtime/inbox-client.js';
import { CHAT_CLOSE_CODES, type WireInboxSnapshot } from '../../src/realtime/wire.js';
import { ChatAccessDeniedError } from '../../src/realtime/shared.js';
import {
  CHAT_CLIENT_DIAGNOSTIC_EVENTS as DIAG,
  type ChatClientDiagnosticsOption,
} from '../../src/realtime/diagnostics.js';
import { createMockSocketHarness, createFakeClock } from './mock-socket.js';

function makeInbox(overrides?: {
  grantProvider?: () => Promise<string>;
  diagnostics?: ChatClientDiagnosticsOption;
}) {
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
    ...(overrides?.diagnostics === undefined ? {} : { diagnostics: overrides.diagnostics }),
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

describe('InboxClient — connect() idempotency + lifecycle revival', () => {
  it('a second connect() while already connecting/open opens NO second socket', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    await client.connect(); // no-op: already connecting
    expect(harness.sockets).toHaveLength(1);
    harness.last().serverOpen();
    await client.connect(); // no-op: already open
    expect(harness.sockets).toHaveLength(1);
  });

  it('a transient close reports reconnecting and schedules a retry that opens a new socket', async () => {
    const { client, harness, clock } = makeInbox();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();

    s1.serverClose(1006, 'abnormal');
    expect(client.getState().status).toBe('reconnecting');
    expect(harness.sockets).toHaveLength(1);
    clock.tick(200);
    await Promise.resolve();
    expect(harness.sockets).toHaveLength(2);
  });

  it('close() → connect() → open → transient close still RECONNECTS (never parks in closed)', async () => {
    const { client, harness, clock } = makeInbox();
    await client.connect();
    harness.last().serverOpen();
    client.close();
    expect(client.getState().status).toBe('closed');

    await client.connect();
    expect(harness.sockets).toHaveLength(2);
    const s2 = harness.last();
    s2.serverOpen();
    expect(client.getState().status).toBe('open');

    s2.serverClose(1006, 'abnormal');
    expect(client.getState().status).toBe('reconnecting');
    clock.tick(200);
    await Promise.resolve();
    expect(harness.sockets).toHaveLength(3);
  });

  it('a fresh connect() clears the previous TERMINAL lastErrorCode', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverClose(CHAT_CLOSE_CODES.REVOKED, 'revoked');
    expect(client.getState().lastErrorCode).toBe('revoked');

    await client.connect();
    expect(client.getState().lastErrorCode).toBeNull();
    expect(client.getState().status).toBe('connecting');
  });

  it('a fresh connect() clears a terminal access-denied and re-attempts the mint', async () => {
    const grant = vi
      .fn()
      .mockRejectedValueOnce(new ChatAccessDeniedError())
      .mockResolvedValue('inbox-grant-after-reinstate');
    const { client, harness } = makeInbox({ grantProvider: grant });
    await client.connect();
    expect(client.getState().lastErrorCode).toBe('access-denied');
    expect(harness.sockets).toHaveLength(0);

    await client.connect();
    expect(client.getState().lastErrorCode).toBeNull();
    expect(grant).toHaveBeenCalledTimes(2);
    expect(harness.sockets).toHaveLength(1);
  });

  it('preserves the registry projection across a lifecycle restart', async () => {
    const { client, harness } = makeInbox();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('snapshot', snap([{ channelRef: 'c1', kind: 'channel', state: 'active', registryVersion: 1 }], true));
    expect(client.getState().registry.map((e) => e.channelRef)).toEqual(['c1']);

    client.close();
    await client.connect();
    // A lifecycle restart must not blank the dock — the DO's next snapshot is authoritative.
    expect(client.getState().registry.map((e) => e.channelRef)).toEqual(['c1']);
    expect(client.getState().hasUnread).toBe(true);
  });

  it('4403 REVOKED stays terminal WITHIN the lifecycle (only an explicit connect() revives it)', async () => {
    const { client, harness, clock } = makeInbox();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverClose(CHAT_CLOSE_CODES.REVOKED, 'revoked');
    expect(client.getState().status).toBe('closed');
    clock.tick(60_000);
    await Promise.resolve();
    expect(harness.sockets).toHaveLength(1);
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

// ---------------------------------------------------------------------------
// OPT-IN structured diagnostics (`diagnostics` config, default OFF) — the same
// option type + emitter the channel client uses (ONE owner: src/realtime/diagnostics.ts).
// Inbox payloads are SIZES ONLY: a `channelRef` names one specific conversation
// and must never appear in a diagnostic line.
// ---------------------------------------------------------------------------

/** A channelRef whose substrings must never show up in any diagnostic payload. */
const SECRET_REF = 'ttt:test:channel:secret-workspace:secret-channel';

/**
 * One representative inbox script: connect → authoritative snapshot (mixed
 * active/tombstoned/archived + unread) → markRead → a cleared snapshot → a
 * lightweight unread patch → two frames the client deliberately ignores → an idle
 * window → a drop/reconnect → a fresh snapshot.
 */
async function runInboxScenario(diagnostics?: ChatClientDiagnosticsOption) {
  const ctx = makeInbox(diagnostics === undefined ? undefined : { diagnostics });
  const { client, harness, clock } = ctx;
  await client.connect();
  let sock = harness.last();
  sock.serverOpen();
  sock.serverFrame(
    'snapshot',
    snap(
      [
        { channelRef: SECRET_REF, kind: 'channel', state: 'active', registryVersion: 3, unread: true },
        { channelRef: 'ttt:test:channel:gone', kind: 'channel', state: 'tombstoned', registryVersion: 5 },
        { channelRef: 'ttt:test:invite:inv1', kind: 'invite', state: 'active', registryVersion: 1, archived: true },
      ],
      true,
    ),
  );
  client.markRead(SECRET_REF);
  sock.serverFrame(
    'snapshot',
    snap([{ channelRef: SECRET_REF, kind: 'channel', state: 'active', registryVersion: 4, unread: false }], false),
  );
  sock.serverFrame('unread', { hasUnread: true });
  sock.serverFrame('snapshot', { lastMessageSeq: 9, readSeq: 2 }); // stray CHANNEL snapshot
  sock.serverFrame('brand-new-frame', { whatever: 1 }); // forward-compat noise
  clock.tick(120_000); // the inbox socket runs no heartbeat — an idle window is silent
  sock.serverClose(1006, 'abnormal');
  clock.tick(200);
  await Promise.resolve();
  sock = harness.last();
  sock.serverOpen();
  sock.serverFrame(
    'snapshot',
    snap([{ channelRef: SECRET_REF, kind: 'channel', state: 'active', registryVersion: 5, unread: false }], false),
  );
  return ctx;
}

/** Every frame every socket sent, as a stable comparable string. */
function allInboxFrames(harness: { sockets: Array<{ sent: unknown[] }> }): string {
  return JSON.stringify(harness.sockets.map((s) => s.sent));
}

describe('InboxClient — diagnostics OFF (the default: zero behavior change, zero output)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes nothing to the console when the flag is absent or false', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runInboxScenario();
    await runInboxScenario(false);
    expect(debug).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('produces IDENTICAL state and IDENTICAL sent frames with the flag off vs. on', async () => {
    const off = await runInboxScenario();
    const on = await runInboxScenario(() => undefined);
    expect(JSON.stringify(on.client.getState())).toBe(JSON.stringify(off.client.getState()));
    expect(allInboxFrames(on.harness)).toBe(allInboxFrames(off.harness));
  });

  it('a THROWING sink never breaks the inbox client', async () => {
    const off = await runInboxScenario();
    const throwing = await runInboxScenario(() => {
      throw new Error('sink exploded');
    });
    expect(JSON.stringify(throwing.client.getState())).toBe(JSON.stringify(off.client.getState()));
    expect(allInboxFrames(throwing.harness)).toBe(allInboxFrames(off.harness));
  });
});

describe('InboxClient — diagnostics ON (structured decision log)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function runCaptured() {
    const entries: Array<{ event: string; data: Record<string, unknown> }> = [];
    const ctx = await runInboxScenario((event, data) => entries.push({ event, data }));
    const of = (event: string) => entries.filter((e) => e.event === event).map((e) => e.data);
    return { ...ctx, entries, of };
  }

  it('records the socket lifecycle with the reconnect cause and attempt number', async () => {
    const { of } = await runCaptured();
    expect(of(DIAG.INBOX_CONNECT_ATTEMPT).map((d) => [d.attempt, d.cause])).toEqual([
      [1, 'initial'],
      [2, 'transient-close'],
    ]);
    expect(of(DIAG.INBOX_SOCKET_OPEN).map((d) => d.attempt)).toEqual([1, 2]);
    expect(of(DIAG.INBOX_SOCKET_CLOSE)[0]).toMatchObject({ code: 1006, closedByUs: false, outcome: 'reconnect' });
    const scheduled = of(DIAG.INBOX_RECONNECT_SCHEDULED)[0];
    expect(scheduled).toMatchObject({ cause: 'transient-close' });
    expect(typeof scheduled.delayMs).toBe('number');
  });

  it('records the cursorless resume sent on every open', async () => {
    const { of } = await runCaptured();
    expect(of(DIAG.INBOX_RESUME_REQUEST)).toEqual([
      { attempt: 1, cursorless: true, sent: true },
      { attempt: 2, cursorless: true, sent: true },
    ]);
  });

  it('records snapshot application as SIZES (received / active / archived), never refs', async () => {
    const { of } = await runCaptured();
    const applied = of(DIAG.INBOX_SNAPSHOT_APPLIED);
    expect(applied[0]).toMatchObject({
      source: 'snapshot',
      received: 3, // one of which is tombstoned and filtered out
      active: 2,
      archived: 1,
      hasUnread: true,
      unreadCount: 1,
      registryDelta: 2,
    });
    expect(applied[1]).toMatchObject({ received: 1, active: 1, archived: 0, hasUnread: false, unreadCount: 0 });
  });

  it('records unread-projection changes as counts and deltas only', async () => {
    const { of } = await runCaptured();
    const updates = of(DIAG.INBOX_UNREAD_UPDATED);
    // false -> true (first snapshot), true -> false (the cleared snapshot), then the
    // lightweight dock-dot patch back to true.
    expect(updates[0]).toMatchObject({ hasUnreadBefore: false, hasUnreadAfter: true, unreadCountDelta: 1 });
    expect(updates[1]).toMatchObject({ hasUnreadBefore: true, hasUnreadAfter: false, unreadCountDelta: -1 });
    expect(updates[2]).toMatchObject({ source: 'unread-patch', hasUnreadBefore: false, hasUnreadAfter: true });
    // The reconnect's AUTHORITATIVE snapshot corrects the dock dot the patch had set —
    // exactly the "client state vs. server truth" divergence this log exists to show.
    expect(updates[3]).toMatchObject({ source: 'snapshot', hasUnreadBefore: true, hasUnreadAfter: false });
    // Bounded: only real changes emit — four transitions, four lines, no repeats.
    expect(updates).toHaveLength(4);
  });

  it('records the frames it deliberately ignores, with reasons', async () => {
    const { of } = await runCaptured();
    expect(of(DIAG.INBOX_FRAME_DROPPED)).toEqual([
      { kind: 'snapshot', reason: 'not-an-inbox-payload' },
      { kind: 'brand-new-frame', reason: 'unknown-type' },
    ]);
  });

  it('records a mark-read WITHOUT the channelRef', async () => {
    const { of } = await runCaptured();
    expect(of(DIAG.INBOX_MARK_READ)).toEqual([{ sent: true, unreadCount: 1 }]);
  });

  it('emits NOTHING during an idle window (no heartbeat / no per-render lines)', async () => {
    const entries: Array<{ event: string; data: Record<string, unknown> }> = [];
    const { client, harness, clock } = makeInbox({ diagnostics: (event, data) => entries.push({ event, data }) });
    await client.connect();
    harness.last().serverOpen();
    const afterOpen = entries.length;
    clock.tick(300_000);
    expect(entries).toHaveLength(afterOpen);
  });

  it('records a terminal grant denial and never leaks the grant token', async () => {
    const entries: Array<{ event: string; data: Record<string, unknown> }> = [];
    const grant = vi.fn().mockRejectedValue(new ChatAccessDeniedError());
    const { client } = makeInbox({ grantProvider: grant, diagnostics: (event, data) => entries.push({ event, data }) });
    await client.connect();
    expect(entries.filter((e) => e.event === DIAG.INBOX_GRANT_FAILED).map((e) => e.data)).toEqual([
      { attempt: 1, terminal: true },
    ]);
    expect(JSON.stringify(entries)).not.toContain('inbox-grant');
  });

  it('NEVER logs a channelRef or any other conversation identity', async () => {
    const { entries } = await runCaptured();
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain(SECRET_REF);
    expect(serialized).not.toContain('secret-workspace');
    expect(serialized).not.toContain('secret-channel');
    expect(serialized).not.toContain('inv1');
    expect(serialized).not.toContain('inbox-grant');
  });

  it('the `true` shorthand emits ONE parseable console.debug line per decision', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    await runInboxScenario(true);
    expect(debug.mock.calls.length).toBeGreaterThan(0);
    const declared = new Set<string>(Object.values(DIAG));
    for (const call of debug.mock.calls) {
      expect(call).toHaveLength(1);
      const line = String(call[0]);
      expect(line).not.toContain('\n');
      const [event, ...rest] = line.split(' ');
      expect(event.startsWith('chat_client_inbox_')).toBe(true);
      expect(declared.has(event)).toBe(true);
      expect(() => JSON.parse(rest.join(' ')) as unknown).not.toThrow();
    }
  });
});
