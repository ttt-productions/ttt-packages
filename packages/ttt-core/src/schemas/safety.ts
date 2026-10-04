// TTT safety-domain callable input schemas.
//
// The Trust & Safety operator surface (safety case console, evidence reveal, NCMEC
// manual-portal completion, per-account safety actions, operator TOTP step-up, retained-
// evidence inventory, party panel, TAKE IT DOWN request detail, protected-context re-fetch)
// crosses the backend↔frontend boundary, so its callable input contracts live here — the
// single source of truth — instead of being redefined locally in `functions/src/safety/`.
//
// Every object schema is `.strict()` so an unknown field on a privileged operator/admin
// action is REJECTED rather than silently accepted (defense-in-depth on the highest-risk
// callables). `caseId` / `targetUid` / `requestId` / `submissionId` and similar identifiers
// derive from the id atoms, so each is exactly one document-id segment (ARCH-106).

import { z } from 'zod';
import { MAX_REPORT_NARRATIVE_LENGTH, MAX_USER_FACING_REASON_LENGTH } from '../constants/business.js';
import {
  ADMIN_TASK_RESOLUTION_INPUT,
  NCMEC_ARTIFACT_DESCRIPTION_INPUT,
  NCMEC_CORRECTION_REASON_INPUT,
  NCMEC_PORTAL_PROOF_TEXT_INPUT,
  REPORT_COMMENT_INPUT,
  SAFETY_INTERNAL_REASON_INPUT,
} from '../constants/text-fields.js';
import { textFieldSchema } from './text-field.js';
import {
  SAFETY_ACCOUNT_ACTION_CONFIRMATION,
  NCMEC_PORTAL_RECEIPT_CONFIRMATION,
  NCMEC_MANUAL_PORTAL_FILED_CONFIRMATION,
  REVEAL_CASE_EVIDENCE_CONFIRMATION,
  NCMEC_PORTAL_CORRECTION_CONFIRMATION,
} from '../constants/safety-confirmation-phrases.js';
import { AccountActionSchema } from '../doc-schemas/safety/sagas.js';
import {
  NciiInternalStatusSchema,
  NciiMinorAssessmentSchema,
  ReportableItemTypeSchema,
  ReportDispositionSchema,
  ReportReasonSchema,
  SafetyCaseClosureV1Schema,
} from '../doc-schemas/safety/foundation.js';
import {
  reportTargetItemIdSchema,
  reportTargetParentRefSchema,
  reportTargetUserIdSchema,
  documentIdSegmentSchema,
  safetyCaseIdSchema,
  userIdSchema,
  takeItDownRequestIdSchema,
} from './atoms.js';
import { SafetySlaMonitorV1Schema } from '../doc-schemas/safety/monitors.js';
import { NciiCaseLaneSchema, NciiCaseV1Schema } from '../doc-schemas/ncii/cases.js';
import {
  NciiRetainedEvidenceInventoryV1Schema,
  TakeItDownRequestRootV1Schema,
} from '../doc-schemas/ncii/requests.js';
import {
  DeadLetterCollectionSchema,
  FlatDeadLetterCollectionSchema,
  HallSubItemEdgeSyncReplayTargetSchema,
} from './admin.js';
import {
  ChildSafetyAccountRoleSchema,
  ChildSafetyAccountSubjectDispositionSchema,
  ChildSafetyCaseListV1Schema,
  ChildSafetyCaseV1Schema,
  ChildSafetyIncidentClassSchema,
  ChildSafetyPreservationStatusSchema,
  ChildSafetyWorkStatusSchema,
  SafetyCaseLaneSchema,
} from '../doc-schemas/safety/case.js';

// The case-lane enum is declared beside the case shapes (a leaf both schema files import); it is
// re-exported here with the console and case-lookup inputs that take it.
export { SafetyCaseLaneSchema, type SafetyCaseLane } from '../doc-schemas/safety/case.js';
import {
  SafetyEvidenceJobPhaseSchema,
  SafetyEvidenceJobStatusSchema,
} from '../doc-schemas/safety/evidence.js';

