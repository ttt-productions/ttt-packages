// Trust & Safety — the child-safety CASE spine (Appendix A §A1b, §A9).
//
// The split-projection case model: a reviewer list/metadata doc
// (`childSafetyCaseList/{caseId}` — NO content, NO reporter identity) and a
// restricted root (`childSafetyCases/{caseId}` — adds the evidence manifest,
// the internal reason, and the lease/fencing fields). Append-only detail lives
// in subcollections (NEVER arrays), each enforced by writing to the
// subcollection so there is no parent array to overflow.
//
// Every shape here is transcribed verbatim from the frozen Trust & Safety spec
// (Appendix A §A1b + the §A9 state-transition rules) — no invented values, no
// placeholders; the durable design owner is ttt-prod
// docs/design/csam-detection-and-response.md.
//
// SHARED enums come from ./foundation.js (the single source for every
// cross-cluster enum); they are NEVER redefined here. This cluster IMPORTS
// ReportDispositionSchema, ReportDispositionReasonCodeSchema, and
// NcmecSubmissionStateSchema from foundation.
//
// Collection note: this cluster introduces NEW Firestore collections; the app
// leg (orchestrator) wires collections.ts / path-builders.ts / registry.ts.
// The merge/alias/correlation cluster (§A2) lives in ./case-aliases.js.

import { z } from 'zod';
import {
  ReportDispositionSchema,
  ReportDispositionReasonCodeSchema,
  refineReportDispositionReasonCode,
  refineReportDispositionEvidenceRefs,
  NcmecSubmissionStateSchema,
  SafetyCaseClosureV1Schema,
  TargetLocatorV1Schema,
  SafetyCrossoverLegStatusSchema,
  type SafetyCrossoverLegStatus,
} from './foundation.js';
import { MAX_MANIFEST_NCMEC_RECEIPTS } from './evidence.js';
import { LEGAL_REPORTING_DISPOSITION_CONFIRMATION } from '../../constants/safety-confirmation-phrases.js';
import { SweepRollingCursorSchema, type SweepRollingCursor } from '../sweep-cursor.js';

// ===========================================================================
// Cluster-local enums (§A1b + §A9). These are case-spine-specific value sets,
// NOT cross-cluster; they live here, not in foundation.
// ===========================================================================

/** Incident classification on the case (§A1b). */
export const ChildSafetyIncidentClassSchema = z.enum([
  'apparentCsam',
  'enticement',
  'minorSexTrafficking',
  'sextortion',
  'csamSolicitation',
  'imminentCsea',
  'nonReportableSafety',
]);
export type ChildSafetyIncidentClass = z.infer<typeof ChildSafetyIncidentClassSchema>;

/** Source-signal kind (shared by the case `sourceSignalSummary` projection and
 * the `…/sourceSignals/{signalId}` append-only rows). */
export const ChildSafetySignalKindSchema = z.enum([
  'hashMatch',
  'report',
  'aiFlag',
  'manual',
  'copyMatch',
]);
export type ChildSafetySignalKind = z.infer<typeof ChildSafetySignalKindSchema>;

/** §A9 workStatus FSM: new → triaged → reporting → actioning → operationallyResolved.
 * `operationallyResolved` NEVER deletes the case (preservation continues).
 *
 * [R12] close-lifecycle states: clicking **Close** (after the strict-closable gate passes)
 * applies the staged actions and moves the case to `processing` — it STAYS pinned/in-queue,
 * it is NEVER cleared on the click. The WORKER (quarantine saga / NCII removal / edge
 * serving-deny) flips the case to the terminal `operationallyResolved` ONLY on VERIFIED
 * completion (which clears the time-sensitive pin via onSafetyCaseClosed). If the saga
 * exhausts its retries (dead-letter), the case moves to `failed` — kept pinned, surfaced in
 * the Safety Console failed-jobs view, with a Restart that re-arms the job. Both are explicit
 * values (never derived). */
