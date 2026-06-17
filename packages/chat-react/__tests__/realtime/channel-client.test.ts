import { describe, it, expect, vi } from 'vitest';
import { ChannelClient } from '../../src/realtime/channel-client.js';
import { CHAT_CLOSE_CODES, CHAT_SUBPROTOCOL, type WireMessageRow } from '../../src/realtime/wire.js';
import { createMockSocketHarness, createFakeClock } from './mock-socket.js';

function wireRow(seq: number, senderUid: string, text: string, clientMessageId = `srv-${seq}`): WireMessageRow {
  return {
    seq,
    senderUid,
    clientMessageId,
    text,
    replyTo: null,
    attachmentState: null,
    attachmentMeta: null,
    createdAt: 1000 + seq,
    epoch: 1,
  };
}

function makeClient(overrides?: { grantProvider?: () => Promise<string>; reconnect?: Record<string, unknown> }) {
  const harness = createMockSocketHarness();
  const clock = createFakeClock();
  const grantCalls: number[] = [];
  let grantSeq = 0;
  const grantProvider =
    overrides?.grantProvider ??
    (() => {
      grantSeq += 1;
      grantCalls.push(grantSeq);
      return Promise.resolve(`grant-token-${grantSeq}`);
    });
  const client = new ChannelClient({
    endpoint: 'wss://chat.example',
    threadId: 'wp1:ch1',
    currentUserId: 'u-me',
    grantProvider,
    socketFactory: harness.factory,
    timers: clock,
    // Deterministic backoff: zero jitter, small base.
    reconnect: { baseDelayMs: 100, maxDelayMs: 1000, random: () => 0, ...(overrides?.reconnect ?? {}) },
  });
  return { client, harness, clock, grantCalls };
}

describe('ChannelClient — connect + auth handshake', () => {
  it('offers the chat subprotocol + grant token and sends resume on open', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    // The grant token is what the browser factory would offer as the 2nd subprotocol.
    expect(sock.grantToken).toBe('grant-token-1');
    expect(sock.url).toBe('wss://chat.example/channel');
    expect(client.getState().status).toBe('connecting');

    sock.serverOpen();
    expect(client.getState().status).toBe('open');
    // First frame after open is the resume cursor (ackSeq 0 initially).
    expect(sock.sent[0]).toMatchObject({ type: 'resume', payload: { ackSeq: 0 } });
  });

  it('pins the subprotocol tag constant the worker echoes', () => {
    expect(CHAT_SUBPROTOCOL).toBe('ttt.chat.v1');
  });
});

describe('ChannelClient — optimistic send + seq reconcile', () => {
  it('renders an optimistic echo immediately, then reconciles on the server ack seq', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();

    client.send({ clientMessageId: 'c-1', text: 'hello' });
    // Optimistic echo is present immediately, keyed by clientMessageId, no seq yet.
    let msgs = client.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].messageId).toBe('optimistic:c-1');
    expect(msgs[0].meta?.optimistic).toBe(true);
    // The send frame went out with the clientMessageId.
    expect(sock.sent.find((f) => f.type === 'send')?.payload).toMatchObject({ clientMessageId: 'c-1', text: 'hello' });

    // Server acks the seq for that clientMessageId → reconcile in place (no duplicate).
    sock.serverFrame('ack', { clientMessageId: 'c-1', seq: 42 });
    msgs = client.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].messageId).toBe('42');
    expect(msgs[0].meta?.optimistic).toBe(false);
    expect(msgs[0].meta?.seq).toBe(42);
  });

  it('does not duplicate when the canonical message broadcast also arrives', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();

    client.send({ clientMessageId: 'c-1', text: 'hi' });
    // The sender also receives the broadcast `message` carrying its clientMessageId.
    sock.serverFrame('message', { message: wireRow(7, 'u-me', 'hi', 'c-1') });
    const msgs = client.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].messageId).toBe('7');
    expect(msgs[0].meta?.optimistic).toBeUndefined();
  });

  it('keeps messages ordered ascending by server seq', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('message', { message: wireRow(5, 'u-a', 'five') });
    sock.serverFrame('message', { message: wireRow(2, 'u-b', 'two') });
    sock.serverFrame('message', { message: wireRow(9, 'u-c', 'nine') });
    expect(client.getState().messages.map((m) => m.messageId)).toEqual(['2', '5', '9']);
  });
});

