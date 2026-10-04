import { describe, expect, it } from 'vitest';
import * as schemas from '../src/schemas/index';

// The answers of the two chat callables both trees read — the admin context read and the grant
// mint — are declared once here, so Functions and the app type the same shape (ARCH-101).
describe('adminReadChannelContext answer', () => {
  const message = {
    seq: 7,
    senderUid: 'u1',
    text: 'hello',
    createdAt: 1_700_000_000_000,
    moderationKind: null,
    moderationRevision: 0,
  };

  it('carries each message with its moderation overlay and revision', () => {
    const parsed = schemas.AdminReadChannelContextResultSchema.parse({
      messages: [message, { ...message, seq: 8, moderationKind: 'delete', moderationRevision: 2 }],
    });
    expect(parsed.messages.map((m) => [m.seq, m.moderationKind, m.moderationRevision])).toEqual([
      [7, null, 0],
      [8, 'delete', 2],
    ]);
  });

  it('keeps the account ids a system line names, so it renders by current name', () => {
    const parsed = schemas.ChatContextMessageSchema.parse({ ...message, referencedUids: ['u2'] });
    expect(parsed.referencedUids).toEqual(['u2']);
  });

  it('names its overlay only by a revision kind the room stores', () => {
    for (const moderationKind of ['moderate', 'edit', 'restore']) {
      expect(schemas.ChatContextMessageSchema.safeParse({ ...message, moderationKind }).success).toBe(true);
    }
    expect(schemas.ChatContextMessageSchema.safeParse({ ...message, moderationKind: 'hidden' }).success).toBe(false);
  });

  it('refuses a message without the revision a moderation action must name', () => {
    const { moderationRevision: _omitted, ...withoutRevision } = message;
    expect(schemas.ChatContextMessageSchema.safeParse(withoutRevision).success).toBe(false);
    expect(schemas.ChatContextMessageSchema.safeParse({ ...message, seq: -1 }).success).toBe(false);
  });
});

describe('mintChatGrant answer', () => {
  it('is the signed grant and the time it expires', () => {
    expect(schemas.MintChatGrantResultSchema.parse({ grant: 'g.t.s', expiresAt: 1_700_000_060_000 })).toEqual({
      grant: 'g.t.s',
      expiresAt: 1_700_000_060_000,
    });
  });

  it('refuses an empty grant', () => {
    expect(schemas.MintChatGrantResultSchema.safeParse({ grant: '', expiresAt: 1 }).success).toBe(false);
  });
});
