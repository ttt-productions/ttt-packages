// Firestore orders numbers before timestamps, so a Timestamp-valued nextAttemptAt would never match
// `dueActivationJobsQuery`'s numeric filter.

import { describe, it, expect } from 'vitest';
import { MediaActivationJobSchema } from '../src/doc-schemas/media-activation-jobs.js';

const timestamp = {
  seconds: 1_700_000_000,
  nanoseconds: 0,
  toMillis: () => 1_700_000_000_000,
  toDate: () => new Date(1_700_000_000_000),
};
const epochMillis = 1_700_000_000_000;

const shape = MediaActivationJobSchema.shape;

const EPOCH_MILLIS_TIME_FIELDS = [
  'nextAttemptAt',
  'createdAt',
  'authorityAppliedAt',
  'completedAt',
  'deadLetteredAt',
  'parentWaitStartedAt',
] as const;

describe('mediaActivationJobs time fields obey RULE-STD-ARCH-105', () => {
  it('covers every time field the schema declares', () => {
    const declared = Object.keys(shape).filter((key) => /At$/.test(key));
    expect(declared.sort()).toEqual([...EPOCH_MILLIS_TIME_FIELDS, 'expireAt'].sort());
  });

  it.each(EPOCH_MILLIS_TIME_FIELDS)('%s accepts epoch-millis', (field) => {
    expect(shape[field].safeParse(epochMillis).success).toBe(true);
  });

  it.each(EPOCH_MILLIS_TIME_FIELDS)('%s REJECTS a Firestore Timestamp', (field) => {
    expect(shape[field].safeParse(timestamp).success).toBe(false);
  });

  it('expireAt still requires a Timestamp — native TTL honors nothing else', () => {
    expect(shape.expireAt.safeParse(timestamp).success).toBe(true);
    expect(shape.expireAt.safeParse(epochMillis).success).toBe(false);
  });

  it('rejects a negative or fractional epoch-millis value', () => {
    expect(shape.nextAttemptAt.safeParse(-1).success).toBe(false);
    expect(shape.nextAttemptAt.safeParse(1.5).success).toBe(false);
  });

  it('keeps the required/optional split intact', () => {
    expect(shape.nextAttemptAt.safeParse(undefined).success).toBe(false);
    expect(shape.createdAt.safeParse(undefined).success).toBe(false);
    for (const field of [
      'authorityAppliedAt',
      'completedAt',
      'deadLetteredAt',
      'parentWaitStartedAt',
      'expireAt',
    ] as const) {
      expect(shape[field].safeParse(undefined).success).toBe(true);
    }
  });
});
