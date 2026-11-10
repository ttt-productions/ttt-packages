import { describe, it, expect } from 'vitest';
import { isFirestoreTabClockRoundingLine } from '../src/firestore-tab-clock.js';

const TIMESTAMP = '[2026-11-09T21:41:21.275Z]  ';
const LOGGER = '@firebase/firestore: Firestore (12.19.0): ';
const futureLine = (stored: number, now: number) =>
  `${LOGGER}Detected an update time that is in the future: ${stored} > ${now}`;

describe('isFirestoreTabClockRoundingLine', () => {
  it('accepts the line when the two tab clocks read 1 ms apart', () => {
    expect(isFirestoreTabClockRoundingLine(futureLine(1794260481276, 1794260481275))).toBe(true);
  });

  it('accepts the 1 ms line behind the console timestamp', () => {
    expect(
      isFirestoreTabClockRoundingLine(TIMESTAMP + futureLine(1794260481276, 1794260481275)),
    ).toBe(true);
  });

  it('rejects a 2 ms gap, with or without the console timestamp', () => {
    const line = futureLine(1794260481277, 1794260481275);
    expect(isFirestoreTabClockRoundingLine(line)).toBe(false);
    expect(isFirestoreTabClockRoundingLine(TIMESTAMP + line)).toBe(false);
  });

  it('rejects a zero or negative gap', () => {
    expect(isFirestoreTabClockRoundingLine(futureLine(1794260481275, 1794260481275))).toBe(false);
    expect(isFirestoreTabClockRoundingLine(futureLine(1794260481274, 1794260481275))).toBe(false);
  });

  it('rejects the 1 ms line when anything follows it', () => {
    const line = `${futureLine(1794260481276, 1794260481275)} and more`;
    expect(isFirestoreTabClockRoundingLine(line)).toBe(false);
    expect(isFirestoreTabClockRoundingLine(TIMESTAMP + line)).toBe(false);
  });

  it('rejects any other Firestore line', () => {
    const line = `${LOGGER}Uncaught Error in snapshot listener: permission-denied`;
    expect(isFirestoreTabClockRoundingLine(line)).toBe(false);
    expect(isFirestoreTabClockRoundingLine(TIMESTAMP + line)).toBe(false);
  });
});
