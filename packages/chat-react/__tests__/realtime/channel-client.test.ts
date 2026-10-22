import { describe, it, expect, vi, afterEach } from 'vitest';
import { CHAT_CLOSE_CODES, CHAT_SUBPROTOCOL, HEARTBEAT_MS } from '@ttt-productions/chat-schemas';
import { ChannelClient } from '../../src/realtime/channel-client.js';
import {
  CHAT_CLIENT_DIAGNOSTIC_EVENTS as DIAG,
  type ChatClientDiagnosticsOption,
} from '../../src/realtime/diagnostics.js';
import { type WireMessageRow } from '../../src/realtime/wire.js';
import {
  ChatAccessDeniedError,
  MAX_PENDING_SEND_ATTEMPTS,
  PENDING_SEND_MAX_AGE_MS,
  SERVER_RETRYABLE_MAX_AGE_MS,
  SEND_RETRY_MAX_DELAY_MS,
} from '../../src/realtime/shared.js';
import {
  createMockSocketHarness,
  createFakeClock,
  type FakeClock,
  type MockSocket,
} from './mock-socket.js';

// The channel DO auto-answers every heartbeat: a test holding a socket open across a long
// window must model that, or the dead-socket watchdog closes it.
function tickAlive(clock: FakeClock, sock: MockSocket, ms: number): void {
  let remaining = ms;
  while (remaining > 0) {
    const step = Math.min(remaining, HEARTBEAT_MS);
    clock.tick(step);
    remaining -= step;
    if (sock.isOpen) sock.serverFrame('heartbeat-ack', {});
  }
}

function wireRow(
  seq: number,
  senderUid: string,
  text: string,
  clientMessageId = `srv-${seq}`,
): WireMessageRow {
  return {
    seq,
    senderUid,
    clientMessageId,
    text,
    createdAt: 1000 + seq,
    epoch: 1,
  };
}

function makeClient(overrides?: {
  grantProvider?: () => Promise<string>;
  reconnect?: Record<string, unknown>;
  diagnostics?: ChatClientDiagnosticsOption;
}) {
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
    reconnect: {
      baseDelayMs: 100,
      maxDelayMs: 1000,
      random: () => 0,
      ...(overrides?.reconnect ?? {}),
    },
    ...(overrides?.diagnostics === undefined ? {} : { diagnostics: overrides.diagnostics }),
  });
  return { client, harness, clock, grantCalls };
}

describe('ChannelClient — connect + auth handshake', () => {
  it('offers the chat subprotocol + grant token and sends resume on open', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    expect(sock.grantToken).toBe('grant-token-1');
    expect(sock.url).toBe('wss://chat.example/channel');
    expect(client.getState().status).toBe('connecting');

    sock.serverOpen();
    expect(client.getState().status).toBe('open');
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
    let msgs = client.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].messageId).toBe('optimistic:c-1');
    expect(msgs[0].meta?.optimistic).toBe(true);
    expect(sock.sent.find((f) => f.type === 'send')?.payload).toMatchObject({
      clientMessageId: 'c-1',
      text: 'hello',
    });

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
    expect(sock.sent.find((f) => f.type === 'read-ack')?.payload).toEqual({
      readSeq: 17,
      focused: true,
    });
  });

  it('returns false when the socket is closed and re-sends the cursor on reconnect', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();

    s1.serverClose(1006, 'abnormal');
    expect(client.readAck(9, true)).toBe(false);

    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    expect(s2).toBeTruthy();
    s2.serverOpen();
    expect(s2.sent.find((f) => f.type === 'read-ack')?.payload).toEqual({
      readSeq: 9,
      focused: true,
    });
  });
});

describe('ChannelClient — typing coalescing (>= 2s)', () => {
  it('coalesces typing to at most one frame per TYPING_COALESCE_MS', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.typing();
    client.typing();
    expect(sock.sent.filter((f) => f.type === 'typing')).toHaveLength(1);
    clock.tick(2001);
    client.typing();
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

    sock.serverFrame('history-page', {
      messages: [wireRow(8, 'u-a', 'eight'), wireRow(9, 'u-b', 'nine')],
    });
    const st = client.getState();
    expect(st.isFetchingOlder).toBe(false);
    expect(st.hasOlder).toBe(false);
    expect(st.messages.map((m) => m.messageId)).toEqual(['8', '9', '10']);
  });
});

