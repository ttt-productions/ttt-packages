import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import {
  createUploadDisplayFormatters,
  formatFileSize,
  type UploadDisplayCopy,
} from '../src/upload-display.js';

const COPY: UploadDisplayCopy = {
  justNow: 'just now',
  minutesAgo: (minutes) => `${minutes}m ago`,
  hoursAgo: (hours) => `${hours}h ago`,
  yesterdayAt: (time) => `Yesterday ${time}`,
  dateAt: (date, time) => `${date}, ${time}`,
  fileType: { image: 'Image', video: 'Video', audio: 'Audio', other: 'File' },
};
const SIX_HOURS = 6 * 60 * 60 * 1000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// Calendar days are local, so the clock is pinned to a zone that keeps daylight-saving time.
const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'America/New_York';
});
afterAll(() => {
  process.env.TZ = originalTz;
});

function local(year: number, month: number, day: number, hour: number, minute: number): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const date = (ms: number) =>
  new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

describe('formatUploadTimestamp', () => {
  const { formatUploadTimestamp } = createUploadDisplayFormatters({
    copy: COPY,
    relativeTimeCutoffMs: SIX_HOURS,
    locale: 'en-US',
  });
  const now = local(2026, 5, 21, 15, 42);

  it('reads under a minute as just now', () => {
    expect(formatUploadTimestamp(now - 30_000, now)).toBe('just now');
  });

  it('reads under an hour in whole minutes', () => {
    expect(formatUploadTimestamp(now - 5 * MINUTE - 59_000, now)).toBe('5m ago');
  });

  it('reads up to the cutoff in whole hours', () => {
    expect(formatUploadTimestamp(now - 3 * HOUR - 59 * MINUTE, now)).toBe('3h ago');
  });

  it('a time in the future reads as just now', () => {
    expect(formatUploadTimestamp(now + 5 * MINUTE, now)).toBe('just now');
  });

  it('past the cutoff today reads as the clock time', () => {
    const created = local(2026, 5, 21, 8, 5);
    expect(formatUploadTimestamp(created, now)).toBe(time(created));
    expect(time(created)).toBe('8:05 AM');
  });

  it("the cutoff is the app's", () => {
    const tight = createUploadDisplayFormatters({
      copy: COPY,
      relativeTimeCutoffMs: MINUTE,
      locale: 'en-US',
    });
    const created = now - 30 * MINUTE;
    expect(tight.formatUploadTimestamp(created, now)).toBe(time(created));
  });

  it('a minute before midnight, read just after it, is yesterday', () => {
    const tight = createUploadDisplayFormatters({
      copy: COPY,
      relativeTimeCutoffMs: MINUTE,
      locale: 'en-US',
    });
    const created = local(2026, 5, 20, 23, 59);
    expect(tight.formatUploadTimestamp(created, local(2026, 5, 21, 0, 1))).toBe(
      'Yesterday 11:59 PM',
    );
  });

  it('two calendar days back reads as the date and time', () => {
    const created = local(2026, 5, 19, 22, 10);
    expect(formatUploadTimestamp(created, now)).toBe(`${date(created)}, ${time(created)}`);
    expect(date(created)).toBe('May 19');
  });

  it('across the spring-forward night, yesterday is the previous calendar day, not 24 hours back', () => {
    // 8 March 2026 is 23 hours long in New York. Just after midnight on the 9th, 24 hours back is
    // still the 7th — but the 7th is two calendar days back, never yesterday.
    const reading = local(2026, 3, 9, 0, 30);
    const onThe7th = local(2026, 3, 7, 23, 45);
    expect(formatUploadTimestamp(onThe7th, reading)).toBe(`Mar 7, ${time(onThe7th)}`);
    const onThe8th = local(2026, 3, 8, 9, 0);
    expect(formatUploadTimestamp(onThe8th, reading)).toBe(`Yesterday ${time(onThe8th)}`);
  });

  it('across the fall-back night, the whole 25-hour previous day is yesterday', () => {
    // 1 November 2026 is 25 hours long in New York.
    const reading = local(2026, 11, 2, 23, 30);
    const earlyOnThe1st = local(2026, 11, 1, 0, 15);
    expect(formatUploadTimestamp(earlyOnThe1st, reading)).toBe(`Yesterday ${time(earlyOnThe1st)}`);
  });

  it("the clock time and date follow the app's locale", () => {
    const british = createUploadDisplayFormatters({
      copy: COPY,
      relativeTimeCutoffMs: SIX_HOURS,
      locale: 'en-GB',
    });
    const created = local(2026, 5, 19, 22, 10);
    expect(british.formatUploadTimestamp(created, now)).toBe('19 May, 22:10');
  });
});

describe('getFileTypeLabel', () => {
  const { getFileTypeLabel } = createUploadDisplayFormatters({
    copy: COPY,
    relativeTimeCutoffMs: SIX_HOURS,
  });

  it('names images, videos and audio, and anything else as the other kind', () => {
    expect(getFileTypeLabel('image/jpeg')).toBe('Image');
    expect(getFileTypeLabel('video/mp4')).toBe('Video');
    expect(getFileTypeLabel('audio/mpeg')).toBe('Audio');
    expect(getFileTypeLabel('application/pdf')).toBe('File');
  });

  it('has no kind for a missing or empty content type', () => {
    expect(getFileTypeLabel(undefined)).toBeNull();
    expect(getFileTypeLabel('')).toBeNull();
  });

  it("the words are the app's", () => {
    const french = createUploadDisplayFormatters({
      copy: {
        ...COPY,
        fileType: { image: 'Photo', video: 'Vidéo', audio: 'Son', other: 'Fichier' },
      },
      relativeTimeCutoffMs: SIX_HOURS,
    });
    expect(french.getFileTypeLabel('image/png')).toBe('Photo');
    expect(french.getFileTypeLabel('text/plain')).toBe('Fichier');
  });
});

describe('formatFileSize', () => {
  it('formats bytes, kilobytes, megabytes and gigabytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1023)).toBe('1023 B');
    expect(formatFileSize(24 * 1024)).toBe('24 KB');
    expect(formatFileSize(Math.round(1.5 * 1024 * 1024))).toBe('1.5 MB');
    expect(formatFileSize(24 * 1024 * 1024)).toBe('24 MB');
    expect(formatFileSize(Math.round(1.2 * 1024 * 1024 * 1024))).toBe('1.2 GB');
    expect(formatFileSize(12 * 1024 * 1024 * 1024)).toBe('12 GB');
  });

  it('has no size for a missing, negative or non-finite count', () => {
    expect(formatFileSize(undefined)).toBeNull();
    expect(formatFileSize(-5)).toBeNull();
    expect(formatFileSize(Infinity)).toBeNull();
    expect(formatFileSize(Number.NaN)).toBeNull();
  });
});
