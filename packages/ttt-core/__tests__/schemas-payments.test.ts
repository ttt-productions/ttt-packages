import { describe, it, expect } from 'vitest';
import { CreateStripeCheckoutSessionInputSchema } from '../src/schemas/payments';
import { MAX_PLEDGE_PAYMENT_AMOUNT_CENTS } from '../src/constants/business';

describe('CreateStripeCheckoutSessionInputSchema', () => {
  describe('amount lower bound', () => {
    it('rejects amount below the Stripe minimum of 50 cents', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({ amount: 49 });
      expect(result.success).toBe(false);
    });

    it('accepts amount exactly at the Stripe minimum (50 cents)', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({ amount: 50 });
      expect(result.success).toBe(true);
    });
  });

  describe('amount upper bound', () => {
    it('accepts amount exactly at MAX_PLEDGE_PAYMENT_AMOUNT_CENTS', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({
        amount: MAX_PLEDGE_PAYMENT_AMOUNT_CENTS,
      });
      expect(result.success).toBe(true);
    });

    it('rejects amount one cent above MAX_PLEDGE_PAYMENT_AMOUNT_CENTS', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({
        amount: MAX_PLEDGE_PAYMENT_AMOUNT_CENTS + 1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects an extremely large amount (1 billion cents)', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({
        amount: 1_000_000_000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('amount type guards', () => {
    it('rejects a non-integer amount (decimal cents)', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({ amount: 175.5 });
      expect(result.success).toBe(false);
    });

    it('rejects a string amount', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({ amount: '175' });
      expect(result.success).toBe(false);
    });

    it('rejects a missing amount', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('message field', () => {
    it('accepts a valid amount with no message (message is optional)', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({ amount: 500 });
      expect(result.success).toBe(true);
    });

    it('accepts a valid amount with a message under 500 chars', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({
        amount: 500,
        message: 'Thanks for your work!',
      });
      expect(result.success).toBe(true);
    });

    it('rejects a message over 500 chars', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({
        amount: 500,
        message: 'x'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('strict mode', () => {
    it('rejects unknown extra fields (schema is .strict())', () => {
      const result = CreateStripeCheckoutSessionInputSchema.safeParse({
        amount: 500,
        unexpectedField: 'oops',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('MAX_PLEDGE_PAYMENT_AMOUNT_CENTS', () => {
  it('equals $500,000.00 expressed in cents', () => {
    expect(MAX_PLEDGE_PAYMENT_AMOUNT_CENTS).toBe(500_000 * 100);
  });
});

