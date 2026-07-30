import { describe, it, expect } from 'vitest';
import * as chatSchemas from '../src/index.js';

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

  it('exports no reply-to schema, type helper, or constant', () => {
    // No chat surface has an authoring affordance for replying to a specific
    // message (chat-react's MessageActions renders only Report/Delete; the
    // composer's onSend takes text alone), so a reply pointer could never be
    // populated by a user action. The machinery was removed rather than left
    // dormant (DJ ruling 2026-07-29) — a re-introduced reply export is the
    // regression this asserts against.
    const exported = Object.keys(chatSchemas);
    expect(exported).not.toContain('ReplyToSchema');
    expect(exported).not.toContain('MAX_CHAT_REPLY_PREVIEW_LENGTH');
    expect(exported.filter((name) => /reply/i.test(name))).toEqual([]);
  });
});
