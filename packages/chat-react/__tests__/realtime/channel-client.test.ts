import { describe, it, expect, vi } from 'vitest';
import { ChannelClient } from '../../src/realtime/channel-client.js';
import { CHAT_CLOSE_CODES, CHAT_SUBPROTOCOL, type WireMessageRow } from '../../src/realtime/wire.js';
import {
  ChatAccessDeniedError,
  MAX_PENDING_SEND_ATTEMPTS,
  PENDING_SEND_MAX_AGE_MS,
  SERVER_RETRYABLE_MAX_AGE_MS,
  SEND_RETRY_MAX_DELAY_MS,
} from '../../src/realtime/shared.js';
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
    // First frame after open is the resume cursor. The field MUST be `afterSeq` — the
    // Channel DO reads `payload.afterSeq`; a mismatched name reads as cursorless.
    expect(sock.sent[0]).toMatchObject({ type: 'resume', payload: { afterSeq: 0 } });
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
    expect(client.readAck(17, true)).toBe(true);
    expect(sock.sent.find((f) => f.type === 'read-ack')?.payload).toEqual({ readSeq: 17, focused: true });
  });

  it('returns false when the socket is closed and re-sends the cursor on reconnect (M2)', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();

    // Drop the socket, then ack while it is closed — nothing is sent, returns false.
    s1.serverClose(1006, 'abnormal');
    expect(client.readAck(9, true)).toBe(false);

    // Reconnect → the remembered read cursor is re-sent after open.
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    expect(s2).toBeTruthy();
    s2.serverOpen();
    expect(s2.sent.find((f) => f.type === 'read-ack')?.payload).toEqual({ readSeq: 9, focused: true });
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

describe('ChannelClient — reconnect + resume (Contract C snapshot: delta / resync)', () => {
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
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    expect(s2).toBeTruthy();
    s2.serverOpen();
    // Resume carries the cursor at the last applied seq (3) — snapshot then deltas.
    expect(s2.sent.find((f) => f.type === 'resume')?.payload).toEqual({ afterSeq: 3 });

    // Within-backlog resume: the DO ships the contiguous delta (resync:false). The
    // client APPLIES it — no history fetch — and advances the cursor to the tail.
    s2.serverFrame('snapshot', {
      lastMessageSeq: 5,
      readSeq: 2,
      resync: false,
      delta: [wireRow(4, 'u-b', 'four'), wireRow(5, 'u-c', 'five')],
    });
    expect(s2.sent.some((f) => f.type === 'history')).toBe(false);
    expect(client.getState().messages.map((m) => m.messageId)).toEqual(['3', '4', '5']);
    // Next resume would report caught-up at the tail.
    expect((client as unknown as { resumeSeq: number }).resumeSeq).toBe(5);
  });

  it('applies a >50-message backlog delta with no permanent hole (the critical fix)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('message', { message: wireRow(10, 'u-a', 'old tail') });

    // 120-message gap during a disconnect, all within the ≤500 backlog → one delta.
    const delta = Array.from({ length: 120 }, (_, i) => wireRow(11 + i, 'u-b', `gap ${i}`));
    s1.serverFrame('snapshot', { lastMessageSeq: 130, readSeq: 0, resync: false, delta });

    const ids = client.getState().messages.map((m) => m.messageId);
    expect(ids).toHaveLength(121); // 10 + 11..130
    expect(ids[0]).toBe('10');
    expect(ids[ids.length - 1]).toBe('130');
    // No gap: every seq 11..130 present, contiguous.
    expect(ids.includes('71')).toBe(true);
    // No history fetch was needed — the delta healed it.
    expect(s1.sent.some((f) => f.type === 'history')).toBe(false);
  });

  it('applies a moderation revision baked into a delta row (hidden text never renders)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    // A delta row that arrives already-moderated (the DO overlay merge).
    const moderated: WireMessageRow = { ...wireRow(4, 'u-x', 'secret'), moderationKind: 'moderate', messageRevision: 2 };
    s1.serverFrame('snapshot', { lastMessageSeq: 4, readSeq: 0, resync: false, delta: [moderated] });
    const msg = client.getState().messages.find((m) => m.messageId === '4');
    expect(msg?.text).not.toBe('secret');
    expect(msg?.meta?.moderated).toBe(true);
  });

  it('on resync=true drops the local tail and re-pages history from the top', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('message', { message: wireRow(3, 'u-a', 'three') });
    s1.serverFrame('message', { message: wireRow(4, 'u-b', 'four') });
    expect(client.getState().messages).toHaveLength(2);

    // Gap beyond the backlog → resync: drop the tail, re-page from the top.
    s1.serverFrame('snapshot', { lastMessageSeq: 900, readSeq: 0, resync: true, delta: [] });
    expect(client.getState().messages).toHaveLength(0);
    expect((client as unknown as { resumeSeq: number }).resumeSeq).toBe(0);
    // A cursorless history request went out (re-page from the top).
    expect(s1.sent.filter((f) => f.type === 'history').at(-1)?.payload).toMatchObject({ beforeSeq: null, limit: 50 });
  });

  it('treats a legacy snapshot (no resync/delta) as a resync re-page', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('message', { message: wireRow(3, 'u-a', 'three') });
    // Pre-contract DO: bare { lastMessageSeq, readSeq }.
    s1.serverFrame('snapshot', { lastMessageSeq: 5, readSeq: 2 });
    expect(client.getState().messages).toHaveLength(0);
    expect(s1.sent.filter((f) => f.type === 'history').at(-1)?.payload).toMatchObject({ beforeSeq: null });
  });

  it('keeps un-acked optimistic rows through a resync', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('message', { message: wireRow(3, 'u-a', 'three') });
    client.send({ clientMessageId: 'c-live', text: 'unsent-through-resync' });
    expect(client.getState().messages.some((m) => m.meta?.optimistic)).toBe(true);

    s1.serverFrame('snapshot', { lastMessageSeq: 900, readSeq: 0, resync: true, delta: [] });
    const msgs = client.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].meta?.optimistic).toBe(true);
    expect(msgs[0].meta?.clientMessageId).toBe('c-live');
  });
});

