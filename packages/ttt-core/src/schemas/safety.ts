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
// are plain `z.string().min(1)` — matching the shapes the callables accept today; do not
// broaden or weaken them.

import { z } from 'zod';
import {
  MAX_INTERNAL_REASON_LENGTH,
  MAX_USER_FACING_REASON_LENGTH,
  MAX_SAFETY_ARTIFACT_DESCRIPTION_LENGTH,
  MAX_NCMEC_PORTAL_PROOF_TEXT_LENGTH,
} from '../constants/business.js';
import { AccountActionSchema } from '../doc-schemas/safety/sagas.js';
import {
  ChildSafetyAccountRoleSchema,
  ChildSafetyAccountSubjectDispositionSchema,
} from '../doc-schemas/safety/case.js';
import { SafetyEvidenceExternalFactKindSchema } from '../doc-schemas/safety/evidence.js';

// ---------------------------------------------------------------------------
// commandAccountAction — apply a per-account safety action on a child-safety case.
// ---------------------------------------------------------------------------

/**
 * The per-account safety action the operator command applies — an ALIAS of the ONE
 * canonical `AccountActionSchema` (../doc-schemas/safety/sagas.ts), re-exported under
 * the callable-input name. Never a re-declared literal (Rule 36).
 */
export const CommandAccountActionSchema = AccountActionSchema;
export type CommandAccountActionValue = z.infer<typeof CommandAccountActionSchema>;

export const CommandAccountActionInputSchema = z
  .object({
    caseId: z.string().min(1),
    targetUid: z.string().min(1),
    action: CommandAccountActionSchema,
    /** Operator-facing internal rationale (LE-loggable). */
    reasonInternal: z.string().min(4, 'An internal reason is required.').max(MAX_INTERNAL_REASON_LENGTH),
    /** The generic owner-readable reason (no detail leaks). */
    reasonUserFacing: z.string().min(1).max(MAX_USER_FACING_REASON_LENGTH),
    /** Per-account case role (A1b) — the canonical case enums, never re-declared. */
    role: ChildSafetyAccountRoleSchema,
    subjectDisposition: ChildSafetyAccountSubjectDispositionSchema,
    confirmation: z.literal('I confirm this account action'),
  })
  .strict();
export type CommandAccountActionInput = z.infer<typeof CommandAccountActionInputSchema>;

// ---------------------------------------------------------------------------
// getSafetyCaseConsole — paginated read of the active safety-case console.
// ---------------------------------------------------------------------------

/** Cursor for the next page of a paginated console source — the last row's `(orderField value, docId)`. */
export const SafetyCaseConsoleCursorSchema = z
  .object({ v: z.number(), id: z.string().min(1) })
  .strict();
export type SafetyCaseConsoleCursor = z.infer<typeof SafetyCaseConsoleCursorSchema>;

const SAFETY_CONSOLE_MAX_PAGE_SIZE = 200;

export const GetSafetyCaseConsoleInputSchema = z
  .object({
    pageSize: z.number().int().min(1).max(SAFETY_CONSOLE_MAX_PAGE_SIZE).optional(),
    childSafetyCursor: SafetyCaseConsoleCursorSchema.nullish(),
    nciiCursor: SafetyCaseConsoleCursorSchema.nullish(),
    takeItDownCursor: SafetyCaseConsoleCursorSchema.nullish(),
  })
  .strict()
  .nullish();
export type GetSafetyCaseConsoleInput = z.infer<typeof GetSafetyCaseConsoleInputSchema>;

// ---------------------------------------------------------------------------
// getSafetyCaseById — full-admin read of a terminal safety case by id.
// ---------------------------------------------------------------------------

export const GetSafetyCaseByIdInputSchema = z
  .object({
    caseType: z.enum(['csam', 'ncii']),
    caseId: z.string().min(1).max(200),
  })
  .strict();
export type GetSafetyCaseByIdInput = z.infer<typeof GetSafetyCaseByIdInputSchema>;

// ---------------------------------------------------------------------------
// getSafetyCaseParties — server-resolved party panel for a safety case.
// ---------------------------------------------------------------------------

