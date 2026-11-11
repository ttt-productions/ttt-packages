import { describe, it, expect } from 'vitest';
import { SweepStateSchema } from '@ttt-productions/sweep-core';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry.js';
import { StatusReconcileQueueEntrySchema } from '../src/doc-schemas/status-reconcile-queue.js';
import { SWEEP_STATE_NAMES } from '../src/constants/scheduled-jobs.js';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit.js';

describe('the shared sweep and account-repair schemas Q-Sports registers', () => {
  it("binds the sweeps package's saved-position schema to every sweep's document", () => {
    expect(COLLECTION_SCHEMAS['sweepState/{sweepName}']).toBe(SweepStateSchema);
  });

  it('binds the account-repair queue entry schema, which declares no uid field', () => {
    expect(COLLECTION_SCHEMAS['statusReconcileQueue/{userId}']).toBe(
      StatusReconcileQueueEntrySchema,
    );
    expect(
      StatusReconcileQueueEntrySchema.parse({
        enqueuedAt: 1,
        attemptCount: 0,
        authEffect: 'roleClaims',
        reason: 'postCommitAuthEffectFailed',
        uid: 'u1',
      }),
    ).not.toHaveProperty('uid');
  });

  it('keeps its own list of sweep names', () => {
    expect([...SWEEP_STATE_NAMES]).toEqual([
      'reconcilePublicUsers',
      'reconcileAccountStatus',
      'pictureRetirement',
      'stalePendingMedia',
      'abandonedStaging',
    ]);
  });

  it('records an account repair as its own audit event', () => {
    expect(AUDIT_EVENT_TYPE_KEYS as readonly string[]).toContain('userProfile.authReconciled');
  });
});