describe('ChannelClient — reconnect + resume (snapshot: delta / resync)', () => {
  it('reconnects after a transient close and resumes from the last applied seq', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('message', { message: wireRow(3, 'u-a', 'three') });
    expect(client.getState().messages.map((m) => m.messageId)).toEqual(['3']);

    s1.serverClose(1006, 'abnormal');
    expect(client.getState().status).toBe('reconnecting');
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    expect(s2).toBeTruthy();
    s2.serverOpen();
    expect(s2.sent.find((f) => f.type === 'resume')?.payload).toEqual({ afterSeq: 3 });

    s2.serverFrame('snapshot', {
      lastMessageSeq: 5,
      readSeq: 2,
      resync: false,
      delta: [wireRow(4, 'u-b', 'four'), wireRow(5, 'u-c', 'five')],
    });
    expect(s2.sent.some((f) => f.type === 'history')).toBe(false);
    expect(client.getState().messages.map((m) => m.messageId)).toEqual(['3', '4', '5']);
    expect((client as unknown as { resumeSeq: number }).resumeSeq).toBe(5);
  });

  it('applies a >50-message backlog delta with no permanent hole', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('message', { message: wireRow(10, 'u-a', 'old tail') });

    const delta = Array.from({ length: 120 }, (_, i) => wireRow(11 + i, 'u-b', `gap ${i}`));
    s1.serverFrame('snapshot', { lastMessageSeq: 130, readSeq: 0, resync: false, delta });

    const ids = client.getState().messages.map((m) => m.messageId);
    expect(ids).toHaveLength(121);
    expect(ids[0]).toBe('10');
    expect(ids[ids.length - 1]).toBe('130');
    expect(ids.includes('71')).toBe(true);
    expect(s1.sent.some((f) => f.type === 'history')).toBe(false);
  });

  it('applies a moderation revision baked into a delta row (hidden text never renders)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    const moderated: WireMessageRow = {
      ...wireRow(4, 'u-x', 'secret'),
      moderationKind: 'moderate',
      messageRevision: 2,
    };
    s1.serverFrame('snapshot', {
      lastMessageSeq: 4,
      readSeq: 0,
      resync: false,
      delta: [moderated],
    });
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

    s1.serverFrame('snapshot', { lastMessageSeq: 900, readSeq: 0, resync: true, delta: [] });
    expect(client.getState().messages).toHaveLength(0);
    expect((client as unknown as { resumeSeq: number }).resumeSeq).toBe(0);
    expect(s1.sent.filter((f) => f.type === 'history').at(-1)?.payload).toMatchObject({
      beforeSeq: null,
      limit: 50,
    });
  });

  it('treats a legacy snapshot (no resync/delta) as a resync re-page', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('message', { message: wireRow(3, 'u-a', 'three') });
    s1.serverFrame('snapshot', { lastMessageSeq: 5, readSeq: 2 });
    expect(client.getState().messages).toHaveLength(0);
    expect(s1.sent.filter((f) => f.type === 'history').at(-1)?.payload).toMatchObject({
      beforeSeq: null,
    });
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
    client.send({ clientMessageId: 'c-1', text: 'hello?' });
    expect(s1.sent.filter((f) => f.type === 'send')).toHaveLength(1);

    s1.serverClose(1006, 'abnormal');
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    s2.serverOpen();
    const resent = s2.sent.find((f) => f.type === 'send');
    expect(resent?.payload).toMatchObject({ clientMessageId: 'c-1', text: 'hello?' });
    expect(
      client
        .getState()
        .messages.some((m) => m.meta?.clientMessageId === 'c-1' && m.meta?.optimistic),
    ).toBe(true);
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
    expect(s2.sent.some((f) => f.type === 'send')).toBe(false);
  });

  it('stops resending once the canonical message echo carries the clientMessageId', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });
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

    sock.serverClose(1006, 'abnormal');
    clock.tick(PENDING_SEND_MAX_AGE_MS + 1000);
    await Promise.resolve();
    sock = harness.last();
    sock.serverOpen();
    expect(sock.sent.some((f) => f.type === 'send')).toBe(false);

    sock.serverClose(1006, 'abnormal');
    clock.tick(2000);
    await Promise.resolve();
    sock = harness.last();
    sock.serverOpen();
    expect(sock.sent.some((f) => f.type === 'send')).toBe(false);
  });
});

