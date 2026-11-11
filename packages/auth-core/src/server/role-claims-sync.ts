import { isAuthUserNotFound, updateClaim } from './account-claims.js';
import type { ClaimPatch, ClaimsAuth } from './account-claims.js';
import type { AccountRepairLog } from './account-repair.js';

export type RoleClaims = Readonly<Record<string, boolean>>;

export interface RoleClaimsAuth extends ClaimsAuth {
  revokeRefreshTokens(uid: string): Promise<void>;
}

export type RoleClaimsSyncOutcome =
  | { readonly result: 'success' }
  | { readonly result: 'failure'; readonly reason: 'authUserMissing' }
  | { readonly result: 'failure'; readonly reason: 'applyFailed'; readonly error: unknown };

export interface RoleClaimsSyncRecord {
  readonly uid: string;
  readonly before: RoleClaims;
  readonly after: RoleClaims;
  readonly outcome: RoleClaimsSyncOutcome;
}

export interface RoleClaimsSyncRequest<List> {
  readonly before: List;
  readonly after: List;
  readonly accountsOf: (list: List) => Iterable<string>;
  readonly rolesOf: (list: List, uid: string) => RoleClaims;
  readonly readList: () => Promise<List>;
  readonly claimPatch: (roles: RoleClaims) => ClaimPatch;
  readonly auth: () => RoleClaimsAuth;
  readonly record: (record: RoleClaimsSyncRecord) => Promise<void>;
  readonly queueRepair: (uid: string) => Promise<void>;
  readonly name: string;
  readonly log: AccountRepairLog;
}

export interface RoleClaimsSyncResult {
  readonly applied: number;
  readonly skippedUserNotFound: number;
}

function sameRoles(a: RoleClaims, b: RoleClaims): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? false) === (b[key] ?? false));
}

export function changedRoleAccounts<List>(
  request: Pick<RoleClaimsSyncRequest<List>, 'before' | 'after' | 'accountsOf' | 'rolesOf'>,
): string[] {
  const { before, after, accountsOf, rolesOf } = request;
  const accounts = new Set([...accountsOf(before), ...accountsOf(after)]);
  return [...accounts].filter((uid) => !sameRoles(rolesOf(before, uid), rolesOf(after, uid)));
}

export async function runRoleClaimsSync<List>(
  request: RoleClaimsSyncRequest<List>,
): Promise<RoleClaimsSyncResult> {
  const { log } = request;
  const accounts = changedRoleAccounts(request);
  if (accounts.length === 0) return { applied: 0, skippedUserNotFound: 0 };
  const list = await request.readList();

  const syncOne = async (uid: string): Promise<'applied' | 'skipped'> => {
    const roles = request.rolesOf(list, uid);
    const before = request.rolesOf(request.before, uid);
    try {
      await updateClaim(request.auth(), uid, request.claimPatch(roles));
      await request.auth().revokeRefreshTokens(uid);
    } catch (error) {
      if (isAuthUserNotFound(error)) {
        log.logger.warn(`${request.name}: no Auth user for an account on the list`, {
          [log.accountField]: uid,
        });
        await request.record({
          uid,
          before,
          after: roles,
          outcome: { result: 'failure', reason: 'authUserMissing' },
        });
        return 'skipped';
      }
      log.logger.error(`${request.name}: the account's claims could not be applied`, {
        [log.accountField]: uid,
        error,
      });
      try {
        await request.record({
          uid,
          before,
          after: roles,
          outcome: { result: 'failure', reason: 'applyFailed', error },
        });
      } catch (recordError) {
        log.capture(recordError, { kind: 'failureAudit' });
      }
      await request.queueRepair(uid);
      throw error;
    }
    await request.record({ uid, before, after: roles, outcome: { result: 'success' } });
    return 'applied';
  };

  const settled = await Promise.allSettled(accounts.map(syncOne));
  const failure = settled.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failure) throw failure.reason;
  return {
    applied: settled.filter((result) => result.status === 'fulfilled' && result.value === 'applied')
      .length,
    skippedUserNotFound: settled.filter(
      (result) => result.status === 'fulfilled' && result.value === 'skipped',
    ).length,
  };
}
