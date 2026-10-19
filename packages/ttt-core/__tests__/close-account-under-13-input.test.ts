import { describe, it, expect } from 'vitest';
import {
  CloseAccountUnder13InputSchema,
  CloseAccountUnder13OutcomeSchema,
  CloseAccountUnder13ResultSchema,
} from '../src/schemas/users.js';
import { MAX_UNDER_13_CLOSE_REASON_LENGTH } from '../src/constants/business-admin.js';

describe('close under-13 account input', () => {
  it('requires a reason: an absent, null, empty, or whitespace-only one is refused', () => {
    for (const reason of [undefined, null, '', '   ']) {
      expect(
        CloseAccountUnder13InputSchema.safeParse({ userId: 'target-uid', reason }).success,
        String(reason),
      ).toBe(false);
    }
  });

  it('keeps a given reason trimmed', () => {
    expect(
      CloseAccountUnder13InputSchema.parse({ userId: 'target-uid', reason: '  parent report  ' }),
    ).toEqual({
      userId: 'target-uid',
      reason: 'parent report',
    });
  });

  it('takes a reason up to the close reason length and no longer', () => {
    expect(
      CloseAccountUnder13InputSchema.safeParse({
        userId: 'u',
        reason: 'a'.repeat(MAX_UNDER_13_CLOSE_REASON_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      CloseAccountUnder13InputSchema.safeParse({
        userId: 'u',
        reason: 'a'.repeat(MAX_UNDER_13_CLOSE_REASON_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('requires the account, as one document id', () => {
    expect(CloseAccountUnder13InputSchema.safeParse({ reason: 'r' }).success).toBe(false);
    expect(CloseAccountUnder13InputSchema.safeParse({ userId: '', reason: 'r' }).success).toBe(
      false,
    );
    expect(CloseAccountUnder13InputSchema.safeParse({ userId: 'a/b', reason: 'r' }).success).toBe(
      false,
    );
  });

  it('never accepts a date of birth or any other field about the child', () => {
    expect(
      CloseAccountUnder13InputSchema.safeParse({
        userId: 'target-uid',
        reason: 'r',
        dob: { year: 2015, month: 1, day: 1 },
      }).success,
    ).toBe(false);
    expect(
      CloseAccountUnder13InputSchema.safeParse({ userId: 'target-uid', reason: 'r', age: 12 })
        .success,
    ).toBe(false);
  });
});

describe('close under-13 account answer', () => {
  it('names the outcome that happened: erased now, or parked behind a safety lock', () => {
    expect(CloseAccountUnder13OutcomeSchema.options).toEqual(['scrubbed', 'parked']);
    expect(CloseAccountUnder13ResultSchema.parse({ success: true, outcome: 'scrubbed' })).toEqual({
      success: true,
      outcome: 'scrubbed',
    });
    expect(CloseAccountUnder13ResultSchema.parse({ success: true, outcome: 'parked' })).toEqual({
      success: true,
      outcome: 'parked',
    });
  });

  it('never answers a preserved outcome, and always names one', () => {
    expect(
      CloseAccountUnder13ResultSchema.safeParse({ success: true, outcome: 'preserved' }).success,
    ).toBe(false);
    expect(CloseAccountUnder13ResultSchema.safeParse({ success: true }).success).toBe(false);
  });
});
