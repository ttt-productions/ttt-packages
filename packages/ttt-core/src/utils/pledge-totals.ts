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
 * refunds plus funds withdrawn by a lost dispute. The formula is linear, so it gives the whole
 * ledger's totals from the ledger's sums, and one pledge's contribution — the webhook's increment
 * is its contribution after an event minus its contribution before (with `pledgeCount` 1 each).
 */
export function pledgePaymentTotalsOf(sums: PledgePaymentAmountSums, pledgeCount: number): PledgePaymentTotals {
  return {
    netRaised: sums.netAmount,
    grossRaised: sums.amount,
    totalRefunded: sums.refundedAmount + sums.disputeLostAmount,
    pledgeCount,
  };
}
