import type {
  ServerDocRef,
  ServerDocSnapshot,
  ServerFirestore,
} from '@ttt-productions/firebase-helpers/server';
import { runAuthFullScanLap } from '@ttt-productions/sweep-core/server';
import type {
  AuthFullScanRun,
  SweepStateStore,
  SweepUserPage,
} from '@ttt-productions/sweep-core/server';
import {
  ACCOUNT_STATUS_PENDING_REASON,
  AUTH_EFFECT_FAILED_REASON,
} from '../account-repair-queue.js';
import { isAlreadyExistsError } from '@ttt-productions/firebase-helpers/server';
import { isAuthUserNotFound, updateClaim } from './account-claims.js';
import type { AccountAuthUser, ClaimPatch, ClaimsAuth } from './account-claims.js';

export const ACCOUNT_REPAIR_DRAIN_PER_RUN = 200;

export function statusChangeAppliedLog(name: string): string {
  return `${name}: applied the status change to Auth`;
}

export function authDriftRepairedLog(name: string): string {
  return `${name}: re-applied Auth drift`;
}

export interface AccountRepairAuth extends ClaimsAuth {
  updateUser(uid: string, properties: { disabled: boolean }): Promise<unknown>;
  revokeRefreshTokens(uid: string): Promise<void>;
  listUsers(maxResults?: number, pageToken?: string): Promise<SweepUserPage<AccountAuthUser>>;
}

export type AccountRepairLogFields = Readonly<Record<string, unknown>>;

export interface AccountRepairLogger {
  info(message: string, fields?: AccountRepairLogFields): void;
  warn(message: string, fields?: AccountRepairLogFields): void;
  error(message: string, fields?: AccountRepairLogFields): void;
}

export interface AccountRepairCaptureContext {
  readonly kind: string;
  readonly level?: 'warning';
  readonly account?: string;
}

export type AccountRepairCapture = (error: unknown, context: AccountRepairCaptureContext) => void;

export interface AccountRepairLog {
  readonly logger: AccountRepairLogger;
  readonly capture: AccountRepairCapture;
  readonly accountField: string;
}

export interface KeptClaimDrift {
  readonly patch: ClaimPatch;
  readonly audit: Readonly<Record<string, unknown>>;
  confirm?(): Promise<KeptClaimDrift | null>;
  settle?(): Promise<void>;
}

export interface KeptClaimAccount {
  readonly uid: string;
  readonly claims: Readonly<Record<string, unknown>>;
}

export interface KeptClaimCheck {
  check(account: KeptClaimAccount): Promise<KeptClaimDrift | null>;
}

export interface KeptClaim {
  readonly name: string;
  readonly revokesTokens: boolean;
  prepare(): Promise<KeptClaimCheck>;
}

export interface AccountStatusConfig<Status extends string> {
  readonly claimKey: string;
  readonly unrestricted: Status;
  readonly disables: (status: Status) => boolean;
  readonly read: (profile: Record<string, unknown>, path: string) => Status;
  readonly queueEffect: string;
}

export type AccountRepairRecord<Status extends string> =
  | {
      readonly kind: 'status';
      readonly uid: string;
      readonly canonicalStatus: Status;
      readonly priorClaimStatus: string | null;
      readonly claimDrift: boolean;
      readonly disabledDrift: boolean;
      readonly appliedDisabled: boolean;
    }
  | {
      readonly kind: 'claim';
      readonly uid: string;
      readonly claim: string;
      readonly payload: Readonly<Record<string, unknown>>;
    };

export interface AccountRepairSweep<SweepName extends string> {
  readonly store: SweepStateStore<SweepName>;
  readonly name: SweepName;
  readonly fullScanMinIntervalMs: number;
}

export interface AccountRepairQueueEntryParser {
  parse(value: unknown): unknown;
}

export interface AccountRepairConfig<Status extends string, SweepName extends string> {
  readonly name: string;
  readonly firestore: () => ServerFirestore;
  readonly auth: () => AccountRepairAuth;
  readonly profilePath: (uid: string) => string;
  readonly queueCollectionPath: string;
  readonly queueEntryPath: (uid: string) => string;
  readonly queueEntrySchema: AccountRepairQueueEntryParser;
  readonly status: AccountStatusConfig<Status>;
  readonly claims: readonly KeptClaim[];
  readonly audit: (record: AccountRepairRecord<Status>) => Promise<void>;
  readonly sweep: AccountRepairSweep<SweepName>;
  readonly log: AccountRepairLog;
  readonly now?: () => number;
}

