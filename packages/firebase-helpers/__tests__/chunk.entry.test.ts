import { describe, it, expect } from 'vitest';
import { FIRESTORE_IN_FILTER_LIMIT } from '../src/utils/chunk';
import * as root from '../src/index';

describe('FIRESTORE_IN_FILTER_LIMIT', () => {
  it('is exported from the server-safe root', () => {
    expect(root.FIRESTORE_IN_FILTER_LIMIT).toBe(FIRESTORE_IN_FILTER_LIMIT);
  });
});
