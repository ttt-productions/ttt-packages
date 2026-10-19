import { describe, it, expect } from 'vitest';
import { ChannelClient } from '../../src/realtime/channel-client.js';
import { createMockSocketHarness, createFakeClock, type FakeClock } from './mock-socket.js';
import { ChatAccessDeniedError } from '../../src/realtime/shared.js';

// A channel is CURRENT (`isSynced`) only while its socket is open, its initial data has loaded,
// and its authoritative state has been re-applied since that socket opened. A consumer that lets
// someone act on what the conversation says waits for it; reading never does.

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function advance(clock: FakeClock, ms: number) {
  for (let t = 0; t < ms; t += 250) {
    clock.tick(Math.min(250, ms - t));
    await flush();
  }
}

function makeChannel() {
  const harness = createMockSocketHarness();
  const clock = createFakeClock();
  const client = new ChannelClient({
    endpoint: 'wss://chat.example',
    threadId: 't1',
    currentUserId: 'u-me',
    grantProvider: () => Promise.resolve('grant'),
    socketFactory: harness.factory,
    timers: clock,
    reconnect: { baseDelayMs: 1000, maxDelayMs: 2000, random: () => 0.99 },
  });
  return { client, harness, clock };
}

const row = (seq: number) => ({
  seq,
  senderUid: 'u-a',
  clientMessageId: `srv-${seq}`,
  text: `m${seq}`,
  createdAt: 1000 + seq,
  epoch: 1,
});

describe('ChannelClient — isSynced', () => {
  it('is not current before connecting, nor when the socket has only opened', async () => {
    const { client, harness } = makeChannel();
    expect(client.getState().isSynced).toBe(false);
    await client.connect();
    harness.last().serverOpen();
    expect(client.getState().status).toBe('open');
    expect(client.getState().isSynced).toBe(false);
  });

  it('a resume snapshot that is caught up makes it current — an empty conversation included', async () => {
    const { client, harness } = makeChannel();
    await client.connect();
    harness.last().serverOpen();
    harness
      .last()
      .serverFrame('snapshot', { lastMessageSeq: 0, readSeq: 0, resync: false, delta: [] });
    expect(client.getState().messages).toEqual([]);
    expect(client.getState().isSynced).toBe(true);
  });

  it('a resync is current only once the re-paged history arrives — an empty first page included', async () => {
    const { client, harness } = makeChannel();
    await client.connect();
    harness.last().serverOpen();
    harness.last().serverFrame('snapshot', { lastMessageSeq: 0, readSeq: 0, resync: true });
    expect(client.getState().isSynced).toBe(false);
    harness.last().serverFrame('history-page', { messages: [] });
    expect(client.getState().hasLoadedInitialData).toBe(true);
    expect(client.getState().isSynced).toBe(true);
  });

  it('a disconnect makes it not current, and a reconnect stays not current until its resume lands', async () => {
    const { client, harness, clock } = makeChannel();
    await client.connect();
    harness.last().serverOpen();
    harness
      .last()
      .serverFrame('snapshot', { lastMessageSeq: 3, readSeq: 0, resync: false, delta: [row(3)] });
    expect(client.getState().isSynced).toBe(true);

    harness.last().serverClose(1006, 'drop');
    expect(client.getState().isSynced).toBe(false);
    expect(client.getState().hasLoadedInitialData).toBe(true);

    await advance(clock, 2500);
    const next = harness.last();
    next.serverOpen();
    expect(client.getState().status).toBe('open');
    expect(client.getState().isSynced).toBe(false);

    next.serverFrame('snapshot', { lastMessageSeq: 3, readSeq: 0, resync: false, delta: [] });
    expect(client.getState().isSynced).toBe(true);
  });

  it('on a reconnect that resyncs, an older page answered first leaves it not current until the re-page', async () => {
    const { client, harness, clock } = makeChannel();
    await client.connect();
    harness.last().serverOpen();
    harness
      .last()
      .serverFrame('snapshot', { lastMessageSeq: 9, readSeq: 0, resync: false, delta: [row(9)] });
    harness.last().serverClose(1006, 'drop');
    await advance(clock, 2500);
    const next = harness.last();
    next.serverOpen();
    client.fetchOlder(); // sent before the resume answers: its page is answered first
    next.serverFrame('snapshot', { lastMessageSeq: 9, readSeq: 0, resync: true });
    next.serverFrame('history-page', { messages: [row(1)] }); // the older page
    expect(client.getState().isSynced).toBe(false);
    next.serverFrame('history-page', { messages: [row(9)] }); // the re-page
    expect(client.getState().isSynced).toBe(true);
  });

  it('a terminal access denial is never current', async () => {
    const harness = createMockSocketHarness();
    const client = new ChannelClient({
      endpoint: 'wss://chat.example',
      threadId: 't1',
      currentUserId: 'u-me',
      grantProvider: () => Promise.reject(new ChatAccessDeniedError('no')),
      socketFactory: harness.factory,
      timers: createFakeClock(),
    });
    await client.connect();
    expect(client.getState().isSynced).toBe(false);
    expect(client.getState().lastErrorCode).toBe('access-denied');
  });
});
