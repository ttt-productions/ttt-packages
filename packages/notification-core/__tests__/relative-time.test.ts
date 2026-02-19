import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime } from '../src/components/relative-time';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('formatRelativeTime', () => {
  const BASE_NOW = 1700000000000; // fixed reference point

  function setNow(ms: number) {
    vi.spyOn(Date, 'now').mockReturnValue(ms);
  }

  it('returns "just now" for 0 seconds ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW)).toBe('just now');
  });

  it('returns "just now" for 30 seconds ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 30 * 1000)).toBe('just now');
  });

  it('returns "just now" for 59 seconds ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 59 * 1000)).toBe('just now');
  });

  it('returns "1m ago" for exactly 60 seconds ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 60 * 1000)).toBe('1m ago');
  });

  it('returns "2m ago" for 2 minutes ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 2 * 60 * 1000)).toBe('2m ago');
  });

  it('returns "59m ago" for 59 minutes ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 59 * 60 * 1000)).toBe('59m ago');
  });

  it('returns "1h ago" for exactly 1 hour ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 60 * 60 * 1000)).toBe('1h ago');
  });

  it('returns "3h ago" for 3 hours ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 3 * 60 * 60 * 1000)).toBe('3h ago');
  });

  it('returns "23h ago" for 23 hours ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 23 * 60 * 60 * 1000)).toBe('23h ago');
  });

  it('returns "1d ago" for exactly 1 day ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 24 * 60 * 60 * 1000)).toBe('1d ago');
  });

  it('returns "3d ago" for 3 days ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 3 * 24 * 60 * 60 * 1000)).toBe('3d ago');
  });

  it('returns "6d ago" for 6 days ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 6 * 24 * 60 * 60 * 1000)).toBe('6d ago');
  });

  it('returns "1w ago" for exactly 7 days ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 7 * 24 * 60 * 60 * 1000)).toBe('1w ago');
  });

  it('returns "2w ago" for 14 days ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 14 * 24 * 60 * 60 * 1000)).toBe('2w ago');
  });

  it('returns "4w ago" for 29 days ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 29 * 24 * 60 * 60 * 1000)).toBe('4w ago');
  });

  it('returns "1mo ago" for 30 days ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 30 * 24 * 60 * 60 * 1000)).toBe('1mo ago');
  });

  it('returns "2mo ago" for 60 days ago', () => {
    setNow(BASE_NOW);
    expect(formatRelativeTime(BASE_NOW - 60 * 24 * 60 * 60 * 1000)).toBe('2mo ago');
  });
});
