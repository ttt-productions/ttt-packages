/**
 * Generic versioned-apply primitives for projection / command / outbox delivery.
 *
 * Wraps `@ttt-productions/edge-protocol-core`'s frozen `decideVersionedApply`
 * rule (apply / idempotent / conflict / stale) so a DO can apply an incoming
 * authoritative item over its stored record without re-implementing the
 * comparison. The store is injected (the realtime package owns NO storage).
 */

import { decideVersionedApply, type VersionedDecision } from '@ttt-productions/edge-protocol-core';

export type { VersionedDecision } from '@ttt-productions/edge-protocol-core';

export interface StoredVersioned {
  version: number;
  payloadHash: string;
}

/** Decide whether an incoming versioned item applies over the stored one (null = no stored record). */
export function decideApply(
  incoming: { version: number; payloadHash: string },
  stored: StoredVersioned | null,
): VersionedDecision {
  return decideVersionedApply({
    incomingVersion: incoming.version,
    incomingHash: incoming.payloadHash,
    storedVersion: stored?.version ?? null,
    storedHash: stored?.payloadHash ?? null,
  });
}

export interface VersionedApplyAdapter<TItem extends { version: number; payloadHash: string }> {
  read(): Promise<StoredVersioned | null> | StoredVersioned | null;
  write(item: TItem): Promise<void> | void;
}

/**
 * Read the stored record, decide, and write on `apply`. `idempotent` and `stale`
 * are no-ops (already applied / superseded); `conflict` (same version, different
 * hash) writes nothing and is returned so the caller can alert + dead-letter.
 * Returns the decision so the delivery worker can ack/retry accordingly.
 */
export async function applyVersioned<TItem extends { version: number; payloadHash: string }>(
  incoming: TItem,
  adapter: VersionedApplyAdapter<TItem>,
): Promise<VersionedDecision> {
  const stored = await adapter.read();
  const decision = decideApply(incoming, stored);
  if (decision === 'apply') {
    await adapter.write(incoming);
  }
  return decision;
}
