// The ONE writer/remover of the time-sensitive admin-tray pin
// (`activeSafetyCaseAlerts/{caseId}` — a PII-free `SafetyCaseAlertV1`).
//
// A row exists while a protected case needs operator attention; its mere EXISTENCE
// lights the admin-only 5th notification-tray tab. It is:
//   - WRITTEN at the ONE protected place — the case-open transactions
//     (openChildSafetyCase / openNciiCaseFromReport) call writeActiveSafetyCaseAlert
//     in-transaction; the public take-it-down intake calls the SAME writer from its own
//     module graph, keyed by requestId (so a statutory request's "case" is the request).
//   - REMOVED by the case-close Cloud Function when the case reaches a terminal/closed
//     state on the Safety Case Console. There is NO client clear path (firestore.rules:
//     admin-read, CF-write-only), so the tray's Clear All can never dismiss it while a
//     case is still open.
//
// PII-free by construction — the schema carries only {caseId, caseKind, createdAt}.
//
// ARCH-102 / Cross-Boundary Type Invariant: this is the SINGLE canonical writer. It used
// to be hand-mirrored in both TTT app TS projects (the Cloud Functions graph and the App
// Hosting route graph) because they cannot cross-import; both now import it from ttt-core.
//
// ttt-core must NOT gain a runtime firebase-admin dependency (the `./safety` entry stays
// server-safe), so the injected Firestore handles are MINIMAL STRUCTURAL types — the
// writer only needs `tx.create(ref, data)`, `db.doc(path)`, and `ref.delete()`. The real
// Admin SDK `Transaction` / `Firestore` / `DocumentReference` satisfy them structurally.

import { PATH_BUILDERS, toPath } from '../paths/index.js';
import type { SafetyCaseAlertV1, SafetyCaseAlertKind } from '../doc-schemas/index.js';

const SCHEMA_VERSION = 1 as const;

/** Minimal structural handle for the Firestore doc reference the writer touches.
 *  The Admin SDK `DocumentReference` satisfies it (its `delete()` returns a WriteResult
 *  promise, assignable to `Promise<unknown>`). */
export interface SafetyAlertDocRefLike {
  delete(): Promise<unknown>;
}

/** Minimal structural handle for an Admin SDK `Transaction` — only `create` is used. */
export interface SafetyAlertTransactionLike {
  create(documentRef: SafetyAlertDocRefLike, data: SafetyCaseAlertV1): void;
}

/** Minimal structural handle for an Admin SDK `Firestore` — only `doc(path)` is used. */
export interface SafetyAlertDbLike {
  doc(path: string): SafetyAlertDocRefLike;
}

/**
 * Create the time-sensitive pin for a freshly-opened protected case, IN the case-open
 * transaction. Call ONLY on the first-creation path (where the case docs are
 * `tx.create`d) — the alert id is the caseId, so a retry that re-creates the case would
 * also re-create the same alert; gating it with the case create keeps it idempotent.
 */
export function writeActiveSafetyCaseAlert(
  tx: SafetyAlertTransactionLike,
  args: { db: SafetyAlertDbLike; caseId: string; caseKind: SafetyCaseAlertKind; now: number },
): void {
  const alert: SafetyCaseAlertV1 = {
    schemaVersion: SCHEMA_VERSION,
    caseId: args.caseId,
    caseKind: args.caseKind,
    createdAt: args.now,
  };
  tx.create(args.db.doc(toPath(PATH_BUILDERS.safetyCaseAlert(args.caseId))), alert);
}

/**
 * Remove the pin when a case closes. Idempotent — a delete of an absent doc is a no-op,
 * so a trigger redelivery (or a case that never armed a pin) is harmless.
 */
export async function deleteActiveSafetyCaseAlert(db: SafetyAlertDbLike, caseId: string): Promise<void> {
  await db.doc(toPath(PATH_BUILDERS.safetyCaseAlert(caseId))).delete();
}
