import { describe, it, expect } from 'vitest';
import { HALL_WING_TYPE_KEYS, WORK_PROJECT_TYPE_KEYS } from '../src/types/content';

describe('HALL_WING_TYPE_KEYS', () => {
  it('is an array', () => {
    expect(Array.isArray(HALL_WING_TYPE_KEYS)).toBe(true);
  });

  it('contains "entertainment"', () => {
    expect(HALL_WING_TYPE_KEYS).toContain('entertainment');
  });

  it('contains "educational"', () => {
    expect(HALL_WING_TYPE_KEYS).toContain('educational');
  });

  it('contains "newsPolitical"', () => {
    expect(HALL_WING_TYPE_KEYS).toContain('newsPolitical');
  });

  it('has exactly 3 entries', () => {
    expect(HALL_WING_TYPE_KEYS).toHaveLength(3);
  });

  it('has no duplicate values', () => {
    expect(new Set(HALL_WING_TYPE_KEYS).size).toBe(HALL_WING_TYPE_KEYS.length);
  });
});

describe('WORK_PROJECT_TYPE_KEYS', () => {
  it('is an array', () => {
    expect(Array.isArray(WORK_PROJECT_TYPE_KEYS)).toBe(true);
  });

  it('contains "Tales"', () => {
    expect(WORK_PROJECT_TYPE_KEYS).toContain('Tales');
  });

  it('contains "Tunes"', () => {
    expect(WORK_PROJECT_TYPE_KEYS).toContain('Tunes');
  });

  it('contains "Television"', () => {
    expect(WORK_PROJECT_TYPE_KEYS).toContain('Television');
  });

  it('has exactly 3 entries', () => {
    expect(WORK_PROJECT_TYPE_KEYS).toHaveLength(3);
  });

  it('has no duplicate values', () => {
    expect(new Set(WORK_PROJECT_TYPE_KEYS).size).toBe(WORK_PROJECT_TYPE_KEYS.length);
  });
});
