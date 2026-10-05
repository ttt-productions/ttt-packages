import { describe, it, expect } from 'vitest';
import { FIRESTORE_SEARCH_MIN_LENGTH, isSearchableText } from '../src/index.js';

describe('the search text rule', () => {
  it('searches a text whose trimmed length reaches the minimum', () => {
    const atMinimum = 'a'.repeat(FIRESTORE_SEARCH_MIN_LENGTH);
    expect(isSearchableText(atMinimum)).toBe(true);
    expect(isSearchableText(` ${atMinimum.toUpperCase()} `)).toBe(true);
  });

  it('does not search a text whose surrounding spaces carry it to the minimum', () => {
    const shortByOne = 'a'.repeat(FIRESTORE_SEARCH_MIN_LENGTH - 1);
    expect(isSearchableText(`${shortByOne} `)).toBe(false);
    expect(isSearchableText(' '.repeat(FIRESTORE_SEARCH_MIN_LENGTH))).toBe(false);
  });
});