/** The two safety-case lanes: a child-safety (CSAM) case and an NCII case. */
export const SafetyCaseLaneSchema = z.enum(['csam', 'ncii']);
export type SafetyCaseLane = z.infer<typeof SafetyCaseLaneSchema>;

export const ChildSafetyWorkStatusSchema = z.enum([
  'new',
  'triaged',
  'reporting',
  'actioning',
  'processing',
  'failed',
  'operationallyResolved',
]);
export type ChildSafetyWorkStatus = z.infer<typeof ChildSafetyWorkStatusSchema>;

/** §A9 preservationStatus FSM: preReportHold → statutoryHold → extendedHold? →
 * dispositionPending → destroyed. `statutoryHold` is set only at verified
 * completion; deletion is eligible only when every hold ref is released AND a
 * reviewed disposition job runs (no auto-delete at exactly one year). */
export const ChildSafetyPreservationStatusSchema = z.enum([
  'preReportHold',
  'statutoryHold',
  'extendedHold',
  'dispositionPending',
  'destroyed',
]);
export type ChildSafetyPreservationStatus = z.infer<typeof ChildSafetyPreservationStatusSchema>;

/** §A9 accountActionStatus — the closure projection over `accountActionCommands`
 * (Finding-H5). A report-required case may not operationally close while
 * `pending`/`operatorDecisionPending`. */
export const ChildSafetyAccountActionStatusSchema = z.enum([
  'noAccountActionRequired',
  'operatorDecisionPending',
  'pending',
  'resolved',
]);
export type ChildSafetyAccountActionStatus = z.infer<typeof ChildSafetyAccountActionStatusSchema>;

/** §A1b reportState — derived list-projection of (reportDisposition + latest
 * submission.state) for admin-list rendering ONLY; NOT the source of truth for
 * whether a report is required (that is reportDisposition, §A9). */
export const ChildSafetyReportStateSchema = z.enum([
  'reportAsSoonAsReasonablyPossible',
  'submissionInProgress',
  'completed',
]);
export type ChildSafetyReportState = z.infer<typeof ChildSafetyReportStateSchema>;

/** §A1b decisions[].kind — the append-only decision-log kind. `caseClosed` [EUAS-008]
 * is the terminal close decision carrying the structured closure record. */
export const ChildSafetyDecisionKindSchema = z.enum([
  'workStatus',
  'accountAction',
  'reportDisposition',
  'reasonUpdate',
  'caseClosed',
]);
export type ChildSafetyDecisionKind = z.infer<typeof ChildSafetyDecisionKindSchema>;

/** §A1b accounts[].role on a case. */
export const ChildSafetyAccountRoleSchema = z.enum([
  'uploader',
  'requester',
  'distributor',
  'questionable',
]);
export type ChildSafetyAccountRole = z.infer<typeof ChildSafetyAccountRoleSchema>;

/** §A1b accounts[].subjectDisposition (per-account; distinct from the case-level
 * `reportDisposition`/ReportDisposition). */
export const ChildSafetyAccountSubjectDispositionSchema = z.enum([
  'subject',
  'questionable',
  'excluded',
]);
export type ChildSafetyAccountSubjectDisposition = z.infer<
  typeof ChildSafetyAccountSubjectDispositionSchema
>;

/** §A1b accounts[].platformAction. */
export const ChildSafetyAccountPlatformActionSchema = z.enum([
  'none',
  'watch',
  'suspend',
  'safetyLocked',
  'ban',
]);
export type ChildSafetyAccountPlatformAction = z.infer<
  typeof ChildSafetyAccountPlatformActionSchema
>;

/** §A1b ncmecSubmissions[].kind. */
export const ChildSafetyNcmecSubmissionKindSchema = z.enum([
  'initial',
  'supplemental',
  'correction',
]);
export type ChildSafetyNcmecSubmissionKind = z.infer<
  typeof ChildSafetyNcmecSubmissionKindSchema
>;

/** §A1b ncmecSubmissions[].completionChannel — launch = MANUAL portal only (the automated ispws API
 *  is a post-launch feature, not built; the speculative live-API client was removed). */
