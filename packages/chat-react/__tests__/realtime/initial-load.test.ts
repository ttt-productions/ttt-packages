import { describe, it, expect } from 'vitest';
import { ChannelClient } from '../../src/realtime/channel-client.js';
import { InboxClient } from '../../src/realtime/inbox-client.js';
import { CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS } from '../../src/realtime/shared.js';
import { createMockSocketHarness, createFakeClock, type FakeClock } from './mock-socket.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Let every due timer fire and every grant promise settle. */
async function advance(clock: FakeClock, ms: number) {
  const step = 250;
  for (let t = 0; t < ms; t += step) {
    clock.tick(Math.min(step, ms - t));
    await flush();
  }
}

type Grant = () => Promise<string>;
const failing: Grant = () => Promise.reject(new Error('unavailable'));

function makeChannel(grantProvider: Grant, reconnect: Record<string, unknown> = {}) {
  const harness = createMockSocketHarness();
  const clock = createFakeClock();
  const client = new ChannelClient({
    endpoint: 'wss://chat.example',
    threadId: 't1',
    currentUserId: 'u-me',
    grantProvider,
    socketFactory: harness.factory,
    timers: clock,
    reconnect: { baseDelayMs: 1000, maxDelayMs: 2000, random: () => 0.99, ...reconnect },
  });
  return { client, harness, clock };
}

function makeInbox(grantProvider: Grant) {
  const harness = createMockSocketHarness();
  const clock = createFakeClock();
  const client = new InboxClient({
    endpoint: 'wss://chat.example',
    currentUserId: 'u-me',
    grantProvider,
    socketFactory: harness.factory,
    timers: clock,
    reconnect: { baseDelayMs: 1000, maxDelayMs: 2000, random: () => 0.99 },
  });
  return { client, harness, clock };
}

describe('a chat that cannot open the first time says so after the failure budget', () => {
  it('the budget is about fifteen seconds', () => {
    expect(CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS).toBe(15_000);
  });

  it('keeps opening while first attempts fail inside the budget, then reports the first open failed', async () => {
    const { client, clock } = makeChannel(failing);
    await client.connect();
    await advance(clock, CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS - 1000);
    expect(client.getState().initialLoadFailed).toBe(false);
    expect(client.getState().hasLoadedInitialData).toBe(false);
    await advance(clock, 2000);
    expect(client.getState().initialLoadFailed).toBe(true);
  });

  it('keeps retrying in the background after reporting, and the first data clears the failure', async () => {
    let fail = true;
    const { client, harness, clock } = makeChannel(() => (fail ? failing() : Promise.resolve('grant')));
    await client.connect();
    await advance(clock, CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS + 1000);
    expect(client.getState().initialLoadFailed).toBe(true);
    fail = false;
    await advance(clock, 3000);
    const sock = harness.last();
    expect(sock).toBeDefined();
    sock.serverOpen();
    sock.serverFrame('snapshot', { lastMessageSeq: 0, readSeq: 0, resync: false, delta: [] });
    expect(client.getState().hasLoadedInitialData).toBe(true);
    expect(client.getState().initialLoadFailed).toBe(false);
  });

  it('an unreachable socket counts as a failed attempt too', async () => {
    const { client, harness, clock } = makeChannel(() => Promise.resolve('grant'));
    await client.connect();
    for (let elapsed = 0; elapsed <= CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS + 2000; elapsed += 500) {
      const sock = harness.last();
      if (sock && !sock.closed) sock.serverClose(1006, 'unreachable');
      await advance(clock, 500);
    }
    expect(client.getState().initialLoadFailed).toBe(true);
  });

  it('Retry opens at once instead of waiting out the backoff, and shows opening again meanwhile', async () => {
    let fail = true;
    const { client, harness, clock } = makeChannel(() => (fail ? failing() : Promise.resolve('grant')), {
      baseDelayMs: 60_000,
      maxDelayMs: 60_000,
    });
    await client.connect();
    await advance(clock, CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS + 1000);
    expect(client.getState().initialLoadFailed).toBe(true);
    expect(harness.sockets).toHaveLength(0);
    fail = false;
    client.retryNow();
    expect(client.getState().initialLoadFailed).toBe(false);
    await flush();
    expect(harness.sockets).toHaveLength(1);
  });

  it('a retry that fails again is reported at once — the budget is already spent', async () => {
    const { client, clock } = makeChannel(failing, { baseDelayMs: 60_000, maxDelayMs: 60_000 });
    await client.connect();
    await advance(clock, CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS + 1000);
    client.retryNow();
    await flush();
    expect(client.getState().initialLoadFailed).toBe(true);
  });

  it('reconnect giving up before any data reports the failure at once', async () => {
    const { client, clock } = makeChannel(failing, { maxAttempts: 1 });
    await client.connect();
    await advance(clock, 10);
    expect(client.getState().status).toBe('closed');
    expect(client.getState().initialLoadFailed).toBe(true);
  });

  it('never reports a first-open failure after data loaded — a later outage keeps the messages', async () => {
    let fail = false;
    const { client, harness, clock } = makeChannel(() => (fail ? failing() : Promise.resolve('grant')));
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('history-page', { messages: [] });
    expect(client.getState().hasLoadedInitialData).toBe(true);
    fail = true;
    sock.serverClose(1006, 'drop');
    await advance(clock, CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS * 2);
    expect(client.getState().initialLoadFailed).toBe(false);
  });
});

