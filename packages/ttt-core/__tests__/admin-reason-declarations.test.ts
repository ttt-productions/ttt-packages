import { describe, it, expect } from 'vitest';
import { CLOSE_UNDER_13_REASON_INPUT } from '../src/constants/text-fields';
import {
  MAX_INTERNAL_REASON_LENGTH,
  MAX_UNDER_13_CLOSE_REASON_LENGTH,
} from '../src/constants/business-admin';
import { APP_MODE, APP_MODES } from '../src/constants/app-mode';
import { RecordAppModeFlipInputSchema, RecordAppModeFlipResultSchema } from '../src/schemas/admin';
import { textFieldSchema } from '../src/schemas/text-field';
import { AppModeMarkerSchema, AppModeSchema } from '../src/doc-schemas/system';

describe('app-mode flip milestone evidence', () => {

  it('the callable input takes only the evidence, trimmed, and may omit it', () => {
    expect(RecordAppModeFlipInputSchema.parse({})).toEqual({});
    expect(RecordAppModeFlipInputSchema.parse({ milestoneEvidence: '  1,000 pledges\nreached  ' })).toEqual({
      milestoneEvidence: '1,000 pledges\nreached',
    });
    expect(RecordAppModeFlipInputSchema.safeParse({ mode: 'full' }).success).toBe(false);
  });

  it('refuses evidence over the cap with the field\'s refusal', () => {
    const exact = 'a'.repeat(MAX_INTERNAL_REASON_LENGTH);
    expect(RecordAppModeFlipInputSchema.safeParse({ milestoneEvidence: exact }).success).toBe(true);
    const over = RecordAppModeFlipInputSchema.safeParse({ milestoneEvidence: `${exact}a` });
    expect(over.success).toBe(false);
    expect(over.error?.issues[0]?.message).toBe(`Milestone evidence can be at most ${MAX_INTERNAL_REASON_LENGTH} characters.`);
  });
});

describe('app-mode flip answer', () => {
  it('names the two modes once, and the deployed mode is one of them', () => {
    expect(APP_MODES).toEqual(['charter', 'full']);
    expect(APP_MODES).toContain(APP_MODE);
    expect(AppModeSchema.options).toEqual([...APP_MODES]);
    expect(AppModeMarkerSchema.safeParse({ current: 'trial', updatedAt: 1 }).success).toBe(false);
  });

  it('carries whether a change was recorded and the mode before and after', () => {
    const first = { success: true, recorded: true, mode: 'charter', previousMode: null };
    expect(RecordAppModeFlipResultSchema.parse(first)).toEqual(first);
    expect(RecordAppModeFlipResultSchema.safeParse({ ...first, previousMode: 'trial' }).success).toBe(false);
    expect(RecordAppModeFlipResultSchema.safeParse({ ...first, success: false }).success).toBe(false);
  });
});

describe('under-13 account close reason', () => {

  it('as a callable field it refuses a blank reason, trims, takes the cap, and refuses one more', () => {
    const reason = textFieldSchema(CLOSE_UNDER_13_REASON_INPUT);
    expect(reason.safeParse('   ').success).toBe(false);
    expect(reason.parse(' confirmed age 11 ')).toBe('confirmed age 11');
    expect(reason.safeParse('a'.repeat(MAX_UNDER_13_CLOSE_REASON_LENGTH)).success).toBe(true);
    const over = reason.safeParse('a'.repeat(MAX_UNDER_13_CLOSE_REASON_LENGTH + 1));
    expect(over.success).toBe(false);
    expect(over.error?.issues[0]?.message).toBe(`Reason can be at most ${MAX_UNDER_13_CLOSE_REASON_LENGTH} characters.`);
  });
});
