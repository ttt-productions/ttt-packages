// Backend-only state document SCHEMAS — Cloud-Functions-owned bookkeeping docs that no
// client ever reads or writes (firestore.rules denies client access to every path below).
// They are registered here for the same reason every other stored shape is: ARCH-104 gives
// the path ONE owner, and COLLECTION_SCHEMAS is the inventory the schema-doc generator and
// the drift-check read. Types are inferred via z.infer.

import { z } from 'zod';

// _systemData/hallMediaReaperCursor — the scheduled Hall-media orphan reaper's scan cursor.
// `createdAtCursor` is the highest mediaAssets `createdAt` the reaper has POSITIVELY cleared
// (candidate resolved referenced / reaped / already-deleted), so each pass resumes past
// permanently-live Hall assets instead of re-reading the same oldest page forever.
// (functions/src/media/reapOrphanedHallMediaCopies.ts)
export const HallMediaReaperCursorSchema = z.object({
  createdAtCursor: z.number(),
  updatedAt: z.number(),
});
export type HallMediaReaperCursor = z.infer<typeof HallMediaReaperCursorSchema>;

// operatorStepUp/{uid} — [H-08] per-operator TOTP step-up state: the authenticator secret
// plus the currently open grant window. The secret is returned to the client EXACTLY ONCE by
// enrollOperatorStepUp and is never readable through Firestore afterwards; `status` goes
// 'pending' → 'active' on confirm, and each successful verify pushes `grantExpiresAt` out by
// the step-up window. (functions/src/safety/operatorStepUp.ts)
export const OperatorStepUpSchema = z.object({
  secret: z.string(),
  status: z.enum(['pending', 'active']),
  /** Absent until the first successful verify; a grant is live while now < grantExpiresAt. */
  grantExpiresAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  /** Set when enrollment is confirmed (status flips to 'active'). */
  confirmedAt: z.number().optional(),
});
export type OperatorStepUp = z.infer<typeof OperatorStepUpSchema>;

// safetyReconcilerCursors/{cursorKey} — one persisted pagination cursor per reconciler
// needs-work backstop sweep (quarantine enqueue, NCMEC enqueue). The sweep pages a
// needs-work-filtered query from `afterValue` and WRAPS to the start when exhausted, so
// coverage does not stall on the oldest rows. (functions/src/safety/reconcilerCursor.ts)
export const SafetyReconcilerCursorSchema = z.object({
  /** `orderBy` value of the last row examined last pass (exclusive lower bound). Absent ⇒ 0. */
  afterValue: z.number().optional(),
  updatedAt: z.number(),
});
export type SafetyReconcilerCursor = z.infer<typeof SafetyReconcilerCursorSchema>;

// childSafetyCases/{caseId}/portalReceiptArtifacts/{artifactId} — [Q13/H-06] the immutable
// record of a PDF/screenshot of the completed NCMEC CyberTipline submission, stored in the
// restricted evidence vault. `markNcmecPortalComplete` accepts only the id of a verified
// artifact bound to the SAME (caseId, submissionId); an arbitrary operator string is never
// proof. Written create-only, never overwritten, and carries the server-verified storage facts
// (generation + sha256) so a later transactional verification can confirm the same object
// still exists unchanged. (functions/src/safety/ncmecOperatorCommands.ts)
export const NcmecPortalReceiptArtifactV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string(),
  submissionId: z.string(),
  /** Key of the object in the restricted evidence vault bucket. */
  evidenceVaultKey: z.string(),
  /** GCS object generation at capture time (immutable identity peg). */
  objectGeneration: z.string(),
  /** SHA-256 hex digest of the object bytes at capture time. */
  sha256: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  capturedAt: z.number(),
  registeredByUid: z.string(),
  /** Optional operator free-text describing what the artifact is. */
  description: z.string().optional(),
});
export type NcmecPortalReceiptArtifactV1 = z.infer<typeof NcmecPortalReceiptArtifactV1Schema>;

// childSafetyCases/{caseId}/ncmecPortalCorrections/{correctionId} — the immutable record that
// the operator filed a CORRECTION on the NCMEC manual portal. There is no in-app correction
// submission pipeline; this records the portal filing. Its EXISTENCE is the gate on the
// corrected-no-apparent-violation disposition, so it is never a bare-discretion close. Each
// correction is a fresh id — a later correction is an additional record, never a mutation of
// the prior one. (functions/src/safety/recordNcmecPortalCorrection.ts)
export const NcmecPortalCorrectionRecordV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string(),
  /** The portal-assigned NCMEC report id being corrected. */
  ncmecReportId: z.string(),
  /** When the operator filed the correction on the portal (operator-supplied). */
  correctionFiledAt: z.number(),
  reason: z.string(),
  recordedByUid: z.string(),
  recordedAt: z.number(),
});
export type NcmecPortalCorrectionRecordV1 = z.infer<typeof NcmecPortalCorrectionRecordV1Schema>;
