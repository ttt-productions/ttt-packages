import { describe, it, expect } from 'vitest';
import {
  checkMoneyCents,
  defineMoneyFormat,
  formatMoney,
  moneyDigitLimits,
  moneyTextFromCents,
  readMoneyText,
} from '../src/money-format.js';

const UP_TO_500K = defineMoneyFormat({ minCents: 0, maxCents: 50_000_000 });
const PLEDGE_LIKE = defineMoneyFormat({ minCents: 250, maxCents: 50_000_000 });

describe('defineMoneyFormat', () => {
  it('returns the declaration frozen with its values', () => {
    expect(UP_TO_500K).toEqual({ minCents: 0, maxCents: 50_000_000 });
    expect(Object.isFrozen(UP_TO_500K)).toBe(true);
  });

  it('accepts a minimum of zero cents', () => {
    expect(() => defineMoneyFormat({ minCents: 0, maxCents: 1 })).not.toThrow();
  });

  it('refuses a negative or fractional minimum', () => {
    expect(() => defineMoneyFormat({ minCents: -1, maxCents: 100 })).toThrow(RangeError);
    expect(() => defineMoneyFormat({ minCents: 0.5, maxCents: 100 })).toThrow(RangeError);
  });

  it('refuses a maximum below one cent, below its minimum, or fractional', () => {
    expect(() => defineMoneyFormat({ minCents: 0, maxCents: 0 })).toThrow(RangeError);
    expect(() => defineMoneyFormat({ minCents: 500, maxCents: 499 })).toThrow(RangeError);
    expect(() => defineMoneyFormat({ minCents: 0, maxCents: 100.5 })).toThrow(RangeError);
  });
});

describe('moneyDigitLimits — counted from the largest amount, digits only', () => {
  it('allows the dollar digits of the maximum plus two cent digits', () => {
    expect(moneyDigitLimits(UP_TO_500K)).toEqual({ dollarDigits: 6, centDigits: 2 });
  });

  it('counts the dollars of a maximum that is not a round number of dollars', () => {
    expect(moneyDigitLimits(defineMoneyFormat({ minCents: 0, maxCents: 99_999 }))).toEqual({
      dollarDigits: 3,
      centDigits: 2,
    });
  });

  it('allows one dollar digit when the maximum is under a dollar', () => {
    expect(moneyDigitLimits(defineMoneyFormat({ minCents: 0, maxCents: 99 })).dollarDigits).toBe(1);
  });
});

describe('readMoneyText — typed dollars to whole cents', () => {
  it('reads whole dollars, dollars and cents, and cents alone', () => {
    expect(readMoneyText('100', UP_TO_500K)).toEqual({ ok: true, cents: 10_000 });
    expect(readMoneyText('1000.5', UP_TO_500K)).toEqual({ ok: true, cents: 100_050 });
    expect(readMoneyText('1000.05', UP_TO_500K)).toEqual({ ok: true, cents: 100_005 });
    expect(readMoneyText('.75', UP_TO_500K)).toEqual({ ok: true, cents: 75 });
    expect(readMoneyText('12.', UP_TO_500K)).toEqual({ ok: true, cents: 1_200 });
  });

  it('reads amounts whose decimal value has no exact binary form without rounding error', () => {
    expect(readMoneyText('0.29', UP_TO_500K)).toEqual({ ok: true, cents: 29 });
    expect(readMoneyText('1.15', UP_TO_500K)).toEqual({ ok: true, cents: 115 });
    expect(readMoneyText('4.35', UP_TO_500K)).toEqual({ ok: true, cents: 435 });
  });

  it('ignores a leading dollar sign, thousands commas, and surrounding spaces', () => {
    expect(readMoneyText(' $1,000.00 ', UP_TO_500K)).toEqual({ ok: true, cents: 100_000 });
  });

  it('reads nothing typed, or only the dollar sign or the point, as no amount', () => {
    for (const text of ['', '  ', '$', '.', '$.']) {
      expect(readMoneyText(text, UP_TO_500K)).toEqual({ ok: true, cents: null });
    }
  });

  it('does not count the dollar sign, commas, or the point toward the digit limit', () => {
    expect(readMoneyText('$500,000.00', UP_TO_500K)).toEqual({ ok: true, cents: 50_000_000 });
  });

  it('does not count leading zeros toward the dollar digits', () => {
    expect(readMoneyText('0000000.50', UP_TO_500K)).toEqual({ ok: true, cents: 50 });
  });

  it('refuses a dollar digit past the limit', () => {
    expect(readMoneyText('1000000', UP_TO_500K)).toEqual({
      ok: false,
      issue: 'tooManyDollarDigits',
    });
  });

  it('refuses a third cent digit', () => {
    expect(readMoneyText('10.123', UP_TO_500K)).toEqual({ ok: false, issue: 'tooManyCentDigits' });
  });

  it('refuses letters, a minus sign, a second point, and any other character', () => {
    for (const text of ['12a', '-5', '1.2.3', '1e5', '5$', '1 000']) {
      expect(readMoneyText(text, UP_TO_500K)).toEqual({ ok: false, issue: 'invalidCharacters' });
    }
  });

  it('reads an amount within the digit limit that is over the maximum, for checkMoneyCents', () => {
    expect(readMoneyText('999999.99', UP_TO_500K)).toEqual({ ok: true, cents: 99_999_999 });
  });
});

