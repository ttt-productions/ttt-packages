import { describe, it, expect } from 'vitest';
import { chunk } from '../src/utils/chunk';

describe('chunk', () => {
  it('returns empty array for empty input', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it('chunks a single item into a single group', () => {
    expect(chunk([1], 3)).toEqual([[1]]);
  });

  it('chunks exact multiples evenly', () => {
    expect(chunk([1, 2, 3, 4, 5, 6], 3)).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it('handles remainder in last chunk', () => {
    expect(chunk([1, 2, 3, 4, 5], 3)).toEqual([[1, 2, 3], [4, 5]]);
  });

  it('size 1 puts each item in its own chunk', () => {
    expect(chunk(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']]);
  });

  it('size larger than array returns single chunk', () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it('throws when size is 0', () => {
    expect(() => chunk([1, 2, 3], 0)).toThrow();
  });

  it('throws when size is negative', () => {
    expect(() => chunk([1, 2, 3], -1)).toThrow();
  });

  it('throws when size is non-finite', () => {
    expect(() => chunk([1, 2, 3], Infinity)).toThrow();
    expect(() => chunk([1, 2, 3], NaN)).toThrow();
  });

  it('works with string arrays', () => {
    expect(chunk(['a', 'b', 'c', 'd'], 2)).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('works with size 2', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
