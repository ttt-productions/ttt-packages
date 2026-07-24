// Versioned-apply decision — the frozen version-comparison rule shared by the
// media serving authority DO and (later) the chat sync/projection authorities.
// A monotonically increasing `version` plus a content `payloadHash` makes every
// apply idempotent and conflict-detecting:
//
//   incoming  > stored            → apply   (newer wins; full-record replace)
//   incoming == stored, same hash → idempotent (already applied; no-op success)
//   incoming == stored, diff hash → conflict (same version, different content —
//                                   reject + alert; a real bug or replay attack)
//   incoming  < stored            → stale   (older; no-op, return the stored state)
//   no stored record yet          → apply
//
// This mirrors the chat version-comparison rule (the consuming app's chat design doc
// explains the product rationale).

export type VersionedDecision = 'apply' | 'idempotent' | 'conflict' | 'stale';

export interface VersionedCompareInput {
  incomingVersion: number;
  incomingHash: string;
  /** `null` when there is no stored record yet. */
  storedVersion: number | null;
  /** `null` when there is no stored record yet. */
  storedHash: string | null;
}

export function decideVersionedApply(input: VersionedCompareInput): VersionedDecision {
  const { incomingVersion, incomingHash, storedVersion, storedHash } = input;
  if (storedVersion === null) return 'apply';
  if (incomingVersion > storedVersion) return 'apply';
  if (incomingVersion < storedVersion) return 'stale';
  // Equal version: identical content is an idempotent retry; different content
  // at the same version is a hard conflict the caller must surface + alert on.
  return incomingHash === storedHash ? 'idempotent' : 'conflict';
}
