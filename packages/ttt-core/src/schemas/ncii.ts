import { z } from 'zod';
import { ReportableItemTypeSchema, NciiMinorAssessmentSchema } from '../doc-schemas/safety/foundation.js';
import {
  MAX_NCII_EVIDENCE_REASON_LENGTH,
  MAX_NCII_RATIONALE_LENGTH,
  MAX_NCII_NONCONSENT_STATEMENT_LENGTH,
  MAX_NCII_SIGNED_NAME_LENGTH,
  MAX_NCII_SUPPORTING_FACTS_LENGTH,
} from '../constants/business.js';

// NCII / TAKE IT DOWN callable-input schemas. Cross-boundary contracts for the
// `functions/src/ncii/` callables — moved here from local `functions/` definitions so the
// callable-validation standard (parse `request.data` with a `.strict()` ttt-core schema before any
// auth check) is met from one authoritative place. See docs/design/callable-validation.md.

// Operator sets the child-safety crossover minorAssessment on an NCII case (CSAM possible-minor
// crossover — DECISION 2026-07-01: operator-only, no automated age signal). A routing action: it
// opens/links a PARALLEL child-safety review + deny-serving + PhotoDNA, WITHOUT touching the NCII
// removal clock and WITHOUT auto-NCMEC (that still needs a validated hash or explicit human
// confirmApparentViolation). Writes the `ncii.minorAssessmentSet` audit event.
export const SetNciiMinorAssessmentInputSchema = z.object({
  caseId: z.string().min(1),
  minorAssessment: NciiMinorAssessmentSchema,
}).strict();
export type SetNciiMinorAssessmentInput = z.infer<typeof SetNciiMinorAssessmentInputSchema>;

// ===========================================================================
// listNciiEvidencePool — admin-only pool read for the find-&-link flow.
// Optional caseId selects the currently-linked evidence to also return.
// ===========================================================================
export const ListNciiEvidencePoolInputSchema = z.object({
  caseId: z.string().min(1).optional(),
}).strict();
export type ListNciiEvidencePoolInput = z.infer<typeof ListNciiEvidencePoolInputSchema>;

// ===========================================================================
// linkNciiEvidenceToCase / unlinkNciiEvidenceFromCase — find-&-link step 2 (+ reverse).
// ===========================================================================
export const LinkNciiEvidenceToCaseInputSchema = z.object({
  allegationId: z.string().min(1),
  caseId: z.string().min(1),
}).strict();
export type LinkNciiEvidenceToCaseInput = z.infer<typeof LinkNciiEvidenceToCaseInputSchema>;

export const UnlinkNciiEvidenceFromCaseInputSchema = z.object({
  allegationId: z.string().min(1),
  caseId: z.string().min(1),
}).strict();
export type UnlinkNciiEvidenceFromCaseInput = z.infer<typeof UnlinkNciiEvidenceFromCaseInputSchema>;

// ===========================================================================
// markNciiEvidence — admin-only "NCII linked evidence" intake (find-&-link step 1).
// Client ids are HINTS; the target is re-resolved server-side.
// ===========================================================================
export const MarkNciiEvidenceInputSchema = z.object({
  itemType: ReportableItemTypeSchema,
  reportedItemId: z.string().min(1),
  parentItemId: z.string().min(1).optional(),
  reportedUserId: z.string().min(1).optional(),
  reason: z.string().trim().max(MAX_NCII_EVIDENCE_REASON_LENGTH).optional(),
}).strict();
export type MarkNciiEvidenceInput = z.infer<typeof MarkNciiEvidenceInputSchema>;

// ===========================================================================
// decideTakeItDownValidity — the nciiRequestReviewer-gated validity determination.
// ===========================================================================

/** Enumerated invalid-ruling reasons (never free-form). */
export const TakeItDownInvalidReasonCodeSchema = z.enum([
  'missingSignature',
  'missingLocator',
  'missingNonconsentStatement',
  'missingContactInformation',
  'requesterNotDepictedPersonOrAuthorizedRepresentative',
  'authorityNotEstablished',
  'locatorNotResolvableAfterReasonableEffort',
  'requestOutsideCoveredDepiction',
  'duplicateSuperseded',
  'fraudulentOrBadFaith',
  'otherCounselApproved',
]);
export type TakeItDownInvalidReasonCodeInput = z.infer<typeof TakeItDownInvalidReasonCodeSchema>;

export const DecideTakeItDownValidityInputSchema = z.object({
  requestId: z.string().min(1),
  result: z.enum(['valid', 'invalid', 'unableToLocate']),
  /** Required for an 'invalid' result; an enumerated reason (never free-form). */
  reasonCode: TakeItDownInvalidReasonCodeSchema.optional(),
  /** [EUAS-010] The operator's written rationale for this ruling. Persisted as an IMMUTABLE
   *  restricted rationale row that `rationaleRef` then points at — the UI no longer fabricates a
   *  `rationale:<requestId>` pointer. Required + substantive (non-placeholder). */
  rationaleText: z
    .string()
    .trim()
    .min(10, 'A substantive rationale is required for a validity decision.')
    .max(MAX_NCII_RATIONALE_LENGTH),
  /** Explicit typed confirmation (interim control until the passkey profile lands). */
  confirmation: z.literal('I confirm this TAKE IT DOWN validity decision'),
}).strict();
export type DecideTakeItDownValidityInput = z.infer<typeof DecideTakeItDownValidityInputSchema>;

// ===========================================================================
// submitInAppNciiRequest — logged-in entry to the one NCII statutory intake core.
// Client ids are HINTS; the target is re-resolved server-side.
// ===========================================================================
export const SubmitInAppNciiRequestInputSchema = z
  .object({
    idempotencyKey: z.string().min(8).max(256),
    itemType: ReportableItemTypeSchema,
    reportedItemId: z.string().min(1).max(256),
    parentItemId: z.string().min(1).max(256).optional(),
    nonconsentStatement: z.string().min(1).max(MAX_NCII_NONCONSENT_STATEMENT_LENGTH),
    /** Typed-name electronic signature. */
    signedName: z.string().min(1).max(MAX_NCII_SIGNED_NAME_LENGTH),
    goodFaithCertification: z.literal(true),
    contactEmail: z.string().email().max(320).optional(),
    contactPhone: z.string().min(3).max(64).optional(),
    supportingFacts: z.string().max(MAX_NCII_SUPPORTING_FACTS_LENGTH).default(''),
  })
  .strict()
  // At least one contact method — the form prefills the account email but allows an override.
  .refine((b) => Boolean(b.contactEmail) || Boolean(b.contactPhone), {
    message: 'At least one contact method (email or phone) is required.',
    path: ['contactEmail'],
  });
export type SubmitInAppNciiRequestInput = z.infer<typeof SubmitInAppNciiRequestInputSchema>;

// ===========================================================================
// resolveNciiReportPreview — logged-in read resolving a reported item to a previewable asset.
// Client ids are HINTS; the target is re-resolved server-side.
// ===========================================================================
export const ResolveNciiReportPreviewInputSchema = z.object({
  itemType: ReportableItemTypeSchema,
  reportedItemId: z.string().min(1).max(256),
  parentItemId: z.string().min(1).max(256).optional(),
}).strict();
export type ResolveNciiReportPreviewInput = z.infer<typeof ResolveNciiReportPreviewInputSchema>;
