import { z } from 'zod';
import {
  reportTargetItemIdSchema,
  reportTargetParentRefSchema,
  reportTargetUserIdSchema,
  safetyCaseIdSchema,
  nciiAllegationIdSchema,
  takeItDownRequestIdSchema,
} from './atoms.js';
import {
  ReportableItemTypeSchema,
  NciiMinorAssessmentSchema,
  TakeItDownRequesterRoleSchema,
} from '../doc-schemas/safety/foundation.js';
import { TakeItDownSignatureMethodSchema } from '../doc-schemas/ncii/requests.js';
import {
  MAX_NCII_AUTHORITY_EVIDENCE_REF_LENGTH,
  MAX_NCII_LOCATOR_URL_LENGTH,
  NCII_IDEMPOTENCY_KEY_MIN_LENGTH,
  NCII_IDEMPOTENCY_KEY_MAX_LENGTH,
  MAX_NCII_CONTACT_EMAIL_LENGTH,
  NCII_CONTACT_PHONE_MIN_LENGTH,
  NCII_CONTACT_PHONE_MAX_LENGTH,
} from '../constants/business.js';
import { TAKE_IT_DOWN_VALIDITY_CONFIRMATION } from '../constants/safety-confirmation-phrases.js';
import {
  NCII_AUTHORITY_BASIS_INPUT,
  NCII_NONCONSENT_STATEMENT_INPUT,
  NCII_REPRESENTED_PERSON_NAME_INPUT,
  NCII_REQUESTER_NAME_INPUT,
  NCII_SIGNED_NAME_INPUT,
  NCII_SUPPORTING_FACTS_INPUT,
  REPORT_COMMENT_INPUT,
  TAKE_IT_DOWN_VALIDITY_RATIONALE_INPUT,
} from '../constants/text-fields.js';
import { textFieldSchema } from './text-field.js';

// NCII / TAKE IT DOWN callable-input schemas. Cross-boundary contracts for the
// `functions/src/ncii/` callables — moved here from local `functions/` definitions so the
// callable-validation standard (parse `request.data` with a `.strict()` ttt-core schema before any
// auth check) is met from one authoritative place. See ttt-prod docs/design/callable-validation.md.

// Operator sets the child-safety crossover minorAssessment on an NCII case (CSAM possible-minor
// crossover — DECISION 2026-07-01: operator-only, no automated age signal). A routing action: it
// opens/links a PARALLEL child-safety review + deny-serving + PhotoDNA, WITHOUT touching the NCII
// removal clock and WITHOUT auto-NCMEC (that still needs a validated hash or explicit human
// confirmApparentViolation). Writes the `ncii.minorAssessmentSet` audit event.
export const SetNciiMinorAssessmentInputSchema = z.object({
  caseId: safetyCaseIdSchema,
  minorAssessment: NciiMinorAssessmentSchema,
}).strict();
export type SetNciiMinorAssessmentInput = z.infer<typeof SetNciiMinorAssessmentInputSchema>;

// ===========================================================================
// listNciiEvidencePool — admin-only pool read for the find-&-link flow.
// Optional caseId selects the currently-linked evidence to also return.
// ===========================================================================
export const ListNciiEvidencePoolInputSchema = z.object({
  caseId: safetyCaseIdSchema.optional(),
}).strict();
export type ListNciiEvidencePoolInput = z.infer<typeof ListNciiEvidencePoolInputSchema>;

// ===========================================================================
// linkNciiEvidenceToCase / unlinkNciiEvidenceFromCase — find-&-link step 2 (+ reverse).
// ===========================================================================
export const LinkNciiEvidenceToCaseInputSchema = z.object({
  allegationId: nciiAllegationIdSchema,
  caseId: safetyCaseIdSchema,
}).strict();
export type LinkNciiEvidenceToCaseInput = z.infer<typeof LinkNciiEvidenceToCaseInputSchema>;

