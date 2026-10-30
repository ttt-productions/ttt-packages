import { describe, it, expect } from 'vitest';
import {
  leagueInstantOf,
  toLeagueDayKey,
  toLeagueTimeOfDay,
} from '../src/utils/league-calendar.js';

describe('leagueInstantOf', () => {
  it('reads a winter evening on standard time, five hours behind UTC', () => {
    expect(leagueInstantOf('2026-01-15', '19:30')).toBe(Date.UTC(2026, 0, 16, 0, 30));
  });

  it('reads a summer evening on daylight time, four hours behind UTC', () => {
    expect(leagueInstantOf('2026-07-15', '19:30')).toBe(Date.UTC(2026, 6, 15, 23, 30));
  });

  it('reads each side of the spring change at its own offset', () => {
    expect(leagueInstantOf('2026-03-07', '20:00')).toBe(Date.UTC(2026, 2, 8, 1, 0));
    expect(leagueInstantOf('2026-03-08', '20:00')).toBe(Date.UTC(2026, 2, 9, 0, 0));
  });

  it('reads midnight as the first instant of the day', () => {
    expect(leagueInstantOf('2026-01-15', '00:00')).toBe(Date.UTC(2026, 0, 15, 5, 0));
  });

  it('lands on the same day and time of day it was given', () => {
    for (const [dayKey, timeOfDay] of [
      ['2026-01-15', '19:30'],
      ['2026-07-04', '09:05'],
      ['2026-11-01', '18:00'],
      ['2026-12-31', '23:59'],
    ] as const) {
      const instant = leagueInstantOf(dayKey, timeOfDay);
      expect(toLeagueDayKey(instant)).toBe(dayKey);
      expect(toLeagueTimeOfDay(instant)).toBe(timeOfDay);
    }
  });

  it('refuses a time the clocks skip on the spring change, however it is entered', () => {
    for (const timeOfDay of ['02:00', '02:30', '02:59']) {
      expect(() => leagueInstantOf('2026-03-08', timeOfDay)).toThrow(RangeError);
    }
    expect(() => leagueInstantOf('2027-03-14', '02:15')).toThrow(RangeError);
  });

  it('reads the minutes just before and just after the skipped hour', () => {
    expect(leagueInstantOf('2026-03-08', '01:59')).toBe(Date.UTC(2026, 2, 8, 6, 59));
    expect(leagueInstantOf('2026-03-08', '03:00')).toBe(Date.UTC(2026, 2, 8, 7, 0));
  });

  it('reads the change day from its first minute, and the day before to its last', () => {
    expect(leagueInstantOf('2026-03-08', '00:00')).toBe(Date.UTC(2026, 2, 8, 5, 0));
    expect(leagueInstantOf('2026-03-07', '23:59')).toBe(Date.UTC(2026, 2, 8, 4, 59));
  });

  it('still reads a time in the hour the autumn change repeats', () => {
    const instant = leagueInstantOf('2026-11-01', '01:30');
    expect(toLeagueDayKey(instant)).toBe('2026-11-01');
    expect(toLeagueTimeOfDay(instant)).toBe('01:30');
  });

  it('refuses a day or a time that is not one', () => {
    expect(() => leagueInstantOf('2026-02-30', '19:00')).toThrow(RangeError);
    expect(() => leagueInstantOf('2026-1-5', '19:00')).toThrow(RangeError);
    expect(() => leagueInstantOf('2026-01-15', '24:00')).toThrow(RangeError);
    expect(() => leagueInstantOf('2026-01-15', '7:30')).toThrow(RangeError);
    expect(() => leagueInstantOf('', '')).toThrow(RangeError);
  });
});

describe('toLeagueTimeOfDay', () => {
  it("reads an instant on a 24-hour clock in the leagues' zone, never the viewer's", () => {
    expect(toLeagueTimeOfDay(Date.UTC(2026, 0, 16, 0, 30))).toBe('19:30');
    expect(toLeagueTimeOfDay(Date.UTC(2026, 6, 15, 23, 30))).toBe('19:30');
  });

  it('reads midnight as hour zero', () => {
    expect(toLeagueTimeOfDay(Date.UTC(2026, 0, 15, 5, 0))).toBe('00:00');
  });
});
