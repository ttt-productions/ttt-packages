import { decideVersionedApply, type VersionedDecision } from '@ttt-productions/edge-protocol-core';

export interface StoredVersioned {
  version: number;
  payloadHash: string;
}

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
