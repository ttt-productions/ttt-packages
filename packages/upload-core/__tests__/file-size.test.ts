import { describe, it, expect } from 'vitest';
import { getFileSize } from '../src/utils/file-size';

describe('getFileSize', () => {
  it('returns size from a Blob-like object', () => {
    const blob = { size: 1024 } as Blob;
    expect(getFileSize(blob)).toBe(1024);
  });

  it('returns 0 for zero size', () => {
    const blob = { size: 0 } as Blob;
    expect(getFileSize(blob)).toBe(0);
  });

  it('returns the correct size for a large file', () => {
    const blob = { size: 5 * 1024 * 1024 } as Blob;
    expect(getFileSize(blob)).toBe(5242880);
  });

  it('returns 0 when size is missing', () => {
    const blob = {} as Blob;
    expect(getFileSize(blob)).toBe(0);
  });

  it('returns 0 when size is negative', () => {
    const blob = { size: -100 } as Blob;
    expect(getFileSize(blob)).toBe(0);
  });

  it('returns 0 when size is NaN', () => {
    const blob = { size: NaN } as unknown as Blob;
    expect(getFileSize(blob)).toBe(0);
  });

  it('returns 0 when size is a string', () => {
    const blob = { size: '1024' } as unknown as Blob;
    expect(getFileSize(blob)).toBe(0);
  });

  it('works with a real Blob', () => {
    const content = 'hello world';
    const blob = new Blob([content]);
    expect(getFileSize(blob)).toBe(content.length);
  });
});
