import { describe, it, expect } from 'vitest';
import { isSerializedTimestamp, hasToDateMethod } from '../src/firestore/types';

describe('isSerializedTimestamp', () => {
  it('returns true for a valid SerializedTimestamp', () => {
    expect(isSerializedTimestamp({ _seconds: 1000, _nanoseconds: 0 })).toBe(true);
  });

  it('returns true with positive nanoseconds', () => {
    expect(isSerializedTimestamp({ _seconds: 1700000000, _nanoseconds: 999999999 })).toBe(true);
  });

  it('returns true with zero values', () => {
    expect(isSerializedTimestamp({ _seconds: 0, _nanoseconds: 0 })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isSerializedTimestamp(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSerializedTimestamp(undefined)).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isSerializedTimestamp(12345)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isSerializedTimestamp('2024-01-01')).toBe(false);
  });

  it('returns false when _seconds is missing', () => {
    expect(isSerializedTimestamp({ _nanoseconds: 0 })).toBe(false);
  });

  it('returns false when _nanoseconds is missing', () => {
    expect(isSerializedTimestamp({ _seconds: 1000 })).toBe(false);
  });

  it('returns false when _seconds is not a number', () => {
    expect(isSerializedTimestamp({ _seconds: '1000', _nanoseconds: 0 })).toBe(false);
  });

  it('returns false when _nanoseconds is not a number', () => {
    expect(isSerializedTimestamp({ _seconds: 1000, _nanoseconds: '0' })).toBe(false);
  });

  it('returns false for an empty object', () => {
    expect(isSerializedTimestamp({})).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isSerializedTimestamp([1, 2])).toBe(false);
  });
});

describe('hasToDateMethod', () => {
  it('returns true for an object with a toDate function', () => {
    expect(hasToDateMethod({ toDate: () => new Date() })).toBe(true);
  });

  it('returns true for a Firestore-like Timestamp mock', () => {
    const mockTimestamp = {
      seconds: 1000,
      nanoseconds: 0,
      toDate: () => new Date(1000000),
    };
    expect(hasToDateMethod(mockTimestamp)).toBe(true);
  });

  it('returns false for null', () => {
    expect(hasToDateMethod(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasToDateMethod(undefined)).toBe(false);
  });

  it('returns false for a plain object without toDate', () => {
    expect(hasToDateMethod({ seconds: 1000 })).toBe(false);
  });

  it('returns false when toDate is not a function', () => {
    expect(hasToDateMethod({ toDate: '2024-01-01' })).toBe(false);
    expect(hasToDateMethod({ toDate: 12345 })).toBe(false);
    expect(hasToDateMethod({ toDate: null })).toBe(false);
  });

  it('returns false for a number', () => {
    expect(hasToDateMethod(42)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(hasToDateMethod('2024-01-01')).toBe(false);
  });

  it('returns false for an array', () => {
    expect(hasToDateMethod([])).toBe(false);
  });
});
