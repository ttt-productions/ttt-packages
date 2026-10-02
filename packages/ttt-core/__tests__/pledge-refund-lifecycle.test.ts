import { describe, it, expect } from 'vitest';
import {
  PLEDGE_REFUND_REQUEST_STATUSES,
  PLEDGE_REFUND_OPEN_STATUSES,
  isPledgeRefundRequestOpen,
  PledgeRefundRequestSchema,
  PLEDGE_REFUND_STATES,
  PLEDGE_DISPUTE_STATES,
  PledgePaymentSchema,
  PledgePaymentProviderRefSchema,
  pledgeDisputeStateRank,
  isPledgeDisputeAdvance,
  isPledgeDisputeEventApplicable,
  type PledgeDisputeState,
} from '../src/doc-schemas/payments';
import {
  isPledgeRefundRequestable,
  isPledgeRefundApprovable,
  pledgeRefundRequestRefusal,
  PLEDGE_REFUND_REQUEST_REFUSALS,
} from '../src/utils';
import { PLEDGE_REFUND_REQUEST_WINDOW_MS, MAX_INTERNAL_REASON_LENGTH } from '../src/constants/business';
import { GuildmateUserSchema, PendingStakeSharesSchema } from '../src/doc-schemas/work-project';

describe('the refund request lifecycle', () => {
  it('a request is requested, approving, initiated, denied, completed, or failed', () => {
    expect([...PLEDGE_REFUND_REQUEST_STATUSES].sort()).toEqual(
      ['approving', 'completed', 'denied', 'failed', 'initiated', 'requested'],
    );
    for (const status of PLEDGE_REFUND_REQUEST_STATUSES) {
      expect(PledgeRefundRequestSchema.shape.status.safeParse(status).success).toBe(true);
    }
  });

  it('a request is open while requested, approving, or initiated', () => {
    expect([...PLEDGE_REFUND_OPEN_STATUSES].sort()).toEqual(['approving', 'initiated', 'requested']);
    expect(isPledgeRefundRequestOpen({ status: 'requested' })).toBe(true);
    expect(isPledgeRefundRequestOpen({ status: 'approving' })).toBe(true);
    expect(isPledgeRefundRequestOpen({ status: 'initiated' })).toBe(true);
  });

  it('a denied or completed request is closed', () => {
    expect(isPledgeRefundRequestOpen({ status: 'denied' })).toBe(false);
    expect(isPledgeRefundRequestOpen({ status: 'completed' })).toBe(false);
  });

  it('a failed request stays open until an admin resolves its follow-up', () => {
    expect(isPledgeRefundRequestOpen({ status: 'failed' })).toBe(true);
    expect(isPledgeRefundRequestOpen({ status: 'failed', failureFollowUpResolvedAt: 9 })).toBe(false);
  });

  it('only a failed request records a resolved follow-up', () => {
    const base = { pledgePaymentId: 'pp1', userId: 'u1', amount: 1000, requestedAt: 1 };
    expect(
      PledgeRefundRequestSchema.safeParse({ ...base, status: 'failed', failedAt: 3, failureFollowUpResolvedAt: 4 }).success,
    ).toBe(true);
    expect(
      PledgeRefundRequestSchema.safeParse({ ...base, status: 'completed', failureFollowUpResolvedAt: 4 }).success,
    ).toBe(false);
  });

  it('records when approval began and when the refund failed', () => {
    const base = { pledgePaymentId: 'pp1', userId: 'u1', amount: 1000, requestedAt: 1 };
    expect(PledgeRefundRequestSchema.safeParse({ ...base, status: 'approving', approvingAt: 2 }).success).toBe(true);
    expect(
      PledgeRefundRequestSchema.safeParse({ ...base, status: 'failed', approvingAt: 2, failedAt: 3 }).success,
    ).toBe(true);
  });
});