describe('ChannelClient — un-acked send retry on reconnect (clientMessageId idempotency)', () => {
  it('re-sends an un-acked pending send with the SAME clientMessageId on resume', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    // Send lands on the socket but the ack never arrives before the drop.
    client.send({ clientMessageId: 'c-1', text: 'hello?' });
    expect(s1.sent.filter((f) => f.type === 'send')).toHaveLength(1);

    s1.serverClose(1006, 'abnormal');
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    s2.serverOpen();
    // The same send is re-emitted with the SAME clientMessageId (the DO dedups).
    const resent = s2.sent.find((f) => f.type === 'send');
    expect(resent?.payload).toMatchObject({ clientMessageId: 'c-1', text: 'hello?' });
    // The optimistic bubble is still present (not a ghost yet — it's being retried).
    expect(client.getState().messages.some((m) => m.meta?.clientMessageId === 'c-1' && m.meta?.optimistic)).toBe(true);
  });

  it('stops resending once the send is acked', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });
    s1.serverFrame('ack', { clientMessageId: 'c-1', seq: 7 });

    s1.serverClose(1006, 'abnormal');
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    s2.serverOpen();
    // No resend — the ack cleared the pending send.
    expect(s2.sent.some((f) => f.type === 'send')).toBe(false);
  });

  it('stops resending once the canonical message echo carries the clientMessageId', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });
    // The sender's own broadcast (no separate ack) reconciles the echo.
    s1.serverFrame('message', { message: wireRow(7, 'u-me', 'hi', 'c-1') });

    s1.serverClose(1006, 'abnormal');
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    s2.serverOpen();
    expect(s2.sent.some((f) => f.type === 'send')).toBe(false);
  });

  it('flips a pending send to a visible failed state after the attempt cap', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    let sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'never acked' });

    // Reconnect repeatedly without ever acking → attempts accrue until the cap.
    for (let i = 0; i < MAX_PENDING_SEND_ATTEMPTS + 1; i++) {
      sock.serverClose(1006, 'abnormal');
      clock.tick(2000);
      await Promise.resolve();
      sock = harness.last();
      sock.serverOpen();
    }

    const failed = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(failed?.meta?.sendFailed).toBe(true);
    expect(client.getState().lastErrorCode).toBe('send-failed');
  });

  it('flips a pending send to failed once it exceeds the age cap', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    client.send({ clientMessageId: 'c-old', text: 'stale' });

    s1.serverClose(1006, 'abnormal');
    // Advance well past PENDING_SEND_MAX_AGE_MS before the reconnect resumes.
    clock.tick(PENDING_SEND_MAX_AGE_MS + 5000);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    s2.serverOpen();
    const failed = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-old');
    expect(failed?.meta?.sendFailed).toBe(true);
  });

  it('does NOT auto-resend a failed send on later reconnects (retry is explicit)', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    let sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'never acked' });

    // Age it out → the next resume flips it to failed (no resend on that resume).
    sock.serverClose(1006, 'abnormal');
    clock.tick(PENDING_SEND_MAX_AGE_MS + 1000);
    await Promise.resolve();
    sock = harness.last();
    sock.serverOpen();
    expect(sock.sent.some((f) => f.type === 'send')).toBe(false);

    // A further reconnect still leaves the failed entry alone.
    sock.serverClose(1006, 'abnormal');
    clock.tick(2000);
    await Promise.resolve();
    sock = harness.last();
    sock.serverOpen();
    expect(sock.sent.some((f) => f.type === 'send')).toBe(false);
  });
});

