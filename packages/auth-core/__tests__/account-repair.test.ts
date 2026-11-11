// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_REPAIR_DRAIN_PER_RUN,
  authDriftRepairedLog,
  statusChangeAppliedLog,
} from '../src/server/account-repair.js';
import {
  STATUS_CLAIM,
  perkClaim,
  queuePath,
  repairFixture,
  standingClaim,
} from './helpers/account-repair-fixture.js';

const STATUS_CHANGE_APPLIED_LOG = 'repairAccounts: applied the status change to Auth';
const AUTH_DRIFT_REPAIRED_LOG = 'repairAccounts: re-applied Auth drift';

type Fixture = ReturnType<typeof repairFixture>;

async function queueStatusChange(fixture: Fixture, uid: string, writeId: string) {
  const entry = fixture.repair.accountStatusQueueEntry('blocked', writeId, 500);
  await fixture.memory.db.runTransaction(async (transaction) => {
    fixture.repair.writeAccountStatusQueueEntry(transaction, uid, entry);
  });
}

describe('the status claim and the disabled flag', () => {
  it('reads an account that was never restricted, with no claim, as no drift', () => {
    const { repair } = repairFixture();
    expect(
      repair.statusDrift({
        canonicalStatus: 'active',
        claimStatus: undefined,
        authDisabled: false,
      }),
    ).toEqual({ claimDrift: false, disabledDrift: false, wantDisabled: false });
  });

  it('reads a missing claim on a restricted account as drift', () => {
    const { repair } = repairFixture();
    expect(
      repair.statusDrift({ canonicalStatus: 'held', claimStatus: undefined, authDisabled: false })
        .claimDrift,
    ).toBe(true);
  });

  it("after an unban writes the claim 'active' and enables the account", async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', { [STATUS_CLAIM]: 'blocked', other: 'kept' }, true);
    await fixture.repair.convergeAccountAfterStatusChange('u1', 'w1');
    expect(fixture.authFake.user('u1')).toMatchObject({
      customClaims: { [STATUS_CLAIM]: 'active', other: 'kept' },
      disabled: false,
    });
  });

  it('a ban writes the status claim, disables the account and revokes its tokens', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    await fixture.repair.convergeAccountAfterStatusChange('u1', 'w1');
    expect(fixture.authFake.user('u1')).toMatchObject({
      customClaims: { [STATUS_CLAIM]: 'blocked' },
      disabled: true,
    });
    expect(fixture.authFake.revoked).toEqual(['u1']);
  });
});

describe('the token rule', () => {
  it('revokes when only the disabled flag drifted, the flag being part of the status', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', { [STATUS_CLAIM]: 'blocked' }, false);
    await fixture.repair.runFullScan(5_000);
    expect(fixture.authFake.user('u1')?.disabled).toBe(true);
    expect(fixture.authFake.revoked).toEqual(['u1']);
  });

  it('revokes when a claim that takes standing away is repaired', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', { isStaff: true });
    await fixture.repair.runFullScan(5_000);
    expect(fixture.authFake.user('u1')?.customClaims).toEqual({});
    expect(fixture.authFake.revoked).toEqual(['u1']);
  });

  it('does not revoke when only a claim for the person’s own benefit is repaired', async () => {
    const fixture = repairFixture({
      claims: () => [perkClaim({ level: async () => 3 })],
    });
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', { perk: 1 });
    await fixture.repair.runFullScan(5_000);
    expect(fixture.authFake.user('u1')?.customClaims).toEqual({ perk: 3 });
    expect(fixture.authFake.revoked).toEqual([]);
  });

  it('writes what the re-read before the write finds, not what the check first saw', async () => {
    const steps: string[] = [];
    const fixture = repairFixture({
      claims: () => [
        perkClaim({
          level: async () => 3,
          confirm: async () => {
            steps.push('confirm');
            return { patch: { perk: 4 }, audit: { level: 4 } };
          },
        }),
      ],
    });
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', { perk: 1 });
    await fixture.repair.runFullScan(5_000);
    expect(steps).toEqual(['confirm']);
    expect(fixture.authFake.user('u1')?.customClaims).toEqual({ perk: 4 });
  });

  it('runs the settle the confirmed repair carries after the claim is written', async () => {
    const settled: unknown[] = [];
    const fixture = repairFixture({
      claims: () => [
        perkClaim({
          level: async () => 3,
          confirm: async () => ({
            patch: { perk: 3 },
            audit: { level: 3 },
            settle: async () => {
              settled.push(fixture.authFake.user('u1')?.customClaims?.perk);
            },
          }),
        }),
      ],
    });
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', { perk: 1 });
    await fixture.repair.runFullScan(5_000);
    expect(settled).toEqual([3]);
  });
});