describe('the refund correlation and observation stamps on the provider reference', () => {
  const ref = {
    pledgePaymentId: 'pp1',
    userId: 'u1',
    stripeSessionId: 'cs_1',
    paymentIntentId: 'pi_1',
    latestChargeId: null,
    refundIds: [],
    disputeId: null,
    ageAttestedAt: 1,
    createdAt: 1,
    updatedAt: 1,
  };

  it('carries the request being refunded and the amount it asked Stripe for, then the refund id', () => {
    expect(
      PledgePaymentProviderRefSchema.safeParse({
        ...ref,
        refundCorrelation: { requestId: 'r1', intendedAmount: 1000 },
      }).success,
    ).toBe(true);
    expect(
      PledgePaymentProviderRefSchema.safeParse({
        ...ref,
        refundCorrelation: { requestId: 'r1', intendedAmount: 1000, refundId: 're_1' },
      }).success,
    ).toBe(true);
  });

  it('the intended amount is a positive whole number of cents', () => {
    for (const intendedAmount of [0, -5, 10.5]) {
      expect(
        PledgePaymentProviderRefSchema.safeParse({ ...ref, refundCorrelation: { requestId: 'r1', intendedAmount } }).success,
        String(intendedAmount),
      ).toBe(false);
    }
  });

  it('records the Stripe event time each handler last applied', () => {
    expect(
      PledgePaymentProviderRefSchema.safeParse({ ...ref, refundObservedAt: 5, disputeObservedAt: 6 }).success,
    ).toBe(true);
  });

  it('keeps the last refund failure reason within the internal reason cap', () => {
    expect(PledgePaymentProviderRefSchema.safeParse({ ...ref, lastRefundFailureReason: 'expired_or_canceled_card' }).success).toBe(true);
    expect(
      PledgePaymentProviderRefSchema.safeParse({ ...ref, lastRefundFailureReason: 'x'.repeat(MAX_INTERNAL_REASON_LENGTH + 1) }).success,
    ).toBe(false);
  });
});

describe('refund and dispute states', () => {
  it('the ledger takes its refund and dispute states from the exported sets', () => {
    expect([...PledgePaymentSchema.shape.refundState.options]).toEqual([...PLEDGE_REFUND_STATES]);
    expect([...PledgePaymentSchema.shape.disputeState.options]).toEqual([...PLEDGE_DISPUTE_STATES]);
  });

  it('a dispute only moves forward: none, then under review, then won or lost', () => {
    expect(pledgeDisputeStateRank('none')).toBeLessThan(pledgeDisputeStateRank('underReview'));
    expect(pledgeDisputeStateRank('underReview')).toBeLessThan(pledgeDisputeStateRank('won'));
    expect(pledgeDisputeStateRank('won')).toBe(pledgeDisputeStateRank('lost'));
    expect(isPledgeDisputeAdvance('none', 'underReview')).toBe(true);
    expect(isPledgeDisputeAdvance('underReview', 'won')).toBe(true);
    expect(isPledgeDisputeAdvance('underReview', 'lost')).toBe(true);
    expect(isPledgeDisputeAdvance('none', 'lost')).toBe(true);
  });

  it('a late or repeated dispute event never moves a dispute back or sideways', () => {
    const noAdvance: [PledgeDisputeState, PledgeDisputeState][] = [
      ['underReview', 'underReview'],
      ['underReview', 'none'],
      ['won', 'underReview'],
      ['lost', 'underReview'],
      ['won', 'lost'],
      ['lost', 'won'],
      ['lost', 'none'],
    ];
    for (const [from, to] of noAdvance) {
      expect(isPledgeDisputeAdvance(from, to), `${from} -> ${to}`).toBe(false);
    }
  });
});