describe('ChannelClient — retrySend (explicit retry, same clientMessageId)', () => {
  /** Drive a send into the failed state via the age cap; returns the live socket. */
  async function makeFailedSend() {
    const ctx = makeClient();
    await ctx.client.connect();
    let sock = ctx.harness.last();
    sock.serverOpen();
    ctx.client.send({ clientMessageId: 'c-1', text: 'hello?', replyTo: { messageSeq: 3, preview: 'orig' } });
    sock.serverClose(1006, 'abnormal');
    ctx.clock.tick(PENDING_SEND_MAX_AGE_MS + 1000);
    await Promise.resolve();
    sock = ctx.harness.last();
    sock.serverOpen();
    const failedRow = ctx.client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(failedRow?.meta?.sendFailed).toBe(true);
    return { ...ctx, sock };
  }

  it('re-sends with the SAME clientMessageId (and payload) and clears the failed marker', async () => {
    const { client, sock } = await makeFailedSend();

    expect(client.retrySend('c-1')).toBe(true);
    // The retry frame reuses the ORIGINAL clientMessageId + payload — the DO dedups.
    const resent = sock.sent.find((f) => f.type === 'send');
    expect(resent?.payload).toMatchObject({
      clientMessageId: 'c-1',
      text: 'hello?',
      replyTo: { messageSeq: 3, preview: 'orig' },
    });
    // The bubble is back to the normal pending look — every failure marker stripped
    // (sendFailed / sendFailureCode / sendRetryable), matching the ack reconcile path.
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBeFalsy();
    expect(row?.meta?.sendFailureCode).toBeUndefined();
    expect(row?.meta?.sendRetryable).toBeUndefined();
    expect(row?.meta?.optimistic).toBe(true);
    expect(client.getState().lastErrorCode).toBeNull();

    // The ack reconciles it as delivered, with no failed residue.
    sock.serverFrame('ack', { clientMessageId: 'c-1', seq: 42 });
    const acked = client.getState().messages.find((m) => m.messageId === '42');
    expect(acked?.meta?.optimistic).toBe(false);
    expect(acked?.meta?.sendFailed).toBeUndefined();
  });

  it('a retry over a dead socket re-queues for the next reconnect resume', async () => {
    const { client, harness, clock, sock } = await makeFailedSend();

    // Drop the socket, retry while offline — nothing sent yet, but re-queued.
    sock.serverClose(1006, 'abnormal');
    expect(client.retrySend('c-1')).toBe(true);

    clock.tick(2000);
    await Promise.resolve();
    const s2 = harness.last();
    s2.serverOpen();
    // The reconnect's automatic resend picks the retried entry back up.
    expect(s2.sent.find((f) => f.type === 'send')?.payload).toMatchObject({ clientMessageId: 'c-1' });
  });

  it('returns false for an unknown/already-acked clientMessageId', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });
    sock.serverFrame('ack', { clientMessageId: 'c-1', seq: 7 });

    expect(client.retrySend('c-1')).toBe(false); // acked — nothing pending
    expect(client.retrySend('c-unknown')).toBe(false);
  });
});

