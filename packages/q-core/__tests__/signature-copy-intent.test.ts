import { describe, it, expect } from 'vitest';
import { SignatureCopyIntentSchema } from '../src/doc-schemas/signature-copy-intent.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';
import { buildSignedWaiverPath } from '../src/paths/storage-paths.js';
import { toPath } from '../src/paths/utils.js';

const stagingId = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';

const copying = {
  stagingId,
  stagingPath: `staging/waiver-signature/u1/${stagingId}`,
  keptPath: buildSignedWaiverPath('u1', 'league1', stagingId),
  record: { kind: 'signedWaiver', leagueId: 'league1', userId: 'u1' },
  state: 'copying',
  createdAt: 1_000,
  updatedAt: 1_000,
  reapAfter: 2_000,
  reapAttemptCount: 0,
} as const;

describe('SignatureCopyIntentSchema', () => {
  it('accepts a copying intent and a claimed reaping intent', () => {
    expect(SignatureCopyIntentSchema.safeParse(copying).success).toBe(true);
    expect(
      SignatureCopyIntentSchema.safeParse({ ...copying, state: 'reaping', reapClaimedAt: 3_000 })
        .success,
    ).toBe(true);
    expect(
      SignatureCopyIntentSchema.safeParse({
        ...copying,
        record: { kind: 'hardwareLoanContract', contractId: 'c1' },
      }).success,
    ).toBe(true);
  });

  it('refuses a reaping intent with no claim and a copying intent with one', () => {
    expect(SignatureCopyIntentSchema.safeParse({ ...copying, state: 'reaping' }).success).toBe(
      false,
    );
    expect(SignatureCopyIntentSchema.safeParse({ ...copying, reapClaimedAt: 3_000 }).success).toBe(
      false,
    );
  });

  it('refuses a kept copy named for another staging id', () => {
    expect(
      SignatureCopyIntentSchema.safeParse({
        ...copying,
        keptPath: buildSignedWaiverPath('u1', 'league1', 'other'),
      }).success,
    ).toBe(false);
  });

  it('refuses an intent due before its last write and a non-staging id', () => {
    expect(SignatureCopyIntentSchema.safeParse({ ...copying, reapAfter: 999 }).success).toBe(false);
    expect(
      SignatureCopyIntentSchema.safeParse({ ...copying, stagingId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('keys the intent by its staging id', () => {
    expect(toPath(PATH_BUILDERS.signatureCopyIntent(stagingId))).toBe(
      `signatureCopyIntents/${stagingId}`,
    );
  });
});
