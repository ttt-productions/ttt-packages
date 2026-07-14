// Unit tests for the admin-work-message report additions (work-party admin
// correspondence moderation, DJ ruling 2026-07-13):
//   - `admin-work-message` ReportableItemType (foundation.ts)
//   - `adminWorkMessage` TargetLocatorV1 kind (foundation.ts)
//   - `hidden` moderation tombstone flag on the stored conversationMessage body
//     (messaging.ts ChatMessageV1Schema)

import { describe, it, expect } from 'vitest';
import {
  ReportableItemTypeSchema,
  TargetLocatorV1Schema,
  TargetLocatorKindSchema,
} from '../src/doc-schemas/safety/foundation';
import { ChatMessageV1Schema } from '../src/doc-schemas/messaging';

describe('ReportableItemType — admin-work-message', () => {
  it('accepts admin-work-message', () => {
    expect(ReportableItemTypeSchema.safeParse('admin-work-message').success).toBe(true);
  });

  it('still rejects an unknown item type', () => {
    expect(ReportableItemTypeSchema.safeParse('admin-user-message').success).toBe(false);
  });
});

describe('TargetLocatorV1 — adminWorkMessage', () => {
  it('accepts a valid adminWorkMessage locator', () => {
    const result = TargetLocatorV1Schema.safeParse({
      kind: 'adminWorkMessage',
      adminDispatchId: 'dispatch-1',
      messageId: 'msg-abc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects adminWorkMessage without adminDispatchId', () => {
    const result = TargetLocatorV1Schema.safeParse({
      kind: 'adminWorkMessage',
      messageId: 'msg-abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects adminWorkMessage without messageId', () => {
    const result = TargetLocatorV1Schema.safeParse({
      kind: 'adminWorkMessage',
      adminDispatchId: 'dispatch-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects adminWorkMessage with extra fields (.strict())', () => {
    const result = TargetLocatorV1Schema.safeParse({
      kind: 'adminWorkMessage',
      adminDispatchId: 'dispatch-1',
      messageId: 'msg-abc',
      channelId: 'should-not-be-here',
    });
    expect(result.success).toBe(false);
  });

  it('TargetLocatorKindSchema includes adminWorkMessage', () => {
    expect(TargetLocatorKindSchema.safeParse('adminWorkMessage').success).toBe(true);
  });
});

describe('ChatMessageV1Schema — hidden moderation flag', () => {
  const baseMessage = { senderId: 'user-1', text: 'hello', createdAt: 1000 };

  it('parses without hidden (absent ⇒ visible)', () => {
    const result = ChatMessageV1Schema.safeParse(baseMessage);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hidden).toBeUndefined();
  });

  it('parses with hidden: true', () => {
    const result = ChatMessageV1Schema.safeParse({ ...baseMessage, hidden: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hidden).toBe(true);
  });

  it('rejects a non-boolean hidden', () => {
    expect(ChatMessageV1Schema.safeParse({ ...baseMessage, hidden: 'yes' }).success).toBe(false);
  });
});
