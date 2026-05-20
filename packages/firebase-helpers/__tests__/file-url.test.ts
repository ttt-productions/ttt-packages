import { describe, it, expect } from 'vitest';
import { getFileNameFromUrl } from '../src/utils/file-url';

describe('getFileNameFromUrl', () => {
  it('returns empty string for empty input', () => {
    expect(getFileNameFromUrl('')).toBe('');
  });

  it('returns empty string for non-Storage URL', () => {
    expect(getFileNameFromUrl('https://example.com/image.jpg')).toBe('');
  });

  it('returns empty string for URL without /o/ segment', () => {
    expect(getFileNameFromUrl('https://firebaseapp.com/file.jpg')).toBe('');
  });

  it('extracts filename from a basic Storage URL', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/images%2Fphoto.jpg?alt=media&token=abc';
    expect(getFileNameFromUrl(url)).toBe('photo.jpg');
  });

  it('strips query string before decoding', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/file.png?alt=media';
    expect(getFileNameFromUrl(url)).toBe('file.png');
  });

  it('decodes URL-encoded paths', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/folder%2Fsub%2Fmy%20file.pdf?alt=media';
    expect(getFileNameFromUrl(url)).toBe('my file.pdf');
  });

  it('handles nested paths and returns only the last segment', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/a%2Fb%2Fc%2Fdeep.txt?token=xyz';
    expect(getFileNameFromUrl(url)).toBe('deep.txt');
  });

  it('returns filename when no query string present', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/simple.jpg';
    expect(getFileNameFromUrl(url)).toBe('simple.jpg');
  });
});
