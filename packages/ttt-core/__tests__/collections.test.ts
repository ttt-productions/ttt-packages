import { describe, it, expect } from 'vitest';
import {
  COLLECTIONS,
  USER_SUBCOLLECTIONS,
  WORK_PROJECT_SUBCOLLECTIONS,
  WORK_REALM_SUBCOLLECTIONS,
  HALL_ITEM_SUBCOLLECTIONS,
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

describe('WORK_PROJECT_SUBCOLLECTIONS', () => {
  it('all values are non-empty strings', () => {
    for (const value of allValues(WORK_PROJECT_SUBCOLLECTIONS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate values', () => {
    expect(hasDuplicates(allValues(WORK_PROJECT_SUBCOLLECTIONS))).toBe(false);
  });
});

describe('WORK_REALM_SUBCOLLECTIONS', () => {
  it('all values are non-empty strings', () => {
    for (const value of allValues(WORK_REALM_SUBCOLLECTIONS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate values', () => {
    expect(hasDuplicates(allValues(WORK_REALM_SUBCOLLECTIONS))).toBe(false);
  });

  it('carries the compound-camelCase context prefix (ARCH-104), never a bare "fileFolders"', () => {
    for (const value of allValues(WORK_REALM_SUBCOLLECTIONS)) {
      expect(value).toMatch(/^[a-z]+[A-Z]/);
    }
    expect(WORK_REALM_SUBCOLLECTIONS.REALM_FILE_FOLDERS).toBe('realmFileFolders');
    // Distinct from the WORK-side folder segment — two different file systems.
    expect(WORK_REALM_SUBCOLLECTIONS.REALM_FILE_FOLDERS).not.toBe(
      WORK_PROJECT_SUBCOLLECTIONS.WORK_FILE_FOLDERS,
    );
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

describe('ARCH-104 — compound camelCase collection names', () => {
  // Every collection / subcollection segment is compound camelCase, never a single bare
  // word: `hallItemTales` not `tales`, `takeItDownActions` not `actions`. The leading
  // underscore on the three reserved buckets (_systemData / _appConfig / _serverData) is
  // the deliberate bucket convention and is stripped before the check. This is a RULE
  // guard, not an inventory — a new single-word name fails it.
  const COMPOUND_CAMEL_CASE = /^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/;

  const maps: Array<[string, Record<string, string>]> = [
    ['COLLECTIONS', COLLECTIONS],
    ['USER_SUBCOLLECTIONS', USER_SUBCOLLECTIONS],
    ['WORK_PROJECT_SUBCOLLECTIONS', WORK_PROJECT_SUBCOLLECTIONS],
    ['WORK_REALM_SUBCOLLECTIONS', WORK_REALM_SUBCOLLECTIONS],
    ['HALL_ITEM_SUBCOLLECTIONS', HALL_ITEM_SUBCOLLECTIONS],
    ['NESTED_SUBCOLLECTIONS', NESTED_SUBCOLLECTIONS],
  ];

  for (const [mapName, map] of maps) {
    it(`${mapName} values are all compound camelCase`, () => {
      const offenders = Object.entries(map)
        .filter(([, value]) => !COMPOUND_CAMEL_CASE.test(value.replace(/^_/, '')))
        .map(([key, value]) => `${mapName}.${key} = '${value}'`);
      expect(offenders).toEqual([]);
    });
  }

  it('hall sub-item segments carry the hallItem parent context, never a bare work-type word', () => {
    expect(HALL_ITEM_SUBCOLLECTIONS.TALES).toBe('hallItemTales');
    expect(HALL_ITEM_SUBCOLLECTIONS.TUNES).toBe('hallItemTunes');
    expect(HALL_ITEM_SUBCOLLECTIONS.TELEVISION).toBe('hallItemTelevision');
  });

  it('the shared restricted-PII subcollection is one compound value for both parents', () => {
    expect(NESTED_SUBCOLLECTIONS.PRIVATE).toBe('privateDetails');
  });
});

describe('Cross-collection uniqueness', () => {
  it('COLLECTIONS values do not collide with USER_SUBCOLLECTIONS values', () => {
    const collectionValues = new Set(allValues(COLLECTIONS));
    for (const value of allValues(USER_SUBCOLLECTIONS)) {
      expect(collectionValues.has(value)).toBe(false);
    }
  });

  it('COLLECTIONS values do not collide with WORK_PROJECT_SUBCOLLECTIONS values', () => {
    const collectionValues = new Set(allValues(COLLECTIONS));
    for (const value of allValues(WORK_PROJECT_SUBCOLLECTIONS)) {
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

