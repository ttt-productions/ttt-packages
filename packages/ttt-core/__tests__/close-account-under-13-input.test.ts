import { describe, it, expect } from 'vitest';
import { CloseAccountUnder13InputSchema } from '../src/schemas/index';
import { MAX_UNDER_13_CLOSE_REASON_LENGTH } from '../src/index';

describe('close under-13 account input', () => {
  it('takes the account alone, with no reason', () => {
    expect(CloseAccountUnder13InputSchema.parse({ userId: 'target-uid' })).toEqual({ userId: 'target-uid' });
  });

  it('takes a null reason, which the callable client sends for an omitted argument', () => {
    expect(CloseAccountUnder13InputSchema.parse({ userId: 'target-uid', reason: null })).toEqual({
      userId: 'target-uid',
      reason: null,
    });
  });

  it('keeps a given reason trimmed, and a whitespace-only reason as empty', () => {
    expect(CloseAccountUnder13InputSchema.parse({ userId: 'target-uid', reason: '  parent report  ' }).reason).toBe(
      'parent report',
    );
    expect(CloseAccountUnder13InputSchema.parse({ userId: 'target-uid', reason: '   ' }).reason).toBe('');
  });

  it('takes a reason up to the close reason length and no longer', () => {
    expect(
      CloseAccountUnder13InputSchema.safeParse({ userId: 'u', reason: 'a'.repeat(MAX_UNDER_13_CLOSE_REASON_LENGTH) }).success,
    ).toBe(true);
    expect(
      CloseAccountUnder13InputSchema.safeParse({ userId: 'u', reason: 'a'.repeat(MAX_UNDER_13_CLOSE_REASON_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it('requires the account, as one document id', () => {
    expect(CloseAccountUnder13InputSchema.safeParse({}).success).toBe(false);
    expect(CloseAccountUnder13InputSchema.safeParse({ userId: '' }).success).toBe(false);
    expect(CloseAccountUnder13InputSchema.safeParse({ userId: 'a/b' }).success).toBe(false);
  });

  it('never accepts a date of birth or any other field about the child', () => {
    expect(
      CloseAccountUnder13InputSchema.safeParse({ userId: 'target-uid', dob: { year: 2015, month: 1, day: 1 } }).success,
    ).toBe(false);
    expect(CloseAccountUnder13InputSchema.safeParse({ userId: 'target-uid', age: 12 }).success).toBe(false);
  });
});