// ---------------------------------------------------------------------------
// commandAccountAction — apply a per-account safety action on a child-safety case.
// ---------------------------------------------------------------------------

/**
 * The per-account safety action the operator command applies — an ALIAS of the ONE
 * canonical `AccountActionSchema` (../doc-schemas/safety/sagas.ts), re-exported under
 * the callable-input name. Never a re-declared literal (ARCH-102).
 */
export const CommandAccountActionSchema = AccountActionSchema;
export type CommandAccountActionValue = z.infer<typeof CommandAccountActionSchema>;

export const CommandAccountActionInputSchema = z
  .object({
    caseId: safetyCaseIdSchema,
    targetUid: userIdSchema,
    action: CommandAccountActionSchema,
    /** Operator-facing internal rationale (LE-loggable). */
    reasonInternal: textFieldSchema(SAFETY_INTERNAL_REASON_INPUT),
    /** The generic owner-readable reason (no detail leaks). */
    reasonUserFacing: z.string().min(1).max(MAX_USER_FACING_REASON_LENGTH),
    /** Per-account case role (A1b) — the canonical case enums, never re-declared. */
    role: ChildSafetyAccountRoleSchema,
    subjectDisposition: ChildSafetyAccountSubjectDispositionSchema,
    confirmation: z.literal(SAFETY_ACCOUNT_ACTION_CONFIRMATION),
  })
  .strict();
export type CommandAccountActionInput = z.infer<typeof CommandAccountActionInputSchema>;

// ---------------------------------------------------------------------------
// getSafetyCaseConsole — paginated read of the active safety-case console.
// ---------------------------------------------------------------------------

/** Cursor for the next page of a paginated console source — the last row's `(orderField value, docId)`. */
export const SafetyCaseConsoleCursorSchema = z
  .object({ v: z.number(), id: documentIdSegmentSchema })
  .strict();
export type SafetyCaseConsoleCursor = z.infer<typeof SafetyCaseConsoleCursorSchema>;

const SAFETY_CONSOLE_MAX_PAGE_SIZE = 200;


/** The console's three paged sources — the keys of its per-source pagination. */
export const SafetyCaseConsoleSourceSchema = z.enum(['childSafety', 'ncii', 'takeItDown']);
export type SafetyCaseConsoleSource = z.infer<typeof SafetyCaseConsoleSourceSchema>;

/**
 * `exhaustedSources` names each source whose last page the console already holds: the read skips
 * that source's page query (still counting its total), so a source that ran out is never restarted
 * at its first page while another source keeps paging.
 */
export const GetSafetyCaseConsoleInputSchema = z
  .object({
    pageSize: z.number().int().min(1).max(SAFETY_CONSOLE_MAX_PAGE_SIZE).optional(),
    childSafetyCursor: SafetyCaseConsoleCursorSchema.nullish(),
    nciiCursor: SafetyCaseConsoleCursorSchema.nullish(),
    takeItDownCursor: SafetyCaseConsoleCursorSchema.nullish(),
    exhaustedSources: z
      .array(SafetyCaseConsoleSourceSchema)
      .max(SafetyCaseConsoleSourceSchema.options.length)
      .refine((sources) => new Set(sources).size === sources.length, { message: 'List each source once.' })
      .optional(),
  })
  .strict()
  .nullish();
export type GetSafetyCaseConsoleInput = z.infer<typeof GetSafetyCaseConsoleInputSchema>;

/** One evidence job's disposition state, as a case row shows it. */
export const SafetyEvidenceJobSummarySchema = z
  .object({
    jobId: z.string().min(1),
    phase: SafetyEvidenceJobPhaseSchema,
    status: SafetyEvidenceJobStatusSchema,
  })
  .strict();
export type SafetyEvidenceJobSummary = z.infer<typeof SafetyEvidenceJobSummarySchema>;

/**
 * A dead-lettered enforcement job behind a `failed` safety case — what the console's Restart hands
 * to the dead-letter replay: its replay lane, the job doc id, and the operator-facing label.
 */
export const SafetyCaseFailedJobRefSchema = z
  .object({
    collection: DeadLetterCollectionSchema.extract(['quarantineSagaJobs', 'nciiRemovalJobs']),
    docId: z.string().min(1),
    label: z.string().min(1),
  })
  .strict();
