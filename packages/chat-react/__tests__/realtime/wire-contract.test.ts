import { describe, it, expect } from 'vitest';
import { type WireMessageRow } from '../../src/realtime/wire.js';
import { wireRowToMessage, optimisticMessage } from '../../src/realtime/map.js';

// Chat has NO reply-authoring affordance on any surface — MessageActions renders only
// Report/Delete and the Composer sends one argument — so reply-to is dead machinery and
// was removed end to end (DJ ruling 2026-07-29). These guard the removal at the two
// seams a regression would come back through: the mapper (a DO that still stores a
// legacy `replyTo` column must not resurrect a UI reply pointer) and the optimistic
// echo. See also channel-client.test.ts for the outbound send frame.
describe('reply-to is absent from the realtime message mapping', () => {
  it('ignores a legacy stringified replyTo column on a DO row', () => {
    const mapped = wireRowToMessage(
      {
        seq: 7,
        senderUid: 'u-a',
        clientMessageId: 'srv-7',
        text: 'hello',
        createdAt: 1007,
        epoch: 1,
        // A pre-removal DO still has the column and broadcasts it.
        replyTo: JSON.stringify({ messageSeq: 3, preview: 'earlier' }),
      } as unknown as WireMessageRow,
      't-1',
    );
    expect(mapped).not.toHaveProperty('replyTo');
    expect(mapped.text).toBe('hello');
  });

  it('builds an optimistic echo with no reply pointer', () => {
    const echo = optimisticMessage({
      clientMessageId: 'c-1',
      threadId: 't-1',
      senderId: 'u-a',
      text: 'hello',
      createdAt: 1000,
    });
    expect(echo).not.toHaveProperty('replyTo');
  });
});

describe('a server-written row names accounts beside its text', () => {
  it('maps a system row as a system message carrying its referenced account ids', () => {
    const mapped = wireRowToMessage(
      {
        seq: 3,
        senderUid: 'system',
        clientMessageId: 'cmd',
        text: 't',
        createdAt: 1,
        epoch: 1,
        referencedUids: ['u1'],
      },
      'thread',
    );
    expect(mapped.isSystemMessage).toBe(true);
    expect(mapped.referencedUids).toEqual(['u1']);
  });

  it('a member row is never a system message', () => {
    const mapped = wireRowToMessage(
      { seq: 4, senderUid: 'u2', clientMessageId: 'c', text: 't', createdAt: 1, epoch: 1 },
      'thread',
    );
    expect(mapped.isSystemMessage).toBeUndefined();
    expect(mapped.referencedUids).toBeUndefined();
  });
});
