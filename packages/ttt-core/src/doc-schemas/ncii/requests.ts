import { z } from 'zod';
import {
  MAX_NCII_ACTION_SUMMARY_LENGTH,
  MAX_NCII_RATIONALE_LENGTH,
} from '../../constants/business-admin.js';
import {
  TakeItDownRequesterRoleSchema,
  TargetLocatorV1Schema,
  TargetLocatorSummaryV1Schema,
  TakeItDownCompletenessStatusSchema,
  TakeItDownValidityStatusSchema,
  TakeItDownInvalidReasonCodeSchema,
  TakeItDownPublicStatusSchema,
  NciiRemovalCompletionOutcomeSchema,
  NciiActionTypeSchema,
  NciiActionResultSchema,
  TakeItDownFieldCodeSchema,
  SafetyReviewerCapabilitySchema,
  type TakeItDownFieldCode,
  type TakeItDownRequesterRole,
} from '../safety/foundation.js';

export const TakeItDownRequestRootV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    requestId: z.string().min(1),
    caseId: z.string().min(1).optional(),
    requesterRole: TakeItDownRequesterRoleSchema,
    targetLocatorSummary: TargetLocatorSummaryV1Schema,
    receivedAt: z.number(),
    completenessStatus: TakeItDownCompletenessStatusSchema,
    validityStatus: TakeItDownValidityStatusSchema,
    invalidReasonCode: TakeItDownInvalidReasonCodeSchema.optional(),
    completenessDeterminedAt: z.number().optional(),
    validityDeterminedAt: z.number().optional(),
    completedBySubmissionId: z.string().min(1).optional(),
    validRequestReceivedAt: z.number().optional(),
    removalDeadlineAt: z.number().optional(),
    publicStatus: TakeItDownPublicStatusSchema,
    requestClosedAt: z.number().optional(),
    removalCompletionAt: z.number().optional(),
    finalClosedAt: z.number().optional(),
    removalCompletionOutcome: NciiRemovalCompletionOutcomeSchema.nullable().optional(),
    // Seeded as an explicit null: a Firestore `== null` query never matches an absent field.
    retentionCompletedAt: z.number().nullable().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict();
export type TakeItDownRequestRootV1 = z.infer<typeof TakeItDownRequestRootV1Schema>;

export const TakeItDownSignatureMethodSchema = z.enum(['typedName', 'drawnSignature']);
export type TakeItDownSignatureMethod = z.infer<typeof TakeItDownSignatureMethodSchema>;

export const TakeItDownElectronicSignatureV1Schema = z
  .object({
    signedName: z.string(),
    signedAt: z.number(),
    signatureMethod: TakeItDownSignatureMethodSchema,
  })
  .strict();
export type TakeItDownElectronicSignatureV1 = z.infer<typeof TakeItDownElectronicSignatureV1Schema>;

export const AuthorityProofScanStatusSchema = z.enum([
  'pending',
  'clean',
  'matched',
  'rejected',
  'unavailable',
]);
export type AuthorityProofScanStatus = z.infer<typeof AuthorityProofScanStatusSchema>;

export const AuthorityProofScanStateV1Schema = z
  .object({
    scanStatus: AuthorityProofScanStatusSchema,
    objectGeneration: z.string().min(1),
    objectHash: z.string().min(1),
    scannedAt: z.number().optional(),
  })
  .strict();
export type AuthorityProofScanStateV1 = z.infer<typeof AuthorityProofScanStateV1Schema>;

export const TakeItDownAuthorizedRepresentativeV1Schema = z
  .object({
    representedPersonName: z.string(),
    authorityBasis: z.string(),
    authorityCertification: z.boolean(),
    authorityEvidenceRef: z.string().min(1).optional(),
    authorityProofScan: AuthorityProofScanStateV1Schema.optional(),
  })
  .strict();
export type TakeItDownAuthorizedRepresentativeV1 = z.infer<
  typeof TakeItDownAuthorizedRepresentativeV1Schema
>;

export const TakeItDownRequesterPrivateV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    requesterName: z.string(),
    contactEmail: z.string(),
    contactPhone: z.string().optional(),
    electronicSignature: TakeItDownElectronicSignatureV1Schema,
    authorizedRepresentative: TakeItDownAuthorizedRepresentativeV1Schema.optional(),
    nonconsentStatement: z.string(),
    supportingFacts: z.string(),
    goodFaithCertification: z.boolean(),
    accuracyCertification: z.boolean().optional(),
    targetLocator: TargetLocatorV1Schema.optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict();
export type TakeItDownRequesterPrivateV1 = z.infer<typeof TakeItDownRequesterPrivateV1Schema>;