describe('refund eligibility', () => {
  const now = 10_000_000_000;
  const pledge = {
    userId: 'owner',
    createdAt: now - 1000,
    refundState: 'none' as const,
    disputeState: 'none' as const,
    netAmount: 1000,
  };

  it('the owner may request a refund of a pristine pledge inside the window', () => {
    expect(isPledgeRefundRequestable(pledge, 'owner', now, null)).toBe(true);
    expect(isPledgeRefundRequestable({ ...pledge, createdAt: now - PLEDGE_REFUND_REQUEST_WINDOW_MS }, 'owner', now, null)).toBe(true);
    expect(isPledgeRefundRequestable({ ...pledge, disputeState: 'won' }, 'owner', now, null)).toBe(true);
  });

  it('only the pledge owner may request', () => {
    expect(isPledgeRefundRequestable(pledge, 'someone-else', now, null)).toBe(false);
  });

  it('the window closes after PLEDGE_REFUND_REQUEST_WINDOW_MS', () => {
    expect(
      isPledgeRefundRequestable({ ...pledge, createdAt: now - PLEDGE_REFUND_REQUEST_WINDOW_MS - 1 }, 'owner', now, null),
    ).toBe(false);
  });

  it('a refunded, disputed, or emptied pledge is not requestable', () => {
    expect(isPledgeRefundRequestable({ ...pledge, refundState: 'partial' }, 'owner', now, null)).toBe(false);
    expect(isPledgeRefundRequestable({ ...pledge, refundState: 'full' }, 'owner', now, null)).toBe(false);
    expect(isPledgeRefundRequestable({ ...pledge, disputeState: 'underReview' }, 'owner', now, null)).toBe(false);
    expect(isPledgeRefundRequestable({ ...pledge, disputeState: 'lost' }, 'owner', now, null)).toBe(false);
    expect(isPledgeRefundRequestable({ ...pledge, netAmount: 0 }, 'owner', now, null)).toBe(false);
  });

  it('approval needs the pledge still pristine and its live net still the requested amount', () => {
    expect(isPledgeRefundApprovable(pledge, 1000)).toBe(true);
    expect(isPledgeRefundApprovable(pledge, 900)).toBe(false);
    expect(isPledgeRefundApprovable({ ...pledge, refundState: 'partial' }, 1000)).toBe(false);
    expect(isPledgeRefundApprovable({ ...pledge, disputeState: 'underReview' }, 1000)).toBe(false);
    expect(isPledgeRefundApprovable({ ...pledge, disputeState: 'lost' }, 1000)).toBe(false);
    expect(isPledgeRefundApprovable({ ...pledge, netAmount: 0 }, 0)).toBe(false);
  });

  it('approval does not apply the request window — an admin may approve a request filed in time', () => {
    const longAgo = { ...pledge, createdAt: now - PLEDGE_REFUND_REQUEST_WINDOW_MS * 2 };
    expect(isPledgeRefundApprovable(longAgo, 1000)).toBe(true);
  });
});

describe('stake shares are whole numbers', () => {
  const guildmate = {
    uid: 'u1',
    guildStandings: [],
    tradeProfessions: [],
    stakeShareCount: 10,
    joinedAt: 1,
    status: 'active',
  };

  it('a guildmate holds a whole, non-negative number of stake shares', () => {
    expect(GuildmateUserSchema.safeParse(guildmate).success).toBe(true);
    expect(GuildmateUserSchema.safeParse({ ...guildmate, stakeShareCount: 0 }).success).toBe(true);
    expect(GuildmateUserSchema.safeParse({ ...guildmate, stakeShareCount: 2.5 }).success).toBe(false);
    expect(GuildmateUserSchema.safeParse({ ...guildmate, stakeShareCount: -1 }).success).toBe(false);
  });

  it('a pending stake-share reservation is a whole, positive number', () => {
    expect(PendingStakeSharesSchema.safeParse({ inv1: { amount: 5, createdAt: 1 } }).success).toBe(true);
    expect(PendingStakeSharesSchema.safeParse({ inv1: { amount: 0.5, createdAt: 1 } }).success).toBe(false);
    expect(PendingStakeSharesSchema.safeParse({ inv1: { amount: 0, createdAt: 1 } }).success).toBe(false);
  });
});