export const UnlinkNciiEvidenceFromCaseInputSchema = z.object({
  allegationId: nciiAllegationIdSchema,
  caseId: safetyCaseIdSchema,
}).strict();
export type UnlinkNciiEvidenceFromCaseInput = z.infer<typeof UnlinkNciiEvidenceFromCaseInputSchema>;

// ===========================================================================
// markNciiEvidence — admin-only "NCII linked evidence" intake (find-&-link step 1).
// Client ids are HINTS; the target is re-resolved server-side.
// ===========================================================================
export const MarkNciiEvidenceInputSchema = z.object({
  itemType: ReportableItemTypeSchema,
  reportedItemId: reportTargetItemIdSchema,
  parentItemId: reportTargetParentRefSchema.optional(),
  reportedUserId: reportTargetUserIdSchema.optional(),
  reason: textFieldSchema(REPORT_COMMENT_INPUT).optional(),
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
  requestId: takeItDownRequestIdSchema,
  result: z.enum(['valid', 'invalid', 'unableToLocate']),
  /** Required for an 'invalid' result; an enumerated reason (never free-form). */
  reasonCode: TakeItDownInvalidReasonCodeSchema.optional(),
  /** [EUAS-010] The operator's written rationale for this ruling. Persisted as an IMMUTABLE
   *  restricted rationale row that `rationaleRef` then points at — the UI no longer fabricates a
   *  `rationale:<requestId>` pointer. Required + substantive (non-placeholder). */
  rationaleText: textFieldSchema(TAKE_IT_DOWN_VALIDITY_RATIONALE_INPUT),
  /** Explicit typed confirmation (interim control until the passkey profile lands). */
  confirmation: z.literal(TAKE_IT_DOWN_VALIDITY_CONFIRMATION),
}).strict();
export type DecideTakeItDownValidityInput = z.infer<typeof DecideTakeItDownValidityInputSchema>;

// ===========================================================================
// The statutory intake fields both entries share (in-app and no-login).
// ===========================================================================
const nciiIdempotencyKeySchema = z
  .string()
  .min(NCII_IDEMPOTENCY_KEY_MIN_LENGTH)
  .max(NCII_IDEMPOTENCY_KEY_MAX_LENGTH);
const nciiContactEmailSchema = z.string().email().max(MAX_NCII_CONTACT_EMAIL_LENGTH);
const nciiContactPhoneSchema = z
  .string()
  .min(NCII_CONTACT_PHONE_MIN_LENGTH)
  .max(NCII_CONTACT_PHONE_MAX_LENGTH);

// The form must carry at least one contact method: rejecting at the door gives a clean 400 instead
// of an incomplete receipt for a wholly uncontactable request.
const ONE_CONTACT_METHOD_REQUIRED = {
  message: 'At least one contact method (email or phone) is required.',
  path: ['contactEmail'],
};
const hasContactMethod = (body: { contactEmail?: string; contactPhone?: string }): boolean =>
  Boolean(body.contactEmail) || Boolean(body.contactPhone);

// ===========================================================================
// submitInAppNciiRequest — logged-in entry to the one NCII statutory intake core.
// Client ids are HINTS; the target is re-resolved server-side.
// ===========================================================================
export const SubmitInAppNciiRequestInputSchema = z
  .object({
    idempotencyKey: nciiIdempotencyKeySchema,
    itemType: ReportableItemTypeSchema,
    reportedItemId: reportTargetItemIdSchema,
    parentItemId: reportTargetParentRefSchema.optional(),
    nonconsentStatement: textFieldSchema(NCII_NONCONSENT_STATEMENT_INPUT),
    /** Typed-name electronic signature. */
    signedName: textFieldSchema(NCII_SIGNED_NAME_INPUT),
    goodFaithCertification: z.literal(true),
    contactEmail: nciiContactEmailSchema.optional(),
    contactPhone: nciiContactPhoneSchema.optional(),
    supportingFacts: textFieldSchema(NCII_SUPPORTING_FACTS_INPUT).default(''),
  })
  .strict()
  // The form prefills the account email but allows an override.
  .refine(hasContactMethod, ONE_CONTACT_METHOD_REQUIRED);