export const ChildSafetyNcmecCompletionChannelSchema = z.enum(['manualPortal']);
export type ChildSafetyNcmecCompletionChannel = z.infer<
  typeof ChildSafetyNcmecCompletionChannelSchema
>;

/** §A1b ncmecSubmissions[].completionProofType — manual portal only at launch (no API /finish
 *  reportDoneResponse; the proof is the operator-recorded portal confirmation). */
export const ChildSafetyNcmecCompletionProofTypeSchema = z.enum([
  'portalConfirmation',
]);
export type ChildSafetyNcmecCompletionProofType = z.infer<
  typeof ChildSafetyNcmecCompletionProofTypeSchema
>;

/** §A1b ncmecSubmissions/{id}/files[].fileInfoState. */
export const ChildSafetyNcmecFileInfoStateSchema = z.enum(['pending', 'sent', 'ack']);
export type ChildSafetyNcmecFileInfoState = z.infer<
  typeof ChildSafetyNcmecFileInfoStateSchema
>;

/** §A1b legalProcess[].kind. */
export const ChildSafetyLegalProcessKindSchema = z.enum([
  'leWatch',
  'leDataRequest',
  'leShutdown',
  'leDestruction',
  'disclosure',
]);
export type ChildSafetyLegalProcessKind = z.infer<typeof ChildSafetyLegalProcessKindSchema>;

// ===========================================================================
// §A1b — sourceSignalSummary (embedded privacy-safe projection on the list doc)
// ===========================================================================

/** Embedded latest-signal summary on `childSafetyCaseList` — NO content. */
export const ChildSafetySourceSignalSummarySchema = z.object({
  count: z.number(),
  latestKind: ChildSafetySignalKindSchema,
  latestAt: z.number(),
}).strict();
export type ChildSafetySourceSignalSummary = z.infer<
  typeof ChildSafetySourceSignalSummarySchema
>;

// ===========================================================================
// §A1b — childSafetyCaseList/{caseId} (reviewer list/metadata; NO content, NO
// reporter identity)
// ===========================================================================

export const ChildSafetyCaseListV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  revision: z.number(),
  canonicalIncidentKey: z.string(),
  incidentClass: ChildSafetyIncidentClassSchema,
  sourceSignalSummary: ChildSafetySourceSignalSummarySchema,
  workStatus: ChildSafetyWorkStatusSchema,
  preservationStatus: ChildSafetyPreservationStatusSchema,
  ncmecStatus: NcmecSubmissionStateSchema, // §A9 NcmecSubmissionState (no `notRequired`)
  accountActionStatus: ChildSafetyAccountActionStatusSchema,
  reportDisposition: ReportDispositionSchema, // §A9 case-level reporting determination
  reviewDueAt: z.number(),
  actualKnowledgeAt: z.number().optional(),
  reportState: ChildSafetyReportStateSchema.optional(), // derived list-projection only
  submissionCompletedAt: z.number().optional(),
  preserveUntil: z.number().optional(),
  openHoldCount: z.number(),
  // Cross-links to other cases that claimed the same owning alias (a rare operator NCII-crossover
  // re-scan collision). arrayUnion'd on both cases in the intake transaction that detected the claim;
  // the console renders these as plain links on the case view. The original alias owner is kept — the
  // colliding case never `tx.create`-throws (see childSafetyOwningAliases intake). Additive/optional.
  relatedCaseIds: z.array(z.string().min(1)).optional(),
  // [H-04 V1] Set to true when a protected-reason chat report's Worker context could not be
  // resolved at intake (text-only / Worker-down). The case is still a
  // fully-valid protected case; context resolution is retried async. Absent = false (no pending
  // context). Cleared once context is attached. Surfaced in the safety console so the reviewer
  // knows to trigger a manual re-fetch if the async retry hasn't landed yet.
  contextResolutionPending: z.boolean().optional(),
  // Test-list drill lane (DJ ruling 2026-07-28): true ⇔ every validated PhotoDNA match on this
  // case matched ONLY Microsoft's published TEST hash list (the detector echoes listId "Test"),
  // never a production list. A drill case is reviewable and closeable through the normal guided
  // flow but carries NO reporting obligation: the converge path sets no actualKnowledgeAt, no
  // reportRequired, enqueues no NCMEC submission, and arms no report-clock monitors — and the
  // `notRequired` disposition invariant exempts it (a test-image match is definitionally not
  // CSAM; auto-filing a CyberTipline report over it would be wrong). CLEARED (deleted) the
  // moment a real-list match joins the case — real evidence instantly restores the full
  // obligation machinery. Absent = real case.
  testListDrill: z.literal(true).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
}).strict();
export type ChildSafetyCaseListV1 = z.infer<typeof ChildSafetyCaseListV1Schema>;