describe('ChannelClient — history-page reconciles optimistic placeholders (no duplicate)', () => {
  it('drops an optimistic row when a history page returns its server counterpart (resync + lost re-ack)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('message', { message: wireRow(3, 'u-a', 'three') });
    client.send({ clientMessageId: 'c-1', text: 'mine' });

    // Resync: local tail drops, the optimistic row survives (kept deliberately).
    s1.serverFrame('snapshot', { lastMessageSeq: 900, readSeq: 0, resync: true, delta: [] });
    expect(client.getState().messages.map((m) => m.messageId)).toEqual(['optimistic:c-1']);

    // The re-page returns the server-stored copy of that very send (the DO stored it;
    // the ack — including the resend's re-ack — was lost). ONE row must remain.
    s1.serverFrame('history-page', {
      messages: [wireRow(899, 'u-a', 'context'), wireRow(900, 'u-me', 'mine', 'c-1')],
    });
    const ids = client.getState().messages.map((m) => m.messageId);
    expect(ids).toEqual(['899', '900']);
    expect(ids).not.toContain('optimistic:c-1');
    const mine = client.getState().messages.find((m) => m.messageId === '900');
    expect(mine?.meta?.optimistic).toBeUndefined();
  });

  it('after the history-page reconcile, a reconnect does not resend the landed message', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'mine' });
    s1.serverFrame('history-page', { messages: [wireRow(10, 'u-me', 'mine', 'c-1')] });
    expect(client.getState().messages.map((m) => m.messageId)).toEqual(['10']);

    s1.serverClose(1006, 'abnormal');
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    s2.serverOpen();
    expect(s2.sent.some((f) => f.type === 'send')).toBe(false);
  });

  it('an unrelated optimistic row survives a history page untouched', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    client.send({ clientMessageId: 'c-other', text: 'still in flight' });
    s1.serverFrame('history-page', { messages: [wireRow(5, 'u-a', 'someone else', 'srv-5')] });
    const ids = client.getState().messages.map((m) => m.messageId);
    expect(ids).toEqual(['5', 'optimistic:c-other']);
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

describe('ChannelClient — membership-pending retry (send vs. membership-sync race)', () => {
  it('keeps the send pending (no visible error) and re-sends after retryAfterMs, delivered on the late ack', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();

    client.send({ clientMessageId: 'c-1', text: 'fast first message' });
    // The DO's member row hasn't synced yet → retryable error frame, socket stays open.
    sock.serverFrame('error', { code: 'membership-pending', retryAfterMs: 2000 });

    // NOT surfaced as an error — the optimistic bubble stays a normal "Sending…".
    expect(client.getState().lastErrorCode).toBeNull();
    expect(client.getState().status).toBe('open');
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBeUndefined();

    // No resend before the delay; one resend (same clientMessageId) after it.
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(1);
    clock.tick(2000);
    const sends = sock.sent.filter((f) => f.type === 'send');
    expect(sends).toHaveLength(2);
    expect(sends[1].payload).toMatchObject({ clientMessageId: 'c-1', text: 'fast first message' });

    // Membership landed — the ack reconciles the send as delivered.
    sock.serverFrame('ack', { clientMessageId: 'c-1', seq: 5 });
    const acked = client.getState().messages.find((m) => m.messageId === '5');
    expect(acked?.meta?.optimistic).toBe(false);
    expect(acked?.meta?.sendFailed).toBeUndefined();
  });

  it('retries legacy membership-pending past the 5-attempt cap, failing only on the 90s wall-clock budget', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'never syncs' });

    // Many membership-pending cycles — WELL past the old 5-attempt cap — must NOT
    // fail the bubble. The give-up is now the wall-clock budget, not the attempt cap
    // (rollout-compat: the legacy uncorrelated frame rides the same age budget).
    for (let i = 0; i < MAX_PENDING_SEND_ATTEMPTS + 4; i++) {
      sock.serverFrame('error', { code: 'membership-pending', retryAfterMs: 1000 });
      clock.tick(1000);
    }
    const stillPending = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(stillPending?.meta?.sendFailed).toBeFalsy();
    // > 5 resends went out — proof the attempt cap did not govern this path.
    expect(sock.sent.filter((f) => f.type === 'send').length).toBeGreaterThan(MAX_PENDING_SEND_ATTEMPTS);

    // Cross the 90s wall-clock budget → the next membership-pending resend fails it.
    clock.tick(SERVER_RETRYABLE_MAX_AGE_MS);
    sock.serverFrame('error', { code: 'membership-pending', retryAfterMs: 1000 });
    clock.tick(1000);
    const failed = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(failed?.meta?.sendFailed).toBe(true);
    // The socket was never closed — this is the retryable path end-to-end.
    expect(client.getState().status).toBe('open');
  });

  it('a membership-pending frame with no retryAfterMs falls back to the default delay', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hello' });
    sock.serverFrame('error', { code: 'membership-pending' });
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(1);
    clock.tick(2000); // MEMBERSHIP_PENDING_DEFAULT_RETRY_MS
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(2);
  });
});