describe('ChannelClient — retrySend (explicit retry, same clientMessageId)', () => {
  async function makeFailedSend() {
    const ctx = makeClient();
    await ctx.client.connect();
    let sock = ctx.harness.last();
    sock.serverOpen();
    ctx.client.send({ clientMessageId: 'c-1', text: 'hello?' });
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
    const resent = sock.sent.find((f) => f.type === 'send');
    expect(resent?.payload).toMatchObject({
      clientMessageId: 'c-1',
      text: 'hello?',
    });
    expect(resent?.payload).not.toHaveProperty('replyTo');
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBeFalsy();
    expect(row?.meta?.sendFailureCode).toBeUndefined();
    expect(row?.meta?.sendRetryable).toBeUndefined();
    expect(row?.meta?.optimistic).toBe(true);
    expect(client.getState().lastErrorCode).toBeNull();

    sock.serverFrame('ack', { clientMessageId: 'c-1', seq: 42 });
    const acked = client.getState().messages.find((m) => m.messageId === '42');
    expect(acked?.meta?.optimistic).toBe(false);
    expect(acked?.meta?.sendFailed).toBeUndefined();
  });

  it('a retry over a dead socket re-queues for the next reconnect resume', async () => {
    const { client, harness, clock, sock } = await makeFailedSend();

    sock.serverClose(1006, 'abnormal');
    expect(client.retrySend('c-1')).toBe(true);

    clock.tick(2000);
    await Promise.resolve();
    const s2 = harness.last();
    s2.serverOpen();
    expect(s2.sent.find((f) => f.type === 'send')?.payload).toMatchObject({
      clientMessageId: 'c-1',
    });
  });

  it('returns false for an unknown/already-acked clientMessageId', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });
    sock.serverFrame('ack', { clientMessageId: 'c-1', seq: 7 });

    expect(client.retrySend('c-1')).toBe(false);
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

    s1.serverFrame('snapshot', { lastMessageSeq: 900, readSeq: 0, resync: true, delta: [] });
    expect(client.getState().messages.map((m) => m.messageId)).toEqual(['optimistic:c-1']);

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

    s1.serverClose(CHAT_CLOSE_CODES.AUTH_EXPIRED, 'grant expired');
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
    s2.serverClose(CHAT_CLOSE_CODES.AUTH_EXPIRED, 'expired again');
    expect(client.getState().status).toBe('reconnecting');
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
    sock.serverFrame('error', { code: 'membership-pending', retryAfterMs: 2000 });

    expect(client.getState().lastErrorCode).toBeNull();
    expect(client.getState().status).toBe('open');
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBeUndefined();

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

  it('retries legacy membership-pending past the 5-attempt cap, failing only on the 90s wall-clock budget', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'never syncs' });

    for (let i = 0; i < MAX_PENDING_SEND_ATTEMPTS + 4; i++) {
      sock.serverFrame('error', { code: 'membership-pending', retryAfterMs: 1000 });
      clock.tick(1000);
    }
    const stillPending = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(stillPending?.meta?.sendFailed).toBeFalsy();
    expect(sock.sent.filter((f) => f.type === 'send').length).toBeGreaterThan(
      MAX_PENDING_SEND_ATTEMPTS,
    );

    tickAlive(clock, sock, SERVER_RETRYABLE_MAX_AGE_MS);
    sock.serverFrame('error', { code: 'membership-pending', retryAfterMs: 1000 });
    clock.tick(1000);
    const failed = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(failed?.meta?.sendFailed).toBe(true);
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
    clock.tick(2000);
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

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'blocked-word',
      retryable: false,
    });

    const r1 = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    const r2 = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-2');
    expect(r1?.meta?.sendFailed).toBe(true);
    expect(r1?.meta?.sendFailureCode).toBe('blocked-word');
    expect(r1?.meta?.sendRetryable).toBe(false);
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

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'membership-pending',
      retryable: true,
      retryAfterMs: 2000,
    });
    clock.tick(2000);

    const sends = sock.sent.filter((f) => f.type === 'send');
    expect(sends).toHaveLength(3);
    expect(sends[2].payload).toMatchObject({ clientMessageId: 'c-1', text: 'first' });
  });

  it('a terminal rejection fails the matching bubble immediately and schedules no resend', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'blocked' });

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'archived',
      retryable: false,
    });
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBe(true);
    expect(row?.meta?.sendFailureCode).toBe('archived');
    expect(row?.meta?.sendRetryable).toBe(false);
    expect(client.getState().lastErrorCode).toBe('archived');

    const before = sock.sent.filter((f) => f.type === 'send').length;
    tickAlive(clock, sock, SERVER_RETRYABLE_MAX_AGE_MS + 5000);
    expect(sock.sent.filter((f) => f.type === 'send').length).toBe(before);
  });

  it('a retryable rejection resends the SAME clientMessageId after the server hint, delivered on the late ack', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'fast first message' });
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(1);

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'membership-pending',
      retryable: true,
      retryAfterMs: 2000,
    });
    expect(client.getState().lastErrorCode).toBeNull();
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBeUndefined();

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

    for (let i = 0; i < MAX_PENDING_SEND_ATTEMPTS + 4; i++) {
      sock.serverFrame('send-rejected', {
        clientMessageId: 'c-1',
        code: 'membership-pending',
        retryable: true,
        retryAfterMs: 1000,
      });
      clock.tick(1000);
    }
    const stillPending = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(stillPending?.meta?.sendFailed).toBeFalsy();
    expect(sock.sent.filter((f) => f.type === 'send').length).toBeGreaterThan(
      MAX_PENDING_SEND_ATTEMPTS,
    );

    tickAlive(clock, sock, SERVER_RETRYABLE_MAX_AGE_MS);
    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'membership-pending',
      retryable: true,
      retryAfterMs: 1000,
    });
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

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'membership-pending',
      retryable: true,
      retryAfterMs: 5000,
    });
    sock.serverFrame('ack', { clientMessageId: 'c-1', seq: 9 });
    const acked = client.getState().messages.find((m) => m.messageId === '9');
    expect(acked?.meta?.optimistic).toBe(false);
    expect(acked?.meta?.sendFailed).toBeUndefined();

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

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'blocked-word',
      retryable: false,
    });
    expect(
      client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1')?.meta?.sendFailed,
    ).toBe(true);

    sock.serverFrame('message', { message: wireRow(7, 'u-me', 'mine', 'c-1') });
    const ids = client.getState().messages.map((m) => m.messageId);
    expect(ids).toEqual(['7']);
    const merged = client.getState().messages.find((m) => m.messageId === '7');
    expect(merged?.meta?.optimistic).toBeUndefined();
    expect(merged?.meta?.sendFailed).toBeUndefined();
  });

  it('an UNPARSEABLE rejection naming one of OUR pending sends fails that send CLOSED (never strands it)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'brand-new-future-code',
      retryable: true,
    });
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBe(true);
    expect(row?.meta?.sendFailureCode).toBeUndefined();
    expect(row?.meta?.sendRetryable).toBeUndefined();
    expect(client.getState().lastErrorCode).toBe('send-failed');
  });

  it('a retryability MISMATCH on a known code also fails closed (schema refine rejects the frame)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'blocked-word',
      retryable: true,
    });
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

    sock.serverFrame('send-rejected', { code: 'not-a-real-code', retryable: true });
    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-other',
      code: 'not-a-real-code',
      retryable: true,
    });
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBeUndefined();
    expect(row?.meta?.optimistic).toBe(true);
    expect(client.getState().lastErrorCode).toBeNull();

    sock.serverFrame('brand-new-frame', { whatever: 1 });
    expect(client.getState().status).toBe('open');
  });

  it('clamps a pathological retryAfterMs hint to the max resend delay', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'flood',
      retryable: true,
      retryAfterMs: 600_000,
    });
    clock.tick(SEND_RETRY_MAX_DELAY_MS);
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(2);
  });

  it('a terminal rejection after a scheduled retryable one CANCELS the pending retry timer', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'membership-pending',
      retryable: true,
      retryAfterMs: 5000,
    });
    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'blocked-word',
      retryable: false,
    });
    const row = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-1');
    expect(row?.meta?.sendFailed).toBe(true);
    expect(row?.meta?.sendFailureCode).toBe('blocked-word');
    tickAlive(clock, sock, 60_000);
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(1);
  });

  it('a reconnect resend SUPERSEDES a scheduled per-send retry timer (no duplicate resend)', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });
    s1.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'membership-pending',
      retryable: true,
      retryAfterMs: 5000,
    });

    s1.serverClose(1006, 'abnormal');
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    s2.serverOpen();
    expect(s2.sent.filter((f) => f.type === 'send')).toHaveLength(1);
    clock.tick(10_000);
    expect(s2.sent.filter((f) => f.type === 'send')).toHaveLength(1);
  });

  it('a manual retrySend cancels the scheduled per-send timer (no doubled resend)', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });
    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'membership-pending',
      retryable: true,
      retryAfterMs: 5000,
    });

    client.retrySend('c-1');
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(2);
    tickAlive(clock, sock, 60_000);
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(2);
  });

  it('a server that goes silent after a retryable rejection cannot hold "Sending…" past the budget', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'membership-pending',
      retryable: true,
      retryAfterMs: 2000,
    });
    clock.tick(2000);
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(2);
    tickAlive(clock, sock, SERVER_RETRYABLE_MAX_AGE_MS);
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

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'blocked-word',
      retryable: false,
    });
    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-unknown',
      code: 'archived',
      retryable: false,
    });
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

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'membership-pending',
      retryable: true,
      retryAfterMs: 5000,
    });
    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'membership-pending',
      retryable: true,
      retryAfterMs: 5000,
    });
    clock.tick(5000);
    expect(sock.sent.filter((f) => f.type === 'send')).toHaveLength(2);
  });

  it('clears a scheduled per-send retry timer on close() (no resend after teardown)', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: 'hi' });
    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'membership-pending',
      retryable: true,
      retryAfterMs: 5000,
    });

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
    expect(client.getState().lastErrorCode).toBe('revoked');
    const rows = client.getState().messages.filter((m) => m.meta?.optimistic);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.meta?.sendFailed).toBe(true);
  });

  it('reconnect give-up (maxAttempts exhausted) flips pending sends to failed', async () => {
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
    const grant = vi
      .fn()
      .mockRejectedValueOnce(new Error('mint failed'))
      .mockResolvedValue('grant-ok');
    const { client, harness, clock } = makeClient({ grantProvider: grant });
    await client.connect();
    expect(harness.sockets).toHaveLength(0);
    expect(client.getState().status).toBe('reconnecting');
    clock.tick(200);
    await Promise.resolve();
    await Promise.resolve();
    expect(grant).toHaveBeenCalledTimes(2);
  });
});

