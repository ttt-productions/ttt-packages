import { describe, it, expect } from 'vitest';
import { joinPath, colPath, docPath } from '../src/firestore/paths.js';

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
    expect(joinPath('folders', 1, 'files')).toBe('folders/1/files');
  });
});

describe('colPath', () => {
  it('builds collection path', () => {
    expect(colPath('groups', 'abc', 'members')).toBe('groups/abc/members');
  });
});

describe('docPath', () => {
  it('builds document path', () => {
    expect(docPath('users', 'uid123')).toBe('users/uid123');
  });
});