export const TakeItDownSubmissionCreatedBySchema = z.enum(['requester', 'operator', 'system']);
export type TakeItDownSubmissionCreatedBy = z.infer<typeof TakeItDownSubmissionCreatedBySchema>;

export const TakeItDownSubmissionV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    submissionId: z.string().min(1),
    sequence: z.number(),
    receivedAt: z.number(),
    suppliedFieldCodes: z.array(TakeItDownFieldCodeSchema).max(16),
    evidenceIds: z.array(z.string().min(1)).max(16),
    cumulativeRequestSnapshotHash: z.string(),
    cumulativeCompleteness: TakeItDownCompletenessStatusSchema,
    firstCompletedRequest: z.boolean(),
    supersedesSubmissionId: z.string().min(1).optional(),
    createdBy: TakeItDownSubmissionCreatedBySchema,
  })
  .strict();
export type TakeItDownSubmissionV1 = z.infer<typeof TakeItDownSubmissionV1Schema>;

export const TakeItDownValidityDecisionResultSchema = z.enum([
  'valid',
  'invalid',
  'unableToLocate',
]);
export type TakeItDownValidityDecisionResult = z.infer<
  typeof TakeItDownValidityDecisionResultSchema
>;

export const TakeItDownValidityDecisionV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    decisionId: z.string().min(1),
    requestId: z.string().min(1),
    result: TakeItDownValidityDecisionResultSchema,
    basisSubmissionIds: z.array(z.string().min(1)).max(16),
    validFromSubmissionId: z.string().min(1).optional(),
    validRequestReceivedAt: z.number().optional(),
    reasonCode: TakeItDownInvalidReasonCodeSchema.optional(),
    rationaleRef: z.string(),
    decidedByUid: z.string().min(1),
    decidedAt: z.number(),
  })
  .strict();
export type TakeItDownValidityDecisionV1 = z.infer<typeof TakeItDownValidityDecisionV1Schema>;

export const TakeItDownValidityRationaleV1Schema = z
  .object({
    requestId: z.string().min(1),
    decisionId: z.string().min(1),
    result: TakeItDownValidityDecisionResultSchema,
    reasonCode: TakeItDownInvalidReasonCodeSchema.optional(),
    text: z.string().min(1).max(MAX_NCII_RATIONALE_LENGTH),
    authoredByUid: z.string().min(1),
    authoredAt: z.number(),
  })
  .strict();
export type TakeItDownValidityRationaleV1 = z.infer<typeof TakeItDownValidityRationaleV1Schema>;

export const TakeItDownRequestActionV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    actionId: z.string().min(1),
    at: z.number(),
    actorId: z.string().min(1),
    capability: SafetyReviewerCapabilitySchema,
    actionType: NciiActionTypeSchema,
    result: NciiActionResultSchema,
    summary: z.string().max(MAX_NCII_ACTION_SUMMARY_LENGTH),
    detailRef: z.string().min(1),
  })
  .strict();
export type TakeItDownRequestActionV1 = z.infer<typeof TakeItDownRequestActionV1Schema>;

export const TakeItDownEvidenceV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    evidenceId: z.string().min(1),
    requestId: z.string().min(1),
    uploadContext: z.literal('takeItDownEvidence'),
    submitterUid: z.string().min(1).optional(),
    bucket: z.string().min(1),
    key: z.string().min(1),
    generation: z.string().min(1),
    contentType: z.string().min(1),
    sizeBytes: z.number(),
    sha256: z.string().min(1),
    md5: z.string().min(1),
    capturedAt: z.number(),
    createdAt: z.number(),
  })
  .strict();
export type TakeItDownEvidenceV1 = z.infer<typeof TakeItDownEvidenceV1Schema>;

export const NciiRetainedEvidenceReasonSchema = z.enum([
  'orphan',
  'fileTooLarge',
  'imageTooLarge',
  'archiveOrPolyglot',
  'malformedPath',
  'scanRejected',
  'capOverflow',
]);
export type NciiRetainedEvidenceReason = z.infer<typeof NciiRetainedEvidenceReasonSchema>;

export const NciiRetainedEvidenceInventoryV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    inventoryId: z.string().min(1),
    reason: NciiRetainedEvidenceReasonSchema,
    bucket: z.string().min(1),
    key: z.string().min(1),
    generation: z.string().min(1),
    requestReference: z.string().min(1).optional(),
    contentType: z.string().min(1).optional(),
    sizeBytes: z.number().optional(),
    detectedAt: z.number(),
    createdAt: z.number(),
  })
  .strict();
