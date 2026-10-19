import { describe, it, expect } from 'vitest';
import { UserPrivateDataSchema } from '../src/doc-schemas/user.js';
import {
  NotificationArchiveAllJobSchema,
} from '../src/doc-schemas/notification-archive-all-jobs.js';

const job = {
  schemaVersion: 1,
  jobId: 'job1',
  userId: 'u1',
  category: 'user',
  state: 'complete',
  revision: 1,
  archived: 3,
  error: null,
  attemptCount: 0,
  nextAttemptAt: 0,
  deadLettered: false,
  createdAt: 1,
  updatedAt: 2,
  completedAt: 2,
  deadLetteredAt: null,
};

describe('privateData orphan-deletion claim', () => {
  const claim = UserPrivateDataSchema.shape.orphanDeletionClaimedAt;

  it('stores the epoch-ms moment the cleanup claimed the uid, and is absent on an unclaimed uid', () => {
    expect(claim.parse(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(claim.parse(undefined)).toBeUndefined();
  });

  it('rejects a claim that is not a whole non-negative epoch-ms value', () => {
    expect(claim.safeParse(-1).success).toBe(false);
    expect(claim.safeParse(1.5).success).toBe(false);
  });
});

describe('archive-all job counts', () => {
  it('records how many cards the completing drain left in the list', () => {
    expect(NotificationArchiveAllJobSchema.parse({ ...job, notArchived: 2 }).notArchived).toBe(2);
  });

  it('reads a job written before any card was left behind', () => {
    expect(NotificationArchiveAllJobSchema.parse(job).notArchived).toBeUndefined();
  });

  it('rejects a negative left-behind count', () => {
    expect(NotificationArchiveAllJobSchema.safeParse({ ...job, notArchived: -1 }).success).toBe(false);
  });
});
