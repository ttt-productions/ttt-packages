import { describe, it, expect } from 'vitest';
import { joinPath } from '../src/utils/paths';

describe('joinPath', () => {
  it('joins two simple segments', () => {
    expect(joinPath('a', 'b')).toBe('a/b');
  });

  it('joins multiple segments', () => {
    expect(joinPath('a', 'b', 'c')).toBe('a/b/c');
  });

  it('filters empty string segments', () => {
    expect(joinPath('a', '', 'b')).toBe('a/b');
  });

  it('collapses multiple slashes', () => {
    expect(joinPath('a/', '/b')).toBe('a/b');
  });

  it('handles segments with trailing slashes', () => {
    expect(joinPath('path/to/', 'file')).toBe('path/to/file');
  });

  it('handles segments with leading slashes', () => {
    expect(joinPath('path', '/to/file')).toBe('path/to/file');
  });

  it('returns single segment unchanged', () => {
    expect(joinPath('alone')).toBe('alone');
  });

  it('returns empty string for all-empty segments', () => {
    expect(joinPath('', '')).toBe('');
  });

  it('handles no arguments (no parts)', () => {
    expect(joinPath()).toBe('');
  });

  it('handles deep paths', () => {
    expect(joinPath('users', 'abc123', 'uploads', 'file.jpg')).toBe('users/abc123/uploads/file.jpg');
  });
});
