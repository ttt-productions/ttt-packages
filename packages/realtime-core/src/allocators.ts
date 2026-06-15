/**
 * Monotonic allocator logic (PURE) — the generic seqAllocator / messageRevAllocator
 * semantics from Contract D. The next value is always `lastValue + 1`; a
 * restore/recovery "advances" the floor to at least a recovered maximum (max of
 * existing rows / manifest lastSeq / stored allocator) so a value can NEVER be
 * reused after an epoch delete or PITR restore. The allocator never uses rowid.
 */

export interface AllocatorState {
  lastValue: number;
}

/** Allocate the next monotonic value; returns it plus the advanced state (same-txn bump). */
export function allocateNext(state: AllocatorState): { value: number; next: AllocatorState } {
  const value = state.lastValue + 1;
  return { value, next: { lastValue: value } };
}

/**
 * Restore-advance: raise the allocator floor to at least `recoveredFloor` (the
 * max of surviving rows, manifest lastSeq, and the stored allocator). Never
 * regresses — so the next allocation exceeds anything previously issued.
 */
export function advanceFloor(state: AllocatorState, recoveredFloor: number): AllocatorState {
  return { lastValue: Math.max(state.lastValue, recoveredFloor) };
}

/** Build an allocator floor from the recovery inputs (max of all, clamped at ≥ 0). */
export function recoveredFloor(...candidates: Array<number | null | undefined>): number {
  return candidates.reduce<number>((max, c) => (typeof c === 'number' && c > max ? c : max), 0);
}
