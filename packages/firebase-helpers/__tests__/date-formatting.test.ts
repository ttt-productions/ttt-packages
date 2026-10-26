import { Timestamp } from 'firebase/firestore';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDateDisplay } from '../src/firestore-client/date-formatting.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('formatDateDisplay', () => {
  it('returns fallback for null', () => {
    expect(formatDateDisplay(null)).toBe('Unknown');
  });

  it('returns fallback for undefined', () => {
    expect(formatDateDisplay(undefined)).toBe('Unknown');
  });

  it('uses custom fallback string', () => {
    expect(formatDateDisplay(null, 'PPP', 'N/A')).toBe('N/A');
  });

  it('formats a Date object', () => {
    const date = new Date(2024, 0, 1);
    const result = formatDateDisplay(date, 'PPP');
    expect(result).toBe('January 1st, 2024');
  });

  it('formats a Firestore Timestamp', () => {
    const result = formatDateDisplay(Timestamp.fromDate(new Date(2024, 0, 1)), 'PPP');
    expect(result).toBe('January 1st, 2024');
  });

  it('formats a number (epoch ms)', () => {
    const epochMs = new Date(2024, 0, 1).getTime();
    const result = formatDateDisplay(epochMs, 'yyyy-MM-dd');
    expect(result).toBe('2024-01-01');
  });

  it('formats an ISO date string', () => {
    const result = formatDateDisplay('2024-01-01T12:00:00', 'HH:mm');
    expect(result).toBe('12:00');
  });

  it('returns fallback for invalid string', () => {
    expect(formatDateDisplay('not-a-date')).toBe('Unknown');
  });

  it('uses default format "PPP" when not specified', () => {
    const date = new Date(2024, 0, 1);
    const result = formatDateDisplay(date);
    expect(result).toBe('January 1st, 2024');
  });

  it('returns fallback when format throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = formatDateDisplay(new Date(Number.NaN), 'PPP', 'Error');
    expect(result).toBe('Error');
  });
});
