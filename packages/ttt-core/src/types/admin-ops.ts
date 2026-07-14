// Admin ops-dashboard callable return shapes — cross-boundary contracts (backend
// builds them, frontend renders them), so they live HERE per the Cross-Boundary
// Type Invariant. Consolidated 2026-07-13 from the former "intentional LOCAL DTO"
// in functions/src/admin/getOpsStatus.ts + its structurally-matching frontend
// re-declaration (publish-avoidance rationale — auto-reject; Rule 36 extended).

import type { PledgePaymentTotals } from './payments.js';

/** The `getOpsStatus` callable's return shape (read-only ops snapshot). */
export interface OpsStatus {
  generatedAt: number;
  /** pendingMedia processing pipeline depth + uncleared failures. */
  media: { pending: number; processing: number; failed: number };
  /** Open admin work-queue tasks by type (status == 'pending'). `opsAnomalies` is the
   *  combined stake-share + pledge-ledger + pledge-payment-repair integrity lane depth. */
  adminQueue: {
    libraryReviews: number;
    reports: number;
    appeals: number;
    dispatches: number;
    opsAnomalies: number;
  };
  /** userProfiles created in the last 24h. */
  signupsLast24h: number;
  /** auditEvents with result == 'failure' in the last 24h (failed sensitive actions). */
  actionFailuresLast24h: number;
  /** auditEvents of type 'payment.pledgePaymentFailed' in the last 24h. */
  paymentFailuresLast24h: number;
  /** All-time pledge totals (live Firestore aggregation over pledgePayments; cents). */
  pledge: PledgePaymentTotals;
}
