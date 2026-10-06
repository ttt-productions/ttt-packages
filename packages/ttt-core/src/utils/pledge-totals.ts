// The ONE formula for the pledge-totals counters (`pledgePaymentTotals/summary` and the Ops
// snapshot's `pledge`). The webhook's increments, the repair script's recompute, and the Ops
// aggregate all derive from it, so the three can never count a counter differently.

import type { PledgePayment } from '../doc-schemas/payments.js';
import type { PledgePaymentTotals } from '../types/payments.js';

/** The pledge fields the totals are built from — each summed over the ledger. */
export const PLEDGE_PAYMENT_SUMMED_AMOUNT_FIELDS = [
  'amount',
  'netAmount',
  'refundedAmount',
  'disputeLostAmount',
] as const satisfies readonly (keyof PledgePayment)[];

/** Those fields' values for one pledge, or their sums over many (cents). */
export type PledgePaymentAmountSums = Pick<PledgePayment, (typeof PLEDGE_PAYMENT_SUMMED_AMOUNT_FIELDS)[number]>;

/**
 * The counters from the summed pledge amounts. `totalRefunded` is money that left the platform:
 * refunds plus funds withdrawn by a lost dispute. `pledgeCount` is the number of those pledges that
 * still count (`isPledgePaymentCounted`) — a sum cannot say how many pledges kept money, so the
 * caller counts them. The money formula is linear, so it gives the whole ledger's totals from the
 * ledger's sums; one pledge's share is `pledgePaymentContributionOf`.
 */
export function pledgePaymentTotalsOf(sums: PledgePaymentAmountSums, pledgeCount: number): PledgePaymentTotals {
  return {
    netRaised: sums.netAmount,
    grossRaised: sums.amount,
    totalRefunded: sums.refundedAmount + sums.disputeLostAmount,
    pledgeCount,
  };
}

/**
 * A pledge counts — in the pledge count and toward the Supporter badge — while it still holds money:
 * a full refund or a lost dispute that leaves its net at 0 stops it counting, and a refund that
 * fails restores it.
 */
export function isPledgePaymentCounted(pledge: Pick<PledgePayment, 'netAmount'>): boolean {
  return pledge.netAmount > 0;
}

/**
 * One pledge's contribution to the totals: its amounts, and 1 toward `pledgeCount` while it counts.
 * The webhook's increment for an event is the pledge's contribution after it minus its contribution
 * before, so a refund that ends the pledge's money also takes it out of the count.
 */
export function pledgePaymentContributionOf(pledge: PledgePaymentAmountSums): PledgePaymentTotals {
  return pledgePaymentTotalsOf(pledge, isPledgePaymentCounted(pledge) ? 1 : 0);
}
