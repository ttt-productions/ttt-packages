import { describe, it, expect } from 'vitest';
import { normalizeFilename } from '../src/utils/filename';

describe('normalizeFilename', () => {
  it('lowercases the base name', () => {
    expect(normalizeFilename('MyPhoto.jpg')).toBe('myphoto.jpg');
  });

  it('lowercases the extension', () => {
    expect(normalizeFilename('photo.JPG')).toBe('photo.jpg');
  });

  it('replaces spaces with hyphens', () => {
    expect(normalizeFilename('my photo.jpg')).toBe('my-photo.jpg');
  });

  it('collapses multiple spaces to a single hyphen', () => {
    expect(normalizeFilename('my  photo.jpg')).toBe('my-photo.jpg');
  });

  it('removes special characters from base', () => {
    expect(normalizeFilename('photo!@#$.jpg')).toBe('photo.jpg');
  });

  it('collapses multiple hyphens', () => {
    expect(normalizeFilename('my--photo.jpg')).toBe('my-photo.jpg');
  });

  it('removes leading/trailing hyphens from base', () => {
    expect(normalizeFilename('-photo-.jpg')).toBe('photo.jpg');
  });

  it('returns "file" for empty string', () => {
    expect(normalizeFilename('')).toBe('file');
  });

  it('returns "file" for whitespace-only string', () => {
    expect(normalizeFilename('   ')).toBe('file');
  });

  it('preserves extension when base becomes empty after sanitization', () => {
    const result = normalizeFilename('!!.jpg');
    expect(result).toBe('file.jpg');
  });

  it('handles filename without extension', () => {
    const result = normalizeFilename('myfile');
    expect(result).toBe('myfile');
  });

  it('handles normal alphanumeric filename', () => {
    expect(normalizeFilename('photo123.png')).toBe('photo123.png');
  });

  it('preserves underscores and hyphens in base', () => {
    expect(normalizeFilename('my_file-name.mp4')).toBe('my_file-name.mp4');
  });

  it('handles filename with multiple dots (keeps last extension)', () => {
    const result = normalizeFilename('my.file.name.jpg');
    expect(result).toMatch(/\.jpg$/);
  });
});