export type SafetyCaseFailedJobRef = z.infer<typeof SafetyCaseFailedJobRefSchema>;

/** A child-safety case row: its list projection, its armed or overdue monitors, and its evidence jobs. */
export const ChildSafetyCaseConsoleRowSchema = z
  .object({
    case: ChildSafetyCaseListV1Schema,
    monitors: z.array(SafetySlaMonitorV1Schema),
    evidenceJobs: z.array(SafetyEvidenceJobSummarySchema),
    failedJobs: z.array(SafetyCaseFailedJobRefSchema).optional(),
    crossoverLegs: ChildSafetyCaseV1Schema.shape.crossoverLegs,
  })
  .strict();
export type ChildSafetyCaseConsoleRow = z.infer<typeof ChildSafetyCaseConsoleRowSchema>;

/** An NCII case row: the case and its case- and request-scoped monitors. */
export const NciiCaseConsoleRowSchema = z
  .object({
    case: NciiCaseV1Schema,
    monitors: z.array(SafetySlaMonitorV1Schema),
    failedJobs: z.array(SafetyCaseFailedJobRefSchema).optional(),
  })
  .strict();
export type NciiCaseConsoleRow = z.infer<typeof NciiCaseConsoleRowSchema>;

/**
 * An unresolved public TAKE IT DOWN request: the request root's non-sensitive fields (the raw
 * locator and the requester's details stay on the restricted subdoc) and its removal-clock monitors.
 */
export const TakeItDownRequestConsoleRowSchema = TakeItDownRequestRootV1Schema.pick({
  requestId: true,
  requesterRole: true,
  targetLocatorSummary: true,
  completenessStatus: true,
  validityStatus: true,
  publicStatus: true,
  removalDeadlineAt: true,
  receivedAt: true,
})
  .extend({ monitors: z.array(SafetySlaMonitorV1Schema) })
  .strict();
export type TakeItDownRequestConsoleRow = z.infer<typeof TakeItDownRequestConsoleRowSchema>;

/** One source's page: its active total, whether more pages follow, and the next page's cursor. */
export const SafetyCaseConsolePageInfoSchema = z
  .object({
    total: z.number().int().nonnegative(),
    hasMore: z.boolean(),
    nextCursor: SafetyCaseConsoleCursorSchema.nullable(),
  })
  .strict();
export type SafetyCaseConsolePageInfo = z.infer<typeof SafetyCaseConsolePageInfoSchema>;

/** One case in the urgent projection: an active case with an armed or overdue monitor. */
export const SafetyCaseConsoleUrgentEntrySchema = z
  .object({
    caseId: z.string().min(1),
    lane: SafetyCaseLaneSchema,
    monitors: z.array(SafetySlaMonitorV1Schema),
  })
  .strict();
export type SafetyCaseConsoleUrgentEntry = z.infer<typeof SafetyCaseConsoleUrgentEntrySchema>;

/** The `getSafetyCaseConsole` answer: one page per source, the per-source pagination, and the
 *  urgent projection — every active case with an armed or overdue monitor, never capped. */
export const GetSafetyCaseConsoleResultSchema = z
  .object({
    childSafetyCases: z.array(ChildSafetyCaseConsoleRowSchema),
    nciiCases: z.array(NciiCaseConsoleRowSchema),
    takeItDownRequests: z.array(TakeItDownRequestConsoleRowSchema),
    pagination: z
      .object({
        childSafety: SafetyCaseConsolePageInfoSchema,
        ncii: SafetyCaseConsolePageInfoSchema,
        takeItDown: SafetyCaseConsolePageInfoSchema,
      } satisfies Record<SafetyCaseConsoleSource, z.ZodType>)
      .strict(),
    urgentProjection: z.array(SafetyCaseConsoleUrgentEntrySchema),
    generatedAt: z.number(),
  })
  .strict();
export type GetSafetyCaseConsoleResult = z.infer<typeof GetSafetyCaseConsoleResultSchema>;

