import { describe, it, expect } from 'vitest';
import {
  COLLECTIONS,
  USER_SUBCOLLECTIONS,
  PROJECT_SUBCOLLECTIONS,
  NESTED_SUBCOLLECTIONS,
  SPECIAL_DOCS,
} from '../src/paths/collections';

function allValues(obj: Record<string, string>): string[] {
  return Object.values(obj);
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

describe('COLLECTIONS', () => {
  it('all values are non-empty strings', () => {
    for (const value of allValues(COLLECTIONS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate values', () => {
    expect(hasDuplicates(allValues(COLLECTIONS))).toBe(false);
  });
});

describe('USER_SUBCOLLECTIONS', () => {
  it('all values are non-empty strings', () => {
    for (const value of allValues(USER_SUBCOLLECTIONS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate values', () => {
    expect(hasDuplicates(allValues(USER_SUBCOLLECTIONS))).toBe(false);
  });
});

describe('PROJECT_SUBCOLLECTIONS', () => {
  it('all values are non-empty strings', () => {
    for (const value of allValues(PROJECT_SUBCOLLECTIONS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate values', () => {
    expect(hasDuplicates(allValues(PROJECT_SUBCOLLECTIONS))).toBe(false);
  });
});

describe('NESTED_SUBCOLLECTIONS', () => {
  it('all values are non-empty strings', () => {
    for (const value of allValues(NESTED_SUBCOLLECTIONS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate values', () => {
    expect(hasDuplicates(allValues(NESTED_SUBCOLLECTIONS))).toBe(false);
  });
});

describe('SPECIAL_DOCS', () => {
  it('all values are non-empty strings', () => {
    for (const value of allValues(SPECIAL_DOCS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate values', () => {
    expect(hasDuplicates(allValues(SPECIAL_DOCS))).toBe(false);
  });
});

describe('Cross-collection uniqueness', () => {
  it('COLLECTIONS values do not collide with USER_SUBCOLLECTIONS values', () => {
    const collectionValues = new Set(allValues(COLLECTIONS));
    for (const value of allValues(USER_SUBCOLLECTIONS)) {
      expect(collectionValues.has(value)).toBe(false);
    }
  });

  it('COLLECTIONS values do not collide with PROJECT_SUBCOLLECTIONS values', () => {
    const collectionValues = new Set(allValues(COLLECTIONS));
    for (const value of allValues(PROJECT_SUBCOLLECTIONS)) {
      expect(collectionValues.has(value)).toBe(false);
    }
  });

  it('COLLECTIONS values do not collide with NESTED_SUBCOLLECTIONS values', () => {
    const collectionValues = new Set(allValues(COLLECTIONS));
    for (const value of allValues(NESTED_SUBCOLLECTIONS)) {
      expect(collectionValues.has(value)).toBe(false);
    }
  });
});
