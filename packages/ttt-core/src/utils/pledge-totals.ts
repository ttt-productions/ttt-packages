import type { PledgePayment } from '../doc-schemas/payments.js';
import type { PledgePaymentTotals } from '../types/payments.js';

export const PLEDGE_PAYMENT_SUMMED_AMOUNT_FIELDS = [
  'amount',
  'netAmount',
  'refundedAmount',
  'disputeLostAmount',
] as const satisfies readonly (keyof PledgePayment)[];

export type PledgePaymentAmountSums = Pick<
  PledgePayment,
  (typeof PLEDGE_PAYMENT_SUMMED_AMOUNT_FIELDS)[number]
>;

export const PLEDGE_DISPUTE_LOST_STAMPED_FIELDS = [
  'disputeLostAmount',
  'netAmount',
] as const satisfies readonly (typeof PLEDGE_PAYMENT_SUMMED_AMOUNT_FIELDS)[number][];

export function pledgePaymentTotalsOf(
  sums: PledgePaymentAmountSums,
  pledgeCount: number,
): PledgePaymentTotals {
  return {
    netRaised: sums.netAmount,
    grossRaised: sums.amount,
    totalRefunded: sums.refundedAmount + sums.disputeLostAmount,
    pledgeCount,
  };
}

export function isPledgePaymentCounted(pledge: Pick<PledgePayment, 'netAmount'>): boolean {
  return pledge.netAmount > 0;
}

export function pledgePaymentContributionOf(pledge: PledgePaymentAmountSums): PledgePaymentTotals {
  return pledgePaymentTotalsOf(pledge, isPledgePaymentCounted(pledge) ? 1 : 0);
}