export interface AccountStatusDrift {
  readonly claimDrift: boolean;
  readonly disabledDrift: boolean;
  readonly wantDisabled: boolean;
}

export type AccountRepairOutcome = 'noAuthUser' | 'noProfile' | 'noDrift' | 'reconciled' | 'failed';

export interface AccountRepairResult<Status extends string> {
  readonly outcome: AccountRepairOutcome;
  readonly canonicalStatus: Status | null;
}

export interface AccountStatusQueueEntry<Status extends string> {
  readonly enqueuedAt: number;
  readonly attemptCount: number;
  readonly authEffect: string;
  readonly reason: typeof ACCOUNT_STATUS_PENDING_REASON;
  readonly targetStatus: Status;
  readonly writeId: string;
}

export interface AccountRepairQueueTransaction {
  set(ref: ServerDocRef, data: Record<string, unknown>): unknown;
}

export interface AccountRepairDrain {
  readonly drained: number;
  readonly reconciled: number;
  readonly retained: number;
}

export interface AccountRepairFullScan extends AuthFullScanRun {
  readonly reconciled: number;
}

export interface AccountRepair<Status extends string> {
  statusDrift(args: {
    canonicalStatus: Status;
    claimStatus: unknown;
    authDisabled: boolean;
  }): AccountStatusDrift;
  mintStatusQueueWriteId(): string;
  accountStatusQueueEntry(
    targetStatus: Status,
    writeId: string,
    now: number,
  ): AccountStatusQueueEntry<Status>;
  writeAccountStatusQueueEntry(
    transaction: AccountRepairQueueTransaction,
    uid: string,
    entry: AccountStatusQueueEntry<Status>,
  ): void;
  queueAccountClaimsRepair(uid: string, effect: string): Promise<void>;
  convergeAccountAfterStatusChange(uid: string, writeId: string): Promise<void>;
  drainQueue(): Promise<AccountRepairDrain>;
  runFullScan(now: number, minIntervalMs?: number): Promise<AccountRepairFullScan>;
}

type RepairSource = 'statusChange' | 'repair';

type ClaimChecks = ReadonlyMap<KeptClaim, KeptClaimCheck | null>;

interface RepairedClaim {
  readonly claim: KeptClaim;
  readonly drift: KeptClaimDrift;
}

const FAILED_PRECONDITION = 9;

function grpcCode(error: unknown): unknown {
  return (error as { code?: unknown } | null)?.code;
}