describe('ChannelClient — correlated send-rejected (per-message send results)', () => {
  it('a terminal rejection for one pending send fails ONLY that send (two-send isolation)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'first' });
    client.send({ clientMessageId: 'c-2', text: 'second' });

    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'blocked-word', retryable: false });

    const r1 = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    const r2 = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-2');
    expect(r1?.meta?.sendFailed).toBe(true);
    expect(r1?.meta?.sendFailureCode).toBe('blocked-word');
    expect(r1?.meta?.sendRetryable).toBe(false);
    // The unrelated send is untouched — still an ordinary pending optimistic bubble.
    expect(r2?.meta?.sendFailed).toBeUndefined();
    expect(r2?.meta?.optimistic).toBe(true);
  });

  it('a retryable rejection for one pending send reschedules ONLY that send', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'first' });
    client.send({ clientMessageId: 'c-2', text: 'second' });

    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'membership-pending', retryable: true, retryAfterMs: 2000 });
    clock.tick(2000);

    // Exactly ONE resend went out and it was c-1 — c-2 was never touched.
    const sends = sock.sent.filter((f) => f.type === 'send');
    expect(sends).toHaveLength(3); // c-1, c-2, resent c-1
    expect(sends[2].payload).toMatchObject({ clientMessageId: 'c-1', text: 'first' });
  });

  it('a terminal rejection fails the matching bubble immediately and schedules no resend', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'blocked' });

    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'archived', retryable: false });
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBe(true);
    expect(row?.meta?.sendFailureCode).toBe('archived');
    expect(row?.meta?.sendRetryable).toBe(false);
    expect(client.getState().lastErrorCode).toBe('archived');

    // No resend is ever scheduled for a terminal rejection.
    const before = sock.sent.filter((f) => f.type === 'send').length;
    clock.tick(SERVER_RETRYABLE_MAX_AGE_MS + 5000);
    expect(sock.sent.filter((f) => f.type === 'send').length).toBe(before);
  });

  it('a retryable rejection resends the SAME clientMessageId after the server hint, delivered on the late ack', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'fast first message' });
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(1);

    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'membership-pending', retryable: true, retryAfterMs: 2000 });
    // Not surfaced as an error — the bubble stays a normal pending "Sending…".
    expect(client.getState().lastErrorCode).toBeNull();
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBeUndefined();

    // No resend before the hint; exactly one (same id) after it.
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(1);
    clock.tick(2000);
    const sends = sock.sent.filter((f) => f.type === 'send');
    expect(sends).toHaveLength(2);
    expect(sends[1].payload).toMatchObject({ clientMessageId: 'c-1', text: 'fast first message' });

    sock.serverFrame('ack', { clientMessageId: 'c-1', seq: 5 });
    const acked = client.getState().messages.find((m) => m.messageId === '5');
    expect(acked?.meta?.optimistic).toBe(false);
    expect(acked?.meta?.sendFailed).toBeUndefined();
  });

  it('repeated retryable rejections use the wall-clock cap, NOT the 5-attempt cap', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'never ready' });

    // Feed retryable rejections far past the 5-attempt cap; each fires a resend.
    for (let i = 0; i < MAX_PENDING_SEND_ATTEMPTS + 4; i++) {
      sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'membership-pending', retryable: true, retryAfterMs: 1000 });
      clock.tick(1000);
    }
    const stillPending = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(stillPending?.meta?.sendFailed).toBeFalsy();
    expect(sock.sent.filter((f) => f.type === 'send').length).toBeGreaterThan(MAX_PENDING_SEND_ATTEMPTS);

    // Once the 90s wall-clock budget elapses, the next rejection fails it (retryable class).
    clock.tick(SERVER_RETRYABLE_MAX_AGE_MS);
    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'membership-pending', retryable: true, retryAfterMs: 1000 });
    const failed = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(failed?.meta?.sendFailed).toBe(true);
    expect(failed?.meta?.sendRetryable).toBe(true);
    expect(failed?.meta?.sendFailureCode).toBe('membership-pending');
  });

  it('a late ack cancels the scheduled retry timer and reconciles the row', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hello' });

    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'membership-pending', retryable: true, retryAfterMs: 5000 });
    sock.serverFrame('ack', { clientMessageId: 'c-1', seq: 9 });
    const acked = client.getState().messages.find((m) => m.messageId === '9');
    expect(acked?.meta?.optimistic).toBe(false);
    expect(acked?.meta?.sendFailed).toBeUndefined();

    // The cancelled retry timer must not fire a resend after the ack.
    const before = sock.sent.filter((f) => f.type === 'send').length;
    clock.tick(10_000);
    expect(sock.sent.filter((f) => f.type === 'send').length).toBe(before);
  });

  it('a late echo still wins over a previously failed row (reconciles to delivered)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'mine' });

    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'blocked-word', retryable: false });
    expect(client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1')?.meta?.sendFailed).toBe(true);

    // The canonical echo carrying the same clientMessageId reconciles the failed row.
    sock.serverFrame('message', { message: wireRow(7, 'u-me', 'mine', 'c-1') });
    const ids = client.getState().messages.map((m) => m.messageId);
    expect(ids).toEqual(['7']);
    const merged = client.getState().messages.find((m) => m.messageId === '7');
    expect(merged?.meta?.optimistic).toBeUndefined();
    expect(merged?.meta?.sendFailed).toBeUndefined();
  });

  it('an UNPARSEABLE rejection naming one of OUR pending sends fails that send CLOSED (never strands it)', async () => {
    // Version skew: a server one deploy ahead rejects with a code this client's
    // closed enum doesn't know. The frame still names our send — swallowing it
    // would strand the bubble on "Sending…" forever (no further frame, no budget
    // check). Fail closed with the neutral code-less failure (Retry available).
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });

    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'brand-new-future-code', retryable: true });
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBe(true);
    expect(row?.meta?.sendFailureCode).toBeUndefined(); // neutral — we can't trust the unknown code
    expect(row?.meta?.sendRetryable).toBeUndefined(); // Retry affordance stays available
    expect(client.getState().lastErrorCode).toBe('send-failed');
  });

  it('a retryability MISMATCH on a known code also fails closed (schema refine rejects the frame)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });

    // blocked-word declared retryable contradicts the canonical table → unparseable
    // → the id-correlated send fails closed rather than stranding.
    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'blocked-word', retryable: true });
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBe(true);
    expect(row?.meta?.sendFailureCode).toBeUndefined();
  });

  it('a malformed rejection with NO recognizable pending id is dropped; unknown frame types ignored', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });

    // No id at all / an id that is not ours — forward-compat noise, no state change.
    sock.serverFrame('send-rejected', { code: 'not-a-real-code', retryable: true });
    sock.serverFrame('send-rejected', { clientMessageId: 'c-other', code: 'not-a-real-code', retryable: true });
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBeUndefined();
    expect(row?.meta?.optimistic).toBe(true);
    expect(client.getState().lastErrorCode).toBeNull();

    // A totally unknown frame type is ignored (forward compat).
    sock.serverFrame('brand-new-frame', { whatever: 1 });
    expect(client.getState().status).toBe('open');
  });

  it('clamps a pathological retryAfterMs hint to the max resend delay', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });

    // 600s hint (the schema's own max) must clamp to SEND_RETRY_MAX_DELAY_MS (30s).
    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'flood', retryable: true, retryAfterMs: 600_000 });
    clock.tick(SEND_RETRY_MAX_DELAY_MS);
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(2); // 1 original + 1 clamped resend
  });

  it('a terminal rejection after a scheduled retryable one CANCELS the pending retry timer', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });

    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'membership-pending', retryable: true, retryAfterMs: 5000 });
    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'blocked-word', retryable: false });
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBe(true);
    expect(row?.meta?.sendFailureCode).toBe('blocked-word');
    // The cancelled timer never fires a doomed resend.
    clock.tick(60_000);
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(1); // the original only
  });

  it('a reconnect resend SUPERSEDES a scheduled per-send retry timer (no duplicate resend)', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });
    s1.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'membership-pending', retryable: true, retryAfterMs: 5000 });

    // Socket drops before the 5s timer fires; the reconnect resume resends.
    s1.serverClose(1006, 'abnormal');
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    s2.serverOpen();
    expect(s2.sent.filter((f) => f.type === 'send')).toHaveLength(1); // reconnect resend
    // The pre-drop timer was cleared by the reconnect resend — advancing past its
    // deadline produces NO second frame.
    clock.tick(10_000);
    expect(s2.sent.filter((f) => f.type === 'send')).toHaveLength(1);
  });

  it('a manual retrySend cancels the scheduled per-send timer (no doubled resend)', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });
    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'membership-pending', retryable: true, retryAfterMs: 5000 });

    client.retrySend('c-1');
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(2); // original + manual retry
    clock.tick(60_000);
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(2); // old timer never fired
  });

  it('BUDGET BACKSTOP: a server that goes silent after a retryable rejection cannot hold "Sending…" past the budget', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });

    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'membership-pending', retryable: true, retryAfterMs: 2000 });
    clock.tick(2000); // the scheduled resend fires…
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(2);
    // …and the server (contract violation) never answers again. The deadline check
    // flips the send to failed at budget end instead of stranding it.
    clock.tick(SERVER_RETRYABLE_MAX_AGE_MS);
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBe(true);
    expect(row?.meta?.sendFailureCode).toBe('membership-pending');
    expect(row?.meta?.sendRetryable).toBe(true);
  });

  it('a rejection for an unknown/already-reconciled clientMessageId is a no-op', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });
    sock.serverFrame('ack', { clientMessageId: 'c-1', seq: 3 });

    // No pending send left for c-1, and c-unknown was never ours — neither surfaces anything.
    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'blocked-word', retryable: false });
    sock.serverFrame('send-rejected', { clientMessageId: 'c-unknown', code: 'archived', retryable: false });
    const acked = client.getState().messages.find((m) => m.messageId === '3');
    expect(acked?.meta?.sendFailed).toBeUndefined();
    expect(client.getState().status).toBe('open');
  });

  it('a repeated retryable rejection REPLACES (never stacks) the per-send retry timer', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });

    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'membership-pending', retryable: true, retryAfterMs: 5000 });
    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'membership-pending', retryable: true, retryAfterMs: 5000 });
    clock.tick(5000);
    // Exactly ONE resend — the second rejection cleared the first timer, not stacked it.
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(2); // 1 original + 1 resend
  });

  it('clears a scheduled per-send retry timer on close() (no resend after teardown)', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });
    sock.serverFrame('send-rejected', { clientMessageId: 'c-1', code: 'membership-pending', retryable: true, retryAfterMs: 5000 });

    client.close();
    const before = sock.sent.filter((f) => f.type === 'send').length;
    clock.tick(60_000);
    expect(sock.sent.filter((f) => f.type === 'send').length).toBe(before);
  });
});