// ---------------------------------------------------------------------------
// The console patch — what a console action changed, so the console's loaded pages are patched in
// place rather than reloaded (FRONTEND-103). Its rows come from Functions-only collections the
// client cannot read, so the action answers with them, built by the console's own row projection.
// ---------------------------------------------------------------------------

/**
 * One console row an action changed, keyed by the id its source keys it by. `row` is the row as the
 * console now shows it; `null` means it is no longer in the active console. A row that was not
 * loaded or not active before is placed in its source's order.
 */
export const SafetyCaseConsoleRowChangeSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('childSafety'), caseId: safetyCaseIdSchema, row: ChildSafetyCaseConsoleRowSchema.nullable() }).strict(),
  z.object({ source: z.literal('ncii'), caseId: safetyCaseIdSchema, row: NciiCaseConsoleRowSchema.nullable() }).strict(),
  z.object({ source: z.literal('takeItDown'), requestId: takeItDownRequestIdSchema, row: TakeItDownRequestConsoleRowSchema.nullable() }).strict(),
]);
export type SafetyCaseConsoleRowChange = z.infer<typeof SafetyCaseConsoleRowChangeSchema>;

/**
 * The console after an action: every row it changed, entered, or removed, each source's active
 * total, and the complete urgent set — the same values a console read would answer — so no count
 * or urgent entry is derived from the pages a client happens to hold (BACKEND-112).
 */
export const SafetyCaseConsolePatchSchema = z
  .object({
    changes: z.array(SafetyCaseConsoleRowChangeSchema),
    totals: z
      .object({
        childSafety: z.number().int().nonnegative(),
        ncii: z.number().int().nonnegative(),
        takeItDown: z.number().int().nonnegative(),
      } satisfies Record<SafetyCaseConsoleSource, z.ZodType>)
      .strict(),
    urgentProjection: z.array(SafetyCaseConsoleUrgentEntrySchema),
    generatedAt: z.number(),
  })
  .strict();
export type SafetyCaseConsolePatch = z.infer<typeof SafetyCaseConsolePatchSchema>;

// The answers of the console's actions. Each carries its console patch when the read after the
// commit succeeded; a failed read never fails an action that already committed (ENG-009), and the
// client keeps its loaded pages when `console` is absent. Non-strict (server → client result posture).

/** `decideTakeItDownValidity`. */
export const DecideTakeItDownValidityResultSchema = z.object({
  success: z.literal(true),
  result: z.enum(['valid', 'invalid', 'unableToLocate']),
  /** Present on a `valid` ruling. */
  validRequestReceivedAt: z.number().optional(),
  removalDeadlineAt: z.number().optional(),
  caseId: z.string().min(1).optional(),
  alreadyDecided: z.boolean(),
  console: SafetyCaseConsolePatchSchema.optional(),
});
export type DecideTakeItDownValidityResult = z.infer<typeof DecideTakeItDownValidityResultSchema>;

/** `setNciiMinorAssessment`. */
export const SetNciiMinorAssessmentResultSchema = z.object({
  ok: z.literal(true),
  caseId: z.string().min(1),
  from: NciiMinorAssessmentSchema,
  to: NciiMinorAssessmentSchema,
  /** Set when the change opened or linked a parallel child-safety review. */
  childSafetyCaseId: z.string().min(1).optional(),
  /** Whether this call denied serving on any asset. */
  servingDenied: z.boolean(),
  console: SafetyCaseConsolePatchSchema.optional(),
});
export type SetNciiMinorAssessmentResult = z.infer<typeof SetNciiMinorAssessmentResultSchema>;

/** `refetchProtectedCaseContext`. */
export const RefetchProtectedCaseContextResultSchema = z.object({
  resolved: z.boolean(),
  senderUid: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  console: SafetyCaseConsolePatchSchema.optional(),
});
export type RefetchProtectedCaseContextResult = z.infer<typeof RefetchProtectedCaseContextResultSchema>;

