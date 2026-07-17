// Admin ops-dashboard callable return shapes — cross-boundary contracts (backend
// builds them, frontend renders them), so they live HERE per the Cross-Boundary
// Type Invariant. Consolidated 2026-07-13 from the former "intentional LOCAL DTO"
// in functions/src/admin/getOpsStatus.ts + its structurally-matching frontend
// re-declaration (publish-avoidance rationale — auto-reject; Rule 36 extended).

import type { PledgePaymentTotals } from './payments.js';
import type { DeadLetterCollection } from '../schemas/admin.js';

/** Trust & Safety SLA-clock + active-case snapshot for the Mission Control landing (§A8).
 * Counts are point-in-time; the per-lane earliest-deadline epochs (ms) are handed over raw so
 * the countdown ticks CLIENT-side — the server holds no live timer. All fields optional so an
 * older client still type-checks; the earliest-* epochs are additionally absent when a lane has
 * no armed clock. */
export interface OpsSafetyClocks {
  /** `safetySlaMonitors` rows with status == 'armed' (an obligation clock still running). */
  armedMonitors: number;
  /** `safetySlaMonitors` rows with status == 'overdue' (a breached SLA obligation). */
  overdueMonitors: number;
  /** Open CSAM (childSafety) cases. */
  activeChildSafetyCases: number;
  /** Open NCII cases. */
  activeNciiCases: number;
  /** Open statutory TAKE IT DOWN requests (`takeItDownRequests`). */
  activeTakeItDownRequests: number;
  /** Earliest armed `reviewDue` monitor deadline across all lanes (epoch ms). */
  earliestReviewDueAt?: number;
  /** Earliest armed CSAM `photoDnaContract` (72h match-reporting) deadline (epoch ms). */
  earliestPhotoDnaContractAt?: number;
  /** Earliest armed NCII / TAKE IT DOWN `nciiRemovalDeadline` (48h statutory removal) deadline
   *  (epoch ms). */
  earliestNciiRemovalDeadlineAt?: number;
}

/** Backend-machinery health for the Mission Control landing: dead-letter depth, stuck async
 * lanes, failed media, and the global safety-sweep dead-man heartbeat. Numbers/epochs only. */
export interface OpsBrokenMachinery {
  /** Total parked dead-letter rows across every ledger (see `getDeadLetters`). */
  deadLetterTotal: number;
  /** Dead-lettered chat-sync fanout jobs (`chatSyncFanoutJobs`). */
  deadLetteredFanoutJobs: number;
  /** Stuck hall-sub-item edge-sync rows (`hallSubItemEdgeSync`). */
  stuckEdgeSyncCount: number;
  /** Uncleared failed pendingMedia (mirrors `media.failed`, surfaced in the machinery lane). */
  failedMediaCount: number;
  /** `safetyMonitorHeartbeat/global.lastRunAt` (epoch ms) of the scheduled monitor sweep;
   *  staleness is computed client-side against that doc's `expectedIntervalMs`. Absent if the
   *  heartbeat has never stamped. */
  safetyMonitorHeartbeatLastRunAt?: number;
}

/** The `getOpsStatus` callable's return shape (read-only ops snapshot). */
export interface OpsStatus {
  generatedAt: number;
  /** pendingMedia processing pipeline depth + uncleared failures. */
  media: { pending: number; processing: number; failed: number };
  /** Open admin work-queue tasks by type (status == 'pending'). `opsAnomalies` is the
   *  combined stake-share + pledge-ledger + pledge-payment-repair integrity lane depth.
   *  `refundRequests` and `disputes` are additive (optional) money-ops queue counts — an
   *  older backend that does not project them simply omits them. */
  adminQueue: {
    libraryReviews: number;
    reports: number;
    appeals: number;
    dispatches: number;
    opsAnomalies: number;
    /** Pending user-initiated refund requests (the `payment.pledgeRefundRequested` lane). */
    refundRequests?: number;
    /** Open Stripe disputes / chargebacks awaiting resolution. */
    disputes?: number;
  };
  /** userProfiles created in the last 24h. */
  signupsLast24h: number;
  /** auditEvents with result == 'failure' in the last 24h (failed sensitive actions). */
  actionFailuresLast24h: number;
  /** auditEvents of type 'payment.pledgePaymentFailed' in the last 24h. */
  paymentFailuresLast24h: number;
  /** All-time pledge totals (live Firestore aggregation over pledgePayments; cents). */
  pledge: PledgePaymentTotals;
  /** Trust & Safety SLA-clock + active-case snapshot (§A8). Additive — an older backend that
   *  does not project it omits the block entirely. */
  safetyClocks?: OpsSafetyClocks;
  /** Backend-machinery health snapshot. Additive — omitted by an older backend. */
  brokenMachinery?: OpsBrokenMachinery;
}

/** One parked row in the `getDeadLetters` operator view — a normalized projection
 * over the heterogeneous ledger shapes (the callable maps each ledger's own
 * status/error/timestamp fields onto this). */
export interface DeadLetterRow {
  collection: DeadLetterCollection;
  /** Flat doc id, or the full nested document path for hallSubItemEdgeSync rows. */
  docId: string;
  deadLetteredAt: number | null;
  lastError: string | null;
  attemptCount: number | null;
}

/** The `getDeadLetters` callable's return shape. */
export interface GetDeadLettersResult {
  generatedAt: number;
  rows: DeadLetterRow[];
  /** True when any ledger hit the row cap — more parked rows exist than shown. */
  truncated: boolean;
}
