import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { sanitizeKey, safeOutputPathFor } from '../src/utils/safe-path';

describe('sanitizeKey', () => {
  it('passes through a safe alphanumeric key', () => {
    expect(sanitizeKey('thumb')).toBe('thumb');
    expect(sanitizeKey('variant1')).toBe('variant1');
  });

  it('allows dots, hyphens, and underscores', () => {
    expect(sanitizeKey('my-key_v1.0')).toBe('my-key_v1.0');
  });

  it('replaces forward slashes with underscores', () => {
    expect(sanitizeKey('path/to/key')).toBe('path_to_key');
  });

  it('replaces backslashes with underscores', () => {
    expect(sanitizeKey('path\\to\\key')).toBe('path_to_key');
  });

  it('collapses multiple dots into a single dot', () => {
    expect(sanitizeKey('a..b')).toBe('a.b');
    expect(sanitizeKey('a...b')).toBe('a.b');
  });

  it('replaces special characters with underscores', () => {
    expect(sanitizeKey('key!@#$%')).toBe('key_____');
  });

  it('returns "file" for an empty string', () => {
    expect(sanitizeKey('')).toBe('file');
  });

  it('limits key length to 80 characters', () => {
    const longKey = 'a'.repeat(200);
    expect(sanitizeKey(longKey).length).toBe(80);
  });

  it('sanitizes a path traversal attempt', () => {
    const result = sanitizeKey('../../../etc/passwd');
    expect(result).not.toContain('/');
    expect(result).not.toContain('..');
  });

  it('handles null-like coercion gracefully', () => {
    expect(sanitizeKey(String(undefined))).toBe('undefined');
  });
});

describe('safeOutputPathFor', () => {
  it('builds a correct output path', () => {
    const result = safeOutputPathFor('/uploads/original.jpg', 'thumb', 'webp');
    expect(result).toContain('thumb');
    expect(result).toContain('.webp');
    expect(result).toContain('original.jpg_');
  });

  it('strips leading dot from extension', () => {
    const result = safeOutputPathFor('/uploads/file.jpg', 'key', '.png');
    expect(result).toMatch(/\.png$/);
    expect(result).not.toMatch(/\.\.png/);
  });

  it('sanitizes the key in the output path', () => {
    const result = safeOutputPathFor('/uploads/file.jpg', 'my key!', 'jpg');
    expect(result).not.toContain(' ');
    expect(result).not.toContain('!');
  });

  it('produces a path with the output file in the same directory as base', () => {
    const result = safeOutputPathFor('/uploads/file.mp4', 'preview', 'jpg');
    // Normalize separators for cross-platform comparison
    const normalized = result.replace(/\\/g, '/');
    expect(normalized).toMatch(/^\/uploads\//);
  });

  it('handles a base file in nested directories', () => {
    const result = safeOutputPathFor('/a/b/c/file.png', 'variant', 'webp');
    const normalized = result.replace(/\\/g, '/');
    expect(normalized).toMatch(/^\/a\/b\/c\//);
  });

  it('includes the base filename in the output name', () => {
    const result = safeOutputPathFor('/uploads/original.jpg', 'sm', 'jpg');
    expect(result).toContain('original.jpg_sm.jpg');
  });
});