/** `markNcmecPortalComplete`. */
export const MarkNcmecPortalCompleteResultSchema = z.object({
  success: z.literal(true),
  state: z.literal('completed'),
  alreadyCompleted: z.boolean(),
  console: SafetyCaseConsolePatchSchema.optional(),
});
export type MarkNcmecPortalCompleteResult = z.infer<typeof MarkNcmecPortalCompleteResultSchema>;

/** `reopenSafetyCase`. */
export const ReopenSafetyCaseResultSchema = z.object({
  success: z.literal(true),
  reopened: z.boolean(),
  console: SafetyCaseConsolePatchSchema.optional(),
});
export type ReopenSafetyCaseResult = z.infer<typeof ReopenSafetyCaseResultSchema>;

/** The replay lanes behind a `failed` safety case — the only lanes whose performed replay may answer
 *  the console patch (when the read after the commit succeeded). */
export const SAFETY_CASE_REPLAY_LANES = SafetyCaseFailedJobRefSchema.shape.collection.options;

const replayOutcomeShape = {
  replayed: z.literal(true).optional(),
  resetTo: z.string().optional(),
  dryRun: z.literal(true).optional(),
  currentStatus: z.unknown().optional(),
  wouldResetTo: z.string().optional(),
  console: SafetyCaseConsolePatchSchema.optional(),
};

/**
 * The `adminReplayDeadLetter` answer: the replayed target and its outcome. `console` appears only on
 * a performed (not dry-run) replay of a safety lane, the console's Restart, and only when the read
 * after the commit succeeded. Declared
 * here, beside the console patch, because this module already imports ./admin.js.
 */
export const AdminReplayDeadLetterResultSchema = z
  .discriminatedUnion('collection', [
    z.object({ collection: FlatDeadLetterCollectionSchema, docId: z.string().min(1), ...replayOutcomeShape }),
    z.object({ collection: z.literal('hallSubItemEdgeSync'), ...HallSubItemEdgeSyncReplayTargetSchema.shape, ...replayOutcomeShape }),
  ])
  .superRefine((answer, ctx) => {
    const safetyLane = (SAFETY_CASE_REPLAY_LANES as readonly string[]).includes(answer.collection);
    const performed = answer.replayed === true && answer.dryRun !== true;
    if (answer.console !== undefined && !(safetyLane && performed)) {
      ctx.addIssue({ code: 'custom', path: ['console'] });
    }
  });
export type AdminReplayDeadLetterResult = z.infer<typeof AdminReplayDeadLetterResultSchema>;

// ---------------------------------------------------------------------------
// getSafetyCaseById — full-admin read of a terminal safety case by id.
// ---------------------------------------------------------------------------

export const GetSafetyCaseByIdInputSchema = z
  .object({
    caseType: SafetyCaseLaneSchema,
    caseId: safetyCaseIdSchema.max(200),
  })
  .strict();
export type GetSafetyCaseByIdInput = z.infer<typeof GetSafetyCaseByIdInputSchema>;

// The lookup is a reopen surface: it carries the case's status, revision, safe metadata, and
// closure history only — never evidence or reporter identity.
const SafetyCaseByIdFields = {
  caseId: safetyCaseIdSchema,
  /** The revision `reopenSafetyCase` must name. */
  revision: z.number().int().nonnegative(),
  meta: z
    .object({
      incidentClass: ChildSafetyIncidentClassSchema.optional(),
      lane: NciiCaseLaneSchema.optional(),
      createdAt: z.number().optional(),
      actualKnowledgeAt: z.number().optional(),
      preserveUntil: z.number().optional(),
      reportDisposition: ReportDispositionSchema.optional(),
    })
    .strict(),
  /** Each close, as the closure record it wrote, keyed by the event that recorded it. */
  closureHistory: z.array(SafetyCaseClosureV1Schema.extend({ eventId: z.string().min(1) }).strict()),
};

/** The `getSafetyCaseById` answer: a child-safety case with its work status, an NCII case with its internal status. */
export const SafetyCaseByIdResultSchema = z.discriminatedUnion('caseType', [
  z
    .object({ ...SafetyCaseByIdFields, caseType: z.literal(SafetyCaseLaneSchema.enum.csam), status: ChildSafetyWorkStatusSchema })
    .strict(),
  z
    .object({ ...SafetyCaseByIdFields, caseType: z.literal(SafetyCaseLaneSchema.enum.ncii), status: NciiInternalStatusSchema })
    .strict(),
]);
export type SafetyCaseByIdResult = z.infer<typeof SafetyCaseByIdResultSchema>;

