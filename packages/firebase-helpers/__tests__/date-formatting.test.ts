import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDateDisplay } from '../src/firestore/date-formatting';

// Mock date-fns format so we don't depend on locale/timezone behavior
vi.mock('date-fns', () => ({
  format: vi.fn((date: Date, fmt: string) => {
    if (fmt === 'PPP') return 'Jan 1, 2024';
    if (fmt === 'yyyy-MM-dd') return '2024-01-01';
    if (fmt === 'HH:mm') return '12:00';
    return `formatted(${date.getTime()},${fmt})`;
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
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
    expect(result).toBe('Jan 1, 2024');
  });

  it('formats a Firestore Timestamp-like object', () => {
    const ts = {
      toDate: () => new Date(2024, 0, 1),
      seconds: 1704067200,
      nanoseconds: 0,
    };
    const result = formatDateDisplay(ts as any, 'PPP');
    expect(result).toBe('Jan 1, 2024');
  });

  it('formats a number (epoch ms)', () => {
    const epochMs = new Date(2024, 0, 1).getTime();
    const result = formatDateDisplay(epochMs, 'yyyy-MM-dd');
    expect(result).toBe('2024-01-01');
  });

  it('formats an ISO date string', () => {
    const result = formatDateDisplay('2024-01-01', 'HH:mm');
    expect(result).toBe('12:00');
  });

  it('returns fallback for invalid string', () => {
    expect(formatDateDisplay('not-a-date')).toBe('Unknown');
  });

  it('uses default format "PPP" when not specified', () => {
    const date = new Date(2024, 0, 1);
    const result = formatDateDisplay(date);
    expect(result).toBe('Jan 1, 2024');
  });

  it('returns fallback when format throws', async () => {
    const { format } = await import('date-fns');
    (format as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('format error');
    });
    const date = new Date(2024, 0, 1);
    const result = formatDateDisplay(date, 'PPP', 'Error');
    expect(result).toBe('Error');
  });
});
