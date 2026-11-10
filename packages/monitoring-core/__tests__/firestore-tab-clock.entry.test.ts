import { describe, it, expect } from 'vitest';
import { isFirestoreTabClockRoundingLine } from '../src/firestore-tab-clock.js';
import * as root from '../src/index.js';

describe('isFirestoreTabClockRoundingLine', () => {
  it('is exported from the server-safe root', () => {
    expect(root.isFirestoreTabClockRoundingLine).toBe(isFirestoreTabClockRoundingLine);
  });
});
