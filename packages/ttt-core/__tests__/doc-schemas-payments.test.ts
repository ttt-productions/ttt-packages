import { describe, it, expect } from 'vitest';
import {
  PledgePaymentSchema,
  PledgePaymentProviderRefSchema,
  ProcessedStripeEventSchema,
  PledgePaymentLedgerEventSchema,
  PaymentWebhookQuarantineSchema,
  PledgeRefundRequestSchema,
  pledgeDisputeNumberForEvent,
  isPledgeDisputeTransitionLegal,
} from '../src/doc-schemas/payments';

const validPledgePayment = {
  pledgePaymentId: 'pp1',
  userId: 'u1',
  amount: 1000,
  refundedAmount: 0,
  disputeLostAmount: 0,
  netAmount: 1000,
  currency: 'usd',
  paymentInstrument: 'card',
  status: 'completed',
  refundState: 'none',
  disputeState: 'none',
  disputeNumber: 0,
  createdAt: 1,
  updatedAt: 1,
};

// Fields the auth-readable ledger doc must NEVER declare. `pledgePayments` is
// `allow read: if request.auth != null` (every signed-in member), so anything here is a
// disclosure the design forbids: Stripe provider identifiers, the free-text supporter
// message, and the 18+ age-attestation consent evidence — which lives on the server-only
// `pledgePaymentProviderRefs` doc instead.
const SERVER_ONLY_LEDGER_FIELDS = [
  'stripeSessionId',
  'paymentIntentId',
  'latestChargeId',
  'refundIds',
  'disputeId',
  'ageAttestedAt',
  'message',
] as const;

describe('PledgePaymentSchema (public-safe ledger)', () => {
  it('accepts a valid launch pledge (net === amount, states none)', () => {
    expect(PledgePaymentSchema.safeParse(validPledgePayment).success).toBe(true);
  });

  it('declares NO server-only field — the ledger is readable by every signed-in member', () => {
    // The guard that matters: this doc is auth-readable, so a server-only field declared here
    // invites the next writer/projection to put it on a member-readable document.
    const declared = Object.keys(PledgePaymentSchema.shape);
    for (const field of SERVER_ONLY_LEDGER_FIELDS) {
      expect(declared).not.toContain(field);
    }
    const parsed = PledgePaymentSchema.parse(validPledgePayment);
    for (const field of SERVER_ONLY_LEDGER_FIELDS) {
      expect(parsed).not.toHaveProperty(field);
    }
  });

  it('pins paymentInstrument to the literal "card"', () => {
    expect(
      PledgePaymentSchema.safeParse({ ...validPledgePayment, paymentInstrument: 'paypal' }).success,
    ).toBe(false);
  });

  it('pins status to the literal "completed"', () => {
    expect(
      PledgePaymentSchema.safeParse({ ...validPledgePayment, status: 'pending' }).success,
    ).toBe(false);
  });

  it('constrains refundState / disputeState to their enums', () => {
    expect(
      PledgePaymentSchema.safeParse({ ...validPledgePayment, refundState: 'reversed' }).success,
    ).toBe(false);
    expect(
      PledgePaymentSchema.safeParse({ ...validPledgePayment, disputeState: 'pending' }).success,
    ).toBe(false);
  });

  it('requires netAmount (the sum() target)', () => {
    const { netAmount, ...withoutNet } = validPledgePayment;
    void netAmount;
    expect(PledgePaymentSchema.safeParse(withoutNet).success).toBe(false);
  });

  it('rejects a non-numeric amount', () => {
    expect(PledgePaymentSchema.safeParse({ ...validPledgePayment, amount: '1000' }).success).toBe(false);
  });
});

describe('PledgePaymentProviderRefSchema (server-only Stripe refs)', () => {
  const validRef = {
    pledgePaymentId: 'pp1',
    userId: 'u1',
    stripeSessionId: 'cs_test_1',
    paymentIntentId: 'pi_1',
    latestChargeId: null,
    refundIds: [],
    disputeId: null,
    ageAttestedAt: 1,
    createdAt: 1,
    updatedAt: 1,
  };

  it('accepts a new pledge ref (refundIds [], disputeId null, no charge yet)', () => {
    expect(PledgePaymentProviderRefSchema.safeParse(validRef).success).toBe(true);
  });

  it('requires ageAttestedAt — the consent evidence rides the SERVER-ONLY doc', () => {
    // What the webhook actually writes (runProcessStripePledgeEvent.ts): the attestation
    // timestamp goes here, not on the auth-readable ledger doc.
    const { ageAttestedAt, ...withoutAttestation } = validRef;
    void ageAttestedAt;
    expect(PledgePaymentProviderRefSchema.safeParse(withoutAttestation).success).toBe(false);
  });

  it('accepts a resolved charge id and refund/dispute ids', () => {
    expect(
      PledgePaymentProviderRefSchema.safeParse({
        ...validRef,
        latestChargeId: 'ch_1',
        refundIds: ['re_1'],
        disputeId: 'dp_1',
      }).success,
    ).toBe(true);
  });

  it('requires stripeSessionId (the success-page lookup key)', () => {
    const { stripeSessionId, ...withoutSession } = validRef;
    void stripeSessionId;
    expect(PledgePaymentProviderRefSchema.safeParse(withoutSession).success).toBe(false);
  });
});

