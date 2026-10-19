import { describe, it, expect } from 'vitest';
import {
  hasPendingMutation,
  useDuplicateGuardedMutation,
  usePendingMutationTargets,
} from '../../src/react/pending-mutations.js';
import * as reactEntry from '../../src/react/index.js';

describe('pending mutations', () => {
  it('is exported from the react entry', () => {
    expect(reactEntry.useDuplicateGuardedMutation).toBe(useDuplicateGuardedMutation);
    expect(reactEntry.usePendingMutationTargets).toBe(usePendingMutationTargets);
    expect(reactEntry.hasPendingMutation).toBe(hasPendingMutation);
  });
});