describe('the inbox tells "not loaded" from "empty" and reports a failed first open', () => {
  it('has no initial data until the first snapshot, then has it for good', async () => {
    const { client, harness } = makeInbox(() => Promise.resolve('grant'));
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    expect(client.getState().hasLoadedInitialData).toBe(false);
    sock.serverFrame('snapshot', { registry: [], hasUnread: false });
    expect(client.getState().hasLoadedInitialData).toBe(true);
    sock.serverClose(1006, 'drop');
    expect(client.getState().hasLoadedInitialData).toBe(true);
  });

  it('reports the first open failed after the budget of failed attempts, and Retry clears it', async () => {
    let fail = true;
    const { client, harness, clock } = makeInbox(() => (fail ? failing() : Promise.resolve('grant')));
    await client.connect();
    await advance(clock, CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS + 1000);
    expect(client.getState().initialLoadFailed).toBe(true);
    fail = false;
    client.retryNow();
    expect(client.getState().initialLoadFailed).toBe(false);
    await flush();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('snapshot', { registry: [], hasUnread: false });
    expect(client.getState().hasLoadedInitialData).toBe(true);
    expect(client.getState().initialLoadFailed).toBe(false);
  });
});

describe('an older-history request that cannot be sent is not left in flight', () => {
  it('a fetch on a dropped socket ends at once, so the user can ask again', async () => {
    const { client, harness } = makeChannel(() => Promise.resolve('grant'));
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('history-page', {
      messages: Array.from({ length: 50 }, (_, i) => ({
        seq: i + 1,
        senderUid: 'x',
        clientMessageId: `c${i}`,
        text: 't',
        createdAt: i,
        epoch: 1,
      })),
    });
    sock.serverClose(1006, 'drop');
    client.fetchOlder();
    expect(client.getState().isFetchingOlder).toBe(false);
  });

  it('a request in flight when the socket drops is no longer reported as in flight', async () => {
    const { client, harness } = makeChannel(() => Promise.resolve('grant'));
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('history-page', {
      messages: Array.from({ length: 50 }, (_, i) => ({
        seq: i + 1,
        senderUid: 'x',
        clientMessageId: `c${i}`,
        text: 't',
        createdAt: i,
        epoch: 1,
      })),
    });
    client.fetchOlder();
    expect(client.getState().isFetchingOlder).toBe(true);
    sock.serverClose(1006, 'drop');
    expect(client.getState().isFetchingOlder).toBe(false);
  });
});

describe('a first attempt that hangs is reported at the budget too', () => {
  it('a grant mint that never answers', async () => {
    const { client, clock } = makeChannel(() => new Promise<string>(() => undefined));
    void client.connect();
    await advance(clock, CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS - 500);
    expect(client.getState().initialLoadFailed).toBe(false);
    await advance(clock, 1000);
    expect(client.getState().initialLoadFailed).toBe(true);
  });

  it('a socket that opens but never sends a snapshot', async () => {
    const { client, harness, clock } = makeInbox(() => Promise.resolve('grant'));
    await client.connect();
    harness.last().serverOpen();
    await advance(clock, CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS + 500);
    expect(client.getState().initialLoadFailed).toBe(true);
  });

  it('Retry while an attempt is in flight clears the failure, and a hang is reported again a full budget later', async () => {
    const { client, clock } = makeChannel(() => new Promise<string>(() => undefined));
    void client.connect();
    await advance(clock, CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS + 500);
    expect(client.getState().initialLoadFailed).toBe(true);
    client.retryNow();
    expect(client.getState().initialLoadFailed).toBe(false);
    await advance(clock, CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS - 500);
    expect(client.getState().initialLoadFailed).toBe(false);
    await advance(clock, 1000);
    expect(client.getState().initialLoadFailed).toBe(true);
  });
});
