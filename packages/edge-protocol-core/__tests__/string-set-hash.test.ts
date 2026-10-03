import { describe, it, expect } from 'vitest';
import { hashStringSet, sha256Hex } from '../src/index.js';

describe('hashStringSet — one canonical hash of a word-list style snapshot', () => {
  it('is the SHA-256 hex of the values sorted and joined with newlines', async () => {
    expect(await hashStringSet(['pear', 'apple', 'fig'])).toBe(await sha256Hex('apple\nfig\npear'));
  });

  it('does not depend on the order the values arrive in', async () => {
    expect(await hashStringSet(['b', 'a', 'c'])).toBe(await hashStringSet(['c', 'b', 'a']));
  });

  it('tells two different sets apart', async () => {
    expect(await hashStringSet(['a', 'b'])).not.toBe(await hashStringSet(['a', 'c']));
    expect(await hashStringSet(['a', 'b'])).not.toBe(await hashStringSet(['a', 'b', 'b']));
  });

  it('sorts by UTF-16 code unit, so every runtime orders the same values the same way', async () => {
    // Upper case sorts before lower case by code unit, unlike a locale-aware sort.
    expect(await hashStringSet(['b', 'B', 'a'])).toBe(await sha256Hex('B\na\nb'));
  });

  it('refuses a value holding the separator, which would make two sets hash alike', async () => {
    await expect(hashStringSet(['a\nb'])).rejects.toThrow(RangeError);
  });

  it('hashes an empty set to the hash of the empty string', async () => {
    expect(await hashStringSet([])).toBe(await sha256Hex(''));
  });
});