describe('ChannelClient — terminal close flips pending sends to failed', () => {
  it('4403 REVOKED flips every un-acked pending send to the visible failed state', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'in flight' });
    client.send({ clientMessageId: 'c-2', text: 'also in flight' });

    s1.serverClose(CHAT_CLOSE_CODES.REVOKED, 'not authorized');

    expect(client.getState().status).toBe('closed');
    // 'revoked' stays the surfaced code (failPendingSend's 'send-failed' must not win).
    expect(client.getState().lastErrorCode).toBe('revoked');
    const rows = client.getState().messages.filter((m) => m.meta?.optimistic);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.meta?.sendFailed).toBe(true);
  });

  it('reconnect give-up (maxAttempts exhausted) flips pending sends to failed', async () => {
    // maxAttempts: 1 → the first abnormal close exhausts the budget (onClose
    // returns null) and the client lands terminally closed with no reconnect.
    const { client, harness } = makeClient({ reconnect: { maxAttempts: 1 } });
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'doomed' });

    sock.serverClose(1006, 'abnormal');

    expect(client.getState().status).toBe('closed');
    expect(harness.sockets).toHaveLength(1);
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBe(true);
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

describe('ChannelClient — hasLoadedInitialData (authoritative initial-load tracking)', () => {
  it('is false on a new client', () => {
    const { client } = makeClient();
    expect(client.getState().hasLoadedInitialData).toBe(false);
  });

  it('remains false while the socket is open but no snapshot has arrived', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    harness.last().serverOpen();
    expect(client.getState().status).toBe('open');
    // Socket `open` alone does NOT end initial loading — an authoritative snapshot/history must land.
    expect(client.getState().hasLoadedInitialData).toBe(false);
  });

  it('remains false after a failed first grant + reconnect (still initial loading)', async () => {
    const grant = vi.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValue('grant-ok');
    const { client, clock } = makeClient({ grantProvider: grant });
    await client.connect();
    expect(client.getState().hasLoadedInitialData).toBe(false);
    expect(client.getState().status).toBe('reconnecting');
    // The reconnect grant now resolves, but until a snapshot lands it stays initial-loading.
    clock.tick(200);
    await Promise.resolve();
    await Promise.resolve();
    expect(client.getState().hasLoadedInitialData).toBe(false);
  });

  it('ends initial loading on a non-resync snapshot (even an empty delta)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('snapshot', { lastMessageSeq: 0, readSeq: 0, resync: false, delta: [] });
    expect(client.getState().hasLoadedInitialData).toBe(true);
    // An empty non-resync snapshot is a real, loaded, empty chat — not inferred from length.
    expect(client.getState().messages).toHaveLength(0);
  });

  it('a resync snapshot does NOT end initial loading until the first history page', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    // Gap beyond backlog → resync directive: re-page requested, but nothing loaded yet.
    sock.serverFrame('snapshot', { lastMessageSeq: 900, readSeq: 0, resync: true, delta: [] });
    expect(client.getState().hasLoadedInitialData).toBe(false);
    // The first history page ends it.
    sock.serverFrame('history-page', { messages: [wireRow(1, 'u-a', 'one')] });
    expect(client.getState().hasLoadedInitialData).toBe(true);
  });

  it('an empty first history page ends initial loading (not inferred from messages.length === 0)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('snapshot', { lastMessageSeq: 0, readSeq: 0, resync: true });
    sock.serverFrame('history-page', { messages: [] });
    expect(client.getState().hasLoadedInitialData).toBe(true);
    expect(client.getState().messages).toHaveLength(0);
  });

  it('stays true and retains messages through a later reconnect (no return to opening)', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('snapshot', {
      lastMessageSeq: 2,
      readSeq: 0,
      resync: false,
      delta: [wireRow(1, 'u-a', 'one'), wireRow(2, 'u-b', 'two')],
    });
    expect(client.getState().hasLoadedInitialData).toBe(true);
    expect(client.getState().messages).toHaveLength(2);

    // Transient drop → reconnect. hasLoadedInitialData must NOT flip back to false.
    s1.serverClose(1006, 'abnormal');
    expect(client.getState().hasLoadedInitialData).toBe(true);
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    s2.serverOpen();
    // Still true through the reconnect open, before any new snapshot — messages stay mounted.
    expect(client.getState().hasLoadedInitialData).toBe(true);
    expect(client.getState().messages.map((m) => m.messageId)).toEqual(['1', '2']);
  });
});

