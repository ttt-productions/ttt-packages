import { describe, it, expect } from 'vitest';
import * as chatSchemas from '../src/index.js';

describe('chat message schemas are text-only (files belong to the conversation, never a message)', () => {
  it('exports no chat-attachment schema, type helper, or constant', () => {
    const exported = Object.keys(chatSchemas);
    expect(exported).not.toContain('ChatAttachmentSchema');
    expect(exported).not.toContain('CHAT_ATTACHMENT_STALE_AGE_MS');
    expect(exported.filter((name) => /attachment/i.test(name))).toEqual([]);
  });

  it('exports no reply-to schema, type helper, or constant', () => {
    const exported = Object.keys(chatSchemas);
    expect(exported).not.toContain('ReplyToSchema');
    expect(exported).not.toContain('MAX_CHAT_REPLY_PREVIEW_LENGTH');
    expect(exported.filter((name) => /reply/i.test(name))).toEqual([]);
  });
});