// ===========================================================================
// §A1b — childSafetyCases/{caseId} (restricted root; childSafetyReviewer only;
// adds the evidence manifest, the internal reason, and the lease/fencing fields)
// ===========================================================================

export const ChildSafetyCaseV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  evidenceManifestId: z.string().min(1),
  currentReasonInternal: z.string(),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: z.number().optional(),
  fencingOwnerToken: z.string().min(1).optional(),
  fencingGeneration: z.number().optional(),
  // [H-04 V1] Immutable channel/message locator stored at case open when the Worker context
  // could not be resolved at intake. This is the AUTHORITATIVE source-of-truth locator that
  // the best-effort async re-fetch (and the operator's manual re-fetch) use to retrieve the
  // message text/sender. NEVER updated after creation — if context resolves, the resolved
  // context is ATTACHED to the case; this field stays unchanged as the permanent intake record.
  // Uses TargetLocatorV1 (a `guildChatMessage` / `guildInviteMessage` kind); absent on
  // media-resolved cases that went through the normal protected path with a published
  // Conversation File.
  chatMessageLocator: TargetLocatorV1Schema.optional(),
  // [H-04 V1] Mirror of the list-doc field — kept in sync so the restricted root can be
  // independently queried/checked without a join against childSafetyCaseList.
  contextResolutionPending: z.boolean().optional(),
  // The case-level ROLLUP of the possible-minor crossover's two post-commit side effects
  // (serving deny + PhotoDNA), present only on a crossover child-safety case. The per-asset state
  // lives on `childSafetyCaseCrossoverItems/{mediaAssetId}`; each leg here is
  // `rollupCrossoverLegStatus` of that leg across the case's items and the registration progress,
  // so a scheduled pass finds a case with outstanding work by one query on a leg and then resumes
  // registration and lists its item rows. `itemsCursor` is the progress of registering the case's
  // items across bounded transactions: absent before the first page, `inLap` while more remain
  // after `afterKey`, `done` once every item is registered. Until it is `done` the unregistered
  // items still owe both legs, so each leg is `pending` or `failed` — never `done` or absent — and a
  // stalled registration keeps the case findable (BACKEND-302). Once it is `done`, a leg is absent
  // when no item has it (an external, no-media target has nothing to deny or scan). A leg failure
  // never rolls back the committed assessment and the NCII removal clock is never touched.
  crossoverLegs: z.object({
    servingDeny: SafetyCrossoverLegStatusSchema.optional(),
    photoDna: SafetyCrossoverLegStatusSchema.optional(),
    itemsCursor: SweepRollingCursorSchema.optional(),
  }).strict().superRefine((legs, ctx) => {
    if (isCrossoverItemRegistrationDone(legs.itemsCursor)) return;
    for (const leg of ['servingDeny', 'photoDna'] as const) {
      if (legs[leg] !== 'pending' && legs[leg] !== 'failed') {
        ctx.addIssue({
          code: 'custom',
          path: [leg],
          message: 'a leg stays pending or failed until every item of the case is registered',
        });
      }
    }
  }).optional(),
}).strict();
export type ChildSafetyCaseV1 = z.infer<typeof ChildSafetyCaseV1Schema>;

