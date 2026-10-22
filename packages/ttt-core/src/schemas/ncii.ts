import { z } from 'zod';
import {
  reportTargetItemIdSchema,
  reportTargetParentRefSchema,
  reportTargetUserIdSchema,
  safetyCaseIdSchema,
  nciiAllegationIdSchema,
  takeItDownRequestIdSchema,
  mediaAssetIdSchema,
  unpaddedValueSchema,
} from './atoms.js';
import {
  ReportableItemTypeSchema,
  NciiMinorAssessmentSchema,
  TakeItDownRequesterRoleSchema,
  TakeItDownInvalidReasonCodeSchema,
} from '../doc-schemas/safety/foundation.js';
import { TakeItDownSignatureMethodSchema } from '../doc-schemas/ncii/requests.js';
import { NciiAllegationV1Schema } from '../doc-schemas/ncii/allegations.js';
import {
  MAX_NCII_AUTHORITY_EVIDENCE_REF_LENGTH,
  MAX_NCII_LOCATOR_URL_LENGTH,
  NCII_IDEMPOTENCY_KEY_MIN_LENGTH,
  NCII_IDEMPOTENCY_KEY_MAX_LENGTH,
  MAX_NCII_CONTACT_EMAIL_LENGTH,
  NCII_CONTACT_PHONE_MIN_LENGTH,
  NCII_CONTACT_PHONE_MAX_LENGTH,
} from '../constants/business-admin.js';
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

export const SetNciiMinorAssessmentInputSchema = z
  .object({
    caseId: safetyCaseIdSchema,
    minorAssessment: NciiMinorAssessmentSchema,
  })
  .strict();
export type SetNciiMinorAssessmentInput = z.infer<typeof SetNciiMinorAssessmentInputSchema>;

export const ListNciiEvidencePoolInputSchema = z
  .object({
    caseId: safetyCaseIdSchema.optional(),
  })
  .strict();
export type ListNciiEvidencePoolInput = z.infer<typeof ListNciiEvidencePoolInputSchema>;

export const NciiEvidencePoolItemSchema = z.object({
  allegationId: nciiAllegationIdSchema,
  targetLocator: NciiAllegationV1Schema.shape.targetLocator,
  itemType: z.string().optional(),
  ownerUid: z.string().optional(),
  allegationReason: z.string(),
  submittedAt: z.number(),
});
export type NciiEvidencePoolItem = z.infer<typeof NciiEvidencePoolItemSchema>;

export const ListNciiEvidencePoolResultSchema = z.object({
  pool: z.array(NciiEvidencePoolItemSchema),
  linked: z.array(NciiEvidencePoolItemSchema),
});
export type ListNciiEvidencePoolResult = z.infer<typeof ListNciiEvidencePoolResultSchema>;

export const LinkNciiEvidenceToCaseInputSchema = z
  .object({
    allegationId: nciiAllegationIdSchema,
    caseId: safetyCaseIdSchema,
  })
  .strict();
export type LinkNciiEvidenceToCaseInput = z.infer<typeof LinkNciiEvidenceToCaseInputSchema>;

export const LinkNciiEvidenceToCaseResultSchema = z.object({
  success: z.literal(true),
  caseId: safetyCaseIdSchema,
  allegationId: nciiAllegationIdSchema,
  ownerUid: z.string().min(1).nullable(),
  holdRefId: z.string().min(1),
});
export type LinkNciiEvidenceToCaseResult = z.infer<typeof LinkNciiEvidenceToCaseResultSchema>;

export const UnlinkNciiEvidenceFromCaseInputSchema = z
  .object({
    allegationId: nciiAllegationIdSchema,
    caseId: safetyCaseIdSchema,
  })
  .strict();
export type UnlinkNciiEvidenceFromCaseInput = z.infer<typeof UnlinkNciiEvidenceFromCaseInputSchema>;

export const UnlinkNciiEvidenceFromCaseResultSchema = z.object({
  success: z.literal(true),
});
export type UnlinkNciiEvidenceFromCaseResult = z.infer<
  typeof UnlinkNciiEvidenceFromCaseResultSchema
>;

export const MarkNciiEvidenceInputSchema = z
  .object({
    itemType: ReportableItemTypeSchema,
    reportedItemId: reportTargetItemIdSchema,
    parentItemId: reportTargetParentRefSchema.optional(),
    reportedUserId: reportTargetUserIdSchema.optional(),
    reason: textFieldSchema(REPORT_COMMENT_INPUT).optional(),
  })
  .strict();
export type MarkNciiEvidenceInput = z.infer<typeof MarkNciiEvidenceInputSchema>;

