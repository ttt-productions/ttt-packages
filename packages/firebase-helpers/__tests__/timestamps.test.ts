import { describe, it, expect } from 'vitest';
import { serverNow, dateToTs, msToTs, tsToDate } from '../src/firestore-client/timestamps.js';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

describe('serverNow()', () => {
  it('returns the server-timestamp sentinel', () => {
    expect(serverNow().isEqual(serverTimestamp())).toBe(true);
  });
});

describe('dateToTs()', () => {
  it('returns the Timestamp of the provided date', () => {
    const date = new Date('2024-06-15T00:00:00.123Z');
    const result = dateToTs(date);
    expect(result).toBeInstanceOf(Timestamp);
    expect(result.toDate()).toEqual(date);
  });
});

describe('msToTs()', () => {
  it('returns the Timestamp of the provided milliseconds', () => {
    const ms = 1700000000123;
    const result = msToTs(ms);
    expect(result).toBeInstanceOf(Timestamp);
    expect(result.toMillis()).toBe(ms);
  });
});

describe('tsToDate()', () => {
  it('returns null for null', () => {
    expect(tsToDate(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(tsToDate(undefined)).toBeNull();
  });

  it('returns the Date a Timestamp holds', () => {
    const date = new Date('2024-03-01T12:30:00.000Z');
    const result = tsToDate(Timestamp.fromDate(date));
    expect(result).toBeInstanceOf(Date);
    expect(result).toEqual(date);
  });
});