export type NciiRetainedEvidenceInventoryV1 = z.infer<typeof NciiRetainedEvidenceInventoryV1Schema>;

export const REQUIRED_FIELD_CODES_DEPICTED_PERSON = [
  'requesterName',
  'requesterRole',
  'electronicSignature',
  'targetLocator',
  'nonconsentStatement',
  'goodFaithCertification',
] as const satisfies readonly TakeItDownFieldCode[];

export const REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE = [
  ...REQUIRED_FIELD_CODES_DEPICTED_PERSON,
  'authorityBasis',
  'authorityCertification',
] as const satisfies readonly TakeItDownFieldCode[];

export const CONTACT_ONE_OF_FIELD_CODES = [
  'contactEmail',
  'contactPhone',
] as const satisfies readonly TakeItDownFieldCode[];

export function requiredFieldCodes(
  requesterRole: TakeItDownRequesterRole,
): readonly TakeItDownFieldCode[] {
  return requesterRole === 'authorizedRepresentative'
    ? REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE
    : REQUIRED_FIELD_CODES_DEPICTED_PERSON;
}

export function computeCompleteness(input: {
  requesterRole: TakeItDownRequesterRole;
  suppliedFieldCodes: readonly TakeItDownFieldCode[];
}): { status: 'incomplete' | 'complete'; missingFieldCodes: TakeItDownFieldCode[] } {
  const supplied = new Set(input.suppliedFieldCodes);
  const missingFieldCodes: TakeItDownFieldCode[] = [];

  for (const code of requiredFieldCodes(input.requesterRole)) {
    if (!supplied.has(code)) missingFieldCodes.push(code);
  }

  const contactSatisfied = CONTACT_ONE_OF_FIELD_CODES.some((code) => supplied.has(code));
  if (!contactSatisfied) missingFieldCodes.push('contactEmail');

  return {
    status: missingFieldCodes.length === 0 ? 'complete' : 'incomplete',
    missingFieldCodes,
  };
}

export function takeItDownRequestCanBeRuledValid(input: {
  completenessStatus: TakeItDownRequestRootV1['completenessStatus'];
  hasStoredLocator: boolean;
}): boolean {
  return input.completenessStatus === 'complete' && input.hasStoredLocator;
}

export interface NciiIntakeFacts {
  readonly requesterRole: TakeItDownRequesterRole;
  readonly requesterName?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly electronicSignature?: { signedName: string; signatureMethod: string };
  readonly nonconsentStatement?: string;
  readonly supportingFacts?: string;
  readonly goodFaithCertification?: boolean;
  readonly authorityBasis?: string;
  readonly authorityCertification?: boolean;
  readonly authorityEvidenceRef?: string;
  readonly hasLocator: boolean;
}

function nonEmpty(s: string | undefined): boolean {
  return typeof s === 'string' && s.trim().length > 0;
}

export function suppliedFieldCodes(facts: NciiIntakeFacts): TakeItDownFieldCode[] {
  const codes: TakeItDownFieldCode[] = [];
  if (nonEmpty(facts.requesterName)) codes.push('requesterName');
  if (nonEmpty(facts.contactEmail)) codes.push('contactEmail');
  if (nonEmpty(facts.contactPhone)) codes.push('contactPhone');
  codes.push('requesterRole');
  if (facts.electronicSignature && nonEmpty(facts.electronicSignature.signedName)) {
    codes.push('electronicSignature');
  }
  if (facts.hasLocator) codes.push('targetLocator');
  if (nonEmpty(facts.nonconsentStatement)) codes.push('nonconsentStatement');
  if (nonEmpty(facts.supportingFacts)) codes.push('supportingFacts');
  if (facts.goodFaithCertification === true) codes.push('goodFaithCertification');
  if (nonEmpty(facts.authorityBasis)) codes.push('authorityBasis');
  if (facts.authorityCertification === true) codes.push('authorityCertification');
  if (nonEmpty(facts.authorityEvidenceRef)) codes.push('authorityEvidence');
  return codes;
}

export interface NciiCompletenessOutcome {
  readonly status: 'incomplete' | 'complete';
  readonly suppliedFieldCodes: TakeItDownFieldCode[];
  readonly missingFieldCodes: TakeItDownFieldCode[];
}

export function deriveCompleteness(facts: NciiIntakeFacts): NciiCompletenessOutcome {
  const supplied = suppliedFieldCodes(facts);
  const { status, missingFieldCodes } = computeCompleteness({
    requesterRole: facts.requesterRole,
    suppliedFieldCodes: supplied,
  });
  return { status, suppliedFieldCodes: supplied, missingFieldCodes };
}
