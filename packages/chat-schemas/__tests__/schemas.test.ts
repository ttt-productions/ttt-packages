import { describe, it, expect } from 'vitest';
import * as chatSchemas from '../src/index.js';
import { ReplyToSchema } from '../src/index.js';

describe('chat message schemas are text-only (Conversation Files replaced attachments)', () => {
  it('exports no chat-attachment schema, type helper, or constant', () => {
    // Chat carries text; files belong to the conversation's Conversation Files
    // list (ttt-core), never to a message. A re-introduced attachment export is
    // the regression this asserts against.
    const exported = Object.keys(chatSchemas);
    expect(exported).not.toContain('ChatAttachmentSchema');
    expect(exported).not.toContain('CHAT_ATTACHMENT_STALE_AGE_MS');
    expect(exported.filter((name) => /attachment/i.test(name))).toEqual([]);
  });

  it('ReplyToSchema rejects an attachment field (a reply pointer is text metadata only)', () => {
    expect(() =>
      ReplyToSchema.parse({
        messageId: 'msg_1',
        senderId: 'user_1',
        messagePreview: 'Hello there',
        attachment: { id: 'att_1' },
      }),
    ).toThrow();
  });
});

describe('ReplyToSchema', () => {
  const valid = {
    messageId: 'msg_1',
    senderId: 'user_1',
    messagePreview: 'Hello there',
  };

  it('accepts a valid reply', () => {
    expect(() => ReplyToSchema.parse(valid)).not.toThrow();
  });

  it('accepts empty messagePreview', () => {
    expect(() => ReplyToSchema.parse({ ...valid, messagePreview: '' })).not.toThrow();
  });

  it('rejects empty messageId', () => {
    expect(() => ReplyToSchema.parse({ ...valid, messageId: '' })).toThrow();
  });

  it('rejects empty senderId', () => {
    expect(() => ReplyToSchema.parse({ ...valid, senderId: '' })).toThrow();
  });

  it('rejects extra unknown fields', () => {
    expect(() => ReplyToSchema.parse({ ...valid, extra: 'x' })).toThrow();
  });

  it('bounds messagePreview at MAX_CHAT_REPLY_PREVIEW_LENGTH', () => {
    const max = chatSchemas.MAX_CHAT_REPLY_PREVIEW_LENGTH;
    expect(() =>
      ReplyToSchema.parse({ ...valid, messagePreview: 'a'.repeat(max) }),
    ).not.toThrow();
    expect(() =>
      ReplyToSchema.parse({ ...valid, messagePreview: 'a'.repeat(max + 1) }),
    ).toThrow();
  });
});
