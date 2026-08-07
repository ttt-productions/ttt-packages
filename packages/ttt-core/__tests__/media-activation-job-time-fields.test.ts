// ARCH-105 on mediaActivationJobs: only the TTL field itself may be a Firestore
// Timestamp. Every other time field on the collection is epoch-millis, so a reader
// never needs a conversion the rest of the codebase does not.
//
// This is load-bearing beyond tidiness. `dueActivationJobsQuery` filters
// `where('nextAttemptAt', '<=', <number>)`, and Firestore's type ordering sorts numbers
// before timestamps — a Timestamp-valued nextAttemptAt would never match, making a
// non-terminal job INVISIBLE to the recovery worker instead of erroring.
//
// Asserted per-field rather than through a whole-document fixture on purpose: a fixture
// would have to satisfy the full nested authority payload, and any unrelated change there
// would make these assertions pass or fail for the wrong reason.

import { describe, it, expect } from 'vitest';
import { MediaActivationJobSchema } from '../src/doc-schemas/media-activation-jobs';

const timestamp = {
  seconds: 1_700_000_000,
  nanoseconds: 0,
  toMillis: () => 1_700_000_000_000,
  toDate: () => new Date(1_700_000_000_000),
};
const epochMillis = 1_700_000_000_000;

const shape = MediaActivationJobSchema.shape;

/** Every non-TTL time field on the collection. `expireAt` is deliberately absent. */
const EPOCH_MILLIS_TIME_FIELDS = [
  'nextAttemptAt',
  'createdAt',
  'authorityAppliedAt',
  'completedAt',
  'deadLetteredAt',
  'parentWaitStartedAt',
] as const;

describe('mediaActivationJobs time fields obey ARCH-105', () => {
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
    for (const field of ['authorityAppliedAt', 'completedAt', 'deadLetteredAt', 'parentWaitStartedAt', 'expireAt'] as const) {
      expect(shape[field].safeParse(undefined).success).toBe(true);
    }
  });
});
