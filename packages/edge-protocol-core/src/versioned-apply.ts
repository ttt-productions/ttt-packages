export type VersionedDecision = 'apply' | 'idempotent' | 'conflict' | 'stale';

export interface VersionedCompareInput {
  incomingVersion: number;
  incomingHash: string;
  storedVersion: number | null;
  storedHash: string | null;
}

export function decideVersionedApply(input: VersionedCompareInput): VersionedDecision {
  const { incomingVersion, incomingHash, storedVersion, storedHash } = input;
  if (storedVersion === null) return 'apply';
  if (incomingVersion > storedVersion) return 'apply';
  if (incomingVersion < storedVersion) return 'stale';
  return incomingHash === storedHash ? 'idempotent' : 'conflict';
}
