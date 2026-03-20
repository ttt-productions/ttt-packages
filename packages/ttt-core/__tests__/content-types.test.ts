import { describe, it, expect } from 'vitest';
import { LIBRARY_TYPE_KEYS, PROJECT_TYPE_KEYS } from '../src/types/content';

describe('LIBRARY_TYPE_KEYS', () => {
  it('is an array', () => {
    expect(Array.isArray(LIBRARY_TYPE_KEYS)).toBe(true);
  });

  it('contains "entertainment"', () => {
    expect(LIBRARY_TYPE_KEYS).toContain('entertainment');
  });

  it('contains "educational"', () => {
    expect(LIBRARY_TYPE_KEYS).toContain('educational');
  });

  it('contains "newsPolitical"', () => {
    expect(LIBRARY_TYPE_KEYS).toContain('newsPolitical');
  });

  it('has exactly 3 entries', () => {
    expect(LIBRARY_TYPE_KEYS).toHaveLength(3);
  });

  it('has no duplicate values', () => {
    expect(new Set(LIBRARY_TYPE_KEYS).size).toBe(LIBRARY_TYPE_KEYS.length);
  });
});

describe('PROJECT_TYPE_KEYS', () => {
  it('is an array', () => {
    expect(Array.isArray(PROJECT_TYPE_KEYS)).toBe(true);
  });

  it('contains "Tales"', () => {
    expect(PROJECT_TYPE_KEYS).toContain('Tales');
  });

  it('contains "Tunes"', () => {
    expect(PROJECT_TYPE_KEYS).toContain('Tunes');
  });

  it('contains "Television"', () => {
    expect(PROJECT_TYPE_KEYS).toContain('Television');
  });

  it('has exactly 3 entries', () => {
    expect(PROJECT_TYPE_KEYS).toHaveLength(3);
  });

  it('has no duplicate values', () => {
    expect(new Set(PROJECT_TYPE_KEYS).size).toBe(PROJECT_TYPE_KEYS.length);
  });
});
