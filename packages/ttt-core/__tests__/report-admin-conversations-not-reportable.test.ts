import { describe, it, expect } from 'vitest';
import {
  ReportableItemTypeSchema,
  TargetLocatorV1Schema,
  TargetLocatorKindSchema,
  CONTENT_ACTION_PANEL_ITEM_TYPES,
  CHAT_REPORT_ITEM_TYPES,
} from '../src/doc-schemas/safety/foundation.js';
import { ChatMessageV1Schema } from '../src/doc-schemas/messaging.js';
import {
  REPORTABLE_ITEM_LABELS,
  REPORT_ITEM_TYPE_MULTIPLIERS,
} from '../src/report/report-config-values.js';
import { ModerateReportedContentInputSchema } from '../src/schemas/admin.js';

describe('ReportableItemType — admin correspondence is not a reportable surface', () => {
  it('rejects an admin-work-message item type', () => {
    expect(ReportableItemTypeSchema.safeParse('admin-work-message').success).toBe(false);
    expect(ReportableItemTypeSchema.options).not.toContain('admin-work-message');
  });

  it('keeps the two DO-transported guild message surfaces reportable', () => {
    expect(ReportableItemTypeSchema.parse('guild-chat-message')).toBe('guild-chat-message');
    expect(ReportableItemTypeSchema.parse('guild-invite-message')).toBe('guild-invite-message');
    expect([...CHAT_REPORT_ITEM_TYPES]).toEqual(['guild-chat-message', 'guild-invite-message']);
  });

  it('carries no label or priority multiplier for it (both maps stay Record-complete)', () => {
    expect(Object.keys(REPORTABLE_ITEM_LABELS)).not.toContain('admin-work-message');
    expect(Object.keys(REPORT_ITEM_TYPE_MULTIPLIERS)).not.toContain('admin-work-message');
    for (const itemType of ReportableItemTypeSchema.options) {
      expect(typeof REPORTABLE_ITEM_LABELS[itemType]).toBe('string');
      expect(typeof REPORT_ITEM_TYPE_MULTIPLIERS[itemType]).toBe('number');
    }
  });
});

describe('admin correspondence has no content-action path', () => {
  it('is absent from the content-action panel item types', () => {
    expect([...CONTENT_ACTION_PANEL_ITEM_TYPES]).not.toContain('admin-work-message');
  });

  it('is rejected as a moderateReportedContent target', () => {
    expect(
      ModerateReportedContentInputSchema.safeParse({
        reportGroupId: 'rg-1',
        targetType: 'admin-work-message',
        reportedItemId: 'msg-1',
        action: 'hide',
        reason: 'test',
      }).success,
    ).toBe(false);
  });
});

describe('TargetLocatorV1 — there is no adminWorkMessage locator', () => {
  it('refuses a well-formed adminWorkMessage locator', () => {
    expect(
      TargetLocatorV1Schema.safeParse({
        kind: 'adminWorkMessage',
        adminDispatchId: 'dispatch-1',
        messageId: 'msg-abc',
      }).success,
    ).toBe(false);
  });

  it('leaves adminWorkMessage out of the locator-kind enum', () => {
    expect(TargetLocatorKindSchema.safeParse('adminWorkMessage').success).toBe(false);
    expect(TargetLocatorKindSchema.options).not.toContain('adminWorkMessage');
  });

  it('parses the guild message locators', () => {
    expect(
      TargetLocatorV1Schema.safeParse({
        kind: 'guildChatMessage',
        channelId: 'wp-1/chan-abc',
        messageId: 'msg-123',
      }).success,
    ).toBe(true);
    expect(
      TargetLocatorV1Schema.safeParse({
        kind: 'guildInviteMessage',
        channelId: 'invite-chan',
        messageId: 'msg-7',
      }).success,
    ).toBe(true);
  });
});

describe('ChatMessageV1Schema — there is no moderation tombstone flag', () => {
  const baseMessage = { senderId: 'user-1', text: 'hello', createdAt: 1000 };

  it('declares no hidden field', () => {
    expect(Object.keys(ChatMessageV1Schema.shape)).not.toContain('hidden');
  });

  it('strips a supplied hidden flag instead of persisting it', () => {
    const parsed = ChatMessageV1Schema.parse({ ...baseMessage, hidden: true });
    expect(parsed).not.toHaveProperty('hidden');
    expect(parsed).toEqual(baseMessage);
  });
});