// ---------------------------------------------------------------------------
// getSafetyCaseParties — server-resolved party panel for a safety case.
// ---------------------------------------------------------------------------

export const GetSafetyCasePartiesInputSchema = z
  .object({
    caseType: SafetyCaseLaneSchema,
    caseId: safetyCaseIdSchema,
  })
  .strict();
export type GetSafetyCasePartiesInput = z.infer<typeof GetSafetyCasePartiesInputSchema>;

// ---------------------------------------------------------------------------
// getTakeItDownRequestDetail — operator detail read for one public TAKE IT DOWN request.
// ---------------------------------------------------------------------------

export const GetTakeItDownRequestDetailInputSchema = z
  .object({
    requestId: takeItDownRequestIdSchema,
  })
  .strict();
export type GetTakeItDownRequestDetailInput = z.infer<typeof GetTakeItDownRequestDetailInputSchema>;

// ---------------------------------------------------------------------------
// listRetainedEvidenceInventory — paginated retained-evidence inventory read.
// ---------------------------------------------------------------------------

/** A retention list's cursor — the last row's `(createdAt, docId)`, newest first. */
const createdAtCursorSchema = () => z.object({ createdAt: z.number(), id: documentIdSegmentSchema }).strict();

/** The largest page either retention list serves. */
const RETENTION_LIST_MAX_PAGE_SIZE = 200;

/** Cursor for the retained-evidence inventory — the last row's `(createdAt, docId)`. */
export const RetainedEvidenceInventoryCursorSchema = createdAtCursorSchema();
export type RetainedEvidenceInventoryCursor = z.infer<typeof RetainedEvidenceInventoryCursorSchema>;

export const ListRetainedEvidenceInventoryInputSchema = z
  .object({
    pageSize: z.number().int().min(1).max(RETENTION_LIST_MAX_PAGE_SIZE).optional(),
    cursor: RetainedEvidenceInventoryCursorSchema.nullish(),
    /** Exact inventoryId lookup — returns just that row (or none), ignoring the cursor. */
    exactId: documentIdSegmentSchema.optional(),
  })
  .strict()
  .nullish();
export type ListRetainedEvidenceInventoryInput = z.infer<typeof ListRetainedEvidenceInventoryInputSchema>;

export const ListRetainedEvidenceInventoryResultSchema = z
  .object({
    rows: z.array(NciiRetainedEvidenceInventoryV1Schema),
    /** Pass as `cursor` for the next page; null when this page reached the end. */
    nextCursor: RetainedEvidenceInventoryCursorSchema.nullable(),
    /** Every inventory row, counted with an aggregate. */
    total: z.number().int().nonnegative(),
  })
  .strict();
export type ListRetainedEvidenceInventoryResult = z.infer<typeof ListRetainedEvidenceInventoryResultSchema>;

// ---------------------------------------------------------------------------
// listRetainedChildSafetyCases — the Retention tab's paged list of closed child-safety cases whose
// evidence is still preserved.
// ---------------------------------------------------------------------------

/**
 * A closed child-safety case is retained while its evidence is: every preservation status but
 * `destroyed`. The list reads cases whose `workStatus` is `operationallyResolved` (the one closed
 * work status) and whose `preservationStatus` is one of these, newest `createdAt` first.
 */
export const CHILD_SAFETY_RETAINED_PRESERVATION_STATUSES = ChildSafetyPreservationStatusSchema.exclude([
  'destroyed',
]).options;

/** Cursor for the retained child-safety case list — the last row's `(createdAt, docId)`. */
export const RetainedChildSafetyCaseCursorSchema = createdAtCursorSchema();
export type RetainedChildSafetyCaseCursor = z.infer<typeof RetainedChildSafetyCaseCursorSchema>;

