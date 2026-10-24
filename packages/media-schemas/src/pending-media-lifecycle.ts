import type { z } from 'zod';
import { PendingMediaStatusSchema } from './factories/pending-media.js';

const STATUS = PendingMediaStatusSchema.enum;

export type PendingMediaStatus = z.infer<typeof PendingMediaStatusSchema>;
export type PendingMediaNonTerminalStatus = typeof STATUS.pending | typeof STATUS.processing;
export const PENDING_MEDIA_TERMINAL_STATUSES = [
  STATUS.completed,
  STATUS.failed,
  STATUS.rejected,
] as const;
export type PendingMediaTerminalStatus = (typeof PENDING_MEDIA_TERMINAL_STATUSES)[number];

export function isPendingMediaTerminalStatus(
  status: unknown,
): status is PendingMediaTerminalStatus {
  return (PENDING_MEDIA_TERMINAL_STATUSES as readonly unknown[]).includes(status);
}

export function isPendingMediaNonTerminalStatus(
  status: unknown,
): status is PendingMediaNonTerminalStatus {
  return status === STATUS.pending || status === STATUS.processing;
}

export interface PendingMediaClaimPolicy {
  leaseMs: number;
  maxAttempts: number;
}

export interface ClaimablePendingMedia {
  status: PendingMediaStatus;
  createdAt: number;
  processingStartedAt?: number;
  processingAttemptCount?: number;
  processingLeaseExpiresAt?: number;
}

export interface PendingMediaClaimWrite {
  status: typeof STATUS.processing;
  processingAttemptCount: number;
  processingStartedAt: number;
  processingLeaseExpiresAt: number;
  updatedAt: number;
}

export type ClaimedPendingMedia<TRow extends ClaimablePendingMedia> =
  Extract<TRow, { status: PendingMediaNonTerminalStatus }> extends infer T
    ? T extends unknown
      ? Omit<T, keyof PendingMediaClaimWrite> & PendingMediaClaimWrite
      : never
    : never;

export type PendingMediaClaimOutcome<TRow extends ClaimablePendingMedia> =
  | { kind: 'claimed'; pendingFile: ClaimedPendingMedia<TRow>; attempt: number }
  | { kind: 'busy'; leaseExpiresAt: number }
  | { kind: 'terminal'; status: PendingMediaTerminalStatus }
  | { kind: 'exhausted'; pendingFile: TRow; attempts: number }
  | { kind: 'missing' };

export interface PendingMediaClaimDecision<TRow extends ClaimablePendingMedia> {
  outcome: PendingMediaClaimOutcome<TRow>;
  write?: PendingMediaClaimWrite;
}

function buildClaimWrite(
  attempt: number,
  now: number,
  policy: PendingMediaClaimPolicy,
): PendingMediaClaimWrite {
  return {
    status: STATUS.processing,
    processingAttemptCount: attempt,
    processingStartedAt: now,
    processingLeaseExpiresAt: now + policy.leaseMs,
    updatedAt: now,
  };
}

export function effectivePendingMediaLeaseExpiry(
  current: ClaimablePendingMedia,
  policy: Pick<PendingMediaClaimPolicy, 'leaseMs'>,
): number {
  if (typeof current.processingLeaseExpiresAt === 'number') return current.processingLeaseExpiresAt;
  if (typeof current.processingStartedAt === 'number')
    return current.processingStartedAt + policy.leaseMs;
  return current.createdAt + policy.leaseMs;
}

