// Both fields are optional so job rows stored without them still parse.

import { describe, it, expect } from 'vitest';
import {
  MediaActivationJobSchema,
  MediaActivationJobStatusSchema,
} from '../src/doc-schemas/media-activation-jobs.js';

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
  nextAttemptAt: 1_700_000_000_000,
  createdAt: 1_700_000_000_000,
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

  it('parses a parked job carrying both fields', () => {
    const parsed = MediaActivationJobSchema.parse({
      ...legacyJob,
      parentKey: 'aud-1',
      parentWaitStartedAt: 1_700_000_123_000,
    });
    expect(parsed.parentKey).toBe('aud-1');
    expect(parsed.parentWaitStartedAt).toBe(1_700_000_123_000);
  });

  it('rejects an empty parentKey (a blank key would park a job against nothing)', () => {
    expect(MediaActivationJobSchema.safeParse({ ...legacyJob, parentKey: '' }).success).toBe(false);
  });

  it('rejects a Firestore Timestamp for parentWaitStartedAt — only the TTL field is one (RULE-STD-ARCH-105)', () => {
    expect(
      MediaActivationJobSchema.safeParse({
        ...legacyJob,
        parentWaitStartedAt: ts(1_700_000_123_000),
      }).success,
    ).toBe(false);
  });

  it('stays strict — a look-alike misspelling is rejected, not silently ignored', () => {
    expect(MediaActivationJobSchema.safeParse({ ...legacyJob, parentId: 'aud-1' }).success).toBe(
      false,
    );
  });

  it('leaves the job status machine untouched (parking is an outcome, never a stored status)', () => {
    expect(MediaActivationJobStatusSchema.safeParse('parentPending').success).toBe(false);
    for (const status of ['pending', 'authorityApplied', 'complete', 'deadLetter']) {
      expect(MediaActivationJobStatusSchema.safeParse(status).success).toBe(true);
    }
  });
});
