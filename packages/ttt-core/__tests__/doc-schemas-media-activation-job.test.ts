// mediaActivationJobs/{jobId} — the parent-publication dependency fields.
//
// Some publications legitimately arrive before the parent document they attach to exists
// (the curated-audition lane: an option's publish can beat the prompt's publish, which is
// what CREATES the audition doc). `parentKey` marks a job as riding that lane and
// `parentWaitStartedAt` bounds the wait. Both are optional so rows written before the pair
// existed still parse — that backward compatibility is the point of these tests.

import { describe, it, expect } from 'vitest';
import {
  MediaActivationJobSchema,
  MediaActivationJobStatusSchema,
} from '../src/doc-schemas/media-activation-jobs';

/** A structural Firestore Timestamp (ttt-core validates the shape, never firebase-admin). */
function ts(ms: number) {
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1e6,
    toMillis: () => ms,
    toDate: () => new Date(ms),
  };
}

const authorityPayload = {
  schemaVersion: 1,
  assetId: 'asset-1',
  authorityVersion: 1,
  operationId: 'op-1',
  payloadHash: 'hash-1',
  servingStatus: 'servable' as const,
  accessTier: 'broad' as const,
  ownerType: 'auditionEntry' as const,
  ownerId: 'entry-1',
  scope: null,
  variants: { main: { contentType: 'video/mp4', sizeBytes: 10 } },
  updatedAtMs: 1,
};

/** A job row exactly as it existed BEFORE the dependency fields were added. */
const legacyJob = {
  jobId: 'job-1',
  schemaVersion: 1,
  assetId: 'asset-1',
  pendingMediaId: 'pending-1',
  fileOrigin: 'audition-entry' as const,
  authorityVersion: 1,
  payloadHash: 'hash-1',
  authorityPayload,
  publicationKind: 'auditionMedia' as const,
  publicationArgs: { auditionId: 'aud-1' },
  status: 'pending' as const,
  attemptCount: 0,
  nextAttemptAt: ts(1_700_000_000_000),
  createdAt: ts(1_700_000_000_000),
};

describe('MediaActivationJobSchema — parent-publication dependency fields', () => {
  it('parses an OLD row carrying neither field (backward compatibility)', () => {
    const parsed = MediaActivationJobSchema.parse(legacyJob);
    expect(parsed.parentKey).toBeUndefined();
    expect(parsed.parentWaitStartedAt).toBeUndefined();
  });

  it('parses a job carrying parentKey alone (minted on the absent-parent lane, never parked yet)', () => {
    const parsed = MediaActivationJobSchema.parse({ ...legacyJob, parentKey: 'aud-1' });
    expect(parsed.parentKey).toBe('aud-1');
    expect(parsed.parentWaitStartedAt).toBeUndefined();
  });

  it('parses a parked job carrying both fields and preserves the Timestamp instance', () => {
    const startedAt = ts(1_700_000_123_000);
    const parsed = MediaActivationJobSchema.parse({
      ...legacyJob,
      parentKey: 'aud-1',
      parentWaitStartedAt: startedAt,
    });
    expect(parsed.parentKey).toBe('aud-1');
    // Validated structurally, NOT transformed — the Timestamp keeps its methods.
    expect(parsed.parentWaitStartedAt?.toMillis()).toBe(1_700_000_123_000);
  });

  it('rejects an empty parentKey (a blank key would park a job against nothing)', () => {
    expect(MediaActivationJobSchema.safeParse({ ...legacyJob, parentKey: '' }).success).toBe(false);
  });

  it('rejects an epoch-millis number for parentWaitStartedAt — the job time fields are Timestamps', () => {
    expect(
      MediaActivationJobSchema.safeParse({ ...legacyJob, parentWaitStartedAt: 1_700_000_123_000 })
        .success,
    ).toBe(false);
  });

  it('stays strict — a look-alike misspelling is rejected, not silently ignored', () => {
    expect(
      MediaActivationJobSchema.safeParse({ ...legacyJob, parentId: 'aud-1' }).success,
    ).toBe(false);
  });

  it('leaves the job status machine untouched (parking is an outcome, never a stored status)', () => {
    expect(MediaActivationJobStatusSchema.safeParse('parentPending').success).toBe(false);
    for (const status of ['pending', 'authorityApplied', 'complete', 'deadLetter']) {
      expect(MediaActivationJobStatusSchema.safeParse(status).success).toBe(true);
    }
  });
});
