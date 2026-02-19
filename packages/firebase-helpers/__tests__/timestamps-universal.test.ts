import { describe, it, expect, vi, afterEach } from 'vitest';
import { toMillis, toDate, now, formatDate } from '../src/firestore/timestamps-universal';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('toMillis', () => {
  it('returns the number as-is', () => {
    expect(toMillis(1700000000000)).toBe(1700000000000);
  });

  it('returns 0 for null', () => {
    expect(toMillis(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(toMillis(undefined)).toBe(0);
  });

  it('converts a Date object', () => {
    const d = new Date('2024-01-15T12:00:00.000Z');
    expect(toMillis(d)).toBe(d.getTime());
  });

  it('converts an ISO date string', () => {
    const iso = '2024-01-15T12:00:00.000Z';
    expect(toMillis(iso)).toBe(new Date(iso).getTime());
  });

  it('returns 0 for an invalid string', () => {
    expect(toMillis('not-a-date')).toBe(0);
  });

  it('converts a SerializedTimestamp {_seconds, _nanoseconds}', () => {
    const ts = { _seconds: 1700000000, _nanoseconds: 500000000 };
    expect(toMillis(ts)).toBe(1700000000 * 1000 + 500);
  });

  it('converts a SerializedTimestamp with zero nanoseconds', () => {
    const ts = { _seconds: 1000000, _nanoseconds: 0 };
    expect(toMillis(ts)).toBe(1000000 * 1000);
  });

  it('converts an object with toDate() method (Firestore Timestamp duck-typing)', () => {
    const mockDate = new Date('2024-06-01T00:00:00.000Z');
    const mockTimestamp = { toDate: () => mockDate };
    expect(toMillis(mockTimestamp)).toBe(mockDate.getTime());
  });
});

describe('toDate', () => {
  it('returns a Date for a number', () => {
    const ms = 1700000000000;
    const result = toDate(ms);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(ms);
  });

  it('returns NaN Date for null', () => {
    expect(toDate(null).getTime()).toBeNaN();
  });

  it('returns NaN Date for undefined', () => {
    expect(toDate(undefined).getTime()).toBeNaN();
  });

  it('returns the same Date object', () => {
    const d = new Date('2024-03-01');
    expect(toDate(d)).toBe(d);
  });

  it('converts an ISO string to a Date', () => {
    const iso = '2024-01-15T12:00:00.000Z';
    const result = toDate(iso);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(new Date(iso).getTime());
  });

  it('converts a SerializedTimestamp to a Date', () => {
    const ts = { _seconds: 1700000000, _nanoseconds: 0 };
    const result = toDate(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(1700000000000);
  });

  it('converts an object with toDate() method', () => {
    const mockDate = new Date('2024-06-01');
    const mockTimestamp = { toDate: () => mockDate };
    expect(toDate(mockTimestamp)).toBe(mockDate);
  });
});

describe('now', () => {
  it('returns a number', () => {
    expect(typeof now()).toBe('number');
  });

  it('returns a reasonable timestamp (after year 2020)', () => {
    expect(now()).toBeGreaterThan(new Date('2020-01-01').getTime());
  });

  it('returns current epoch ms (via Date.now)', () => {
    const before = Date.now();
    const result = now();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});

describe('formatDate', () => {
  it('returns "Invalid Date" for null', () => {
    expect(formatDate(null)).toBe('Invalid Date');
  });

  it('returns "Invalid Date" for undefined', () => {
    expect(formatDate(undefined)).toBe('Invalid Date');
  });

  it('returns "Invalid Date" for 0', () => {
    expect(formatDate(0)).toBe('Invalid Date');
  });

  it('returns a formatted string for a valid timestamp', () => {
    const result = formatDate(1700000000000);
    expect(result).not.toBe('Invalid Date');
    expect(result.length).toBeGreaterThan(0);
  });

  it('short format does not include time', () => {
    const result = formatDate(1700000000000, 'short');
    expect(result).not.toMatch(/at/);
  });

  it('long format includes "at"', () => {
    const result = formatDate(1700000000000, 'long');
    expect(result).toMatch(/at/);
  });

  it('defaults to short format', () => {
    const short = formatDate(1700000000000, 'short');
    const defaultResult = formatDate(1700000000000);
    expect(defaultResult).toBe(short);
  });
});