describe('the two log lines and the audit', () => {
  it('builds both lines from the name the product hands in, so two products with one name log alike', () => {
    expect(statusChangeAppliedLog('reconcileAccountStatus')).toBe(
      'reconcileAccountStatus: applied the status change to Auth',
    );
    expect(authDriftRepairedLog('reconcileAccountStatus')).toBe(
      'reconcileAccountStatus: re-applied Auth drift',
    );
  });

  it('a routine status change logs the status-change line only, and is not audited as a repair', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    await fixture.repair.convergeAccountAfterStatusChange('u1', 'w1');
    expect(fixture.logMessages()).toEqual([STATUS_CHANGE_APPLIED_LOG]);
    expect(fixture.logger.info).toHaveBeenCalledWith(STATUS_CHANGE_APPLIED_LOG, {
      accountId: 'u1',
      canonicalStatus: 'blocked',
      claimDrift: true,
      disabledDrift: true,
    });
    expect(fixture.audits).toEqual([]);
  });

  it('a status change that also repairs another claim logs both lines, each naming what it applied', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', { isStaff: true });
    await fixture.repair.convergeAccountAfterStatusChange('u1', 'w1');
    expect(fixture.logMessages()).toEqual([STATUS_CHANGE_APPLIED_LOG, AUTH_DRIFT_REPAIRED_LOG]);
    expect(fixture.logger.info).toHaveBeenLastCalledWith(AUTH_DRIFT_REPAIRED_LOG, {
      accountId: 'u1',
      canonicalStatus: 'blocked',
      repairedClaims: ['standingClaims'],
    });
    expect(fixture.audits).toEqual([
      { kind: 'claim', uid: 'u1', claim: 'standingClaims', payload: { isStaff: false } },
    ]);
  });

  it('a status change that finds only another claim drifted logs the drift line only', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', { isStaff: true });
    await fixture.repair.convergeAccountAfterStatusChange('u1', 'w1');
    expect(fixture.logMessages()).toEqual([AUTH_DRIFT_REPAIRED_LOG]);
  });

  it('a status repair by the drain logs the drift line and is audited as a repair', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'held');
    fixture.authFake.add('u1', { [STATUS_CLAIM]: 'active' });
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    await fixture.repair.drainQueue();
    expect(fixture.logMessages()).toEqual([AUTH_DRIFT_REPAIRED_LOG]);
    expect(fixture.logger.info).toHaveBeenCalledWith(AUTH_DRIFT_REPAIRED_LOG, {
      accountId: 'u1',
      canonicalStatus: 'held',
      claimDrift: true,
      disabledDrift: false,
      repairedClaims: [],
    });
    expect(fixture.audits).toEqual([
      {
        kind: 'status',
        uid: 'u1',
        canonicalStatus: 'held',
        priorClaimStatus: 'active',
        claimDrift: true,
        disabledDrift: false,
        appliedDisabled: false,
      },
    ]);
  });

  it('a status and claim repair by the full scan logs one drift line naming both, with one record each', async () => {
    const fixture = repairFixture();
    fixture.roster.staff.push('u1');
    fixture.profile('u1', 'held');
    fixture.authFake.add('u1', undefined);
    await fixture.repair.runFullScan(5_000);
    expect(fixture.logMessages()).toEqual([AUTH_DRIFT_REPAIRED_LOG]);
    expect(fixture.logger.info).toHaveBeenCalledWith(AUTH_DRIFT_REPAIRED_LOG, {
      accountId: 'u1',
      canonicalStatus: 'held',
      claimDrift: true,
      disabledDrift: false,
      repairedClaims: ['standingClaims'],
    });
    expect(fixture.audits.map((record) => record.kind)).toEqual(['status', 'claim']);
  });

  it('a claim repair by the full scan logs the drift line', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', { isStaff: true });
    await fixture.repair.runFullScan(5_000);
    expect(fixture.logMessages()).toEqual([AUTH_DRIFT_REPAIRED_LOG]);
  });

  it('logs nothing and audits nothing for an account with no drift', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', undefined);
    await fixture.repair.convergeAccountAfterStatusChange('u1', 'w1');
    await fixture.repair.runFullScan(5_000);
    expect(fixture.logMessages()).toEqual([]);
    expect(fixture.audits).toEqual([]);
    expect(fixture.authFake.revoked).toEqual([]);
  });
});