describe('ChannelClient — read ack (delivery != read)', () => {
  it('emits an explicit read-ack frame with the focus signal', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.readAck(17, true);
    expect(sock.sent.find((f) => f.type === 'read-ack')?.payload).toEqual({ readSeq: 17, focused: true });
  });
});

describe('ChannelClient — typing coalescing (>= 2s)', () => {
  it('coalesces typing to at most one frame per TYPING_COALESCE_MS', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.typing();
    client.typing(); // suppressed (within 2s window)
    expect(sock.sent.filter((f) => f.type === 'typing')).toHaveLength(1);
    clock.tick(2001);
    client.typing(); // now allowed again
    expect(sock.sent.filter((f) => f.type === 'typing')).toHaveLength(2);
  });
});

describe('ChannelClient — presence + heartbeat', () => {
  it('subscribes to presence and applies the online set', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.presenceSubscribe();
    expect(sock.sent.some((f) => f.type === 'presence-subscribe')).toBe(true);
    sock.serverFrame('presence', { online: ['u-a', 'u-b'] });
    expect(client.getState().presence).toEqual(['u-a', 'u-b']);
  });

  it('sends a heartbeat every 20s while open', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    expect(sock.sent.filter((f) => f.type === 'heartbeat')).toHaveLength(0);
    clock.tick(20_000);
    expect(sock.sent.filter((f) => f.type === 'heartbeat')).toHaveLength(1);
    clock.tick(20_000);
    expect(sock.sent.filter((f) => f.type === 'heartbeat')).toHaveLength(2);
  });
});

describe('ChannelClient — history pagination', () => {
  it('requests an older page and stops paginating when a short page returns', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('message', { message: wireRow(10, 'u-a', 'ten') });

    client.fetchOlder();
    const hist = sock.sent.find((f) => f.type === 'history');
    expect(hist?.payload).toMatchObject({ beforeSeq: 10, limit: 50 });
    expect(client.getState().isFetchingOlder).toBe(true);

    // A short page (< 50) means we've reached the head.
    sock.serverFrame('history-page', { messages: [wireRow(8, 'u-a', 'eight'), wireRow(9, 'u-b', 'nine')] });
    const st = client.getState();
    expect(st.isFetchingOlder).toBe(false);
    expect(st.hasOlder).toBe(false);
    expect(st.messages.map((m) => m.messageId)).toEqual(['8', '9', '10']);
  });
});

describe('ChannelClient — reconnect + resume (snapshot then delta)', () => {
  it('reconnects after a transient close and resumes from the last applied seq', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('message', { message: wireRow(3, 'u-a', 'three') });
    expect(client.getState().messages.map((m) => m.messageId)).toEqual(['3']);

    // Transient drop (not auth/revoke) → backoff reconnect.
    s1.serverClose(1006, 'abnormal');
    expect(client.getState().status).toBe('reconnecting');
    // Advance past the (jitter=0 → 0ms? no: floor base) backoff window.
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    expect(s2).toBeTruthy();
    s2.serverOpen();
    // Resume carries the cursor at the last applied seq (3) — snapshot then deltas.
    expect(s2.sent.find((f) => f.type === 'resume')?.payload).toEqual({ ackSeq: 3 });

    // The DO snapshot reports a newer tail → the client pulls the latest page to fill the gap.
    s2.serverFrame('snapshot', { lastMessageSeq: 5, readSeq: 2 });
    expect(s2.sent.some((f) => f.type === 'history')).toBe(true);
    // Live delta after resume.
    s2.serverFrame('message', { message: wireRow(4, 'u-b', 'four') });
    expect(client.getState().messages.map((m) => m.messageId)).toEqual(['3', '4']);
  });
});

