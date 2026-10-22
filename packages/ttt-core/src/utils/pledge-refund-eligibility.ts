import {
  isPledgeRefundRequestOpen,
  type PledgePayment,
  type PledgeRefundRequest,
} from '../doc-schemas/payments.js';
import { PLEDGE_REFUND_REQUEST_WINDOW_MS } from '../constants/business-platform.js';

type PledgeRefundFields = Pick<PledgePayment, 'refundState' | 'disputeState' | 'netAmount'>;

function isPristineForRefund(pledge: PledgeRefundFields): boolean {
  return (
    pledge.refundState === 'none' &&
    pledge.disputeState !== 'underReview' &&
    pledge.disputeState !== 'lost' &&
    pledge.netAmount > 0
  );
}

export const PLEDGE_REFUND_REQUEST_REFUSALS = [
  'not-owner',
  'window-expired',
  'ineligible',
  'already-open',
] as const;
export type PledgeRefundRequestRefusal = (typeof PLEDGE_REFUND_REQUEST_REFUSALS)[number];

type PledgeRefundRequestFields = Pick<PledgePayment, 'userId' | 'createdAt'> & PledgeRefundFields;

type LatestPledgeRefundRequest = Pick<
  PledgeRefundRequest,
  'status' | 'failureFollowUpResolvedAt'
> | null;

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

export function isPledgeRefundRequestable(
  pledge: PledgeRefundRequestFields,
  callerUid: string,
  now: number,
  latestRequest: LatestPledgeRefundRequest,
): boolean {
  return pledgeRefundRequestRefusal(pledge, callerUid, now, latestRequest) === null;
}

export function isPledgeRefundApprovable(
  pledge: PledgeRefundFields,
  requestAmount: number,
): boolean {
  return isPristineForRefund(pledge) && pledge.netAmount === requestAmount;
}
