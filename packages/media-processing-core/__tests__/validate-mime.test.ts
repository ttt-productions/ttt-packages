import { describe, it, expect } from 'vitest';
import { validateMime } from '../src/validation/validate-mime';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'audio/mpeg'];

describe('validateMime', () => {
  it('returns true for an allowed mime type', () => {
    expect(validateMime('image/jpeg', ALLOWED_MIMES)).toBe(true);
  });

  it('returns true for each allowed mime', () => {
    for (const mime of ALLOWED_MIMES) {
      expect(validateMime(mime, ALLOWED_MIMES)).toBe(true);
    }
  });

  it('returns false for a disallowed mime type', () => {
    expect(validateMime('application/pdf', ALLOWED_MIMES)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(validateMime('', ALLOWED_MIMES)).toBe(false);
  });

  it('returns false when allowed list is empty', () => {
    expect(validateMime('image/jpeg', [])).toBe(false);
  });

  it('is case-sensitive (mime types should be lowercase)', () => {
    expect(validateMime('IMAGE/JPEG', ALLOWED_MIMES)).toBe(false);
  });

  it('returns false for similar but unlisted mime', () => {
    expect(validateMime('image/gif', ALLOWED_MIMES)).toBe(false);
    expect(validateMime('video/webm', ALLOWED_MIMES)).toBe(false);
  });

  it('returns true for video/mp4', () => {
    expect(validateMime('video/mp4', ALLOWED_MIMES)).toBe(true);
  });
});