export const GetSafetyCasePartiesInputSchema = z
  .object({
    caseType: z.enum(['csam', 'ncii']),
    caseId: z.string().min(1),
  })
  .strict();
export type GetSafetyCasePartiesInput = z.infer<typeof GetSafetyCasePartiesInputSchema>;

// ---------------------------------------------------------------------------
// getTakeItDownRequestDetail — operator detail read for one public TAKE IT DOWN request.
// ---------------------------------------------------------------------------

export const GetTakeItDownRequestDetailInputSchema = z
  .object({
    requestId: z.string().min(1),
  })
  .strict();
export type GetTakeItDownRequestDetailInput = z.infer<typeof GetTakeItDownRequestDetailInputSchema>;

// ---------------------------------------------------------------------------
// listRetainedEvidenceInventory — paginated retained-evidence inventory read.
// ---------------------------------------------------------------------------

/** Cursor for the retained-evidence inventory — the last row's `(createdAt, docId)`. */
export const RetainedEvidenceInventoryCursorSchema = z
  .object({ createdAt: z.number(), id: z.string().min(1) })
  .strict();
export type RetainedEvidenceInventoryCursor = z.infer<typeof RetainedEvidenceInventoryCursorSchema>;

const RETAINED_EVIDENCE_MAX_PAGE_SIZE = 200;

export const ListRetainedEvidenceInventoryInputSchema = z
  .object({
    pageSize: z.number().int().min(1).max(RETAINED_EVIDENCE_MAX_PAGE_SIZE).optional(),
    cursor: RetainedEvidenceInventoryCursorSchema.nullish(),
    /** Exact inventoryId lookup — returns just that row (or none), ignoring the cursor. */
    exactId: z.string().min(1).optional(),
  })
  .strict()
  .nullish();
export type ListRetainedEvidenceInventoryInput = z.infer<typeof ListRetainedEvidenceInventoryInputSchema>;

// ---------------------------------------------------------------------------
// ncmecOperatorCommands — NCMEC manual-portal completion path.
// ---------------------------------------------------------------------------

export const RecordNcmecPortalReceiptArtifactInputSchema = z
  .object({
    caseId: z.string().min(1),
    submissionId: z.string().min(1),
    /** The key of an object already in the restricted evidence vault (verified via statObject). */
    evidenceVaultKey: z.string().min(1, 'An evidence vault object key is required.'),
    /** Optional operator description of what the artifact is (e.g. "NCMEC portal screenshot"). */
    description: z.string().min(1).max(MAX_SAFETY_ARTIFACT_DESCRIPTION_LENGTH).optional(),
    /** Explicit typed confirmation (interim control until the passkey profile lands). */
    confirmation: z.literal('I confirm this is the NCMEC portal receipt'),
  })
  .strict();
export type RecordNcmecPortalReceiptArtifactInput = z.infer<
  typeof RecordNcmecPortalReceiptArtifactInputSchema
>;

export const MarkNcmecPortalCompleteInputSchema = z
  .object({
    caseId: z.string().min(1),
    submissionId: z.string().min(1),
    /** [Q13/H-06] The ID of an existing NcmecPortalReceiptArtifactV1 record bound to this (caseId, submissionId). */
    artifactId: z.string().min(1, 'A valid portal-receipt artifact id is required.'),
    /** [Q13/H-06] The object generation recorded on the artifact at registration time (immutable-object peg). */
    artifactObjectGeneration: z.string().min(1, 'The artifact object generation is required.'),
    /** [Q13/H-06] The sha256 hex digest recorded on the artifact at registration time (content-integrity check). */
    artifactSha256: z.string().regex(/^[0-9a-f]{64}$/, 'artifactSha256 must be a 64-character hex string.'),
    /** Optional operator free-text note describing the portal confirmation. */
    proofText: z.string().min(1).max(MAX_NCMEC_PORTAL_PROOF_TEXT_LENGTH).optional(),
    /** The NCMEC-assigned report id — REQUIRED (it IS the proof; no "filed, number pending" grace). */
    ncmecReportId: z.string().min(1, 'The NCMEC report id is required to mark the report complete.'),
    /** Explicit typed confirmation (interim control until the passkey profile lands). */
    confirmation: z.literal('I confirm this NCMEC report was filed via the manual portal'),
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
    caseId: z.string().min(1),
    /** Explicit typed confirmation (interim control until the passkey profile lands). */
    confirmation: z.literal('I confirm I am revealing case evidence under reauth'),
  })
  .strict();
