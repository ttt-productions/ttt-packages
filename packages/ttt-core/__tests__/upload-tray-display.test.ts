import { describe, it, expect } from 'vitest';
import {
  formatUploadTimestamp,
  getFileTypeLabel,
  fileOriginRowLabel,
  DEFAULT_RELATIVE_TIME_CUTOFF_MS,
} from '../src/media/upload-tray-display.js';
import { formatFileSize } from '../src/utils/format.js';
import { FileOriginSchema } from '../src/media/file-origin.js';
import { AdminAuditionPromptTargetInfoSchema } from '../src/media/target-info.js';

describe('fileOriginRowLabel', () => {
  it('gives every canonical fileOrigin a non-empty label', () => {
    for (const origin of FileOriginSchema.options) {
      expect(fileOriginRowLabel[origin].length).toBeGreaterThan(0);
    }
  });

  it('labels the admin audition origin neutrally — it creates BOTH audition types', () => {
    // The origin's own target-info accepts platformAudition AND sponsoredAudition, so a
    // type-specific label (it used to say "Sponsored audition") is wrong half the time.
    const accepted = AdminAuditionPromptTargetInfoSchema.shape.type.options;
    expect([...accepted].sort()).toEqual(['platformAudition', 'sponsoredAudition']);
    expect(fileOriginRowLabel['admin-audition-prompt']).toBe('Admin audition');
  });
});

describe('formatUploadTimestamp', () => {
  it('returns "just now" for differences under 1 minute', () => {
    const now = 1_000_000_000_000;
    expect(formatUploadTimestamp(now - 30_000, now)).toBe('just now');
  });

  it('returns minutes for differences under 1 hour', () => {
    const now = 1_000_000_000_000;
    expect(formatUploadTimestamp(now - 5 * 60_000, now)).toBe('5m ago');
  });

  it('returns hours up to the cutoff', () => {
    const now = 1_000_000_000_000;
    expect(formatUploadTimestamp(now - 3 * 3_600_000, now)).toBe('3h ago');
  });

  it('uses absolute time once past the cutoff', () => {
    const now = 1_000_000_000_000;
    const result = formatUploadTimestamp(now - DEFAULT_RELATIVE_TIME_CUTOFF_MS - 1, now);
    // Should not be a relative phrase.
    expect(result).not.toMatch(/ago|just now/);
  });

  it('respects an explicit cutoff parameter', () => {
    const now = 1_000_000_000_000;
    // 30 min ago, cutoff 1 min → absolute.
    const result = formatUploadTimestamp(now - 30 * 60_000, now, 60_000);
    expect(result).not.toMatch(/ago|just now/);
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(24 * 1024)).toBe('24 KB');
  });

  it('formats megabytes with one decimal under 10MB', () => {
    expect(formatFileSize(Math.round(1.5 * 1024 * 1024))).toBe('1.5 MB');
  });

  it('formats megabytes without decimal at or above 10MB', () => {
    expect(formatFileSize(24 * 1024 * 1024)).toBe('24 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(Math.round(1.2 * 1024 * 1024 * 1024))).toBe('1.2 GB');
  });

  it('returns null for undefined / negative / non-finite', () => {
    expect(formatFileSize(undefined)).toBeNull();
    expect(formatFileSize(-5)).toBeNull();
    expect(formatFileSize(Infinity)).toBeNull();
  });
});

describe('getFileTypeLabel', () => {
  it('returns Image for image/*', () => {
    expect(getFileTypeLabel('image/jpeg')).toBe('Image');
  });
  it('returns Video for video/*', () => {
    expect(getFileTypeLabel('video/mp4')).toBe('Video');
  });
  it('returns Audio for audio/*', () => {
    expect(getFileTypeLabel('audio/mpeg')).toBe('Audio');
  });
  it('returns File for unrecognized types', () => {
    expect(getFileTypeLabel('commissionProposal/pdf')).toBe('File');
  });
  it('returns null for empty / undefined', () => {
    expect(getFileTypeLabel(undefined)).toBeNull();
    expect(getFileTypeLabel('')).toBeNull();
  });
});