describe('ProcessedStripeEventSchema (idempotency sentinel)', () => {
  it('accepts a completion event that produced a pledge', () => {
    expect(
      ProcessedStripeEventSchema.safeParse({
        eventId: 'evt_1',
        eventType: 'checkout.session.completed',
        processedAt: 1,
        pledgePaymentId: 'pp1',
      }).success,
    ).toBe(true);
  });

  it('accepts a non-pledge event (expiry/failure) with null pledgePaymentId', () => {
    expect(
      ProcessedStripeEventSchema.safeParse({
        eventId: 'evt_2',
        eventType: 'checkout.session.expired',
        processedAt: 1,
        pledgePaymentId: null,
      }).success,
    ).toBe(true);
  });
});

describe('PledgePaymentLedgerEventSchema (integrity trail)', () => {
  it('accepts a create record (before null, after snapshot)', () => {
    expect(
      PledgePaymentLedgerEventSchema.safeParse({
        ledgerId: 'l1',
        pledgePaymentId: 'pp1',
        subtype: 'created',
        reason: 'pledge created',
        before: null,
        after: { ...validPledgePayment },
        source: 'firestore-trigger',
        createdAt: 1,
      }).success,
    ).toBe(true);
  });

  it('captures an anomalous after-snapshot of any shape (forensic bag)', () => {
    expect(
      PledgePaymentLedgerEventSchema.safeParse({
        ledgerId: 'l2',
        pledgePaymentId: 'pp1',
        subtype: 'anomaly',
        reason: 'out-of-band edit',
        before: { amount: 1000 },
        after: { amount: 'tampered', extra: true },
        source: 'firestore-trigger',
        createdAt: 2,
      }).success,
    ).toBe(true);
  });

  it('pins source to the literal "firestore-trigger"', () => {
    expect(
      PledgePaymentLedgerEventSchema.safeParse({
        ledgerId: 'l3',
        pledgePaymentId: 'pp1',
        subtype: 'created',
        reason: 'x',
        before: null,
        after: null,
        source: 'webhook',
        createdAt: 1,
      }).success,
    ).toBe(false);
  });
});

describe('PaymentWebhookQuarantineSchema (admin-readable, safe summary only)', () => {
  it('accepts an open quarantine record with only IDs + redacted summary', () => {
    expect(
      PaymentWebhookQuarantineSchema.safeParse({
        eventId: 'evt_1',
        eventType: 'checkout.session.completed',
        livemode: true,
        reason: 'paid but missing metadata',
        recoverable: false,
        stripeObjectIds: { sessionId: 'cs_1', paymentIntentId: 'pi_1' },
        rawSafeSummary: 'paid session with no userId metadata',
        status: 'open',
        createdAt: 1,
      }).success,
    ).toBe(true);
  });

  it('constrains status to open | resolved | ignored', () => {
    expect(
      PaymentWebhookQuarantineSchema.safeParse({
        eventId: 'evt_1',
        eventType: 'checkout.session.completed',
        livemode: true,
        reason: 'x',
        recoverable: false,
        stripeObjectIds: {},
        rawSafeSummary: 'x',
        status: 'pending',
        createdAt: 1,
      }).success,
    ).toBe(false);
  });
});

