import { describe, it, expect } from 'vitest';
import { ChannelClient } from '../../src/realtime/channel-client.js';
import type { RevisionKind, WireMessageRow } from '../../src/realtime/wire.js';
import { MODERATION_REDACTED_TEXT } from '../../src/realtime/map.js';
import { createMockSocketHarness, createFakeClock } from './mock-socket.js';

function wireRow(
  seq: number,
  text: string,
  overlay?: { moderationKind: RevisionKind | null; messageRevision?: number },
): WireMessageRow {
  return {
    seq,
    senderUid: 'u-a',
    clientMessageId: `srv-${seq}`,
    text,
    replyTo: null,
    attachmentState: null,
    attachmentMeta: null,
    createdAt: 1000 + seq,
    epoch: 1,
    ...(overlay
      ? { moderationKind: overlay.moderationKind, messageRevision: overlay.messageRevision ?? 1 }
      : {}),
  };
}

function makeClient() {
  const harness = createMockSocketHarness();
  const clock = createFakeClock();
  const client = new ChannelClient({
    endpoint: 'wss://chat.example',
    threadId: 'wp1:ch1',
    currentUserId: 'u-me',
    grantProvider: () => Promise.resolve('grant-token-1'),
    socketFactory: harness.factory,
    timers: clock,
    reconnect: { baseDelayMs: 100, maxDelayMs: 1000, random: () => 0 },
  });
  return { client, harness, clock };
}

function byId(client: ChannelClient, messageId: string) {
  return client.getState().messages.find((m) => m.messageId === messageId);
}

describe('ChannelClient — moderation overlay (I1)', () => {
  it('blanks the original text for a history row that arrives with moderationKind set', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();

    // The DO history/delta merge stamps the effective overlay onto the row.
    sock.serverFrame('history-page', {
      messages: [
        wireRow(5, 'this is fine'),
        wireRow(6, 'SECRET ORIGINAL', { moderationKind: 'delete', messageRevision: 1 }),
        wireRow(7, 'hidden too', { moderationKind: 'moderate', messageRevision: 2 }),
      ],
    });

    const fine = byId(client, '5');
    const deleted = byId(client, '6');
    const hidden = byId(client, '7');

    expect(fine?.text).toBe('this is fine');
    expect(fine?.meta?.moderated).toBeUndefined();

    // The ORIGINAL text never renders for a deleted/hidden message.
    expect(deleted?.text).toBe(MODERATION_REDACTED_TEXT);
    expect(deleted?.text).not.toContain('SECRET ORIGINAL');
    expect(deleted?.meta?.moderated).toBe(true);
    expect(deleted?.meta?.moderationKind).toBe('delete');

    expect(hidden?.text).toBe(MODERATION_REDACTED_TEXT);
    expect(hidden?.meta?.moderated).toBe(true);
    expect(hidden?.meta?.moderationKind).toBe('moderate');
  });

  it('overlays an edited history row with the DO-provided text (not redacted)', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    // For `edit`, the DO rewrites `text` to the edited content; the client only marks it.
    sock.serverFrame('history-page', {
      messages: [wireRow(8, 'edited content', { moderationKind: 'edit', messageRevision: 1 })],
    });
    const edited = byId(client, '8');
    expect(edited?.text).toBe('edited content');
    expect(edited?.meta?.moderated).toBe(true);
    expect(edited?.meta?.moderationKind).toBe('edit');
  });

  it('applies a live revision frame to an already-rendered message in place', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();

    sock.serverFrame('message', { message: wireRow(10, 'ORIGINAL TEXT') });
    expect(byId(client, '10')?.text).toBe('ORIGINAL TEXT');
    expect(byId(client, '10')?.meta?.moderated).toBeUndefined();

    // Admin deletes it → the DO broadcasts a revision frame.
    sock.serverFrame('revision', { messageSeq: 10, kind: 'delete', messageRevision: 1 });
    const after = byId(client, '10');
    expect(after?.text).toBe(MODERATION_REDACTED_TEXT);
    expect(after?.text).not.toContain('ORIGINAL TEXT');
    expect(after?.meta?.moderated).toBe(true);
    expect(after?.meta?.moderationKind).toBe('delete');
  });

  it('applies a revision frame that arrives BEFORE its base message', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();

    // The revision races ahead of the message row.
    sock.serverFrame('revision', { messageSeq: 11, kind: 'moderate', messageRevision: 1 });
    expect(byId(client, '11')).toBeUndefined();

    // The base row finally arrives — the retained overlay must apply on render.
    sock.serverFrame('message', { message: wireRow(11, 'LATE ORIGINAL') });
    const row = byId(client, '11');
    expect(row?.text).toBe(MODERATION_REDACTED_TEXT);
    expect(row?.text).not.toContain('LATE ORIGINAL');
    expect(row?.meta?.moderated).toBe(true);
  });

  it('honors max-revision: a higher revision wins, a stale older one is ignored', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();
    sock.serverFrame('message', { message: wireRow(12, 'text') });

    // Delete at rev 1, then restore at rev 2 → restore (higher) wins.
    sock.serverFrame('revision', { messageSeq: 12, kind: 'delete', messageRevision: 1 });
    sock.serverFrame('revision', { messageSeq: 12, kind: 'restore', messageRevision: 2 });
    let row = byId(client, '12');
    expect(row?.meta?.moderationKind).toBe('restore');
    expect(row?.meta?.moderated).toBe(false);
    expect(row?.text).toBe('text');

    // A stale rev-1 delete frame arrives late → ignored (does not re-redact).
    sock.serverFrame('revision', { messageSeq: 12, kind: 'delete', messageRevision: 1 });
    row = byId(client, '12');
    expect(row?.meta?.moderationKind).toBe('restore');
    expect(row?.text).toBe('text');
  });

  it('merges a live frame over a lower-revision inline row overlay', async () => {
    const { client, harness } = makeClient();
    await client.connect();
    const sock = harness.last();
    sock.serverOpen();

    // Row arrives already deleted at rev 1 from the DO merge.
    sock.serverFrame('message', { message: wireRow(13, 'orig', { moderationKind: 'delete', messageRevision: 1 }) });
    expect(byId(client, '13')?.text).toBe(MODERATION_REDACTED_TEXT);

    // A later restore (rev 2) frame supersedes the inline rev-1 delete.
    sock.serverFrame('revision', { messageSeq: 13, kind: 'restore', messageRevision: 2 });
    const row = byId(client, '13');
    expect(row?.meta?.moderationKind).toBe('restore');
    expect(row?.meta?.moderated).toBe(false);
    expect(row?.text).toBe('orig');
  });
});
