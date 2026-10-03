import { describe, it, expect } from 'vitest';
import { InboxClient, type ChatMarkReadOutcome } from '../../src/realtime/inbox-client.js';
import { createMockSocketHarness, createFakeClock } from './mock-socket.js';

async function openInbox() {
  const harness = createMockSocketHarness();
  const clock = createFakeClock();
  const client = new InboxClient({
    endpoint: 'wss://chat.example',
    currentUserId: 'u-me',
    grantProvider: () => Promise.resolve('grant'),
    socketFactory: harness.factory,
    timers: clock,
    reconnect: { baseDelayMs: 100, maxDelayMs: 1000, random: () => 0 },
  });
  await client.connect();
  const sock = harness.last();
  sock.serverOpen();
  sock.serverFrame('snapshot', {
    registry: [
      { channelRef: 'c1', kind: 'k', state: 'active', registryVersion: 1, unread: true },
      { channelRef: 'c2', kind: 'k', state: 'active', registryVersion: 1, unread: true },
    ],
    hasUnread: true,
  });
  const requestIdOf = (channelRef: string) =>
    sock.sent.find((f) => f.type === 'mark-read' && f.payload.channelRef === channelRef)?.payload.requestId as string;
  return { client, sock, requestIdOf };
}

/** Records when a promise settles, so a test can prove it has NOT settled yet. */
function track(promise: Promise<ChatMarkReadOutcome>) {
  const box: { outcome?: ChatMarkReadOutcome } = {};
  void promise.then((outcome) => {
    box.outcome = outcome;
  });
  return box;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('a mark-read settles on its own correlated result', () => {
  it('stays pending until the result naming its request arrives — a snapshot is not the answer', async () => {
    const { client, sock, requestIdOf } = await openInbox();
    const result = track(client.markRead('c1'));
    sock.serverFrame('snapshot', { registry: [], hasUnread: false });
    await flush();
    expect(result.outcome).toBeUndefined();
    sock.serverFrame('mark-read-result', { requestId: requestIdOf('c1'), ok: true });
    await flush();
    expect(result.outcome).toEqual({ ok: true });
  });

  it('reports the runtime refusal as a failure with its reason', async () => {
    const { client, sock, requestIdOf } = await openInbox();
    const pending = client.markRead('c1');
    sock.serverFrame('mark-read-result', { requestId: requestIdOf('c1'), ok: false, code: 'mark-read-failed' });
    await expect(pending).resolves.toEqual({ ok: false, code: 'mark-read-failed' });
  });

  it('Clear All: each row settles on its own result — one failure leaves the other cleared', async () => {
    const { client, sock, requestIdOf } = await openInbox();
    const first = client.markRead('c1');
    const second = client.markRead('c2');
    expect(requestIdOf('c1')).not.toBe(requestIdOf('c2'));
    sock.serverFrame('mark-read-result', { requestId: requestIdOf('c2'), ok: false, code: 'bad-mark-read' });
    sock.serverFrame('mark-read-result', { requestId: requestIdOf('c1'), ok: true });
    await expect(first).resolves.toEqual({ ok: true });
    await expect(second).resolves.toEqual({ ok: false, code: 'bad-mark-read' });
  });

  it('a result naming no pending request, or a malformed one, settles nothing', async () => {
    const { client, sock } = await openInbox();
    const result = track(client.markRead('c1'));
    sock.serverFrame('mark-read-result', { requestId: 'someone-else', ok: true });
    sock.serverFrame('mark-read-result', { ok: true });
    await flush();
    expect(result.outcome).toBeUndefined();
  });

  it('a socket that closes first leaves the outcome unknown — connection-lost, never success', async () => {
    const { client, sock } = await openInbox();
    const pending = client.markRead('c1');
    sock.serverClose(1006, 'drop');
    await expect(pending).resolves.toEqual({ ok: false, code: 'connection-lost' });
  });

  it('tearing the client down settles every pending mark-read as connection-lost', async () => {
    const { client } = await openInbox();
    const pending = client.markRead('c1');
    client.close();
    await expect(pending).resolves.toEqual({ ok: false, code: 'connection-lost' });
  });

  it('nothing on a closed socket is sent — not-sent, at once', async () => {
    const { client, sock } = await openInbox();
    sock.serverClose(1006, 'drop');
    await expect(client.markRead('c1')).resolves.toEqual({ ok: false, code: 'not-sent' });
  });
});