describe('ChannelClient — terminal access denial (ChatAccessDeniedError)', () => {
  it('stops reconnecting, surfaces access-denied, and opens no socket', async () => {
    const grant = vi.fn().mockRejectedValue(new ChatAccessDeniedError());
    const { client, harness } = makeClient({ grantProvider: grant });
    await client.connect();
    expect(client.getState().status).toBe('closed');
    expect(client.getState().lastErrorCode).toBe('access-denied');
    // Denied at mint → no socket was ever built, and no reconnect is scheduled.
    expect(harness.sockets).toHaveLength(0);
    // The flag never flips → the shell shows its no-access surface, not an eternal loader.
    expect(client.getState().hasLoadedInitialData).toBe(false);
    expect(grant).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect after a terminal denial even as the clock advances', async () => {
    const grant = vi.fn().mockRejectedValue(new ChatAccessDeniedError());
    const { client, harness, clock } = makeClient({ grantProvider: grant });
    await client.connect();
    clock.tick(60_000);
    await Promise.resolve();
    expect(harness.sockets).toHaveLength(0);
    expect(grant).toHaveBeenCalledTimes(1);
  });

  it('fails pending optimistic sends when a re-grant is terminally denied', async () => {
    // First grant succeeds (socket opens, a send goes pending); the reconnect re-mint is
    // terminally denied → the pending send flips to the visible failed state.
    const grant = vi.fn().mockResolvedValueOnce('grant-1').mockRejectedValue(new ChatAccessDeniedError());
    const { client, harness, clock } = makeClient({ grantProvider: grant });
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'in flight' });

    s1.serverClose(1006, 'abnormal');
    clock.tick(200);
    await Promise.resolve();
    await Promise.resolve();

    expect(client.getState().status).toBe('closed');
    // 'access-denied' wins over failPendingSend's 'send-failed'.
    expect(client.getState().lastErrorCode).toBe('access-denied');
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBe(true);
    expect(harness.sockets).toHaveLength(1);
  });

  it('recognizes a duck-typed access-denial marker (cross-realm safe)', async () => {
    const grant = vi.fn().mockRejectedValue({ isChatAccessDenied: true });
    const { client } = makeClient({ grantProvider: grant });
    await client.connect();
    expect(client.getState().status).toBe('closed');
    expect(client.getState().lastErrorCode).toBe('access-denied');
  });

  it('a transient grant error still reconnects (not terminal)', async () => {
    const grant = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue('grant-ok');
    const { client, clock } = makeClient({ grantProvider: grant });
    await client.connect();
    expect(client.getState().status).toBe('reconnecting');
    expect(client.getState().lastErrorCode).not.toBe('access-denied');
    clock.tick(200);
    await Promise.resolve();
    await Promise.resolve();
    expect(grant).toHaveBeenCalledTimes(2);
  });
});