export const MarkNciiEvidenceResultSchema = z.object({
  success: z.literal(true),
  allegationId: nciiAllegationIdSchema,
  alreadyExisted: z.boolean(),
});
export type MarkNciiEvidenceResult = z.infer<typeof MarkNciiEvidenceResultSchema>;

export const DecideTakeItDownValidityInputSchema = z
  .object({
    requestId: takeItDownRequestIdSchema,
    result: z.enum(['valid', 'invalid', 'unableToLocate']),
    reasonCode: TakeItDownInvalidReasonCodeSchema.optional(),
    rationaleText: textFieldSchema(TAKE_IT_DOWN_VALIDITY_RATIONALE_INPUT),
    confirmation: z.literal(TAKE_IT_DOWN_VALIDITY_CONFIRMATION),
  })
  .strict();
export type DecideTakeItDownValidityInput = z.infer<typeof DecideTakeItDownValidityInputSchema>;

const nciiIdempotencyKeySchema = z
  .string()
  .min(NCII_IDEMPOTENCY_KEY_MIN_LENGTH)
  .max(NCII_IDEMPOTENCY_KEY_MAX_LENGTH);
const nciiContactEmailSchema = z.string().email().max(MAX_NCII_CONTACT_EMAIL_LENGTH);
const nciiContactPhoneSchema = z
  .string()
  .min(NCII_CONTACT_PHONE_MIN_LENGTH)
  .max(NCII_CONTACT_PHONE_MAX_LENGTH);

const ONE_CONTACT_METHOD_REQUIRED = {
  message: 'At least one contact method (email or phone) is required.',
  path: ['contactEmail'],
};
const hasContactMethod = (body: { contactEmail?: string; contactPhone?: string }): boolean =>
  Boolean(body.contactEmail) || Boolean(body.contactPhone);

export const SubmitInAppNciiRequestInputSchema = z
  .object({
    idempotencyKey: nciiIdempotencyKeySchema,
    itemType: ReportableItemTypeSchema,
    reportedItemId: reportTargetItemIdSchema,
    parentItemId: reportTargetParentRefSchema.optional(),
    nonconsentStatement: textFieldSchema(NCII_NONCONSENT_STATEMENT_INPUT),
    signedName: textFieldSchema(NCII_SIGNED_NAME_INPUT),
    goodFaithCertification: z.literal(true),
    contactEmail: nciiContactEmailSchema.optional(),
    contactPhone: nciiContactPhoneSchema.optional(),
    supportingFacts: textFieldSchema(NCII_SUPPORTING_FACTS_INPUT).default(''),
  })
  .strict()
  .refine(hasContactMethod, ONE_CONTACT_METHOD_REQUIRED);
export type SubmitInAppNciiRequestInput = z.infer<typeof SubmitInAppNciiRequestInputSchema>;

export const SubmitInAppNciiRequestResultSchema = z.object({
  requestReference: z.string().min(1),
  requestId: takeItDownRequestIdSchema,
  completenessStatus: z.literal('complete'),
  created: z.boolean(),
});
export type SubmitInAppNciiRequestResult = z.infer<typeof SubmitInAppNciiRequestResultSchema>;

export const nciiLocatorUrlSchema = unpaddedValueSchema.max(MAX_NCII_LOCATOR_URL_LENGTH).refine(
  (value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'Enter a web address that starts with http:// or https://.' },
);

export const PublicTakeItDownLocatorSchema = z
  .object({ kind: z.literal('url'), url: nciiLocatorUrlSchema })
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
    const representative =
      intake.requesterRole === TakeItDownRequesterRoleSchema.enum.authorizedRepresentative;
    if (representative && !intake.authorizedRepresentative) {
      ctx.addIssue({
        code: 'custom',
        message:
          'An authorized representative request requires the authorizedRepresentative block.',
      });
    }
    if (!representative && intake.authorizedRepresentative) {
      ctx.addIssue({ code: 'custom' });
    }
  });
export type TakeItDownIntakeBody = z.infer<typeof TakeItDownIntakeBodySchema>;

export const ResolveNciiReportPreviewInputSchema = z
  .object({
    itemType: ReportableItemTypeSchema,
    reportedItemId: reportTargetItemIdSchema,
    parentItemId: reportTargetParentRefSchema.optional(),
  })
  .strict();
export type ResolveNciiReportPreviewInput = z.infer<typeof ResolveNciiReportPreviewInputSchema>;

export const ResolveNciiReportPreviewResultSchema = z.object({
  mediaAssetId: mediaAssetIdSchema.optional(),
  mediaKind: z.enum(['image', 'video', 'audio']).optional(),
});
export type ResolveNciiReportPreviewResult = z.infer<typeof ResolveNciiReportPreviewResultSchema>;
