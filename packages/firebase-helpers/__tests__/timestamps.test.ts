import { describe, it, expect, vi } from 'vitest';
import { serverNow, dateToTs, msToTs, tsToDate } from '../src/firestore/timestamps';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

// Extend the Timestamp mock with fromMillis (not in global setup)
const mockTimestamp = vi.mocked(Timestamp) as any;
if (!mockTimestamp.fromMillis) {
  mockTimestamp.fromMillis = vi.fn((ms: number) => ({
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1_000_000,
    toDate: () => new Date(ms),
  }));
}

describe('serverNow()', () => {
  it('calls serverTimestamp from firebase/firestore', () => {
    serverNow();
    expect(serverTimestamp).toHaveBeenCalled();
  });

  it('returns the value from serverTimestamp', () => {
    vi.mocked(serverTimestamp).mockReturnValueOnce({ _type: 'serverTimestamp' } as any);
    const result = serverNow();
    expect(result).toEqual({ _type: 'serverTimestamp' });
  });
});

describe('dateToTs()', () => {
  it('calls Timestamp.fromDate with the provided date', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    dateToTs(date);
    expect(Timestamp.fromDate).toHaveBeenCalledWith(date);
  });

  it('returns the value from Timestamp.fromDate', () => {
    const date = new Date('2024-06-15T00:00:00.000Z');
    const result = dateToTs(date);
    expect(result).toBeDefined();
    expect((result as any).seconds).toBe(Math.floor(date.getTime() / 1000));
  });
});

describe('msToTs()', () => {
  it('calls Timestamp.fromMillis with the provided ms value', () => {
    const ms = 1700000000000;
    msToTs(ms);
    expect(mockTimestamp.fromMillis).toHaveBeenCalledWith(ms);
  });

  it('returns the value from Timestamp.fromMillis', () => {
    const ms = 1700000000000;
    const result = msToTs(ms);
    expect(result).toBeDefined();
    expect((result as any).seconds).toBe(Math.floor(ms / 1000));
  });
});

describe('tsToDate()', () => {
  it('returns null for null', () => {
    expect(tsToDate(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(tsToDate(undefined)).toBeNull();
  });

  it('calls .toDate() on a Timestamp and returns the result', () => {
    const mockDate = new Date('2024-03-01');
    const mockTs = { toDate: vi.fn(() => mockDate) } as any;
    const result = tsToDate(mockTs);
    expect(mockTs.toDate).toHaveBeenCalled();
    expect(result).toBe(mockDate);
  });

  it('returns a Date instance', () => {
    const mockDate = new Date('2024-01-01');
    const mockTs = { toDate: vi.fn(() => mockDate) } as any;
    expect(tsToDate(mockTs)).toBeInstanceOf(Date);
  });
});