export const ListRetainedChildSafetyCasesInputSchema = z
  .object({
    pageSize: z.number().int().min(1).max(RETENTION_LIST_MAX_PAGE_SIZE).optional(),
    cursor: RetainedChildSafetyCaseCursorSchema.nullish(),
    /** Exact caseId lookup — returns just that case when it is retained (or none), ignoring the cursor. */
    exactId: documentIdSegmentSchema.optional(),
  })
  .strict()
  .nullish();
export type ListRetainedChildSafetyCasesInput = z.infer<typeof ListRetainedChildSafetyCasesInputSchema>;

/** One retained case: its list projection and its own evidence jobs (read by case, never a global window). */
export const RetainedChildSafetyCaseRowSchema = z
  .object({
    case: ChildSafetyCaseListV1Schema,
    evidenceJobs: z.array(SafetyEvidenceJobSummarySchema),
  })
  .strict();
export type RetainedChildSafetyCaseRow = z.infer<typeof RetainedChildSafetyCaseRowSchema>;

export const ListRetainedChildSafetyCasesResultSchema = z
  .object({
    rows: z.array(RetainedChildSafetyCaseRowSchema),
    /** Pass as `cursor` for the next page; null when this page reached the end. */
    nextCursor: RetainedChildSafetyCaseCursorSchema.nullable(),
    /** Every retained case, counted with an aggregate. */
    total: z.number().int().nonnegative(),
  })
  .strict();
export type ListRetainedChildSafetyCasesResult = z.infer<typeof ListRetainedChildSafetyCasesResultSchema>;

// ---------------------------------------------------------------------------
// ncmecOperatorCommands — NCMEC manual-portal completion path.
// ---------------------------------------------------------------------------

export const RecordNcmecPortalReceiptArtifactInputSchema = z
  .object({
    caseId: safetyCaseIdSchema,
    submissionId: documentIdSegmentSchema,
    /** The key of an object already in the restricted evidence vault (verified via statObject). */
    evidenceVaultKey: z.string().min(1, 'An evidence vault object key is required.'),
    /** Optional operator description of what the artifact is (e.g. "NCMEC portal screenshot"). */
    description: textFieldSchema(NCMEC_ARTIFACT_DESCRIPTION_INPUT).optional(),
    /** Explicit typed confirmation (interim control until the passkey profile lands). */
    confirmation: z.literal(NCMEC_PORTAL_RECEIPT_CONFIRMATION),
  })
  .strict();
export type RecordNcmecPortalReceiptArtifactInput = z.infer<
  typeof RecordNcmecPortalReceiptArtifactInputSchema
>;

export const MarkNcmecPortalCompleteInputSchema = z
  .object({
    caseId: safetyCaseIdSchema,
    submissionId: documentIdSegmentSchema,
    /** [Q13/H-06] The ID of an existing NcmecPortalReceiptArtifactV1 record bound to this (caseId, submissionId). */
    artifactId: documentIdSegmentSchema,
    /** [Q13/H-06] The object generation recorded on the artifact at registration time (immutable-object peg). */
    artifactObjectGeneration: z.string().min(1, 'The artifact object generation is required.'),
    /** [Q13/H-06] The sha256 hex digest recorded on the artifact at registration time (content-integrity check). */
    artifactSha256: z.string().regex(/^[0-9a-f]{64}$/, 'artifactSha256 must be a 64-character hex string.'),
    /** Optional operator free-text note describing the portal confirmation. */
    proofText: textFieldSchema(NCMEC_PORTAL_PROOF_TEXT_INPUT).optional(),
    /** The NCMEC-assigned report id — REQUIRED (it IS the proof; no "filed, number pending" grace). */
    ncmecReportId: z.string().min(1, 'The NCMEC report id is required to mark the report complete.'),
    /** Explicit typed confirmation (interim control until the passkey profile lands). */
    confirmation: z.literal(NCMEC_MANUAL_PORTAL_FILED_CONFIRMATION),
  })
  .strict();
export type MarkNcmecPortalCompleteInput = z.infer<typeof MarkNcmecPortalCompleteInputSchema>;

// ---------------------------------------------------------------------------
// operatorStepUp — app-level TOTP step-up (confirm / verify a 6-digit code).
// ---------------------------------------------------------------------------

