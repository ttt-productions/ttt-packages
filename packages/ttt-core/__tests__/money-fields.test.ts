import { describe, it, expect } from 'vitest';
import {
  PLEDGE_PAYMENT_AMOUNT_INPUT,
  SPONSORED_AUDITION_AMOUNT_INPUT,
} from '../src/constants/money-fields.js';
import { MAX_SPONSORED_AUDITION_AMOUNT_CENTS } from '../src/constants/business-content.js';
import {
  MAX_PLEDGE_PAYMENT_AMOUNT_CENTS,
  MIN_PLEDGE_PAYMENT_AMOUNT_CENTS,
} from '../src/constants/business-platform.js';
import { checkMoneyField, moneyFieldRefusal } from '../src/utils/money-field.js';
import { moneyFieldSchema } from '../src/schemas/money-field.js';

describe('the money field declarations', () => {
  it('a sponsored prize runs from zero up to $500,000.00', () => {
    expect(MAX_SPONSORED_AUDITION_AMOUNT_CENTS).toBe(500_000 * 100);
    expect(SPONSORED_AUDITION_AMOUNT_INPUT.minCents).toBe(0);
    expect(SPONSORED_AUDITION_AMOUNT_INPUT.maxCents).toBe(MAX_SPONSORED_AUDITION_AMOUNT_CENTS);
  });

  it('a pledge payment takes the pledge minimum and maximum', () => {
    expect(PLEDGE_PAYMENT_AMOUNT_INPUT.minCents).toBe(MIN_PLEDGE_PAYMENT_AMOUNT_CENTS);
    expect(PLEDGE_PAYMENT_AMOUNT_INPUT.maxCents).toBe(MAX_PLEDGE_PAYMENT_AMOUNT_CENTS);
  });
});

describe('moneyFieldRefusal names the field and the bound in dollars', () => {
  it('says the minimum a too-small amount missed', () => {
    expect(moneyFieldRefusal(PLEDGE_PAYMENT_AMOUNT_INPUT, 'tooSmall')).toBe(
      'Pledge amount must be at least $2.50.',
    );
  });

  it('says the maximum a too-large amount passed', () => {
    expect(moneyFieldRefusal(SPONSORED_AUDITION_AMOUNT_INPUT, 'tooLarge')).toBe(
      'Work Project Amount cannot exceed $500,000.00.',
    );
  });

  it('says an amount must be whole cents', () => {
    expect(moneyFieldRefusal(SPONSORED_AUDITION_AMOUNT_INPUT, 'notWholeCents')).toBe(
      'Work Project Amount must be a whole number of cents.',
    );
  });
});

describe('checkMoneyField', () => {
  it('keeps an accepted amount', () => {
    expect(checkMoneyField(SPONSORED_AUDITION_AMOUNT_INPUT, 0)).toEqual({ ok: true, cents: 0 });
  });

  it('refuses with the field refusal', () => {
    expect(checkMoneyField(PLEDGE_PAYMENT_AMOUNT_INPUT, 249)).toEqual({
      ok: false,
      reason: 'Pledge amount must be at least $2.50.',
    });
  });
});

describe('moneyFieldSchema accepts exactly what the box accepts', () => {
  const prize = moneyFieldSchema(SPONSORED_AUDITION_AMOUNT_INPUT);

  it('accepts zero and the maximum', () => {
    expect(prize.safeParse(0).success).toBe(true);
    expect(prize.safeParse(MAX_SPONSORED_AUDITION_AMOUNT_CENTS).success).toBe(true);
  });

  it('refuses one cent over the maximum with the field refusal', () => {
    const result = prize.safeParse(MAX_SPONSORED_AUDITION_AMOUNT_CENTS + 1);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Work Project Amount cannot exceed $500,000.00.');
  });

  it('refuses a fraction of a cent, a negative amount, and a non-number', () => {
    for (const value of [10.5, -1, '100', Number.NaN]) {
      expect(prize.safeParse(value).success).toBe(false);
    }
  });
});