// ===========================================================================
// Possible-minor crossover — per-asset leg state
// ===========================================================================

/**
 * Whether every item of a crossover case is registered: true only when the registration cursor's
 * lap reached the end of the case's items. Absent (not started) and `inLap` both mean items may
 * still owe their legs.
 */
export function isCrossoverItemRegistrationDone(itemsCursor: SweepRollingCursor | undefined): boolean {
  return itemsCursor?.state === 'done';
}

/**
 * The case-level status of one crossover leg across a case's items: `failed` when any registered
 * item's leg failed; else `pending` while registration is unfinished (the unregistered items still
 * owe the leg) or any item's leg is pending; else `done` when any completed; `undefined` when every
 * item is registered and none has the leg. The ONE rollup rule — the writer of
 * `ChildSafetyCaseV1.crossoverLegs`, the reconciler, and the console read the same answer.
 */
export function rollupCrossoverLegStatus(
  statuses: readonly (SafetyCrossoverLegStatus | undefined)[],
  itemsCursor: SweepRollingCursor | undefined,
): SafetyCrossoverLegStatus | undefined {
  const present = statuses.filter((status): status is SafetyCrossoverLegStatus => status !== undefined);
  if (present.includes('failed')) return 'failed';
  if (!isCrossoverItemRegistrationDone(itemsCursor)) return 'pending';
  if (present.includes('pending')) return 'pending';
  if (present.includes('done')) return 'done';
  return undefined;
}

/**
 * `childSafetyCases/{caseId}/childSafetyCaseCrossoverItems/{mediaAssetId}` — one row per asset the
 * possible-minor assessment acts on: the leg state of that asset's serving deny and PhotoDNA scan.
 * The case's `crossoverLegs` is the rollup of these rows. `servingDeny` is always present (every
 * item has a deny leg); `photoDna` is absent when the asset has no origin lineage to scan. A leg's
 * `…At` stamp is present exactly when the leg is `done` (`servingDeniedAt`, `photoDnaScannedAt`);
 * `…FailedAt` is present whenever the leg is `failed` and may stay after a later success;
 * `…LastError` is an error NAME (never raw bytes or PII) and only accompanies a failure stamp.
 */
export const ChildSafetyCrossoverItemV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1),
  mediaAssetId: z.string().min(1),
  servingDeny: SafetyCrossoverLegStatusSchema,
  servingDeniedAt: z.number().optional(),
  servingDenyFailedAt: z.number().optional(),
  servingDenyLastError: z.string().optional(),
  photoDna: SafetyCrossoverLegStatusSchema.optional(),
  photoDnaScannedAt: z.number().optional(),
  photoDnaFailedAt: z.number().optional(),
  photoDnaLastError: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
}).strict().superRefine((item, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  const legs = [
    { status: item.servingDeny, doneAt: 'servingDeniedAt', failedAt: 'servingDenyFailedAt', lastError: 'servingDenyLastError' },
    { status: item.photoDna, doneAt: 'photoDnaScannedAt', failedAt: 'photoDnaFailedAt', lastError: 'photoDnaLastError' },
  ] as const;
  for (const leg of legs) {
    const doneAt = item[leg.doneAt];
    const failedAt = item[leg.failedAt];
    const lastError = item[leg.lastError];
    if (leg.status === undefined) {
      if (doneAt !== undefined) issue(leg.doneAt, 'a leg that never applied has no completion stamp');
      if (failedAt !== undefined) issue(leg.failedAt, 'a leg that never applied has no failure stamp');
      if (lastError !== undefined) issue(leg.lastError, 'a leg that never applied has no error');
      continue;
    }
    if (leg.status === 'done' && doneAt === undefined) issue(leg.doneAt, 'a done leg carries its completion stamp');
    if (leg.status !== 'done' && doneAt !== undefined) issue(leg.doneAt, 'only a done leg carries a completion stamp');
    if (leg.status === 'failed' && failedAt === undefined) issue(leg.failedAt, 'a failed leg carries its failure stamp');
    if (leg.status === 'pending' && failedAt !== undefined) issue(leg.failedAt, 'a pending leg has not failed');
    if (lastError !== undefined && failedAt === undefined) issue(leg.lastError, 'an error accompanies a failure stamp');
  }
});
export type ChildSafetyCrossoverItemV1 = z.infer<typeof ChildSafetyCrossoverItemV1Schema>;

