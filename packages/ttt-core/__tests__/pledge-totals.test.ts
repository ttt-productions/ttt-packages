import { describe, it, expect } from 'vitest';
import {
  PLEDGE_PAYMENT_SUMMED_AMOUNT_FIELDS,
  isPledgePaymentCounted,
  pledgePaymentContributionOf,
  pledgePaymentTotalsOf,
} from '../src/utils/pledge-totals';
import { PledgePaymentSchema } from '../src/doc-schemas/payments';
import * as root from '../src/index';

const refunded = { amount: 1000, refundedAmount: 400, disputeLostAmount: 0, netAmount: 600 };
const disputeLost = { amount: 2500, refundedAmount: 0, disputeLostAmount: 2500, netAmount: 0 };
const untouched = { amount: 500, refundedAmount: 0, disputeLostAmount: 0, netAmount: 500 };

const sum = (pledges: Array<typeof refunded>) =>
  Object.fromEntries(
    PLEDGE_PAYMENT_SUMMED_AMOUNT_FIELDS.map((field) => [field, pledges.reduce((total, p) => total + p[field], 0)]),
  ) as typeof refunded;

describe('the pledge-totals formula', () => {
  it('counts money lost to a dispute as refunded, beside real refunds', () => {
    expect(pledgePaymentTotalsOf(sum([refunded, disputeLost, untouched]), 3)).toEqual({
      netRaised: 1100,
      grossRaised: 4000,
      totalRefunded: 2900,
      pledgeCount: 3,
    });
  });

  it('gives the ledger total as the sum of each pledge\'s contribution — the lost dispute holds no money, so 2 pledges count', () => {
    const ledger = pledgePaymentTotalsOf(sum([refunded, disputeLost, untouched]), 2);
    const contributions = [refunded, disputeLost, untouched].map((p) => pledgePaymentContributionOf(p));
    expect(contributions.reduce((a, b) => ({
      netRaised: a.netRaised + b.netRaised,
      grossRaised: a.grossRaised + b.grossRaised,
      totalRefunded: a.totalRefunded + b.totalRefunded,
      pledgeCount: a.pledgeCount + b.pledgeCount,
    }))).toEqual(ledger);
  });

  it('gives a lost dispute\'s increment as the change in that pledge\'s contribution', () => {
    const before = pledgePaymentTotalsOf({ ...disputeLost, disputeLostAmount: 0, netAmount: 2500 }, 1);
    const after = pledgePaymentTotalsOf(disputeLost, 1);
    expect(after.totalRefunded - before.totalRefunded).toBe(2500);
    expect(after.netRaised - before.netRaised).toBe(-2500);
    expect(after.grossRaised - before.grossRaised).toBe(0);
  });

  it('sums only fields the pledge document declares', () => {
    for (const field of PLEDGE_PAYMENT_SUMMED_AMOUNT_FIELDS) {
      expect(Object.keys(PledgePaymentSchema.shape)).toContain(field);
    }
  });

  it('is exported from the package root', () => {
    expect(root.pledgePaymentTotalsOf).toBe(pledgePaymentTotalsOf);
    expect(root.isPledgePaymentCounted).toBe(isPledgePaymentCounted);
    expect(root.pledgePaymentContributionOf).toBe(pledgePaymentContributionOf);
  });
});

describe('which pledges count', () => {
  it('a pledge counts while it holds money, and stops once its net is 0', () => {
    expect(isPledgePaymentCounted(untouched)).toBe(true);
    expect(isPledgePaymentCounted(refunded)).toBe(true); // partly refunded, money left
    expect(isPledgePaymentCounted({ netAmount: 0 })).toBe(false); // fully refunded
    expect(isPledgePaymentCounted(disputeLost)).toBe(false);
  });

  it('a full refund takes the pledge out of the count', () => {
    const before = pledgePaymentContributionOf(untouched);
    const after = pledgePaymentContributionOf({ ...untouched, refundedAmount: 500, netAmount: 0 });
    expect(after.pledgeCount - before.pledgeCount).toBe(-1);
    expect(after.netRaised - before.netRaised).toBe(-500);
    expect(after.totalRefunded - before.totalRefunded).toBe(500);
  });

  it('a partial refund keeps the pledge in the count', () => {
    const before = pledgePaymentContributionOf({ ...refunded, refundedAmount: 0, netAmount: 1000 });
    expect(pledgePaymentContributionOf(refunded).pledgeCount - before.pledgeCount).toBe(0);
  });

  it('a lost dispute that takes all the money takes the pledge out of the count', () => {
    const before = pledgePaymentContributionOf({ ...disputeLost, disputeLostAmount: 0, netAmount: 2500 });
    expect(pledgePaymentContributionOf(disputeLost).pledgeCount - before.pledgeCount).toBe(-1);
  });

  it('a refund that fails puts the pledge back in the count', () => {
    const refundedFully = pledgePaymentContributionOf({ ...untouched, refundedAmount: 500, netAmount: 0 });
    expect(pledgePaymentContributionOf(untouched).pledgeCount - refundedFully.pledgeCount).toBe(1);
  });
});