export function createAccountRepair<Status extends string, SweepName extends string>(
  config: AccountRepairConfig<Status, SweepName>,
): AccountRepair<Status> {
  const { status, log } = config;
  const { logger, capture } = log;
  const clock = config.now ?? Date.now;
  const fields = (uid: string, more: AccountRepairLogFields = {}) => ({
    [log.accountField]: uid,
    ...more,
  });
  const queueRef = (uid: string) => config.firestore().doc(config.queueEntryPath(uid));

  function statusDrift(args: {
    canonicalStatus: Status;
    claimStatus: unknown;
    authDisabled: boolean;
  }): AccountStatusDrift {
    const wantDisabled = status.disables(args.canonicalStatus);
    const claimStatus = typeof args.claimStatus === 'string' ? args.claimStatus : undefined;
    const neverRestricted =
      claimStatus === undefined &&
      args.canonicalStatus === status.unrestricted &&
      args.authDisabled === false;
    return {
      claimDrift: claimStatus !== args.canonicalStatus && !neverRestricted,
      disabledDrift: args.authDisabled !== wantDisabled,
      wantDisabled,
    };
  }

  async function readStatus(
    read: (ref: ServerDocRef) => Promise<ServerDocSnapshot>,
    uid: string,
  ): Promise<Status | null> {
    const path = config.profilePath(uid);
    const snapshot = await read(config.firestore().doc(path));
    if (!snapshot.exists) return null;
    return status.read(snapshot.data() ?? {}, path);
  }

  async function prepareChecks(): Promise<ClaimChecks> {
    const checks = new Map<KeptClaim, KeptClaimCheck | null>();
    for (const claim of config.claims) {
      try {
        checks.set(claim, await claim.prepare());
      } catch (error) {
        logger.error(
          `${config.name}: a claim source is unreadable; that claim waits for the next run`,
          { claim: claim.name, error },
        );
        capture(error, { kind: 'claimSource' });
        checks.set(claim, null);
      }
    }
    return checks;
  }

  async function findClaimDrift(
    claim: KeptClaim,
    check: KeptClaimCheck | null,
    account: KeptClaimAccount,
  ): Promise<{ drift: KeptClaimDrift | null; converges: boolean }> {
    if (check === null) return { drift: null, converges: false };
    try {
      const found = await check.check(account);
      if (found === null || found.confirm === undefined) return { drift: found, converges: true };
      return { drift: await found.confirm(), converges: true };
    } catch (error) {
      logger.error(
        `${config.name}: a claim could not be checked; it waits for the next run`,
        fields(account.uid, { claim: claim.name, error }),
      );
      capture(error, { kind: 'claimCheck' });
      return { drift: null, converges: false };
    }
  }

  async function repairAccount(
    uid: string,
    authUser: AccountAuthUser | null,
    checks: ClaimChecks,
    source: RepairSource,
  ): Promise<AccountRepairResult<Status>> {
    let user = authUser;
    if (user === null) {
      try {
        user = await config.auth().getUser(uid);
      } catch (error) {
        if (isAuthUserNotFound(error)) return { outcome: 'noAuthUser', canonicalStatus: null };
        logger.error(
          `${config.name}: an Auth user read failed; the next run retries it`,
          fields(uid, { error }),
        );
        capture(error, { kind: 'authRead' });
        return { outcome: 'failed', canonicalStatus: null };
      }
    }

    let canonicalStatus: Status | null;
    try {
      canonicalStatus = await readStatus((ref) => ref.get(), uid);
    } catch (error) {
      logger.error(
        `${config.name}: the profile could not be read; the next run retries it`,
        fields(uid, { error }),
      );
      capture(error, { kind: 'profileRead' });
      return { outcome: 'failed', canonicalStatus: null };
    }
    if (canonicalStatus === null) return { outcome: 'noProfile', canonicalStatus: null };

    const claims = user.customClaims ?? {};
    const claimStatus = claims[status.claimKey];
    const { claimDrift, disabledDrift, wantDisabled } = statusDrift({
      canonicalStatus,
      claimStatus,
      authDisabled: user.disabled === true,
    });
    const statusDrifted = claimDrift || disabledDrift;

    let converges = true;
    const repaired: RepairedClaim[] = [];
    for (const claim of config.claims) {
      const found = await findClaimDrift(claim, checks.get(claim) ?? null, { uid, claims });
      if (!found.converges) converges = false;
      if (found.drift) repaired.push({ claim, drift: found.drift });
    }

    if (!statusDrifted && repaired.length === 0) {
      return { outcome: converges ? 'noDrift' : 'failed', canonicalStatus };
    }

    try {
      const patch: Record<string, string | number | boolean> = {};
      if (claimDrift) patch[status.claimKey] = canonicalStatus;
      for (const { drift } of repaired) Object.assign(patch, drift.patch);
      if (Object.keys(patch).length > 0) await updateClaim(config.auth(), uid, patch);
      for (const { drift } of repaired) await drift.settle?.();
      if (disabledDrift) await config.auth().updateUser(uid, { disabled: wantDisabled });
      if (statusDrifted || repaired.some(({ claim }) => claim.revokesTokens)) {
        await config.auth().revokeRefreshTokens(uid);
      }

      if (statusDrifted && source === 'repair') {
        await config.audit({
          kind: 'status',
          uid,
          canonicalStatus,
          priorClaimStatus: typeof claimStatus === 'string' ? claimStatus : null,
          claimDrift,
          disabledDrift,
          appliedDisabled: wantDisabled,
        });
      }
      for (const { claim, drift } of repaired) {
        await config.audit({ kind: 'claim', uid, claim: claim.name, payload: drift.audit });
      }

      const repairedClaims = repaired.map(({ claim }) => claim.name);
      if (source === 'statusChange') {
        if (statusDrifted) {
          logger.info(
            statusChangeAppliedLog(config.name),
            fields(uid, { canonicalStatus, claimDrift, disabledDrift }),
          );
        }
        if (repairedClaims.length > 0) {
          logger.info(
            authDriftRepairedLog(config.name),
            fields(uid, { canonicalStatus, repairedClaims }),
          );
        }
      } else {
        logger.info(
          authDriftRepairedLog(config.name),
          fields(uid, {
            canonicalStatus,
            ...(statusDrifted ? { claimDrift, disabledDrift } : {}),
            repairedClaims,
          }),
        );
      }
      return { outcome: converges ? 'reconciled' : 'failed', canonicalStatus };
    } catch (error) {
      logger.error(
        `${config.name}: a repair failed; the next run retries it`,
        fields(uid, { error }),
      );
      capture(error, { kind: 'repair' });
      return { outcome: 'failed', canonicalStatus };
    }
  }

  async function repairOne(
    uid: string,
    authUser: AccountAuthUser | null,
    checks: ClaimChecks,
  ): Promise<AccountRepairResult<Status>> {
    try {
      return await repairAccount(uid, authUser, checks, 'repair');
    } catch (error) {
      logger.error(
        `${config.name}: repairing one account failed; the next run retries it`,
        fields(uid, { error }),
      );
      capture(error, { kind: 'account' });
      return { outcome: 'failed', canonicalStatus: null };
    }
  }

  function mintStatusQueueWriteId(): string {
    return config.firestore().collection(config.queueCollectionPath).doc().id;
  }

  function accountStatusQueueEntry(
    targetStatus: Status,
    writeId: string,
    now: number,
  ): AccountStatusQueueEntry<Status> {
    return {
      enqueuedAt: now,
      attemptCount: 0,
      authEffect: status.queueEffect,
      reason: ACCOUNT_STATUS_PENDING_REASON,
      targetStatus,
      writeId,
    };
  }

  function writeAccountStatusQueueEntry(
    transaction: AccountRepairQueueTransaction,
    uid: string,
    entry: AccountStatusQueueEntry<Status>,
  ): void {
    config.queueEntrySchema.parse(entry);
    transaction.set(queueRef(uid), { ...entry });
  }

  async function settle(
    uid: string,
    convergedStatus: Status,
    ownsEntry?: (entry: ServerDocSnapshot) => boolean,
  ): Promise<'owed' | 'settled'> {
    const entryRef = queueRef(uid);
    return config.firestore().runTransaction(async (transaction) => {
      const [statusNow, entry] = await Promise.all([
        readStatus((ref) => transaction.get(ref), uid),
        transaction.get(entryRef),
      ]);
      if (statusNow !== convergedStatus) {
        if (entry.exists || statusNow === null) return 'owed';
        writeAccountStatusQueueEntry(
          transaction,
          uid,
          accountStatusQueueEntry(statusNow, mintStatusQueueWriteId(), clock()),
        );
        return 'owed';
      }
      if (entry.exists && ownsEntry?.(entry)) transaction.delete(entryRef);
      return 'settled';
    });
  }

  async function settleSwept(
    uid: string,
    convergedStatus: Status,
  ): Promise<'owed' | 'settled' | 'failed'> {
    try {
      return await settle(uid, convergedStatus);
    } catch (error) {
      logger.error(
        `${config.name}: a converged account could not be settled; the next run retries it`,
        fields(uid, { error }),
      );
      capture(error, { kind: 'settle' });
      return 'failed';
    }
  }

  async function queueAccountClaimsRepair(uid: string, effect: string): Promise<void> {
    try {
      const entry = {
        authEffect: effect,
        enqueuedAt: clock(),
        attemptCount: 0,
        reason: AUTH_EFFECT_FAILED_REASON,
      };
      config.queueEntrySchema.parse(entry);
      await queueRef(uid).create(entry);
    } catch (error) {
      if (isAlreadyExistsError(error)) return;
      logger.error(
        `${config.name}: failed to queue the claims repair; the full scan will converge it`,
        fields(uid, { authEffect: effect, error }),
      );
      capture(error, { kind: 'queue' });
    }
  }

  async function convergeAccountAfterStatusChange(uid: string, writeId: string): Promise<void> {
    try {
      const checks = await prepareChecks();
      const { outcome, canonicalStatus } = await repairAccount(uid, null, checks, 'statusChange');
      if (outcome === 'failed' || canonicalStatus === null) return;
      try {
        await settle(uid, canonicalStatus, (entry) => entry.data()?.writeId === writeId);
      } catch (error) {
        logger.warn(
          `${config.name}: could not settle the queue entry; the drain will`,
          fields(uid, { error }),
        );
        capture(error, { kind: 'settle', level: 'warning' });
      }
    } catch (error) {
      logger.error(
        `${config.name}: applying the status change failed; the drain will`,
        fields(uid, { error }),
      );
      capture(error, { kind: 'statusChange' });
    }
  }

  async function drainQueue(): Promise<AccountRepairDrain> {
    let drained = 0;
    let reconciled = 0;
    let retained = 0;
    const page = await config
      .firestore()
      .collection(config.queueCollectionPath)
      .orderBy('attemptCount')
      .limit(ACCOUNT_REPAIR_DRAIN_PER_RUN)
      .get();
    const checks: ClaimChecks = page.empty ? new Map() : await prepareChecks();
    for (const doc of page.docs) {
      const uid = doc.id;
      drained += 1;
      const { outcome, canonicalStatus } = await repairOne(uid, null, checks);
      if (outcome === 'reconciled') reconciled += 1;

      if (outcome === 'failed') {
        retained += 1;
        const readWriteId = doc.data()?.writeId;
        const readUpdateTime = doc.updateTime;
        try {
          await config.firestore().runTransaction(async (transaction) => {
            const current = await transaction.get(doc.ref);
            const entry = current.data();
            const unchanged =
              current.exists &&
              readUpdateTime !== undefined &&
              current.updateTime !== undefined &&
              current.updateTime.isEqual(readUpdateTime) &&
              entry?.writeId === readWriteId;
            if (!unchanged) return;
            const prior = entry?.attemptCount;
            transaction.update(doc.ref, {
              attemptCount: (typeof prior === 'number' ? prior : 0) + 1,
              lastAttemptAt: clock(),
            });
          });
        } catch (error) {
          logger.error(
            `${config.name}: raising a queue entry's attempt count failed`,
            fields(uid, { error }),
          );
          capture(error, { kind: 'drain' });
        }
        continue;
      }

      if (canonicalStatus !== null && (await settleSwept(uid, canonicalStatus)) !== 'settled') {
        retained += 1;
        continue;
      }

      if (outcome === 'noProfile') {
        const message = `${config.name}: a queued account has a login but no profile; its entry is removed`;
        logger.warn(message, fields(uid));
        capture(new Error(message), { kind: 'noProfile', level: 'warning', account: uid });
      }

      try {
        await doc.ref.delete({ lastUpdateTime: doc.updateTime });
      } catch (error) {
        if (grpcCode(error) === FAILED_PRECONDITION) continue;
        logger.error(
          `${config.name}: removing a converged queue entry failed`,
          fields(uid, { error }),
        );
        capture(error, { kind: 'drain' });
      }
    }
    return { drained, reconciled, retained };
  }

  async function runFullScan(
    now: number,
    minIntervalMs: number = config.sweep.fullScanMinIntervalMs,
  ): Promise<AccountRepairFullScan> {
    let reconciled = 0;
    const checks = await prepareChecks();
    const run = await runAuthFullScanLap({
      store: config.sweep.store,
      name: config.sweep.name,
      now,
      minIntervalMs,
      users: config.auth(),
      visit: async (user) => {
        const { outcome, canonicalStatus } = await repairOne(user.uid, user, checks);
        if (outcome !== 'reconciled') return;
        reconciled += 1;
        if (canonicalStatus !== null) await settleSwept(user.uid, canonicalStatus);
      },
    });
    return { ...run, reconciled };
  }

  return {
    statusDrift,
    mintStatusQueueWriteId,
    accountStatusQueueEntry,
    writeAccountStatusQueueEntry,
    queueAccountClaimsRepair,
    convergeAccountAfterStatusChange,
    drainQueue,
    runFullScan,
  };
}
