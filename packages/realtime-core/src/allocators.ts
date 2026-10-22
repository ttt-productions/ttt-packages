export interface AllocatorState {
  lastValue: number;
}

export function allocateNext(state: AllocatorState): { value: number; next: AllocatorState } {
  const value = state.lastValue + 1;
  return { value, next: { lastValue: value } };
}

export function advanceFloor(state: AllocatorState, recoveredFloor: number): AllocatorState {
  return { lastValue: Math.max(state.lastValue, recoveredFloor) };
}

export function recoveredFloor(...candidates: Array<number | null | undefined>): number {
  return candidates.reduce<number>((max, c) => (typeof c === 'number' && c > max ? c : max), 0);
}
