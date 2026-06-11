import { describe, it, expect } from 'vitest';
import { CreateStripeCheckoutSessionInputSchema } from '../src/schemas/payments';
import {
  MIN_PLEDGE_PAYMENT_AMOUNT_CENTS,
  MAX_PLEDGE_PAYMENT_AMOUNT_CENTS,
} from '../src/constants/business';

const ATTEMPT_ID = 'f1f86a55-94f6-4c5e-9396-1c4e3f9b7a01';

/** Valid base input; tests override/remove fields from here. */
const valid = (overrides: Record<string, unknown> = {}) => ({
  amount: 500,
  checkoutAttemptId: ATTEMPT_ID,
  ageAttested: true,
  ...overrides,
});

describe('CreateStripeCheckoutSessionInputSchema', () => {
  describe('amount lower bound', () => {
    it('rejects amount one cent below MIN_PLEDGE_PAYMENT_AMOUNT_CENTS', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(
        valid({ amount: MIN_PLEDGE_PAYMENT_AMOUNT_CENTS - 1 }),
      );
      expect(result.success).toBe(false);
    });

    it('accepts amount exactly at MIN_PLEDGE_PAYMENT_AMOUNT_CENTS', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(
        valid({ amount: MIN_PLEDGE_PAYMENT_AMOUNT_CENTS }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('amount upper bound', () => {
    it('accepts amount exactly at MAX_PLEDGE_PAYMENT_AMOUNT_CENTS', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(
        valid({ amount: MAX_PLEDGE_PAYMENT_AMOUNT_CENTS }),
      );
      expect(result.success).toBe(true);
    });

    it('rejects amount one cent above MAX_PLEDGE_PAYMENT_AMOUNT_CENTS', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(
        valid({ amount: MAX_PLEDGE_PAYMENT_AMOUNT_CENTS + 1 }),
      );
      expect(result.success).toBe(false);
    });

    it('rejects an extremely large amount (1 billion cents)', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(
        valid({ amount: 1_000_000_000 }),
      );
      expect(result.success).toBe(false);
    });
  });

  describe('amount type guards', () => {
    it('rejects a non-integer amount (decimal cents)', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(valid({ amount: 175.5 }));
      expect(result.success).toBe(false);
    });

    it('rejects a string amount', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(valid({ amount: '175' }));
      expect(result.success).toBe(false);
    });

    it('rejects a missing amount', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({
        checkoutAttemptId: ATTEMPT_ID,
        ageAttested: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ageAttested (18+ / public-disclosure attestation)', () => {
    it('rejects a missing ageAttested flag', () => {
      const { ageAttested: _omitted, ...rest } = valid();
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects ageAttested: false', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(valid({ ageAttested: false }));
      expect(result.success).toBe(false);
    });

    it('rejects a truthy non-boolean ageAttested', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(valid({ ageAttested: 'true' }));
      expect(result.success).toBe(false);
    });

    it('accepts ageAttested: true', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(valid());
      expect(result.success).toBe(true);
    });
  });

  describe('checkoutAttemptId', () => {
    it('rejects a missing checkoutAttemptId', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({ amount: 500, ageAttested: true });
      expect(result.success).toBe(false);
    });

    it('rejects a non-UUID checkoutAttemptId', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(
        valid({ checkoutAttemptId: 'not-a-uuid' }),
      );
      expect(result.success).toBe(false);
    });

    it('accepts a UUID checkoutAttemptId', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(valid());
      expect(result.success).toBe(true);
    });
  });

  describe('message field removed', () => {
    it('rejects any message field (messages were dropped; schema is .strict())', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(
        valid({ message: 'Thanks for your work!' }),
      );
      expect(result.success).toBe(false);
    });
  });

  describe('strict mode', () => {
    it('rejects unknown extra fields (schema is .strict())', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse(
        valid({ unexpectedField: 'oops' }),
      );
      expect(result.success).toBe(false);
    });
  });
});

describe('MIN_PLEDGE_PAYMENT_AMOUNT_CENTS', () => {
  it('is the $2.50 platform business floor (above Stripe\'s 50-cent technical floor), mode-invariant', () => {
    expect(MIN_PLEDGE_PAYMENT_AMOUNT_CENTS).toBe(250);
  });
});

describe('MAX_PLEDGE_PAYMENT_AMOUNT_CENTS', () => {
  it('equals $500,000.00 expressed in cents', () => {
    expect(MAX_PLEDGE_PAYMENT_AMOUNT_CENTS).toBe(500_000 * 100);
  });
});
