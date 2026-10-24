import { describe, it, expect } from 'vitest';
import { wireRowToMessage, optimisticMessage } from '../../src/realtime/map.js';

describe('reply-to is absent from the realtime message mapping', () => {
  it('ignores a legacy stringified replyTo column on a DO row', () => {
    const legacyRow = {
      seq: 7,
      senderUid: 'u-a',
      clientMessageId: 'srv-7',
      text: 'hello',
      createdAt: 1007,
      epoch: 1,
      replyTo: JSON.stringify({ messageSeq: 3, preview: 'earlier' }),
    };
    const mapped = wireRowToMessage(legacyRow, 't-1');
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