// ===========================================================================
// §A1b subcollections (append-only, NEVER arrays)
// ===========================================================================

/** …/sourceSignals/{signalId} — append-only source-signal row. */
export const ChildSafetySourceSignalV1Schema = z.object({
  at: z.number(),
  kind: ChildSafetySignalKindSchema,
  detector: z.string().min(1).optional(),
  sourceRef: z.string(),
  actorId: z.string().min(1).optional(),
}).strict();
export type ChildSafetySourceSignalV1 = z.infer<typeof ChildSafetySourceSignalV1Schema>;

/** …/decisions/{decisionId} — append-only decision-log row. The actual
 * viewed-evidence ids live in …/decisions/{decisionId}/views/{viewId}. */
export const ChildSafetyDecisionV1Schema = z.object({
  at: z.number(),
  actorId: z.string().min(1),
  kind: ChildSafetyDecisionKindSchema,
  from: z.string(),
  to: z.string(),
  reasonInternal: z.string(),
  reasonUserFacing: z.string().optional(),
  evidenceItemsViewedCount: z.number(),
  // [EUAS-008] present only on a `caseClosed` row — the structured operator closure record
  // (outcome / summary / note + actor / timestamp) persisted when the case is closed.
  closure: SafetyCaseClosureV1Schema.optional(),
}).strict();
export type ChildSafetyDecisionV1 = z.infer<typeof ChildSafetyDecisionV1Schema>;

/** …/decisions/{decisionId}/views/{viewId} — the actual viewed-evidence ids
 * (kept off the decision row itself). */
export const ChildSafetyDecisionViewV1Schema = z.object({
  evidenceItemId: z.string().min(1),
  at: z.number(),
}).strict();
export type ChildSafetyDecisionViewV1 = z.infer<typeof ChildSafetyDecisionViewV1Schema>;

/** …/accounts/{uid} — per-account case record. The per-account
 * `subjectDisposition` is distinct from the case-level `reportDisposition`. */
export const ChildSafetyCaseAccountV1Schema = z.object({
  role: ChildSafetyAccountRoleSchema,
  subjectDisposition: ChildSafetyAccountSubjectDispositionSchema,
  platformAction: ChildSafetyAccountPlatformActionSchema,
  reasonUserFacing: z.string(),
  reasonInternal: z.string(),
  updatedAt: z.number(),
}).strict();
export type ChildSafetyCaseAccountV1 = z.infer<typeof ChildSafetyCaseAccountV1Schema>;

/** …/accounts/{uid}/history/{historyId} — append-only per-account history. */
export const ChildSafetyCaseAccountHistoryV1Schema = z.object({
  role: ChildSafetyAccountRoleSchema,
  subjectDisposition: ChildSafetyAccountSubjectDispositionSchema,
  platformAction: ChildSafetyAccountPlatformActionSchema,
  reasonUserFacing: z.string(),
  reasonInternal: z.string(),
  at: z.number(),
}).strict();
export type ChildSafetyCaseAccountHistoryV1 = z.infer<
  typeof ChildSafetyCaseAccountHistoryV1Schema
>;

/** …/ncmecSubmissions/{submissionId} — one NCMEC submission record. */
export const ChildSafetyNcmecSubmissionV1Schema = z.object({
  kind: ChildSafetyNcmecSubmissionKindSchema,
  state: NcmecSubmissionStateSchema, // §A9 NcmecSubmissionState
  completionChannel: ChildSafetyNcmecCompletionChannelSchema.optional(),
  submissionCompletedAt: z.number().optional(),
  completionProofType: ChildSafetyNcmecCompletionProofTypeSchema.optional(),
  completionProofRef: z.string().min(1).optional(),
  reportId: z.string().min(1).optional(),
  responseCode: z.number().optional(),
}).strict();
export type ChildSafetyNcmecSubmissionV1 = z.infer<
  typeof ChildSafetyNcmecSubmissionV1Schema
