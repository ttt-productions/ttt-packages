import { describe, it, expect } from 'vitest';
import {
  APP_MODE_FLIP_EVIDENCE_INPUT,
  CLOSE_UNDER_13_REASON_INPUT,
  MAX_INTERNAL_REASON_LENGTH,
  MAX_UNDER_13_CLOSE_REASON_LENGTH,
} from '../src/index';
import * as constantsBarrel from '../src/constants/index';
import { RecordAppModeFlipInputSchema, RecordAppModeFlipResultSchema, textFieldSchema } from '../src/schemas/index';
import { APP_MODE, APP_MODES } from '../src/index';
import { AppModeMarkerSchema, AppModeSchema } from '../src/doc-schemas/index';

describe('app-mode flip milestone evidence', () => {
  it('is optional free text up to the internal reason length', () => {
    expect(APP_MODE_FLIP_EVIDENCE_INPUT).toMatchObject({ format: 'none', min: 0, max: MAX_INTERNAL_REASON_LENGTH });
    expect(MAX_INTERNAL_REASON_LENGTH).toBe(2000);
    expect(constantsBarrel.APP_MODE_FLIP_EVIDENCE_INPUT).toBe(APP_MODE_FLIP_EVIDENCE_INPUT);
  });

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
  it('is optional free text up to its own named length', () => {
    expect(CLOSE_UNDER_13_REASON_INPUT).toMatchObject({ format: 'none', min: 0, max: MAX_UNDER_13_CLOSE_REASON_LENGTH });
    expect(MAX_UNDER_13_CLOSE_REASON_LENGTH).toBe(1000);
    expect(constantsBarrel.CLOSE_UNDER_13_REASON_INPUT).toBe(CLOSE_UNDER_13_REASON_INPUT);
  });

  it('as a nullish callable field it accepts null, blank, and the cap, trims, and refuses one more', () => {
    const reason = textFieldSchema(CLOSE_UNDER_13_REASON_INPUT).nullish();
    expect(reason.parse(null)).toBeNull();
    expect(reason.parse(undefined)).toBeUndefined();
    expect(reason.parse('   ')).toBe('');
    expect(reason.parse(' confirmed age 11 ')).toBe('confirmed age 11');
    expect(reason.safeParse('a'.repeat(MAX_UNDER_13_CLOSE_REASON_LENGTH)).success).toBe(true);
    const over = reason.safeParse('a'.repeat(MAX_UNDER_13_CLOSE_REASON_LENGTH + 1));
    expect(over.success).toBe(false);
    expect(over.error?.issues[0]?.message).toBe(`Reason can be at most ${MAX_UNDER_13_CLOSE_REASON_LENGTH} characters.`);
  });
});
