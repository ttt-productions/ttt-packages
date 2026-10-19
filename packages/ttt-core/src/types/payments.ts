// Money / pledge view-model types. The stored pledge document shapes are declared with their
// schemas in ../doc-schemas/payments.ts.

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