>;

/** …/ncmecSubmissions/{submissionId}/files/{fileId} — per-evidence-item file row. */
export const ChildSafetyNcmecSubmissionFileV1Schema = z.object({
  localEvidenceItemId: z.string().min(1),
  ncmecFileId: z.string().min(1).optional(),
  md5: z.string().min(1).optional(),
  fileInfoState: ChildSafetyNcmecFileInfoStateSchema,
}).strict();
export type ChildSafetyNcmecSubmissionFileV1 = z.infer<
  typeof ChildSafetyNcmecSubmissionFileV1Schema
>;

/** …/legalProcess/{eventId} — append-only legal-process event. */
export const ChildSafetyLegalProcessEventV1Schema = z.object({
  at: z.number(),
  kind: ChildSafetyLegalProcessKindSchema,
  verifiedBy: z.string().min(1),
  instruction: z.string(),
  handedOver: z.boolean().optional(),
}).strict();
export type ChildSafetyLegalProcessEventV1 = z.infer<
  typeof ChildSafetyLegalProcessEventV1Schema
>;

// ===========================================================================
// §A9 — setReportDisposition privileged-command input (NON-DOC embedded shape).
// Authority = `legalDispositionAuthority` (§A11 matrix); requires fresh two-step
// reauth. Appends to …/decisions/{decisionId} with kind:'reportDisposition'.
// `evidenceRefs` is an array capped at MAX; it MAY be empty EXCEPT for disposition
// 'reportRequired', which requires ≥1 (enforced by the shared
// refineReportDispositionEvidenceRefs cross-field rule, not a field-level min).
// ===========================================================================

// The base object shape (kept as a ZodObject so the callable input can `.extend` it); the exported
// schema below adds the TWO canonical cross-field refinements (disposition↔reason pairing +
// reportRequired⇒evidence-present).
const SetReportDispositionInputV1ObjectSchema = z.object({
  caseId: z.string().min(1),
  expectedRevision: z.number(),
  disposition: ReportDispositionSchema,
  dispositionReasonCode: ReportDispositionReasonCodeSchema,
  // MAX derives from the ONE receipts cap (evidence.ts) — the callable + admin.ts use the same. No
  // field-level min: the reportRequired⇒non-empty rule lives in the shared cross-field refinement so
  // every other disposition may legally leave this empty.
  evidenceRefs: z.array(z.string().min(1)).max(MAX_MANIFEST_NCMEC_RECEIPTS),
}).strict();
export const SetReportDispositionInputV1Schema = SetReportDispositionInputV1ObjectSchema
  .superRefine(refineReportDispositionReasonCode)
  .superRefine(refineReportDispositionEvidenceRefs);
export type SetReportDispositionInputV1 = z.infer<typeof SetReportDispositionInputV1Schema>;

// The PRIVILEGED CALLABLE input (`setReportDisposition`) — extends the embedded shape with the
// interim explicit typed confirmation (stands in for the passkey two-step until [H-17]), then applies
// the SAME shared cross-field refinements. evidenceRefs is inherited from the base (MAX-bounded,
// empty allowed except when disposition is 'reportRequired'). Lives beside the base shape it extends.
export const SetReportDispositionCallableInputSchema = SetReportDispositionInputV1ObjectSchema.extend({
  confirmation: z.literal(LEGAL_REPORTING_DISPOSITION_CONFIRMATION),
})
  .superRefine(refineReportDispositionReasonCode)
  .superRefine(refineReportDispositionEvidenceRefs);
export type SetReportDispositionCallableInput = z.infer<typeof SetReportDispositionCallableInputSchema>;