describe('ChannelClient — send failure when the socket is closed', () => {
  it('returns false and renders no optimistic echo when the socket is not open', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const ok = client.send({ clientMessageId: 'c-x', text: 'lost?' });
    expect(ok).toBe(false);
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

describe('ChannelClient — connect() idempotency', () => {
  it('a second connect() while already connecting/open opens at most one socket', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    await client.connect();
    expect(harness.sockets).toHaveLength(1);
    harness.last().serverOpen();
    await client.connect();
    expect(harness.sockets).toHaveLength(1);
  });
});

describe('ChannelClient — connect() revives a closed lifecycle', () => {
  it('a transient close reports reconnecting and schedules a retry that opens a new socket', async () => {
    const { client, harness, clock } = makeClient();
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
    const { client, harness, clock } = makeClient();
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
    const { client, harness } = makeClient();
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
      .mockResolvedValue('grant-after-reinstate');
    const { client, harness } = makeClient({ grantProvider: grant });
    await client.connect();
    expect(client.getState().lastErrorCode).toBe('access-denied');
    expect(harness.sockets).toHaveLength(0);

    await client.connect();
    expect(client.getState().lastErrorCode).toBeNull();
    expect(grant).toHaveBeenCalledTimes(2);
    expect(harness.sockets).toHaveLength(1);
  });

  it('preserves loaded messages + hasLoadedInitialData across a lifecycle restart', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('snapshot', {
      lastMessageSeq: 3,
      readSeq: 0,
      resync: false,
      delta: [wireRow(3, 'u-a', 'three')],
    });
    expect(client.getState().messages.map((m) => m.messageId)).toEqual(['3']);

    client.close();
    await client.connect();
    expect(client.getState().messages.map((m) => m.messageId)).toEqual(['3']);
    expect(client.getState().hasLoadedInitialData).toBe(true);
  });

  it('4403 REVOKED stays terminal WITHIN the lifecycle (only an explicit connect() revives it)', async () => {
    const { client, harness, clock } = makeClient();
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

describe('ChannelClient — dead-socket watchdog', () => {
  it('repeated heartbeat-acks keep the socket open across several stale windows', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();

    tickAlive(clock, sock, 300_000);

    expect(client.getState().status).toBe('open');
    expect(sock.closed).toBe(false);
    expect(harness.sockets).toHaveLength(1);
    expect(sock.sent.filter((f) => f.type === 'heartbeat').length).toBeGreaterThanOrEqual(15);
  });

  it('total inbound silence closes the socket exactly ONCE and reconnects', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const s1 = harness.last();
    s1.serverOpen();
    s1.serverFrame('message', { message: wireRow(4, 'u-a', 'last thing we ever heard') });

    clock.tick(40_000);
    expect(client.getState().status).toBe('open');
    expect(s1.closed).toBe(false);

    clock.tick(20_000);
    expect(s1.closed).toBe(true);
    expect(client.getState().status).toBe('reconnecting');

    expect(harness.sockets).toHaveLength(1);

    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    expect(s2).toBeTruthy();
    s2.serverOpen();
    expect(client.getState().status).toBe('open');
    expect(s2.sent.find((f) => f.type === 'resume')?.payload).toEqual({ afterSeq: 4 });
  });

  it('ANY valid inbound frame refreshes the deadline (not just heartbeat-acks)', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();

    clock.tick(40_000);
    sock.serverFrame('message', { message: wireRow(1, 'u-a', 'still here') });
    clock.tick(40_000);
    expect(sock.closed).toBe(false);
    expect(client.getState().status).toBe('open');

    sock.serverFrame('brand-new-frame', {});
    clock.tick(40_000);
    expect(sock.closed).toBe(false);
    expect(client.getState().status).toBe('open');
  });

  it('an UNPARSEABLE frame does NOT refresh the deadline', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();

    clock.tick(40_000);
    sock.serverRaw('not json at all');
    clock.tick(20_000);
    expect(sock.closed).toBe(true);
    expect(client.getState().status).toBe('reconnecting');
  });

  it('teardown clears the watchdog: no close, no diagnostic, no reconnect afterwards', async () => {
    const entries: Array<{ event: string; data: Record<string, unknown> }> = [];
    const { client, harness, clock } = makeClient({
      diagnostics: (event, data) => entries.push({ event, data }),
    });
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();

    client.close();
    const afterClose = entries.length;
    clock.tick(300_000);
    await Promise.resolve();

    expect(entries).toHaveLength(afterClose);
    expect(harness.sockets).toHaveLength(1);
    expect(client.getState().status).toBe('closed');
  });

  it('emits exactly ONE bounded liveness diagnostic per detection (content-free)', async () => {
    const entries: Array<{ event: string; data: Record<string, unknown> }> = [];
    const { client, harness, clock } = makeClient({
      diagnostics: (event, data) => entries.push({ event, data }),
    });
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();

    clock.tick(60_000);
    const liveness = entries.filter((e) => e.event === DIAG.SOCKET_LIVENESS_TIMEOUT);
    expect(liveness).toHaveLength(1);
    expect(liveness[0].data).toMatchObject({
      thresholdMs: 50_000,
      attempt: 1,
      resumeSeq: 0,
      pendingSends: 0,
    });
    expect(liveness[0].data.silentMs).toBeGreaterThanOrEqual(50_000);
    expect(entries.some((e) => e.event === DIAG.SOCKET_CLOSE)).toBe(true);
    expect(entries.some((e) => e.event === DIAG.RECONNECT_SCHEDULED)).toBe(true);
    const after = entries.filter((e) => e.event === DIAG.SOCKET_LIVENESS_TIMEOUT).length;
    clock.tick(300_000);
    expect(entries.filter((e) => e.event === DIAG.SOCKET_LIVENESS_TIMEOUT)).toHaveLength(after);
    expect(client.getState().status).not.toBe('open');
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
    expect(client.getState().hasLoadedInitialData).toBe(false);
  });

  it('remains false after a failed first grant + reconnect (still initial loading)', async () => {
    const grant = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('grant-ok');
    const { client, clock } = makeClient({ grantProvider: grant });
    await client.connect();
    expect(client.getState().hasLoadedInitialData).toBe(false);
    expect(client.getState().status).toBe('reconnecting');
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
    expect(client.getState().messages).toHaveLength(0);
  });

  it('a resync snapshot does NOT end initial loading until the first history page', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('snapshot', { lastMessageSeq: 900, readSeq: 0, resync: true, delta: [] });
    expect(client.getState().hasLoadedInitialData).toBe(false);
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

    s1.serverClose(1006, 'abnormal');
    expect(client.getState().hasLoadedInitialData).toBe(true);
    clock.tick(200);
    await Promise.resolve();
    const s2 = harness.sockets[1];
    s2.serverOpen();
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
    expect(harness.sockets).toHaveLength(0);
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
    const grant = vi
      .fn()
      .mockResolvedValueOnce('grant-1')
      .mockRejectedValue(new ChatAccessDeniedError());
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
    const grant = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue('grant-ok');
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

function reBroadcastRow(seq: number, moderated: boolean): WireMessageRow {
  const base = wireRow(seq, 'u-me', 'body-that-must-never-be-logged', `rb-${seq}`);
  return moderated ? { ...base, moderationKind: 'moderate', messageRevision: 2 } : base;
}

const SECRET_TEXT = 'super-secret-message-body';

async function runScenario(diagnostics?: ChatClientDiagnosticsOption) {
  const ctx = makeClient(diagnostics === undefined ? undefined : { diagnostics });
  const { client, harness, clock } = ctx;
  await client.connect();
  let sock = harness.last();
  sock.serverOpen();
  sock.serverFrame('snapshot', {
    lastMessageSeq: 2,
    readSeq: 1,
    resync: false,
    delta: [wireRow(1, 'u-a', 'one'), wireRow(2, 'u-b', 'two')],
  });
  client.send({ clientMessageId: 'c-1', text: SECRET_TEXT });
  sock.serverFrame('ack', { clientMessageId: 'c-1', seq: 3 });
  sock.serverFrame('message', { message: reBroadcastRow(4, false) });
  sock.serverFrame('message', { message: reBroadcastRow(4, true) });
  sock.serverFrame('revision', { messageSeq: 1, kind: 'moderate', messageRevision: 2 });
  clock.tick(20_000);
  sock.serverClose(1006, 'abnormal');
  clock.tick(200);
  await Promise.resolve();
  sock = harness.last();
  sock.serverOpen();
  sock.serverFrame('snapshot', { lastMessageSeq: 4, readSeq: 3, resync: true, delta: [] });
  sock.serverFrame('history-page', {
    messages: [wireRow(1, 'u-a', 'one'), reBroadcastRow(4, true)],
  });
  return ctx;
}

function allSentFrames(harness: { sockets: Array<{ sent: unknown[] }> }): string {
  return JSON.stringify(harness.sockets.map((s) => s.sent));
}

describe('ChannelClient — diagnostics OFF (the default: zero behavior change, zero output)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes nothing to the console when the flag is absent', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await runScenario();
    expect(debug).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('writes nothing to the console when the flag is explicitly false', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    await runScenario(false);
    expect(debug).not.toHaveBeenCalled();
  });

  it('produces IDENTICAL state and IDENTICAL sent frames with the flag off vs. on', async () => {
    const off = await runScenario();
    const on = await runScenario(() => undefined);
    expect(JSON.stringify(on.client.getState())).toBe(JSON.stringify(off.client.getState()));
    expect(allSentFrames(on.harness)).toBe(allSentFrames(off.harness));
  });

  it('a THROWING sink never breaks the transport (diagnostics observe, never alter)', async () => {
    const off = await runScenario();
    const throwing = await runScenario(() => {
      throw new Error('sink exploded');
    });
    expect(JSON.stringify(throwing.client.getState())).toBe(JSON.stringify(off.client.getState()));
    expect(allSentFrames(throwing.harness)).toBe(allSentFrames(off.harness));
  });
});

describe('ChannelClient — diagnostics ON (structured decision log)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function runCaptured() {
    const entries: Array<{ event: string; data: Record<string, unknown> }> = [];
    const ctx = await runScenario((event, data) => entries.push({ event, data }));
    const of = (event: string) => entries.filter((e) => e.event === event).map((e) => e.data);
    return { ...ctx, entries, of };
  }

  it('records the resume cursor it SENT (chat_client_resume_request)', async () => {
    const { of } = await runCaptured();
    const requests = of(DIAG.RESUME_REQUEST);
    expect(requests.map((d) => d.afterSeq)).toEqual([0, 4]);
  });

  it('records the snapshot RESULT with the delta size and cursor movement', async () => {
    const { of } = await runCaptured();
    const results = of(DIAG.RESUME_RESULT);
    expect(results[0]).toMatchObject({
      lastMessageSeq: 2,
      resync: false,
      deltaCount: 2,
      cursorBefore: 0,
      cursorAfter: 2,
    });
    expect(results[1]).toMatchObject({
      lastMessageSeq: 4,
      resync: true,
      deltaCount: 0,
      cursorBefore: 4,
      cursorAfter: 0,
    });
    expect(of(DIAG.RESYNC_DROPPED_TAIL)[0]).toMatchObject({ removedCount: 4, keptOptimistic: 0 });
  });

  it('records what the UI APPLIED per live frame (insert vs. replace-by-seq)', async () => {
    const { of } = await runCaptured();
    const applied = of(DIAG.FRAME_APPLIED);
    const four = applied.filter((d) => d.seq === 4);
    expect(four).toHaveLength(2);
    expect(four[0]).toMatchObject({
      kind: 'message',
      source: 'live',
      op: 'insert',
      moderationKind: null,
    });
    expect(four[1]).toMatchObject({
      kind: 'message',
      source: 'live',
      op: 'replace-by-seq',
      moderationKind: 'moderate',
    });
    expect(applied.some((d) => d.source === 'delta')).toBe(false);
  });

  it('carries no attachment instrument (chat is text-only)', async () => {
    const { entries } = await runCaptured();
    expect(Object.keys(DIAG).filter((k) => /ATTACHMENT/.test(k))).toEqual([]);
    expect(JSON.stringify(entries)).not.toContain('attachment');
  });

  it('records the history page size, seq range, and cursor advance', async () => {
    const { of } = await runCaptured();
    expect(of(DIAG.HISTORY_REQUEST).at(-1)).toMatchObject({
      beforeSeq: null,
      limit: 50,
      sent: true,
    });
    expect(of(DIAG.HISTORY_PAGE)[0]).toMatchObject({
      count: 2,
      minSeq: 1,
      maxSeq: 4,
      cursorBefore: 0,
      cursorAfter: 4,
    });
  });

  it('records the send lifecycle (optimistic → ack) and the moderation revision', async () => {
    const { of } = await runCaptured();
    expect(of(DIAG.SEND_OPTIMISTIC)[0]).toMatchObject({ clientMessageId: 'c-1' });
    expect(of(DIAG.SEND_ACK)[0]).toMatchObject({
      clientMessageId: 'c-1',
      seq: 3,
      wasPending: true,
    });
    expect(of(DIAG.REVISION_APPLIED)[0]).toMatchObject({
      seq: 1,
      kind: 'moderate',
      messageRevision: 2,
      rendered: true,
    });
  });

  it('records the socket lifecycle with the reconnect cause and attempt number', async () => {
    const { of } = await runCaptured();
    expect(of(DIAG.CONNECT_ATTEMPT).map((d) => [d.attempt, d.cause])).toEqual([
      [1, 'initial'],
      [2, 'transient-close'],
    ]);
    expect(of(DIAG.SOCKET_OPEN).map((d) => d.attempt)).toEqual([1, 2]);
    expect(of(DIAG.SOCKET_CLOSE)[0]).toMatchObject({
      code: 1006,
      closedByUs: false,
      outcome: 'reconnect',
    });
    const scheduled = of(DIAG.RECONNECT_SCHEDULED)[0];
    expect(scheduled).toMatchObject({ cause: 'transient-close' });
    expect(typeof scheduled.delayMs).toBe('number');
  });

  it('records a send-rejected decision and the resulting failure', async () => {
    const entries: Array<{ event: string; data: Record<string, unknown> }> = [];
    const { client, harness } = makeClient({
      diagnostics: (event, data) => entries.push({ event, data }),
    });
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-1', text: SECRET_TEXT });
    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-1',
      code: 'blocked-word',
      retryable: false,
    });
    expect(entries.filter((e) => e.event === DIAG.SEND_REJECTED).map((e) => e.data)).toEqual([
      { clientMessageId: 'c-1', code: 'blocked-word', retryable: false, outcome: 'terminal' },
    ]);
    expect(entries.filter((e) => e.event === DIAG.SEND_FAILED)[0].data).toMatchObject({
      clientMessageId: 'c-1',
      code: 'blocked-word',
      retryable: false,
    });
  });

  it('records a DROPPED frame with its reason (never silently ignored)', async () => {
    const entries: Array<{ event: string; data: Record<string, unknown> }> = [];
    const { client, harness } = makeClient({
      diagnostics: (event, data) => entries.push({ event, data }),
    });
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('brand-new-frame', { whatever: 1 });
    sock.serverFrame('revision', { messageSeq: 5 });
    expect(entries.filter((e) => e.event === DIAG.FRAME_DROPPED).map((e) => e.data)).toEqual([
      { kind: 'brand-new-frame', reason: 'unknown-type' },
      { kind: 'revision', reason: 'malformed-payload' },
    ]);
  });

  it('emits NOTHING for heartbeats or repeated renders (bounded phase logging)', async () => {
    const entries: Array<{ event: string; data: Record<string, unknown> }> = [];
    const { client, harness, clock } = makeClient({
      diagnostics: (event, data) => entries.push({ event, data }),
    });
    await client.connect();
    harness.last().serverOpen();
    const afterOpen = entries.length;
    tickAlive(clock, harness.last(), 120_000);
    expect(harness.last().sent.filter((f) => f.type === 'heartbeat').length).toBeGreaterThanOrEqual(
      6,
    );
    expect(entries).toHaveLength(afterOpen);
  });

  it('a `heartbeat-ack` is an explicit no-op: no diagnostic line, no state change', async () => {
    const entries: Array<{ event: string; data: Record<string, unknown> }> = [];
    const { client, harness } = makeClient({
      diagnostics: (event, data) => entries.push({ event, data }),
    });
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('message', { message: wireRow(1, 'u-other', 'hello') });
    const afterOpen = entries.length;
    const stateBefore = JSON.stringify(client.getState());

    for (let i = 0; i < 5; i++) sock.serverFrame('heartbeat-ack', {});

    expect(entries).toHaveLength(afterOpen);
    expect(JSON.stringify(client.getState())).toBe(stateBefore);

    sock.serverFrame('some-future-frame', {});
    expect(entries.slice(afterOpen).map((e) => ({ event: e.event, data: e.data }))).toEqual([
      { event: DIAG.FRAME_DROPPED, data: { kind: 'some-future-frame', reason: 'unknown-type' } },
    ]);
  });

  it('NEVER logs message text, captions, or any other user content', async () => {
    const { entries } = await runCaptured();
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain(SECRET_TEXT);
    expect(serialized).not.toContain('body-that-must-never-be-logged');
    expect(serialized).not.toContain('grant-token');
  });

  it('the `true` shorthand emits ONE parseable console.debug line per decision', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    await runScenario(true);
    expect(debug.mock.calls.length).toBeGreaterThan(0);
    for (const call of debug.mock.calls) {
      expect(call).toHaveLength(1);
      const line = String(call[0]);
      expect(line).not.toContain('\n');
      const [event, ...rest] = line.split(' ');
      expect(event.startsWith('chat_client_')).toBe(true);
      expect(() => JSON.parse(rest.join(' ')) as unknown).not.toThrow();
    }
    const names = new Set(debug.mock.calls.map((c) => String(c[0]).split(' ')[0]));
    const declared = new Set<string>(Object.values(DIAG));
    for (const name of names) expect(declared.has(name)).toBe(true);
  });
});

describe('ChannelClient — an over-bound text is rejected by name, terminally', () => {
  it('fails exactly that bubble with the too-long reason and offers no retry', async () => {
    const { client, harness, clock } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    client.send({ clientMessageId: 'c-long', text: 'x' });
    client.send({ clientMessageId: 'c-ok', text: 'fine' });

    sock.serverFrame('send-rejected', {
      clientMessageId: 'c-long',
      code: 'too-long',
      retryable: false,
    });

    const long = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-long');
    const ok = client.getState().messages.find((m) => m.meta?.clientMessageId === 'c-ok');
    expect(long?.meta?.sendFailed).toBe(true);
    expect(long?.meta?.sendFailureCode).toBe('too-long');
    expect(long?.meta?.sendRetryable).toBe(false);
    expect(ok?.meta?.sendFailed).toBeUndefined();
    const sendsBefore = sock.sent.filter((f) => f.type === 'send').length;
    tickAlive(clock, sock, 120_000);
    expect(sock.sent.filter((f) => f.type === 'send').length).toBe(sendsBefore);
  });
});