describe('ChannelClient — auth-expiry 4401 re-grant (once)', () => {
  it('re-mints a grant once and reconnects immediately on 4401, no backoff', async () => {
    const { client, harness, grantCalls } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    expect(grantCalls).toEqual([1]);

    // Grant expired mid-session.
    s1.serverClose(CHAT_CLOSE_CODES.AUTH_EXPIRED, 'grant expired');
    // A second socket opens immediately (no timer advance) with a FRESH grant.
    await Promise.resolve();
    const s2 = harness.sockets[1];
    expect(s2).toBeTruthy();
    expect(s2.grantToken).toBe('grant-token-2');
    expect(grantCalls).toEqual([1, 2]);
  });

  it('does not loop re-grant: a second 4401 in the same cycle backs off instead', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverClose(CHAT_CLOSE_CODES.AUTH_EXPIRED, 'expired');
    await Promise.resolve();
    const s2 = harness.sockets[1];
    // s2 never opened → a second 4401 should NOT trigger another instant re-grant.
    s2.serverClose(CHAT_CLOSE_CODES.AUTH_EXPIRED, 'expired again');
    expect(client.getState().status).toBe('reconnecting');
    // No third socket yet (it's waiting on the backoff timer, not an instant re-grant).
    expect(harness.sockets).toHaveLength(2);
  });
});

describe('ChannelClient — 4403 REVOKED stops reconnecting', () => {
  it('closes permanently on 4403 (a reconnect would just re-deny)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverClose(CHAT_CLOSE_CODES.REVOKED, 'account revoked');
    expect(client.getState().status).toBe('closed');
    expect(client.getState().lastErrorCode).toBe('revoked');
    expect(harness.sockets).toHaveLength(1);
  });
});

describe('ChannelClient — error frames', () => {
  it('surfaces a structured error code (blocked-word/too-long/flood) without closing', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('error', { code: 'blocked-word' });
    expect(client.getState().lastErrorCode).toBe('blocked-word');
    expect(client.getState().status).toBe('open');
  });
});

describe('ChannelClient — teardown', () => {
  it('closes the socket and clears timers on close()', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.close();
    expect(sock.closed).toBe(true);
    expect(client.getState().status).toBe('closed');
    // No heartbeat fires after teardown.
    const before = sock.sent.filter((f) => f.type === 'heartbeat').length;
    clock.tick(60_000);
    expect(sock.sent.filter((f) => f.type === 'heartbeat').length).toBe(before);
  });

  it('does not reconnect after an explicit close()', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.close();
    clock.tick(5000);
    await Promise.resolve();
    expect(harness.sockets).toHaveLength(1);
  });
});

describe('ChannelClient — grant mint failure', () => {
  it('backs off and retries when the grant provider rejects', async () => {
    const grant = vi.fn().mockRejectedValueOnce(new Error('mint failed')).mockResolvedValue('grant-ok');
    const { client, harness, clock } = makeClient({ grantProvider: grant });
    await client.connect();
    // No socket was created (mint rejected before openSocket built one).
    expect(harness.sockets).toHaveLength(0);
    expect(client.getState().status).toBe('reconnecting');
    clock.tick(200);
    await Promise.resolve();
    await Promise.resolve();
    expect(grant).toHaveBeenCalledTimes(2);
  });
});

describe('ChannelClient — send failure when the socket is closed (C-B8)', () => {
  it('returns false and renders no optimistic echo when the socket is not open', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    // Socket created but NOT opened (serverOpen never called) → not writable.
    const ok = client.send({ clientMessageId: 'c-x', text: 'lost?' });
    expect(ok).toBe(false);
    // No phantom "sent" bubble, and the failure is surfaced.
    expect(client.getState().messages).toHaveLength(0);
    expect(client.getState().lastErrorCode).toBe('send-failed');
    expect(harness.last().sent.some((f) => f.type === 'send')).toBe(false);
  });

  it('returns false after the client has been closed', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    harness.last().serverOpen();
    client.close();
    expect(client.send({ clientMessageId: 'c-y', text: 'after close' })).toBe(false);
  });

  it('returns true and renders the echo when the socket is open', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    harness.last().serverOpen();
    const ok = client.send({ clientMessageId: 'c-ok', text: 'sent' });
    expect(ok).toBe(true);
    expect(client.getState().messages).toHaveLength(1);
  });
});

describe('ChannelClient — connect() idempotency (C-B7)', () => {
  it('a second connect() while already connecting/open opens at most one socket', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    await client.connect(); // no-op: already connecting
    expect(harness.sockets).toHaveLength(1);
    harness.last().serverOpen();
    await client.connect(); // no-op: already open
    expect(harness.sockets).toHaveLength(1);
  });
});