describe('the refund request refusal reasons', () => {
  const now = 10_000_000_000;
  const pledge = {
    userId: 'owner',
    createdAt: now - 1000,
    refundState: 'none' as const,
    disputeState: 'none' as const,
    netAmount: 1000,
  };

  it('answers no refusal for the owner of a pristine pledge inside the window', () => {
    expect(pledgeRefundRequestRefusal(pledge, 'owner', now, null)).toBeNull();
  });

  it('answers not-owner for someone else, before any other check', () => {
    const old = { ...pledge, createdAt: now - PLEDGE_REFUND_REQUEST_WINDOW_MS - 1, refundState: 'full' as const };
    expect(pledgeRefundRequestRefusal(old, 'someone-else', now, null)).toBe('not-owner');
  });

  it('answers window-expired for the owner once the window has closed, before the pristine check', () => {
    const old = { ...pledge, createdAt: now - PLEDGE_REFUND_REQUEST_WINDOW_MS - 1, refundState: 'full' as const };
    expect(pledgeRefundRequestRefusal(old, 'owner', now, null)).toBe('window-expired');
  });

  it('answers ineligible for the owner of a pledge that is no longer pristine', () => {
    expect(pledgeRefundRequestRefusal({ ...pledge, disputeState: 'underReview' }, 'owner', now, null)).toBe('ineligible');
    expect(pledgeRefundRequestRefusal({ ...pledge, netAmount: 0 }, 'owner', now, null)).toBe('ineligible');
  });

});

describe('the dispute ladder holds per dispute', () => {
  it('a later dispute on the same charge starts its own ladder', () => {
    expect(isPledgeDisputeEventApplicable({ disputeId: 'dp_1', state: 'won' }, { disputeId: 'dp_2', state: 'underReview' })).toBe(true);
    expect(isPledgeDisputeEventApplicable({ disputeId: 'dp_1', state: 'won' }, { disputeId: 'dp_2', state: 'lost' })).toBe(true);
  });

  it('the first dispute applies over a pledge with none recorded', () => {
    expect(isPledgeDisputeEventApplicable({ disputeId: null, state: 'none' }, { disputeId: 'dp_1', state: 'underReview' })).toBe(true);
  });

  it('within one dispute only an advance applies', () => {
    expect(isPledgeDisputeEventApplicable({ disputeId: 'dp_1', state: 'underReview' }, { disputeId: 'dp_1', state: 'lost' })).toBe(true);
    expect(isPledgeDisputeEventApplicable({ disputeId: 'dp_1', state: 'won' }, { disputeId: 'dp_1', state: 'underReview' })).toBe(false);
    expect(isPledgeDisputeEventApplicable({ disputeId: 'dp_1', state: 'won' }, { disputeId: 'dp_1', state: 'lost' })).toBe(false);
  });
});

describe('a failed refund blocks a new request until its follow-up is resolved', () => {
  const now = 10_000_000_000;
  const pledge = {
    userId: 'owner',
    createdAt: now - 1000,
    refundState: 'none' as const,
    disputeState: 'none' as const,
    netAmount: 1000,
  };

  it('a pledge with no request, or whose latest request is denied or completed, may be requested', () => {
    expect(pledgeRefundRequestRefusal(pledge, 'owner', now, null)).toBeNull();
    expect(pledgeRefundRequestRefusal(pledge, 'owner', now, { status: 'denied' })).toBeNull();
  });

  it('an in-flight request is already open', () => {
    for (const status of ['requested', 'approving', 'initiated'] as const) {
      expect(pledgeRefundRequestRefusal(pledge, 'owner', now, { status })).toBe('already-open');
    }
  });

  it('a failed refund still being followed up blocks a new request as already open', () => {
    expect(pledgeRefundRequestRefusal(pledge, 'owner', now, { status: 'failed' })).toBe('already-open');
    expect(isPledgeRefundRequestable(pledge, 'owner', now, { status: 'failed' })).toBe(false);
  });

  it('once the admin resolves the follow-up, the normal eligibility rules apply', () => {
    const resolved = { status: 'failed' as const, failureFollowUpResolvedAt: 9 };
    expect(pledgeRefundRequestRefusal(pledge, 'owner', now, resolved)).toBeNull();
    expect(isPledgeRefundRequestable(pledge, 'owner', now, resolved)).toBe(true);
    expect(
      pledgeRefundRequestRefusal({ ...pledge, createdAt: now - PLEDGE_REFUND_REQUEST_WINDOW_MS - 1 }, 'owner', now, resolved),
    ).toBe('window-expired');
  });

  it('the refusals are the four the request callable answers, in its order', () => {
    expect([...PLEDGE_REFUND_REQUEST_REFUSALS]).toEqual(['not-owner', 'window-expired', 'ineligible', 'already-open']);
  });
});
