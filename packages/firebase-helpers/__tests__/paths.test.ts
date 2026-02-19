import { describe, it, expect } from 'vitest';
import { joinPath, colPath, docPath } from '../src/firestore/paths';

describe('joinPath', () => {
  it('joins segments with /', () => {
    expect(joinPath('users', 'abc123')).toBe('users/abc123');
  });

  it('strips leading and trailing slashes', () => {
    expect(joinPath('/users/', '/abc123/')).toBe('users/abc123');
  });

  it('filters null and undefined', () => {
    expect(joinPath('users', null, undefined, 'abc')).toBe('users/abc');
  });

  it('accepts numbers', () => {
    expect(joinPath('seasons', 1, 'games')).toBe('seasons/1/games');
  });
});

describe('colPath', () => {
  it('builds collection path', () => {
    expect(colPath('leagues', 'abc', 'teams')).toBe('leagues/abc/teams');
  });
});

describe('docPath', () => {
  it('builds document path', () => {
    expect(docPath('users', 'uid123')).toBe('users/uid123');
  });
});
