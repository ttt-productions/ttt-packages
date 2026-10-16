import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RELATIVE_TIME_CUTOFF_MS,
  FILE_ORIGIN_KEYS,
  fileOriginRowLabel,
  formatFileSize,
  formatUploadTimestamp,
  getFileTypeLabel,
} from '../src';

describe('fileOriginRowLabel', () => {
  it('gives every canonical file origin a non-empty label', () => {
    for (const origin of FILE_ORIGIN_KEYS) {
      expect(fileOriginRowLabel[origin].length).toBeGreaterThan(0);
    }
  });
});

describe('formatUploadTimestamp', () => {
  const now = 1_000_000_000_000;

  it('returns "just now" for differences under 1 minute', () => {
    expect(formatUploadTimestamp(now - 30_000, now)).toBe('just now');
  });

  it('returns minutes for differences under 1 hour', () => {
    expect(formatUploadTimestamp(now - 5 * 60_000, now)).toBe('5m ago');
  });

  it('returns hours up to the cutoff', () => {
    expect(formatUploadTimestamp(now - 3 * 3_600_000, now)).toBe('3h ago');
  });

  it('uses absolute time once past the cutoff', () => {
    expect(formatUploadTimestamp(now - DEFAULT_RELATIVE_TIME_CUTOFF_MS - 1, now)).not.toMatch(/ago|just now/);
  });

  it('respects an explicit cutoff', () => {
    expect(formatUploadTimestamp(now - 30 * 60_000, now, 60_000)).not.toMatch(/ago|just now/);
  });
});

describe('formatFileSize', () => {
  it('formats bytes, kilobytes, megabytes, and gigabytes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(24 * 1024)).toBe('24 KB');
    expect(formatFileSize(Math.round(1.5 * 1024 * 1024))).toBe('1.5 MB');
    expect(formatFileSize(24 * 1024 * 1024)).toBe('24 MB');
    expect(formatFileSize(Math.round(1.2 * 1024 * 1024 * 1024))).toBe('1.2 GB');
  });

  it('returns null for undefined, negative, or non-finite', () => {
    expect(formatFileSize(undefined)).toBeNull();
    expect(formatFileSize(-5)).toBeNull();
    expect(formatFileSize(Infinity)).toBeNull();
  });
});

describe('getFileTypeLabel', () => {
  it('names an image, a video, an audio file, and anything else', () => {
    expect(getFileTypeLabel('image/jpeg')).toBe('Image');
    expect(getFileTypeLabel('video/mp4')).toBe('Video');
    expect(getFileTypeLabel('audio/mpeg')).toBe('Audio');
    expect(getFileTypeLabel('application/pdf')).toBe('File');
  });

  it('returns null for an empty or missing type', () => {
    expect(getFileTypeLabel(undefined)).toBeNull();
    expect(getFileTypeLabel('')).toBeNull();
  });
});
