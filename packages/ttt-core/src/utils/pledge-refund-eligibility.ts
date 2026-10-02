import { isPledgeRefundRequestOpen, type PledgePayment, type PledgeRefundRequest } from '../doc-schemas/payments.js';
import { PLEDGE_REFUND_REQUEST_WINDOW_MS } from '../constants/business-platform.js';

type PledgeRefundFields = Pick<PledgePayment, 'refundState' | 'disputeState' | 'netAmount'>;

/**
 * A pledge a full refund can still be asked for: nothing refunded yet, no open or lost dispute,
 * and money still left. Partial refunds and the other cases stay with an admin in Stripe.
 */
function isPristineForRefund(pledge: PledgeRefundFields): boolean {
  return (
    pledge.refundState === 'none' &&
    pledge.disputeState !== 'underReview' &&
    pledge.disputeState !== 'lost' &&
    pledge.netAmount > 0
  );
}

/**
 * Why a refund request is refused, checked in this order: the pledge is not the caller's
 * (`not-owner`), it is older than PLEDGE_REFUND_REQUEST_WINDOW_MS (`window-expired`), it is no
 * longer pristine (`ineligible`), or its latest request is still open (`already-open` — in
 * flight, or failed with the admin's follow-up unresolved). Each is its own answer and
 * failure-audit reason in the request callable.
 */
export const PLEDGE_REFUND_REQUEST_REFUSALS = ['not-owner', 'window-expired', 'ineligible', 'already-open'] as const;
export type PledgeRefundRequestRefusal = (typeof PLEDGE_REFUND_REQUEST_REFUSALS)[number];

type PledgeRefundRequestFields = Pick<PledgePayment, 'userId' | 'createdAt'> & PledgeRefundFields;

/** The pledge's most recent refund request — the only one that can still be open — or null for none. */
type LatestPledgeRefundRequest = Pick<PledgeRefundRequest, 'status' | 'failureFollowUpResolvedAt'> | null;

/**
 * The refusal `callerUid` gets for requesting a refund of `pledge` at `now`, given the pledge's
 * latest request, or null when the request may be made. The request callable decides with it
 * inside its transaction.
 */
export function pledgeRefundRequestRefusal(
  pledge: PledgeRefundRequestFields,
  callerUid: string,
  now: number,
  latestRequest: LatestPledgeRefundRequest,
): PledgeRefundRequestRefusal | null {
  if (pledge.userId !== callerUid) return 'not-owner';
  if (now - pledge.createdAt > PLEDGE_REFUND_REQUEST_WINDOW_MS) return 'window-expired';
  if (!isPristineForRefund(pledge)) return 'ineligible';
  if (latestRequest && isPledgeRefundRequestOpen(latestRequest)) return 'already-open';
  return null;
}

/** Whether `callerUid` may request a refund of `pledge` at `now` — the pledge page offers the button from it. */
export function isPledgeRefundRequestable(
  pledge: PledgeRefundRequestFields,
  callerUid: string,
  now: number,
  latestRequest: LatestPledgeRefundRequest,
): boolean {
  return pledgeRefundRequestRefusal(pledge, callerUid, now, latestRequest) === null;
}

/**
 * Whether an admin may approve a refund request of `requestAmount` against the pledge as it is now:
 * still pristine, and its live net still the amount the request was made for. The window and the
 * owner were settled when the request was made.
 */
export function isPledgeRefundApprovable(pledge: PledgeRefundFields, requestAmount: number): boolean {
  return isPristineForRefund(pledge) && pledge.netAmount === requestAmount;
}