export const OperatorStepUpCodeInputSchema = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/u, 'Enter the 6-digit code.'),
  })
  .strict();
export type OperatorStepUpCodeInput = z.infer<typeof OperatorStepUpCodeInputSchema>;

// ---------------------------------------------------------------------------
// revealCaseEvidence — metadata→evidence reveal under reauth.
// ---------------------------------------------------------------------------

export const RevealCaseEvidenceInputSchema = z
  .object({
    caseId: safetyCaseIdSchema,
    /** Explicit typed confirmation (interim control until the passkey profile lands). */
    confirmation: z.literal(REVEAL_CASE_EVIDENCE_CONFIRMATION),
    /** The operator's child-safety warning acknowledgement, carried so the backend can persist it
     * in the reveal audit trail. This schema serves ONLY the safety-console reveal-under-reauth
     * flow (its sibling `confirmation` literal gates the same surface), so the acknowledgement is a
     * required `true` — consistent with the existing explicit-confirmation style. Server-side
     * enforcement + audit persistence land app-side. */
    warningAcknowledged: z.literal(true),
  })
  .strict();
export type RevealCaseEvidenceInput = z.infer<typeof RevealCaseEvidenceInputSchema>;

// ---------------------------------------------------------------------------
// refetchProtectedCaseContext — operator manual re-fetch of protected chat context.
// ---------------------------------------------------------------------------

export const RefetchProtectedCaseContextInputSchema = z
  .object({
    caseId: safetyCaseIdSchema,
    lane: SafetyCaseLaneSchema,
  })
  .strict();
export type RefetchProtectedCaseContextInput = z.infer<typeof RefetchProtectedCaseContextInputSchema>;

// ---------------------------------------------------------------------------
// recordNcmecPortalCorrection — record an operator's NCMEC manual-portal correction filing.
// ---------------------------------------------------------------------------

export const RecordNcmecPortalCorrectionInputSchema = z
  .object({
    caseId: safetyCaseIdSchema,
    ncmecReportId: z.string().min(1),
    correctionFiledAt: z.number(),
    reason: textFieldSchema(NCMEC_CORRECTION_REASON_INPUT),
    confirmation: z.literal(NCMEC_PORTAL_CORRECTION_CONFIRMATION),
  })
  .strict();
export type RecordNcmecPortalCorrectionInput = z.infer<typeof RecordNcmecPortalCorrectionInputSchema>;

// ---------------------------------------------------------------------------
// submitReport — the one report-intake callable. The target ids are HINTS the server re-derives
// (never owner or target authority): each is bounded and shaped as the path it could become, and
// `parentItemId` may be a chat channel or conversation-file reference of two ids joined by "/".
// ---------------------------------------------------------------------------
/** A report's comment — the field schema the report intake and report-core's submit schema share. */
export const reportCommentFieldSchema = textFieldSchema(REPORT_COMMENT_INPUT);
/** An admin task's check-in resolution note — the field report-core's check-in schema takes. */
export const adminTaskResolutionFieldSchema = textFieldSchema(ADMIN_TASK_RESOLUTION_INPUT);

export const SubmitReportInputSchema = z
  .object({
    itemType: ReportableItemTypeSchema,
    reportedItemId: reportTargetItemIdSchema,
    parentItemId: reportTargetParentRefSchema.optional(),
    /** HINT ONLY — ignored as owner authority (the owner is server-derived). */
    reportedUserId: reportTargetUserIdSchema.optional(),
    reason: ReportReasonSchema,
    /** The reporter's comment (segregated; never inlined on the public projection). */
    comment: reportCommentFieldSchema,
    narrative: z.string().max(MAX_REPORT_NARRATIVE_LENGTH).optional(),
    /** The user-confirmed SECOND call that escalates an EXISTING report on this target to a
     *  protected reason (Child Safety / NCII). Only meaningful with a protected reason and an
     *  existing report; ignored otherwise. */
    confirmUpgrade: z.boolean().optional(),
  })
  .strict();
export type SubmitReportInput = z.infer<typeof SubmitReportInputSchema>;
