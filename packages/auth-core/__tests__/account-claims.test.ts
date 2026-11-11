// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Auth } from 'firebase-admin/auth';
import { updateClaim } from '../src/server/account-claims.js';
import type { AccountRepairAuth } from '../src/server/account-repair.js';
import { fakeAuth, queueSchemas } from './helpers/account-repair-fixture.js';

// Checked by the type checker: the Admin SDK's Auth is the adapter the product hands in.
const adminAuthFits: Auth extends AccountRepairAuth ? true : never = true;

describe('the claim writer', () => {
  it('merges a change into the claims the account already holds', async () => {
    const auth = fakeAuth();
    auth.add('u1', { keep: 'yes', level: 1 });
    await updateClaim(auth.auth, 'u1', { level: 2, isStaff: true });
    expect(auth.user('u1')?.customClaims).toEqual({ keep: 'yes', level: 2, isStaff: true });
  });

  it('removes a claim set to false', async () => {
    const auth = fakeAuth();
    auth.add('u1', { keep: 'yes', isStaff: true });
    await updateClaim(auth.auth, 'u1', { isStaff: false, retired: false });
    expect(auth.user('u1')?.customClaims).toEqual({ keep: 'yes' });
  });

  it('is served by the Admin SDK’s Auth', () => {
    expect(adminAuthFits).toBe(true);
  });
});

describe('the repair queue entry schema', () => {
  const status = {
    enqueuedAt: 1,
    attemptCount: 0,
    authEffect: 'accountStatus',
    reason: 'statusChangePending',
    targetStatus: 'held',
    writeId: 'w1',
  };
  const claims = {
    enqueuedAt: 1,
    attemptCount: 2,
    lastAttemptAt: 3,
    authEffect: 'perkClaim',
    reason: 'postCommitAuthEffectFailed',
  };

  it('reads each kind of entry by its effect, and drops a field it does not name', () => {
    expect(queueSchemas.entry.parse({ ...status, uid: 'u1' })).toEqual(status);
    expect(queueSchemas.entry.parse(claims)).toEqual(claims);
  });

  it.each([
    ['an entry with no effect', { ...claims, authEffect: undefined }],
    ['an effect the product did not hand in', { ...claims, authEffect: 'other' }],
    ['a status entry with no reason', { ...status, reason: undefined }],
    ['a status entry with the claims reason', { ...status, reason: 'postCommitAuthEffectFailed' }],
    ['a status entry with no write id', { ...status, writeId: undefined }],
    ['a status outside the product’s statuses', { ...status, targetStatus: 'gone' }],
    ['a fractional time', { ...claims, enqueuedAt: 1.5 }],
    ['a negative attempt count', { ...claims, attemptCount: -1 }],
  ])('refuses %s', (_label, value) => {
    expect(queueSchemas.entry.safeParse(value).success).toBe(false);
  });
});
