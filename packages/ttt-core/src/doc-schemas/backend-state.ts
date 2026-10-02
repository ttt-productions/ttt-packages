// Backend-only state document SCHEMAS — Cloud-Functions-owned bookkeeping docs that no
// client ever reads or writes (firestore.rules denies client access to every path below).
// They are registered here for the same reason every other stored shape is: ARCH-104 gives
// the path ONE owner, and COLLECTION_SCHEMAS is the inventory the schema-doc generator and
// the drift-check read. Types are inferred via z.infer.

import { z } from 'zod';
import { SWEEP_STATE_MAX_DEFERRED, SWEEP_STATE_NAMES } from '../constants/scheduled-jobs.js';
import { SweepRollingCursorSchema } from './sweep-cursor.js';
import {
  ChildSafetyNcmecCompletionChannelSchema,
  ChildSafetyNcmecCompletionProofTypeSchema,
} from './safety/case.js';

// operatorStepUp/{uid} — [H-08] per-operator TOTP step-up state: the authenticator secret
// plus the currently open grant window. The secret is returned to the client EXACTLY ONCE by
// enrollOperatorStepUp and is never readable through Firestore afterwards; `status` goes
// 'pending' → 'active' on confirm, and each successful verify pushes `grantExpiresAt` out by
// the step-up window. `failedAttempts` and `lockedUntil` make the server-side TOTP brute-force
// lockout durable; omitted fields are the compatible no-lockout state for rows written before
// that protection shipped. (functions/src/safety/operatorStepUp.ts)
export const OperatorStepUpSchema = z.object({
  secret: z.string(),
  status: z.enum(['pending', 'active']),
  /** Absent until the first successful verify; a grant is live while now < grantExpiresAt. */
  grantExpiresAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  /** Set when enrollment is confirmed (status flips to 'active'). */
  confirmedAt: z.number().optional(),
  /** Consecutive failed TOTP checks since the most recent success or lockout. */
  failedAttempts: z.number().int().nonnegative().optional(),
  /** Epoch ms until which TOTP verification is refused; absent or 0 means not locked. */
  lockedUntil: z.number().nonnegative().optional(),
});
export type OperatorStepUp = z.infer<typeof OperatorStepUpSchema>;

/** A `sweepState/{sweepName}` doc id — one of SWEEP_STATE_NAMES. */
export const SweepStateNameSchema = z.enum(SWEEP_STATE_NAMES);


// One row a pass's rolling cursor moved past without positively clearing it (a read error, a
// missing owner, a hold). The pass retries it from here once due instead of stopping at it, so one
// uncertain row never pins the window. `key` / `value` are the row's position in the cursor's
// terms (SweepRollingCursorSchema): its key, and its ordered value when the source has one.
export const SweepDeferredRowSchema = z
  .object({
    key: z.string().min(1),
    value: z.number().optional(),
    /** Epoch ms from which a pass may retry it. */
    nextAttemptAt: z.number().int().nonnegative(),
    /** Passes that examined it without clearing it; the pass that deferred it is the first. A pass's
     *  own backoff (e.g. HALL_MEDIA_REAPER_BACKOFF_BASE_MS / _MAX_MS) grows from it. */
    attemptCount: z.number().int().positive(),
  })
  .strict();
export type SweepDeferredRow = z.infer<typeof SweepDeferredRowSchema>;

// sweepState/{sweepName} — durable cadence + cursor state for one scheduled pass: every persisted
// sweep position in the app lives here, one doc per SWEEP_STATE_NAMES name. The fields a pass uses
// are the ones it declares, so every field except `updatedAt` is optional. A pass over a bounded,
// ordered source keeps its position in `rollingCursor` (a finished lap is `done`, stamped with
// `lapCompletedAt` — the cadence stamp of a pass that runs a lap at a time), and the rows it moved
// past without clearing in `deferred`. `fullScanLastRunAt` is the cadence of the ~weekly
// `listUsers()` scan `orphanRegistrationCleanup` and `reconcileAccountStatus` run. The stamps are
// wall-clock so a container recycle cannot reset the cadence.
export const SweepStateSchema = z
  .object({
    /** Wall-clock ms the last full `listUsers()` scan ran (absent = never). */
    fullScanLastRunAt: z.number().optional(),
    rollingCursor: SweepRollingCursorSchema.optional(),
    deferred: z.array(SweepDeferredRowSchema).max(SWEEP_STATE_MAX_DEFERRED).optional(),
    updatedAt: z.number(),
  })
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    (val.deferred ?? []).forEach((row, index) => {
      if (seen.has(row.key)) {
        ctx.addIssue({ code: 'custom', path: ['deferred', index, 'key'], message: 'a row is deferred at most once' });
      }
      seen.add(row.key);
    });
  });
export type SweepState = z.infer<typeof SweepStateSchema>;

// childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}/ncmecCompletionProof/record —
// [H-05] the IMMUTABLE record of a verified manual-portal completion. Written create-if-absent in
// the SAME transaction as the submission's `completed` transition, so a submission can never reach
// `completed` without a bound proof record; a re-completion keeps the original. The submission's
// `completionProofRef` stores this doc's path, never an operator free-text string.
// [Q13/H-06] `portalReceiptArtifactId` binds the proof to a verified NcmecPortalReceiptArtifactV1
// on the same (caseId, submissionId) — an arbitrary operator string is never accepted.
// (functions/src/safety/ncmecReporting.ts)
export const NcmecCompletionProofRecordV1Schema = z.object({
  caseId: z.string(),
  submissionId: z.string(),
  channel: ChildSafetyNcmecCompletionChannelSchema,
  proofType: ChildSafetyNcmecCompletionProofTypeSchema,
  /** Id of the verified portal-receipt artifact this completion is bound to. */
  portalReceiptArtifactId: z.string(),
  /** Optional operator free-text note about the confirmation. */
  proofText: z.string().optional(),
  /** The NCMEC-assigned report id — REQUIRED. The number IS the proof; there is no
   *  "filed, number pending" grace. */
  ncmecReportId: z.string(),
  recordedByUid: z.string(),
  recordedAt: z.number(),
});
export type NcmecCompletionProofRecordV1 = z.infer<typeof NcmecCompletionProofRecordV1Schema>;

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