describe('the repair queue', () => {
  it('writes the status entry in the caller’s transaction, with the effect, reason and no uid', async () => {
    const fixture = repairFixture();
    await queueStatusChange(fixture, 'u1', 'w1');
    expect(fixture.memory.read(queuePath('u1'))).toEqual({
      enqueuedAt: 500,
      attemptCount: 0,
      authEffect: 'accountStatus',
      reason: 'statusChangePending',
      targetStatus: 'blocked',
      writeId: 'w1',
    });
  });

  it('settles the entry the status change wrote once Auth matches it', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    await queueStatusChange(fixture, 'u1', 'w1');
    await fixture.repair.convergeAccountAfterStatusChange('u1', 'w1');
    expect(fixture.memory.read(queuePath('u1'))).toBeUndefined();
  });

  it('keeps an entry another status change wrote since', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    await queueStatusChange(fixture, 'u1', 'w2');
    await fixture.repair.convergeAccountAfterStatusChange('u1', 'w1');
    expect(fixture.memory.read(queuePath('u1'))).toMatchObject({ writeId: 'w2' });
  });

  it('owes the account again, with a new entry, when its status changed after the repair read it', async () => {
    const scan = repairFixture();
    scan.profile('u2', 'blocked');
    scan.authFake.add('u2', undefined);
    const original = scan.authFake.auth.revokeRefreshTokens;
    scan.authFake.auth.revokeRefreshTokens = async (uid) => {
      await original(uid);
      scan.profile('u2', 'active');
    };
    await scan.repair.runFullScan(5_000);
    expect(scan.memory.read(queuePath('u2'))).toMatchObject({
      authEffect: 'accountStatus',
      targetStatus: 'active',
      reason: 'statusChangePending',
      attemptCount: 0,
    });
  });

  it('queues an account whose claim change did not reach Auth, once', async () => {
    const fixture = repairFixture();
    fixture.setNow(700);
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    await fixture.repair.queueAccountClaimsRepair('u1', 'perkClaim');
    expect(fixture.memory.read(queuePath('u1'))).toEqual({
      authEffect: 'standingClaims',
      enqueuedAt: 700,
      attemptCount: 0,
      reason: 'postCommitAuthEffectFailed',
    });
    expect(fixture.capture).not.toHaveBeenCalled();
  });

  it('logs and captures a queueing that failed, and never throws', async () => {
    const fixture = repairFixture();
    await expect(fixture.repair.queueAccountClaimsRepair('u1', 'noSuchEffect')).resolves.toBe(
      undefined,
    );
    expect(fixture.logger.error).toHaveBeenCalledTimes(1);
    expect(fixture.capture).toHaveBeenCalledWith(expect.anything(), { kind: 'queue' });
  });
});

