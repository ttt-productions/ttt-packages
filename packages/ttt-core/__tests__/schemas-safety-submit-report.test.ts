import { describe, it, expect } from 'vitest';
import { SubmitReportInputSchema } from '../src/schemas/safety';
import { MAX_REPORT_TARGET_ID_LENGTH, MAX_REPORT_NARRATIVE_LENGTH } from '../src/constants/business';

const input = {
  itemType: 'square-streetz-post',
  reportedItemId: 'post-1',
  reason: 'Spam',
} as const;

describe('SubmitReportInputSchema', () => {
  it('accepts a report of one item with an optional comment', () => {
    expect(SubmitReportInputSchema.safeParse({ ...input, comment: 'looks wrong' }).success).toBe(true);
  });

  it('accepts a chat report: a numeric message sequence under a two-id channel reference', () => {
    const chat = {
      itemType: 'guild-chat-message',
      reportedItemId: '17',
      parentItemId: 'work-1/channel-2',
      reason: 'Spam',
      comment: 'Posted the same link ten times.',
    };
    expect(SubmitReportInputSchema.safeParse(chat).success).toBe(true);
  });

  it('refuses a target hint that is not shaped as the path it could become', () => {
    expect(SubmitReportInputSchema.safeParse({ ...input, reportedItemId: 'post/1' }).success).toBe(false);
    expect(SubmitReportInputSchema.safeParse({ ...input, reportedUserId: 'u/1' }).success).toBe(false);
    expect(SubmitReportInputSchema.safeParse({ ...input, parentItemId: 'a/b/c' }).success).toBe(false);
  });

  it('bounds every target hint', () => {
    const tooLong = 'a'.repeat(MAX_REPORT_TARGET_ID_LENGTH + 1);
    expect(SubmitReportInputSchema.safeParse({ ...input, reportedItemId: tooLong }).success).toBe(false);
    expect(SubmitReportInputSchema.safeParse({ ...input, parentItemId: tooLong }).success).toBe(false);
    expect(SubmitReportInputSchema.safeParse({ ...input, reportedUserId: tooLong }).success).toBe(false);
  });

  it('bounds the reporter narrative and refuses a reason outside the canonical set', () => {
    expect(
      SubmitReportInputSchema.safeParse({ ...input, narrative: 'a'.repeat(MAX_REPORT_NARRATIVE_LENGTH + 1) }).success,
    ).toBe(false);
    expect(SubmitReportInputSchema.safeParse({ ...input, reason: 'Not A Reason' }).success).toBe(false);
  });

  it('is strict', () => {
    expect(SubmitReportInputSchema.safeParse({ ...input, ownerUid: 'u1' }).success).toBe(false);
  });
});
