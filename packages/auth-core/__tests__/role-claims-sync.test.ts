// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { changedRoleAccounts, runRoleClaimsSync } from '../src/server/role-claims-sync.js';
import type {
  RoleClaims,
  RoleClaimsSyncRecord,
  RoleClaimsSyncRequest,
} from '../src/server/role-claims-sync.js';
import { fakeAuth } from './helpers/account-repair-fixture.js';

interface StaffList {
  readonly leads: readonly string[];
  readonly helpers: readonly string[];
}

const EMPTY: StaffList = { leads: [], helpers: [] };

const rolesOf = (list: StaffList, uid: string): RoleClaims => {
  const lead = list.leads.includes(uid);
  return { isLead: lead, isHelper: !lead && list.helpers.includes(uid) };
};

function syncRequest(
  before: StaffList,
  after: StaffList,
  overrides: Partial<RoleClaimsSyncRequest<StaffList>> = {},
) {
  const auth = fakeAuth();
  const records: RoleClaimsSyncRecord[] = [];
  const steps: string[] = [];
  const queued: string[] = [];
  const log = {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    capture: vi.fn(),
    accountField: 'accountId',
  };
  const original = auth.auth.revokeRefreshTokens;
  auth.auth.revokeRefreshTokens = async (uid) => {
    steps.push(`revoke:${uid}`);
    await original(uid);
  };
  const request: RoleClaimsSyncRequest<StaffList> = {
    before,
    after,
    accountsOf: (list) => [...list.leads, ...list.helpers],
    rolesOf,
    readList: async () => after,
    claimPatch: (roles) => ({ ...roles, retiredRole: false }),
    auth: () => auth.auth,
    record: async (record) => {
      steps.push(`record:${record.uid}`);
      records.push(record);
    },
    queueRepair: async (uid) => {
      queued.push(uid);
    },
    name: 'syncStaffClaims',
    log,
    ...overrides,
  };
  return { auth, records, steps, queued, log, request };
}

describe('the accounts whose roles changed', () => {
  it('are the accounts whose claims from the list differ before and after the edit', () => {
    expect(
      changedRoleAccounts({
        before: { leads: ['a', 'b'], helpers: ['b', 'c'] },
        after: { leads: ['a'], helpers: ['b', 'c', 'd'] },
        accountsOf: (list) => [...list.leads, ...list.helpers],
        rolesOf,
      }).sort(),
    ).toEqual(['b', 'd']);
  });

  it('include every account when the list is created or deleted', () => {
    const list: StaffList = { leads: ['a'], helpers: ['b'] };
    const accountsOf = (l: StaffList) => [...l.leads, ...l.helpers];
    expect(changedRoleAccounts({ before: EMPTY, after: list, accountsOf, rolesOf }).sort()).toEqual(
      ['a', 'b'],
    );
    expect(changedRoleAccounts({ before: list, after: EMPTY, accountsOf, rolesOf }).sort()).toEqual(
      ['a', 'b'],
    );
  });
});

describe('the role-claims trigger core', () => {
  it('writes the claims the list now gives each changed account, revokes its tokens, then records it', async () => {
    const fixture = syncRequest(EMPTY, { leads: ['a'], helpers: [] });
    fixture.auth.add('a', { retiredRole: true, other: 1 });
    expect(await runRoleClaimsSync(fixture.request)).toEqual({
      applied: 1,
      skippedUserNotFound: 0,
    });
    expect(fixture.auth.user('a')?.customClaims).toEqual({ isLead: true, other: 1 });
    expect(fixture.steps).toEqual(['revoke:a', 'record:a']);
    expect(fixture.records).toEqual([
      {
        uid: 'a',
        before: { isLead: false, isHelper: false },
        after: { isLead: true, isHelper: false },
        outcome: { result: 'success' },
      },
    ]);
  });

  it('reads the claims from the list as it is now, not the edit’s copy', async () => {
    const fixture = syncRequest(
      EMPTY,
      { leads: ['a'], helpers: [] },
      {
        readList: async () => ({ leads: [], helpers: ['a'] }),
      },
    );
    fixture.auth.add('a', undefined);
    await runRoleClaimsSync(fixture.request);
    expect(fixture.auth.user('a')?.customClaims).toEqual({ isHelper: true });
  });

  it('records and skips an account with no Auth user', async () => {
    const fixture = syncRequest(EMPTY, { leads: ['ghost'], helpers: [] });
    expect(await runRoleClaimsSync(fixture.request)).toEqual({
      applied: 0,
      skippedUserNotFound: 1,
    });
    expect(fixture.records[0]?.outcome).toEqual({ result: 'failure', reason: 'authUserMissing' });
    expect(fixture.queued).toEqual([]);
    expect(fixture.log.logger.error).not.toHaveBeenCalled();
  });

  it('records any other failure, queues the account for repair, and fails the trigger', async () => {
    const fixture = syncRequest(EMPTY, { leads: ['a', 'b'], helpers: [] });
    fixture.auth.add('a', undefined);
    fixture.auth.add('b', undefined);
    const failure = new Error('claims write failed');
    fixture.auth.failOn('setCustomUserClaims', 'a', failure);
    await expect(runRoleClaimsSync(fixture.request)).rejects.toBe(failure);
    expect(fixture.records.find((record) => record.uid === 'a')?.outcome).toEqual({
      result: 'failure',
      reason: 'applyFailed',
      error: failure,
    });
    expect(fixture.queued).toEqual(['a']);
    expect(fixture.auth.user('b')?.customClaims).toEqual({ isLead: true });
    expect(fixture.log.logger.error).toHaveBeenCalledTimes(1);
    expect(fixture.log.logger.error).toHaveBeenCalledWith(
      "syncStaffClaims: the account's claims could not be applied",
      { accountId: 'a', error: failure },
    );
  });

  it('still queues and fails when the failure record cannot be written', async () => {
    const fixture = syncRequest(
      EMPTY,
      { leads: ['a'], helpers: [] },
      {
        record: async () => {
          throw new Error('audit down');
        },
      },
    );
    fixture.auth.add('a', undefined);
    fixture.auth.failOn('revokeRefreshTokens', 'a');
    await expect(runRoleClaimsSync(fixture.request)).rejects.toThrow('revokeRefreshTokens failed');
    expect(fixture.queued).toEqual(['a']);
    expect(fixture.log.capture).toHaveBeenCalledWith(expect.any(Error), { kind: 'failureAudit' });
  });

  it('does nothing when no account’s roles changed', async () => {
    const readList = vi.fn(async () => EMPTY);
    const fixture = syncRequest(
      { leads: ['a'], helpers: ['a'] },
      { leads: ['a'], helpers: [] },
      {
        readList,
      },
    );
    expect(await runRoleClaimsSync(fixture.request)).toEqual({
      applied: 0,
      skippedUserNotFound: 0,
    });
    expect(readList).not.toHaveBeenCalled();
  });
});
