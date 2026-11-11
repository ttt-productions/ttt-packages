import { vi } from 'vitest';
import { z } from 'zod';
import { makeInMemoryFirestore } from '@ttt-productions/firebase-helpers/server/testing';
import { createSweepStateStore } from '@ttt-productions/sweep-core/server';
import { createAccountRepairQueueEntrySchemas } from '../../src/account-repair-queue.js';
import type { AccountAuthUser } from '../../src/server/account-claims.js';
import { createAccountRepair } from '../../src/server/account-repair.js';
import type {
  AccountRepairAuth,
  AccountRepairConfig,
  AccountRepairRecord,
  KeptClaim,
  KeptClaimDrift,
} from '../../src/server/account-repair.js';

export const STATUSES = ['active', 'held', 'blocked'] as const;
export type TestStatus = (typeof STATUSES)[number];
export const testStatusSchema = z.enum(STATUSES);

export const queueSchemas = createAccountRepairQueueEntrySchemas({
  statusEffect: 'accountStatus',
  claimEffects: ['standingClaims', 'perkClaim'],
  statusSchema: testStatusSchema,
});

export const profilePath = (uid: string) => `people/${uid}`;
export const queuePath = (uid: string) => `repairQueue/${uid}`;
export const STATUS_CLAIM = 'standing';
export const REPAIR_LOG_NAME = 'repairAccounts';

interface FakeUser {
  uid: string;
  customClaims?: Record<string, unknown>;
  disabled: boolean;
}

function authError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

export function fakeAuth() {
  const users = new Map<string, FakeUser>();
  const revoked: string[] = [];
  const failures = new Map<string, Error>();
  const fail = (method: string, uid: string) => {
    const failure = failures.get(`${method}:${uid}`);
    if (failure) throw failure;
  };
  const read = (uid: string): AccountAuthUser => {
    const user = users.get(uid);
    if (!user) throw authError('auth/user-not-found');
    return { ...user, ...(user.customClaims ? { customClaims: { ...user.customClaims } } : {}) };
  };
  const auth: AccountRepairAuth = {
    getUser: async (uid) => {
      fail('getUser', uid);
      return read(uid);
    },
    setCustomUserClaims: async (uid, claims) => {
      fail('setCustomUserClaims', uid);
      const user = users.get(uid);
      if (!user) throw authError('auth/user-not-found');
      user.customClaims = claims ?? {};
    },
    updateUser: async (uid, properties) => {
      fail('updateUser', uid);
      const user = users.get(uid);
      if (!user) throw authError('auth/user-not-found');
      user.disabled = properties.disabled;
      return read(uid);
    },
    revokeRefreshTokens: async (uid) => {
      fail('revokeRefreshTokens', uid);
      revoked.push(uid);
    },
    listUsers: async (_maxResults, pageToken) => {
      if (pageToken !== undefined) throw authError('auth/invalid-page-token');
      return { users: [...users.keys()].sort().map(read) };
    },
  };
  return {
    auth,
    revoked,
    add(uid: string, customClaims: Record<string, unknown> | undefined, disabled = false) {
      users.set(uid, { uid, ...(customClaims ? { customClaims } : {}), disabled });
    },
    user: (uid: string) => users.get(uid),
    failOn(method: string, uid: string, error: Error = new Error(`${method} failed`)) {
      failures.set(`${method}:${uid}`, error);
    },
  };
}

export interface StandingRoster {
  readonly staff: readonly string[];
}

export function standingClaim(readRoster: () => Promise<StandingRoster>): KeptClaim {
  return {
    name: 'standingClaims',
    revokesTokens: true,
    prepare: async () => {
      const roster = await readRoster();
      return {
        check: async ({ uid, claims }) => {
          const want = roster.staff.includes(uid);
          if ((claims.isStaff === true) === want) return null;
          return { patch: { isStaff: want }, audit: { isStaff: want } };
        },
      };
    },
  };
}

export function perkClaim(options: {
  readonly level: (uid: string) => Promise<number>;
  readonly confirm?: (uid: string) => Promise<KeptClaimDrift | null>;
  readonly settle?: (uid: string) => Promise<void>;
}): KeptClaim {
  const { confirm, settle } = options;
  return {
    name: 'perkClaim',
    revokesTokens: false,
    prepare: async () => ({
      check: async ({ uid, claims }) => {
        const level = await options.level(uid);
        if (claims.perk === level) return null;
        return {
          patch: { perk: level },
          audit: { level },
          ...(confirm ? { confirm: () => confirm(uid) } : {}),
          ...(settle ? { settle: () => settle(uid) } : {}),
        };
      },
    }),
  };
}

export function repairFixture(
  overrides: { claims?: (fixture: { roster: { staff: string[] } }) => KeptClaim[] } = {},
) {
  const memory = makeInMemoryFirestore();
  const authFake = fakeAuth();
  const roster = { staff: [] as string[] };
  const audits: AccountRepairRecord<TestStatus>[] = [];
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const capture = vi.fn();
  const store = createSweepStateStore<'accountRepair'>({
    firestore: () => memory.db,
    path: (name) => `sweeps/${name}`,
  });
  let now = 1_000;
  let auditsFail = false;
  const config: AccountRepairConfig<TestStatus, 'accountRepair'> = {
    name: REPAIR_LOG_NAME,
    firestore: () => memory.db,
    auth: () => authFake.auth,
    profilePath,
    queueCollectionPath: 'repairQueue',
    queueEntryPath: queuePath,
    queueEntrySchema: queueSchemas.entry,
    status: {
      claimKey: STATUS_CLAIM,
      unrestricted: 'active',
      disables: (status) => status === 'blocked',
      read: (profile) => testStatusSchema.parse(profile.status),
      queueEffect: 'accountStatus',
    },
    claims: overrides.claims
      ? overrides.claims({ roster })
      : [standingClaim(async () => ({ staff: [...roster.staff] }))],
    audit: async (record) => {
      if (auditsFail) throw new Error('audit write failed');
      audits.push(record);
    },
    sweep: { store, name: 'accountRepair', fullScanMinIntervalMs: 0 },
    log: { logger, capture, accountField: 'accountId' },
    now: () => now,
  };
  const repair = createAccountRepair(config);
  return {
    memory,
    authFake,
    roster,
    audits,
    logger,
    capture,
    repair,
    failAudits() {
      auditsFail = true;
    },
    setNow(value: number) {
      now = value;
    },
    profile(uid: string, status: TestStatus) {
      memory.seed(profilePath(uid), { status });
    },
    logMessages: () => logger.info.mock.calls.map((call: unknown[]) => call[0]),
  };
}