export type SubmitInAppNciiRequestInput = z.infer<typeof SubmitInAppNciiRequestInputSchema>;

// ===========================================================================
// POST /api/take-it-down — the PUBLIC, no-login statutory intake body. It is url-ONLY by design:
// it never carries a TTT-hosted locator the server would resolve and hold, so an anonymous caller
// cannot take platform content down without an account. A report of TTT content goes through the
// authenticated report path. The route parses this before it reads anything else of the request.
// ===========================================================================
export const PublicTakeItDownLocatorSchema = z
  .object({ kind: z.literal('url'), url: z.string().min(1).max(MAX_NCII_LOCATOR_URL_LENGTH) })
  .strict();

export const TakeItDownElectronicSignatureInputSchema = z
  .object({
    signedName: textFieldSchema(NCII_SIGNED_NAME_INPUT),
    signedAt: z.number(),
    signatureMethod: TakeItDownSignatureMethodSchema,
  })
  .strict();

export const TakeItDownAuthorizedRepresentativeInputSchema = z
  .object({
    representedPersonName: textFieldSchema(NCII_REPRESENTED_PERSON_NAME_INPUT),
    authorityBasis: textFieldSchema(NCII_AUTHORITY_BASIS_INPUT),
    authorityEvidenceRef: z.string().min(1).max(MAX_NCII_AUTHORITY_EVIDENCE_REF_LENGTH).optional(),
  })
  .strict();

export const TakeItDownIntakeBodySchema = z
  .object({
    idempotencyKey: nciiIdempotencyKeySchema,
    requesterRole: TakeItDownRequesterRoleSchema,
    locator: PublicTakeItDownLocatorSchema,
    requesterName: textFieldSchema(NCII_REQUESTER_NAME_INPUT),
    contactEmail: nciiContactEmailSchema.optional(),
    contactPhone: nciiContactPhoneSchema.optional(),
    electronicSignature: TakeItDownElectronicSignatureInputSchema,
    authorizedRepresentative: TakeItDownAuthorizedRepresentativeInputSchema.optional(),
    nonconsentStatement: textFieldSchema(NCII_NONCONSENT_STATEMENT_INPUT),
    supportingFacts: textFieldSchema(NCII_SUPPORTING_FACTS_INPUT).default(''),
    goodFaithCertification: z.boolean(),
    accuracyCertification: z.boolean().optional(),
    authorityCertification: z.boolean().optional(),
  })
  .strict()
  .refine(hasContactMethod, ONE_CONTACT_METHOD_REQUIRED)
  .superRefine((intake, ctx) => {
    const representative = intake.requesterRole === TakeItDownRequesterRoleSchema.enum.authorizedRepresentative;
    if (representative && !intake.authorizedRepresentative) {
      ctx.addIssue({
        code: 'custom',
        message: 'An authorized representative request requires the authorizedRepresentative block.',
      });
    }
    if (!representative && intake.authorizedRepresentative) {
      ctx.addIssue({ code: 'custom' });
    }
  });
export type TakeItDownIntakeBody = z.infer<typeof TakeItDownIntakeBodySchema>;

// ===========================================================================
// resolveNciiReportPreview — logged-in read resolving a reported item to a previewable asset.
// Client ids are HINTS; the target is re-resolved server-side.
// ===========================================================================
export const ResolveNciiReportPreviewInputSchema = z.object({
  itemType: ReportableItemTypeSchema,
  reportedItemId: reportTargetItemIdSchema,
  parentItemId: reportTargetParentRefSchema.optional(),
}).strict();
export type ResolveNciiReportPreviewInput = z.infer<typeof ResolveNciiReportPreviewInputSchema>;