export type RevealCaseEvidenceInput = z.infer<typeof RevealCaseEvidenceInputSchema>;

// ---------------------------------------------------------------------------
// refetchProtectedCaseContext — operator manual re-fetch of protected chat context.
// ---------------------------------------------------------------------------

export const RefetchProtectedCaseContextInputSchema = z
  .object({
    caseId: z.string().min(1),
    lane: z.enum(['csam', 'ncii']),
  })
  .strict();
export type RefetchProtectedCaseContextInput = z.infer<typeof RefetchProtectedCaseContextInputSchema>;

// ---------------------------------------------------------------------------
// preserveAsEvidence — general-purpose ADMIN "Preserve as Evidence" callable.
// ---------------------------------------------------------------------------

/**
 * A target to preserve, discriminated by surface. Non-strict members are carried faithfully
 * from the source callable. The id / path / ref bounds are opaque structural caps (not user
 * text), and the augmentation `factKind` REUSES the canonical evidence external-fact enum
 * (`SafetyEvidenceExternalFactKindSchema`) rather than re-declaring its members.
 */
export const PreserveTargetSchema = z.discriminatedUnion('targetKind', [
  z.object({
    targetKind: z.literal('media'),
    mediaAssetId: z.string().min(1).max(256),
  }),
  z.object({
    targetKind: z.literal('post'),
    postDocPath: z.string().min(1).max(1024),
    revision: z.number().int().nonnegative().optional(),
  }),
  z.object({
    targetKind: z.literal('profile'),
    uid: z.string().min(1).max(256),
    revision: z.number().int().nonnegative().optional(),
  }),
  z.object({
    targetKind: z.literal('chat'),
    channelId: z.string().min(1).max(256),
    messageSeqStart: z.number().int().nonnegative(),
    messageSeqEnd: z.number().int().nonnegative(),
    transcriptObjectRef: z.string().min(1).max(1024),
    attachmentItemIds: z.array(z.string().min(1)).max(256).optional(),
  }),
]);
export type PreserveTarget = z.infer<typeof PreserveTargetSchema>;

export const PreserveAsEvidenceInputSchema = z
  .object({
    /** Attach to an existing case; absent → open a standalone preservation case. */
    caseId: z.string().min(1).max(256).optional(),
    target: PreserveTargetSchema,
    /** Operator note recorded on the case (internal). */
    reasonInternal: z.string().min(1).max(MAX_INTERNAL_REASON_LENGTH),
    /** Optional admin AUGMENTATION — extra externalFact refs preserved alongside the baseline. */
    augmentations: z
      .array(
        z.object({
          factKind: SafetyEvidenceExternalFactKindSchema,
          narrativeRef: z.string().min(1).max(1024),
        }),
      )
      .max(32)
      .optional(),
  })
  .strict();
export type PreserveAsEvidenceInput = z.infer<typeof PreserveAsEvidenceInputSchema>;

// ---------------------------------------------------------------------------
// recordNcmecPortalCorrection — record an operator's NCMEC manual-portal correction filing.
// ---------------------------------------------------------------------------

export const RecordNcmecPortalCorrectionInputSchema = z
  .object({
    caseId: z.string().min(1),
    ncmecReportId: z.string().min(1),
    correctionFiledAt: z.number(),
    reason: z.string().min(1).max(MAX_INTERNAL_REASON_LENGTH),
    confirmation: z.literal('I confirm this NCMEC portal correction was filed'),
  })
  .strict();
export type RecordNcmecPortalCorrectionInput = z.infer<typeof RecordNcmecPortalCorrectionInputSchema>;