describe('the drain', () => {
  it('warns, then deletes the entry of an account whose profile is gone though its Auth user exists', async () => {
    const fixture = repairFixture();
    fixture.authFake.add('u1', { [STATUS_CLAIM]: 'blocked' }, true);
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    expect(await fixture.repair.drainQueue()).toEqual({ drained: 1, reconciled: 0, retained: 0 });
    expect(fixture.memory.read(queuePath('u1'))).toBeUndefined();
    expect(fixture.authFake.user('u1')).toMatchObject({ disabled: true });
    expect(fixture.audits).toEqual([]);
    expect(fixture.logger.warn).toHaveBeenCalledTimes(1);
    expect(fixture.logger.warn).toHaveBeenCalledWith(
      'repairAccounts: a queued account has a login but no profile; its entry is removed',
      { accountId: 'u1' },
    );
    expect(fixture.capture).toHaveBeenCalledTimes(1);
    expect(fixture.capture).toHaveBeenCalledWith(expect.any(Error), {
      kind: 'noProfile',
      level: 'warning',
      account: 'u1',
    });
    expect(fixture.logger.error).not.toHaveBeenCalled();
  });

  it('keeps an entry whose account is owed again after the repair, without raising its attempt count', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    const original = fixture.authFake.auth.revokeRefreshTokens;
    fixture.authFake.auth.revokeRefreshTokens = async (uid) => {
      await original(uid);
      fixture.profile(uid, 'active');
    };
    expect(await fixture.repair.drainQueue()).toEqual({ drained: 1, reconciled: 1, retained: 1 });
    expect(fixture.memory.read(queuePath('u1'))).toEqual({
      authEffect: 'standingClaims',
      enqueuedAt: 1_000,
      attemptCount: 0,
      reason: 'postCommitAuthEffectFailed',
    });
  });

  it('drains the entries with the fewest attempts first, at most its per-run count', async () => {
    const fixture = repairFixture();
    const entry = (attemptCount: number) => ({
      authEffect: 'standingClaims',
      enqueuedAt: 1,
      attemptCount,
      reason: 'postCommitAuthEffectFailed',
    });
    fixture.memory.seed(queuePath('a-retried'), entry(4));
    for (let i = 0; i < ACCOUNT_REPAIR_DRAIN_PER_RUN; i += 1) {
      fixture.memory.seed(queuePath(`fresh-${String(i).padStart(3, '0')}`), entry(0));
    }
    const visited: string[] = [];
    const original = fixture.authFake.auth.getUser;
    fixture.authFake.auth.getUser = async (uid) => {
      visited.push(uid);
      return original(uid);
    };
    expect(await fixture.repair.drainQueue()).toMatchObject({
      drained: ACCOUNT_REPAIR_DRAIN_PER_RUN,
    });
    expect(visited).toHaveLength(ACCOUNT_REPAIR_DRAIN_PER_RUN);
    expect(visited).not.toContain('a-retried');
    expect(fixture.memory.read(queuePath('a-retried'))).toMatchObject({ attemptCount: 4 });
  });

  it('deletes a converged entry', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', undefined);
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    expect(await fixture.repair.drainQueue()).toEqual({ drained: 1, reconciled: 0, retained: 0 });
    expect(fixture.memory.read(queuePath('u1'))).toBeUndefined();
  });

  it('deletes the entry of an account with no Auth user, with no warning', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'active');
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    await fixture.repair.drainQueue();
    expect(fixture.memory.read(queuePath('u1'))).toBeUndefined();
    expect(fixture.logger.warn).not.toHaveBeenCalled();
    expect(fixture.capture).not.toHaveBeenCalled();
  });

  it('raises the attempt count of an entry whose repair failed and keeps it', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    fixture.authFake.failOn('updateUser', 'u1');
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    fixture.setNow(4_000);
    expect(await fixture.repair.drainQueue()).toEqual({ drained: 1, reconciled: 0, retained: 1 });
    expect(fixture.memory.read(queuePath('u1'))).toMatchObject({
      attemptCount: 1,
      lastAttemptAt: 4_000,
    });
    expect(fixture.capture).toHaveBeenCalledWith(expect.anything(), { kind: 'repair' });
  });

  it('raises by one the attempt count of a status entry still the one the drain read', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    fixture.authFake.failOn('updateUser', 'u1');
    await queueStatusChange(fixture, 'u1', 'w1');
    await fixture.memory.db.doc(queuePath('u1')).update({ attemptCount: 3 });
    fixture.setNow(4_000);
    await fixture.repair.drainQueue();
    expect(fixture.memory.read(queuePath('u1'))).toMatchObject({
      writeId: 'w1',
      attemptCount: 4,
      lastAttemptAt: 4_000,
    });
  });

  it('leaves the attempt count of an entry a newer status change rewrote after the drain read it', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    fixture.authFake.failOn('updateUser', 'u1');
    await queueStatusChange(fixture, 'u1', 'w1');
    await fixture.memory.db.doc(queuePath('u1')).update({ attemptCount: 3 });
    const original = fixture.authFake.auth.getUser;
    fixture.authFake.auth.getUser = async (uid) => {
      await queueStatusChange(fixture, uid, 'w2');
      return original(uid);
    };
    expect(await fixture.repair.drainQueue()).toEqual({ drained: 1, reconciled: 0, retained: 1 });
    expect(fixture.memory.read(queuePath('u1'))).toMatchObject({ writeId: 'w2', attemptCount: 0 });
    expect(fixture.memory.read(queuePath('u1'))).not.toHaveProperty('lastAttemptAt');
  });

  it('leaves the attempt count of a claim entry deleted and queued again after the drain read it', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    fixture.authFake.failOn('updateUser', 'u1');
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    await fixture.memory.db.doc(queuePath('u1')).update({ attemptCount: 3 });
    const original = fixture.authFake.auth.getUser;
    fixture.authFake.auth.getUser = async (uid) => {
      await fixture.memory.db.doc(queuePath(uid)).delete();
      await fixture.repair.queueAccountClaimsRepair(uid, 'standingClaims');
      return original(uid);
    };
    expect(await fixture.repair.drainQueue()).toEqual({ drained: 1, reconciled: 0, retained: 1 });
    expect(fixture.memory.read(queuePath('u1'))).toMatchObject({
      authEffect: 'standingClaims',
      attemptCount: 0,
    });
    expect(fixture.memory.read(queuePath('u1'))).not.toHaveProperty('lastAttemptAt');
  });

  it('leaves the attempt count of a claim entry queued again within the same millisecond as the drain read it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const fixture = repairFixture();
      fixture.profile('u1', 'blocked');
      fixture.authFake.add('u1', undefined);
      fixture.authFake.failOn('updateUser', 'u1');
      await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
      await fixture.memory.db.doc(queuePath('u1')).update({ attemptCount: 3 });
      const original = fixture.authFake.auth.getUser;
      fixture.authFake.auth.getUser = async (uid) => {
        await fixture.memory.db.doc(queuePath(uid)).delete();
        await fixture.repair.queueAccountClaimsRepair(uid, 'standingClaims');
        return original(uid);
      };
      await fixture.repair.drainQueue();
      expect(fixture.memory.read(queuePath('u1'))).toMatchObject({ attemptCount: 0 });
      expect(fixture.memory.read(queuePath('u1'))).not.toHaveProperty('lastAttemptAt');
    } finally {
      vi.useRealTimers();
    }
  });

  it('raises by one the attempt count of a claim entry unchanged since the drain read it', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    fixture.authFake.failOn('updateUser', 'u1');
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    await fixture.memory.db.doc(queuePath('u1')).update({ attemptCount: 2 });
    fixture.setNow(4_000);
    await fixture.repair.drainQueue();
    expect(fixture.memory.read(queuePath('u1'))).toMatchObject({
      authEffect: 'standingClaims',
      attemptCount: 3,
      lastAttemptAt: 4_000,
    });
  });

  it('does not recreate an entry deleted after the drain read it, when its repair fails', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    fixture.authFake.failOn('updateUser', 'u1');
    await queueStatusChange(fixture, 'u1', 'w1');
    const original = fixture.authFake.auth.getUser;
    fixture.authFake.auth.getUser = async (uid) => {
      await fixture.memory.db.doc(queuePath(uid)).delete();
      return original(uid);
    };
    expect(await fixture.repair.drainQueue()).toMatchObject({ drained: 1, retained: 1 });
    expect(fixture.memory.read(queuePath('u1'))).toBeUndefined();
    expect(fixture.capture).not.toHaveBeenCalledWith(expect.anything(), { kind: 'drain' });
  });

  it('keeps an entry rewritten after the drain read it', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', { isStaff: true });
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    const original = fixture.authFake.auth.revokeRefreshTokens;
    fixture.authFake.auth.revokeRefreshTokens = async (uid) => {
      await original(uid);
      await fixture.memory.db.doc(queuePath(uid)).update({ enqueuedAt: 9_999 });
    };
    expect(await fixture.repair.drainQueue()).toEqual({ drained: 1, reconciled: 1, retained: 0 });
    expect(fixture.memory.read(queuePath('u1'))).toMatchObject({ enqueuedAt: 9_999 });
    expect(fixture.capture).not.toHaveBeenCalled();
  });

  it('keeps the entry, and fails the outcome, when a claim source cannot be read, though the status was repaired', async () => {
    const fixture = repairFixture({
      claims: () => [
        standingClaim(async () => {
          throw new Error('roster unreadable');
        }),
      ],
    });
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    expect(await fixture.repair.drainQueue()).toEqual({ drained: 1, reconciled: 0, retained: 1 });
    expect(fixture.authFake.user('u1')).toMatchObject({
      customClaims: { [STATUS_CLAIM]: 'blocked' },
      disabled: true,
    });
    expect(fixture.memory.read(queuePath('u1'))).toMatchObject({ attemptCount: 1 });
    expect(fixture.capture).toHaveBeenCalledWith(expect.anything(), { kind: 'claimSource' });
  });

  it('keeps the entry when one account’s claim cannot be checked', async () => {
    const fixture = repairFixture({
      claims: () => [
        perkClaim({
          level: async () => {
            throw new Error('summary unreadable');
          },
        }),
      ],
    });
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', undefined);
    await fixture.repair.queueAccountClaimsRepair('u1', 'perkClaim');
    expect(await fixture.repair.drainQueue()).toEqual({ drained: 1, reconciled: 0, retained: 1 });
    expect(fixture.capture).toHaveBeenCalledWith(expect.anything(), { kind: 'claimCheck' });
  });

  it('keeps the entry when the account’s Auth user cannot be read', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', undefined);
    fixture.authFake.failOn('getUser', 'u1');
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    expect(await fixture.repair.drainQueue()).toMatchObject({ retained: 1 });
    expect(fixture.capture).toHaveBeenCalledWith(expect.anything(), { kind: 'authRead' });
  });

  it('keeps the entry when the profile cannot be read', async () => {
    const fixture = repairFixture();
    fixture.memory.seed('people/u1', { status: 'unknown' });
    fixture.authFake.add('u1', undefined);
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    expect(await fixture.repair.drainQueue()).toMatchObject({ retained: 1 });
    expect(fixture.capture).toHaveBeenCalledWith(expect.anything(), { kind: 'profileRead' });
  });

  it('keeps the entry when the repair’s audit fails', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'active');
    fixture.authFake.add('u1', { isStaff: true });
    await fixture.repair.queueAccountClaimsRepair('u1', 'standingClaims');
    fixture.failAudits();
    expect(await fixture.repair.drainQueue()).toMatchObject({ retained: 1 });
  });
});