describe('checkMoneyCents — the amount against the declaration', () => {
  it('accepts the minimum, the maximum, and between', () => {
    expect(checkMoneyCents(250, PLEDGE_LIKE)).toEqual({ ok: true });
    expect(checkMoneyCents(50_000_000, PLEDGE_LIKE)).toEqual({ ok: true });
    expect(checkMoneyCents(10_000, PLEDGE_LIKE)).toEqual({ ok: true });
  });

  it('accepts zero when the minimum is zero', () => {
    expect(checkMoneyCents(0, UP_TO_500K)).toEqual({ ok: true });
  });

  it('refuses one cent below the minimum and one cent above the maximum', () => {
    expect(checkMoneyCents(249, PLEDGE_LIKE)).toEqual({ ok: false, issue: 'tooSmall' });
    expect(checkMoneyCents(50_000_001, PLEDGE_LIKE)).toEqual({ ok: false, issue: 'tooLarge' });
  });

  it('refuses a fraction of a cent and a value that is not a finite number', () => {
    for (const cents of [100.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(checkMoneyCents(cents, UP_TO_500K)).toEqual({ ok: false, issue: 'notWholeCents' });
    }
  });
});

describe('moneyTextFromCents — the box text for a stored amount', () => {
  it('writes dollars and two cent digits with no sign or commas', () => {
    expect(moneyTextFromCents(100_050)).toBe('1000.50');
    expect(moneyTextFromCents(5)).toBe('0.05');
    expect(moneyTextFromCents(0)).toBe('0.00');
    expect(moneyTextFromCents(50_000_000)).toBe('500000.00');
  });

  it('reads back to the same cents', () => {
    for (const cents of [0, 1, 99, 100, 12_345, 50_000_000]) {
      expect(readMoneyText(moneyTextFromCents(cents), UP_TO_500K)).toEqual({ ok: true, cents });
    }
  });
});

describe('formatMoney — cents shown as US dollars', () => {
  it('shows dollars and cents by default', () => {
    expect(formatMoney(100_050)).toBe('$1,000.50');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(50_000_000)).toBe('$500,000.00');
  });

  it('shows rounded whole dollars in the wholeDollars style', () => {
    expect(formatMoney(100_050, 'wholeDollars')).toBe('$1,001');
    expect(formatMoney(250_000, 'wholeDollars')).toBe('$2,500');
  });

  it('shows a short amount in the compact style', () => {
    expect(formatMoney(250_000, 'compact')).toBe('$2.5K');
    expect(formatMoney(1_000_000_000, 'compact')).toBe('$10M');
  });
});