describe('PledgeRefundRequestSchema (user-initiated refund request)', () => {
  const validRequest = {
    pledgePaymentId: 'pp1',
    userId: 'u1',
    amount: 1000,
    status: 'requested' as const,
    requestedAt: 1,
  };

  it('accepts a minimal requested record (no resolution fields yet)', () => {
    expect(PledgeRefundRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it('accepts a completed record with resolution + completion timestamps', () => {
    expect(
      PledgeRefundRequestSchema.safeParse({
        ...validRequest,
        status: 'completed',
        reason: 'accidental double pledge',
        resolvedBy: 'admin1',
        resolvedAt: 2,
        completedAt: 3,
      }).success,
    ).toBe(true);
  });

  it('constrains status to the refund request lifecycle', () => {
    expect(PledgeRefundRequestSchema.safeParse({ ...validRequest, status: 'cancelled' }).success).toBe(false);
  });

  it('carries no Stripe ids on the shape (they stay on the provider-refs doc)', () => {
    const parsed = PledgeRefundRequestSchema.parse(validRequest);
    expect(parsed).not.toHaveProperty('refundId');
    expect(parsed).not.toHaveProperty('paymentIntentId');
    expect(parsed).not.toHaveProperty('stripeSessionId');
  });
});

describe('the dispute number on the member-readable pledge', () => {
  it('is required: 0 until the first dispute, then the count of disputes the pledge has had', () => {
    const { disputeNumber: _number, ...withoutNumber } = validPledgePayment;
    expect(PledgePaymentSchema.safeParse(withoutNumber).success).toBe(false);
    expect(PledgePaymentSchema.safeParse({ ...validPledgePayment, disputeNumber: 0 }).success).toBe(true);
    expect(
      PledgePaymentSchema.safeParse({ ...validPledgePayment, disputeNumber: 1, disputeState: 'underReview' }).success,
    ).toBe(true);
    expect(PledgePaymentSchema.safeParse({ ...validPledgePayment, disputeNumber: 2, disputeState: 'won' }).success).toBe(true);
  });

  it('is a whole count, never a Stripe dispute id', () => {
    expect(PledgePaymentSchema.safeParse({ ...validPledgePayment, disputeNumber: 'dp_123' }).success).toBe(false);
    expect(PledgePaymentSchema.safeParse({ ...validPledgePayment, disputeNumber: -1 }).success).toBe(false);
    expect(PledgePaymentSchema.safeParse({ ...validPledgePayment, disputeNumber: 1.5, disputeState: 'won' }).success).toBe(false);
  });

  it('agrees with the dispute state: no dispute is number 0, and a dispute is number 1 or more', () => {
    expect(
      PledgePaymentSchema.safeParse({ ...validPledgePayment, disputeNumber: 0, disputeState: 'underReview' }).success,
    ).toBe(false);
    expect(PledgePaymentSchema.safeParse({ ...validPledgePayment, disputeNumber: 1, disputeState: 'none' }).success).toBe(false);
  });

  it('numbers the first dispute 1, keeps the number for a later event of the same dispute, and adds one for a new dispute', () => {
    expect(pledgeDisputeNumberForEvent({ disputeId: null, disputeNumber: 0 }, 'dp_1')).toBe(1);
    expect(pledgeDisputeNumberForEvent({ disputeId: 'dp_1', disputeNumber: 1 }, 'dp_1')).toBe(1);
    expect(pledgeDisputeNumberForEvent({ disputeId: 'dp_1', disputeNumber: 1 }, 'dp_2')).toBe(2);
    expect(pledgeDisputeNumberForEvent({ disputeId: 'dp_2', disputeNumber: 2 }, 'dp_3')).toBe(3);
  });

  describe('which dispute transitions a pledge may make', () => {
    const at = (disputeNumber: number, disputeState: 'none' | 'underReview' | 'won' | 'lost') => ({ disputeNumber, disputeState });

    it('within one dispute, only up the ladder (or unchanged, as a redelivery or a refund leaves it)', () => {
      expect(isPledgeDisputeTransitionLegal(at(0, 'none'), at(0, 'none'))).toBe(true);
      expect(isPledgeDisputeTransitionLegal(at(1, 'underReview'), at(1, 'won'))).toBe(true);
      expect(isPledgeDisputeTransitionLegal(at(1, 'underReview'), at(1, 'lost'))).toBe(true);
      expect(isPledgeDisputeTransitionLegal(at(1, 'lost'), at(1, 'lost'))).toBe(true);
      expect(isPledgeDisputeTransitionLegal(at(1, 'won'), at(1, 'underReview'))).toBe(false);
      expect(isPledgeDisputeTransitionLegal(at(1, 'won'), at(1, 'lost'))).toBe(false);
      expect(isPledgeDisputeTransitionLegal(at(1, 'lost'), at(1, 'won'))).toBe(false);
    });

    it('a new dispute (number up by one) starts its own ladder at any state but none', () => {
      expect(isPledgeDisputeTransitionLegal(at(0, 'none'), at(1, 'underReview'))).toBe(true);
      expect(isPledgeDisputeTransitionLegal(at(1, 'won'), at(2, 'underReview'))).toBe(true);
      // A close delivered before its opening.
      expect(isPledgeDisputeTransitionLegal(at(0, 'none'), at(1, 'won'))).toBe(true);
      expect(isPledgeDisputeTransitionLegal(at(1, 'lost'), at(2, 'lost'))).toBe(true);
      expect(isPledgeDisputeTransitionLegal(at(1, 'won'), at(2, 'none'))).toBe(false);
    });

    it('never skips a number or goes back', () => {
      expect(isPledgeDisputeTransitionLegal(at(0, 'none'), at(2, 'underReview'))).toBe(false);
      expect(isPledgeDisputeTransitionLegal(at(2, 'won'), at(1, 'won'))).toBe(false);
      expect(isPledgeDisputeTransitionLegal(at(1, 'underReview'), at(0, 'none'))).toBe(false);
    });
  });
});