describe('the full-scan visit', () => {
  it('repairs every drifted account in the lap and leaves its queue entry for the drain', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.profile('u2', 'active');
    fixture.authFake.add('u1', undefined);
    fixture.authFake.add('u2', undefined);
    await queueStatusChange(fixture, 'u1', 'w1');
    const run = await fixture.repair.runFullScan(5_000);
    expect(run).toMatchObject({ ran: true, examined: 2, reconciled: 1, lapComplete: true });
    expect(fixture.authFake.user('u1')?.disabled).toBe(true);
    expect(fixture.memory.read(queuePath('u1'))).toMatchObject({ writeId: 'w1', attemptCount: 0 });
  });

  it('waits out the full scan’s minimum interval', async () => {
    const fixture = repairFixture();
    await fixture.repair.runFullScan(5_000);
    const second = await fixture.repair.runFullScan(5_001, 10_000);
    expect(second.ran).toBe(false);
  });

  it('never throws from the post-commit step', async () => {
    const fixture = repairFixture();
    fixture.profile('u1', 'blocked');
    fixture.authFake.add('u1', undefined);
    const settleFailure = vi.spyOn(fixture.memory.db, 'runTransaction');
    settleFailure.mockRejectedValueOnce(new Error('contention'));
    await expect(fixture.repair.convergeAccountAfterStatusChange('u1', 'w1')).resolves.toBe(
      undefined,
    );
    expect(fixture.capture).toHaveBeenCalledWith(expect.anything(), {
      kind: 'settle',
      level: 'warning',
    });
  });
});