export function decidePendingMediaClaim<TRow extends ClaimablePendingMedia>(
  current: TRow,
  now: number,
  policy: PendingMediaClaimPolicy,
): PendingMediaClaimDecision<TRow> {
  const claim = (attempt: number): PendingMediaClaimDecision<TRow> => {
    const write = buildClaimWrite(attempt, now, policy);
    // TypeScript cannot check a value against a per-variant type over a generic row; the claim tests pin both.
    const pendingFile = { ...current, ...write } as unknown as ClaimedPendingMedia<TRow>;
    return { outcome: { kind: 'claimed', pendingFile, attempt }, write };
  };

  switch (current.status) {
    case STATUS.completed:
    case STATUS.failed:
    case STATUS.rejected:
      return { outcome: { kind: 'terminal', status: current.status } };

    case STATUS.pending:
      return claim((current.processingAttemptCount ?? 0) + 1);

    case STATUS.processing: {
      const leaseExpiresAt = effectivePendingMediaLeaseExpiry(current, policy);
      if (leaseExpiresAt > now) return { outcome: { kind: 'busy', leaseExpiresAt } };
      const attemptsSoFar = current.processingAttemptCount ?? 1;
      if (attemptsSoFar >= policy.maxAttempts) {
        return { outcome: { kind: 'exhausted', pendingFile: current, attempts: attemptsSoFar } };
      }
      return claim(attemptsSoFar + 1);
    }
  }
}

export type PendingMediaFinalizeDecision = 'applied' | 'noop' | 'conflict' | 'missing';

export interface PendingMediaFinalizeResult {
  decision: PendingMediaFinalizeDecision;
  currentStatus?: string;
}

export function decidePendingMediaFinalize(
  current: { status?: unknown } | undefined,
  targetStatus: PendingMediaTerminalStatus,
): PendingMediaFinalizeResult {
  if (current === undefined) return { decision: 'missing' };
  const status = current.status;
  if (isPendingMediaNonTerminalStatus(status)) return { decision: 'applied' };
  if (status === targetStatus) return { decision: 'noop', currentStatus: targetStatus };
  return { decision: 'conflict', currentStatus: status === undefined ? undefined : String(status) };
}

// Plain object types, not interfaces: an interface is not assignable to an index-signature type
// (a Firestore update's data).

export type PendingMediaCompletedTerminalFields = {
  status: typeof STATUS.completed;
  completedAt: number;
  terminalAt: number;
  updatedAt: number;
};

export type PendingMediaFailedTerminalFields = {
  status: typeof STATUS.failed;
  failedAt: number;
  terminalAt: number;
  updatedAt: number;
};

export type PendingMediaRejectedTerminalFields = {
  status: typeof STATUS.rejected;
  rejectedAt: number;
  terminalAt: number;
  updatedAt: number;
};

export type PendingMediaTerminalFields<
  S extends PendingMediaTerminalStatus = PendingMediaTerminalStatus,
> = S extends typeof STATUS.completed
  ? PendingMediaCompletedTerminalFields
  : S extends typeof STATUS.failed
    ? PendingMediaFailedTerminalFields
    : PendingMediaRejectedTerminalFields;

export function buildPendingMediaTerminalFields(
  status: typeof STATUS.completed,
  extraFields: Record<string, never>,
  now: number,
): PendingMediaCompletedTerminalFields;
export function buildPendingMediaTerminalFields(
  status: typeof STATUS.failed,
  extraFields: Record<string, never>,
  now: number,
): PendingMediaFailedTerminalFields;
export function buildPendingMediaTerminalFields(
  status: typeof STATUS.rejected,
  extraFields: Record<string, never>,
  now: number,
): PendingMediaRejectedTerminalFields;
export function buildPendingMediaTerminalFields<
  S extends PendingMediaTerminalStatus,
  E extends Record<string, unknown>,
>(status: S, extraFields: E, now: number): PendingMediaTerminalFields<S> & E;
export function buildPendingMediaTerminalFields(
  status: PendingMediaTerminalStatus,
  extraFields: Record<string, unknown>,
  now: number,
): PendingMediaTerminalFields & Record<string, unknown> {
  switch (status) {
    case STATUS.completed:
      return { status, terminalAt: now, updatedAt: now, ...extraFields, completedAt: now };
    case STATUS.failed:
      return { status, terminalAt: now, updatedAt: now, ...extraFields, failedAt: now };
    case STATUS.rejected:
      return { status, terminalAt: now, updatedAt: now, ...extraFields, rejectedAt: now };
  }
}
