// Money / pledge TYPES. Stored document shapes are inferred from the Zod doc-schemas in
// ../doc-schemas/payments.ts (single source of truth per the schema registry) — money data
// never lives in social.ts.

export type {
  PledgePayment,
  PledgePaymentProviderRef,
  ProcessedStripeEvent,
  PledgePaymentLedgerEvent,
  PaymentWebhookQuarantine,
  PledgePaymentTotalsDoc,
} from '../doc-schemas/payments.js';

/**
 * Totals view-model shared by every "total raised" surface. The stored source of truth is the
 * `pledgePaymentTotals/summary` singleton (PledgePaymentTotalsDoc — webhook-maintained); the
 * admin getOpsStatus additionally computes the same shape live via Firestore aggregation as a
 * drift check. `netRaised` drives the goal bar.
 */
export type PledgePaymentTotals = {
  netRaised: number;
  grossRaised: number;
  totalRefunded: number;
  pledgeCount: number;
};
