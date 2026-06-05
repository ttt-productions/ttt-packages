// Money / pledge TYPES. Stored document shapes are inferred from the Zod doc-schemas in
// ../doc-schemas/payments.ts (single source of truth per the schema registry) — money data
// never lives in social.ts. PledgePaymentTotals is a non-stored aggregation view-model, so it
// is a plain type defined here, deliberately outside the doc-schema registry.

export type {
  PledgePayment,
  PledgePaymentProviderRef,
  ProcessedStripeEvent,
  PledgePaymentLedgerEvent,
  PaymentWebhookQuarantine,
} from '../doc-schemas/payments.js';

/**
 * Aggregation result over `pledgePayments` (Firestore sum()/count()). Not a stored document —
 * computed live and cached (React Query hook + getOpsStatus). `netRaised` drives the goal bar.
 */
export type PledgePaymentTotals = {
  netRaised: number;
  grossRaised: number;
  totalRefunded: number;
  pledgeCount: number;
};
