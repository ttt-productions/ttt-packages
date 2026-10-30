import { z } from 'zod';
import {
  MAX_USER_FACING_REASON_LENGTH,
  OPERATOR_STEP_UP_CODE_LENGTH,
  OPERATOR_STEP_UP_RECOVERY_CODE_COUNT,
  OPERATOR_STEP_UP_RECOVERY_CODE_LENGTH,
  MAX_NCMEC_REPORT_NUMBER_LENGTH,
  MAX_EVIDENCE_VAULT_KEY_LENGTH,
} from '../constants/business-admin.js';
import {
  ADMIN_TASK_RESOLUTION_INPUT,
  NCMEC_ARTIFACT_DESCRIPTION_INPUT,
  NCMEC_CORRECTION_REASON_INPUT,
  NCMEC_PORTAL_PROOF_TEXT_INPUT,
  REPORT_COMMENT_INPUT,
  REPORT_NARRATIVE_INPUT,
  SAFETY_INTERNAL_REASON_INPUT,
} from '../constants/text-fields.js';
import {
  SAFETY_ACCOUNT_ACTION_CONFIRMATION,
  NCMEC_PORTAL_RECEIPT_CONFIRMATION,
  NCMEC_MANUAL_PORTAL_FILED_CONFIRMATION,
  REVEAL_CASE_EVIDENCE_CONFIRMATION,
  NCMEC_PORTAL_CORRECTION_CONFIRMATION,
} from '../constants/safety-confirmation-phrases.js';
import { textFieldSchema } from './text-field.js';
import { AccountActionSchema } from '../doc-schemas/safety/sagas.js';
import {
  NciiInternalStatusSchema,
  NciiMinorAssessmentSchema,
  ReportableItemTypeSchema,
  ReportDispositionSchema,
  ReportReasonSchema,
  SafetyCaseClosureV1Schema,
  TargetLocatorV1Schema,
  type TakeItDownFieldCode,
} from '../doc-schemas/safety/foundation.js';
import { SafetySlaMonitorV1Schema } from '../doc-schemas/safety/monitors.js';
import { NciiCaseLaneSchema, NciiCaseV1Schema } from '../doc-schemas/ncii/cases.js';
import {
  AuthorityProofScanStatusSchema,
  NciiRetainedEvidenceInventoryV1Schema,
  TakeItDownAuthorizedRepresentativeV1Schema,
  TakeItDownRequesterPrivateV1Schema,
  TakeItDownRequestRootV1Schema,
  TakeItDownSubmissionV1Schema,
} from '../doc-schemas/ncii/requests.js';
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
import {
  SafetyEvidenceJobPhaseSchema,
  SafetyEvidenceJobStatusSchema,
  SafetyEvidenceManifestV1Schema,
} from '../doc-schemas/safety/evidence.js';
import {
  reportTargetItemIdSchema,
  reportTargetParentRefSchema,
  reportTargetUserIdSchema,
  documentIdSegmentSchema,
  unpaddedValueSchema,
  safetyCaseIdSchema,
  userIdSchema,
  takeItDownRequestIdSchema,
} from './atoms.js';
import {
  DeadLetterCollectionSchema,
  FlatDeadLetterCollectionSchema,
  HallSubItemEdgeSyncReplayTargetSchema,
} from './admin.js';

export const CommandAccountActionInputSchema = z
  .object({
    caseId: safetyCaseIdSchema,
    targetUid: userIdSchema,
    action: AccountActionSchema,
    reasonInternal: textFieldSchema(SAFETY_INTERNAL_REASON_INPUT),
    reasonUserFacing: z.string().min(1).max(MAX_USER_FACING_REASON_LENGTH),
    role: ChildSafetyAccountRoleSchema,
    subjectDisposition: ChildSafetyAccountSubjectDispositionSchema,
    confirmation: z.literal(SAFETY_ACCOUNT_ACTION_CONFIRMATION),
  })
  .strict();
export type CommandAccountActionInput = z.infer<typeof CommandAccountActionInputSchema>;

export const SafetyCaseConsoleCursorSchema = z
  .object({ v: z.number(), id: documentIdSegmentSchema })
  .strict();
export type SafetyCaseConsoleCursor = z.infer<typeof SafetyCaseConsoleCursorSchema>;

const SAFETY_CONSOLE_MAX_PAGE_SIZE = 200;

export const SafetyCaseConsoleSourceSchema = z.enum(['childSafety', 'ncii', 'takeItDown']);
export type SafetyCaseConsoleSource = z.infer<typeof SafetyCaseConsoleSourceSchema>;

export const GetSafetyCaseConsoleInputSchema = z
  .object({
    pageSize: z.number().int().min(1).max(SAFETY_CONSOLE_MAX_PAGE_SIZE).optional(),
    childSafetyCursor: SafetyCaseConsoleCursorSchema.nullish(),
    nciiCursor: SafetyCaseConsoleCursorSchema.nullish(),
    takeItDownCursor: SafetyCaseConsoleCursorSchema.nullish(),
    exhaustedSources: z
      .array(SafetyCaseConsoleSourceSchema)
      .max(SafetyCaseConsoleSourceSchema.options.length)
      .refine((sources) => new Set(sources).size === sources.length, {
        message: 'List each source once.',
      })
      .optional(),
  })
  .strict()
  .nullish();
export type GetSafetyCaseConsoleInput = z.infer<typeof GetSafetyCaseConsoleInputSchema>;

export const SafetyEvidenceJobSummarySchema = z
  .object({
    jobId: z.string().min(1),
    phase: SafetyEvidenceJobPhaseSchema,
    status: SafetyEvidenceJobStatusSchema,
  })
  .strict();
export type SafetyEvidenceJobSummary = z.infer<typeof SafetyEvidenceJobSummarySchema>;

export const SafetyCaseFailedJobRefSchema = z
  .object({
    collection: DeadLetterCollectionSchema.extract(['quarantineSagaJobs', 'nciiRemovalJobs']),
    docId: z.string().min(1),
    label: z.string().min(1),
  })
  .strict();
export type SafetyCaseFailedJobRef = z.infer<typeof SafetyCaseFailedJobRefSchema>;

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

export const NciiCaseConsoleRowSchema = z
  .object({
    case: NciiCaseV1Schema,
    monitors: z.array(SafetySlaMonitorV1Schema),
    failedJobs: z.array(SafetyCaseFailedJobRefSchema).optional(),
  })
  .strict();
export type NciiCaseConsoleRow = z.infer<typeof NciiCaseConsoleRowSchema>;

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

export const SafetyCaseConsolePageInfoSchema = z
  .object({
    total: z.number().int().nonnegative(),
    hasMore: z.boolean(),
    nextCursor: SafetyCaseConsoleCursorSchema.nullable(),
  })
  .strict();
export type SafetyCaseConsolePageInfo = z.infer<typeof SafetyCaseConsolePageInfoSchema>;

export const SafetyCaseConsoleUrgentEntrySchema = z.discriminatedUnion('scope', [
  z
    .object({
      scope: z.literal('case'),
      caseId: z.string().min(1),
      lane: SafetyCaseLaneSchema,
      monitors: z.array(SafetySlaMonitorV1Schema),
    })
    .strict(),
  z
    .object({
      scope: z.literal('request'),
      requestId: takeItDownRequestIdSchema,
      monitors: z.array(SafetySlaMonitorV1Schema),
    })
    .strict(),
]);
export type SafetyCaseConsoleUrgentEntry = z.infer<typeof SafetyCaseConsoleUrgentEntrySchema>;

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

export const SafetyCaseConsoleRowChangeSchema = z.discriminatedUnion('source', [
  z
    .object({
      source: z.literal('childSafety'),
      caseId: safetyCaseIdSchema,
      row: ChildSafetyCaseConsoleRowSchema.nullable(),
    })
    .strict(),
  z
    .object({
      source: z.literal('ncii'),
      caseId: safetyCaseIdSchema,
      row: NciiCaseConsoleRowSchema.nullable(),
    })
    .strict(),
  z
    .object({
      source: z.literal('takeItDown'),
      requestId: takeItDownRequestIdSchema,
      row: TakeItDownRequestConsoleRowSchema.nullable(),
    })
    .strict(),
]);
export type SafetyCaseConsoleRowChange = z.infer<typeof SafetyCaseConsoleRowChangeSchema>;

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

export const DecideTakeItDownValidityResultSchema = z.object({
  success: z.literal(true),
  result: z.enum(['valid', 'invalid', 'unableToLocate']),
  validRequestReceivedAt: z.number().optional(),
  removalDeadlineAt: z.number().optional(),
  caseId: z.string().min(1).optional(),
  alreadyDecided: z.boolean(),
  console: SafetyCaseConsolePatchSchema.optional(),
});
export type DecideTakeItDownValidityResult = z.infer<typeof DecideTakeItDownValidityResultSchema>;

export const SetNciiMinorAssessmentResultSchema = z.object({
  ok: z.literal(true),
  caseId: z.string().min(1),
  from: NciiMinorAssessmentSchema,
  to: NciiMinorAssessmentSchema,
  childSafetyCaseId: z.string().min(1).optional(),
  servingDenied: z.boolean(),
  console: SafetyCaseConsolePatchSchema.optional(),
});
export type SetNciiMinorAssessmentResult = z.infer<typeof SetNciiMinorAssessmentResultSchema>;

export const MarkNcmecPortalCompleteResultSchema = z.object({
  success: z.literal(true),
  state: z.literal('completed'),
  alreadyCompleted: z.boolean(),
  console: SafetyCaseConsolePatchSchema.optional(),
});
export type MarkNcmecPortalCompleteResult = z.infer<typeof MarkNcmecPortalCompleteResultSchema>;

export const ReopenSafetyCaseResultSchema = z.object({
  success: z.literal(true),
  reopened: z.boolean(),
  console: SafetyCaseConsolePatchSchema.optional(),
});
export type ReopenSafetyCaseResult = z.infer<typeof ReopenSafetyCaseResultSchema>;

export const SAFETY_CASE_REPLAY_LANES = SafetyCaseFailedJobRefSchema.shape.collection.options;

const replayOutcomeShape = {
  replayed: z.literal(true).optional(),
  resetTo: z.string().optional(),
  dryRun: z.literal(true).optional(),
  currentStatus: z.unknown().optional(),
  wouldResetTo: z.string().optional(),
  console: SafetyCaseConsolePatchSchema.optional(),
};

// Declared here: this module already imports ./admin.js, so the reverse import would be a cycle.
export const AdminReplayDeadLetterResultSchema = z
  .discriminatedUnion('collection', [
    z.object({
      collection: FlatDeadLetterCollectionSchema,
      docId: z.string().min(1),
      ...replayOutcomeShape,
    }),
    z.object({
      collection: z.literal('hallSubItemEdgeSync'),
      ...HallSubItemEdgeSyncReplayTargetSchema.shape,
      ...replayOutcomeShape,
    }),
  ])
  .superRefine((answer, ctx) => {
    const safetyLane = (SAFETY_CASE_REPLAY_LANES as readonly string[]).includes(answer.collection);
    const performed = answer.replayed === true && answer.dryRun !== true;
    if (answer.console !== undefined && !(safetyLane && performed)) {
      ctx.addIssue({ code: 'custom', path: ['console'] });
    }
  });
export type AdminReplayDeadLetterResult = z.infer<typeof AdminReplayDeadLetterResultSchema>;

export const GetSafetyCaseByIdInputSchema = z
  .object({
    caseType: SafetyCaseLaneSchema,
    caseId: safetyCaseIdSchema,
  })
  .strict();
export type GetSafetyCaseByIdInput = z.infer<typeof GetSafetyCaseByIdInputSchema>;

const SafetyCaseByIdFields = {
  caseId: safetyCaseIdSchema,
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
  closureHistory: z.array(
    SafetyCaseClosureV1Schema.extend({ eventId: z.string().min(1) }).strict(),
  ),
};

export const SafetyCaseByIdResultSchema = z.discriminatedUnion('caseType', [
  z
    .object({
      ...SafetyCaseByIdFields,
      caseType: z.literal(SafetyCaseLaneSchema.enum.csam),
      status: ChildSafetyWorkStatusSchema,
    })
    .strict(),
  z
    .object({
      ...SafetyCaseByIdFields,
      caseType: z.literal(SafetyCaseLaneSchema.enum.ncii),
      status: NciiInternalStatusSchema,
    })
    .strict(),
]);
export type SafetyCaseByIdResult = z.infer<typeof SafetyCaseByIdResultSchema>;

export const GetSafetyCasePartiesInputSchema = z
  .object({
    caseType: SafetyCaseLaneSchema,
    caseId: safetyCaseIdSchema,
  })
  .strict();
export type GetSafetyCasePartiesInput = z.infer<typeof GetSafetyCasePartiesInputSchema>;

export const SafetyPartyRoleSchema = z.enum([
  'uploader',
  'requester',
  'distributor',
  'questionable',
]);
export type SafetyPartyRole = z.infer<typeof SafetyPartyRoleSchema>;

export const SafetyCasePartySchema = z.object({
  uid: userIdSchema,
  label: z.string(),
  suggestedRole: SafetyPartyRoleSchema,
  accountStatus: z.string().optional(),
});
export type SafetyCaseParty = z.infer<typeof SafetyCasePartySchema>;

export const GetSafetyCasePartiesResultSchema = z.object({
  parties: z.array(SafetyCasePartySchema),
});
export type GetSafetyCasePartiesResult = z.infer<typeof GetSafetyCasePartiesResultSchema>;

export const GetTakeItDownRequestDetailInputSchema = z
  .object({
    requestId: takeItDownRequestIdSchema,
  })
  .strict();
export type GetTakeItDownRequestDetailInput = z.infer<typeof GetTakeItDownRequestDetailInputSchema>;

const requesterPrivate = TakeItDownRequesterPrivateV1Schema.shape;
const authorizedRepresentative = TakeItDownAuthorizedRepresentativeV1Schema.shape;

export const TakeItDownReviewPacketSchema = z
  .object({
    requesterName: requesterPrivate.requesterName,
    contactEmail: requesterPrivate.contactEmail,
    contactPhone: requesterPrivate.contactPhone,
    electronicSignature: requesterPrivate.electronicSignature,
    nonconsentStatement: requesterPrivate.nonconsentStatement,
    supportingFacts: requesterPrivate.supportingFacts,
    goodFaithCertification: requesterPrivate.goodFaithCertification,
    accuracyCertification: requesterPrivate.accuracyCertification,
    targetLocator: TargetLocatorV1Schema.optional(),
    authorizedRepresentative: z
      .object({
        representedPersonName: authorizedRepresentative.representedPersonName,
        authorityBasis: authorizedRepresentative.authorityBasis,
        authorityCertification: authorizedRepresentative.authorityCertification,
        hasAuthorityEvidence: z.boolean(),
        authorityProofScanStatus: AuthorityProofScanStatusSchema.optional(),
      })
      .strict()
      .optional(),
    firstSubmission: TakeItDownSubmissionV1Schema.pick({
      receivedAt: true,
      suppliedFieldCodes: true,
    })
      .strict()
      .nullable(),
    evidenceCount: z.number().int().nonnegative(),
  })
  .strict();
export type TakeItDownReviewPacket = z.infer<typeof TakeItDownReviewPacketSchema>;

export function takeItDownReviewPacketExposedFieldCodes(
  packet: TakeItDownReviewPacket,
): TakeItDownFieldCode[] {
  const filled = (s: string | undefined) => typeof s === 'string' && s.trim().length > 0;
  const codes: TakeItDownFieldCode[] = [];
  if (filled(packet.requesterName)) codes.push('requesterName');
  if (filled(packet.contactEmail)) codes.push('contactEmail');
  if (filled(packet.contactPhone)) codes.push('contactPhone');
  if (filled(packet.electronicSignature.signedName)) codes.push('electronicSignature');
  if (filled(packet.nonconsentStatement)) codes.push('nonconsentStatement');
  if (filled(packet.supportingFacts)) codes.push('supportingFacts');
  codes.push('goodFaithCertification');
  if (packet.targetLocator) codes.push('targetLocator');
  const rep = packet.authorizedRepresentative;
  if (rep) {
    if (filled(rep.authorityBasis)) codes.push('authorityBasis');
    codes.push('authorityCertification');
    if (rep.hasAuthorityEvidence) codes.push('authorityEvidence');
  }
  return codes;
}

export const GetTakeItDownRequestDetailResultSchema = z
  .object({
    requestId: takeItDownRequestIdSchema,
    caseId: safetyCaseIdSchema.optional(),
    requesterRole: TakeItDownRequestRootV1Schema.shape.requesterRole,
    targetLocatorSummary: TakeItDownRequestRootV1Schema.shape.targetLocatorSummary,
    completenessStatus: TakeItDownRequestRootV1Schema.shape.completenessStatus,
    validityStatus: TakeItDownRequestRootV1Schema.shape.validityStatus,
    publicStatus: TakeItDownRequestRootV1Schema.shape.publicStatus,
    packet: TakeItDownReviewPacketSchema.nullable(),
  })
  .strict();
export type GetTakeItDownRequestDetailResult = z.infer<
  typeof GetTakeItDownRequestDetailResultSchema
>;

const createdAtCursorSchema = () =>
  z.object({ createdAt: z.number(), id: documentIdSegmentSchema }).strict();

const RETENTION_LIST_MAX_PAGE_SIZE = 200;

export const RetainedEvidenceInventoryCursorSchema = createdAtCursorSchema();
export type RetainedEvidenceInventoryCursor = z.infer<typeof RetainedEvidenceInventoryCursorSchema>;

export const ListRetainedEvidenceInventoryInputSchema = z
  .object({
    pageSize: z.number().int().min(1).max(RETENTION_LIST_MAX_PAGE_SIZE).optional(),
    cursor: RetainedEvidenceInventoryCursorSchema.nullish(),
    exactId: documentIdSegmentSchema.optional(),
  })
  .strict()
  .nullish();
export type ListRetainedEvidenceInventoryInput = z.infer<
  typeof ListRetainedEvidenceInventoryInputSchema
>;

export const ListRetainedEvidenceInventoryResultSchema = z
  .object({
    rows: z.array(NciiRetainedEvidenceInventoryV1Schema),
    nextCursor: RetainedEvidenceInventoryCursorSchema.nullable(),
    total: z.number().int().nonnegative(),
  })
  .strict();
export type ListRetainedEvidenceInventoryResult = z.infer<
  typeof ListRetainedEvidenceInventoryResultSchema
>;

export const CHILD_SAFETY_RETAINED_PRESERVATION_STATUSES =
  ChildSafetyPreservationStatusSchema.exclude(['destroyed']).options;

export const RetainedChildSafetyCaseCursorSchema = createdAtCursorSchema();
export type RetainedChildSafetyCaseCursor = z.infer<typeof RetainedChildSafetyCaseCursorSchema>;

export const ListRetainedChildSafetyCasesInputSchema = z
  .object({
    pageSize: z.number().int().min(1).max(RETENTION_LIST_MAX_PAGE_SIZE).optional(),
    cursor: RetainedChildSafetyCaseCursorSchema.nullish(),
    exactId: documentIdSegmentSchema.optional(),
  })
  .strict()
  .nullish();
export type ListRetainedChildSafetyCasesInput = z.infer<
  typeof ListRetainedChildSafetyCasesInputSchema
>;

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
    nextCursor: RetainedChildSafetyCaseCursorSchema.nullable(),
    total: z.number().int().nonnegative(),
  })
  .strict();
export type ListRetainedChildSafetyCasesResult = z.infer<
  typeof ListRetainedChildSafetyCasesResultSchema
>;

export const ncmecReportNumberSchema = unpaddedValueSchema.max(MAX_NCMEC_REPORT_NUMBER_LENGTH);

export const evidenceVaultKeySchema = unpaddedValueSchema.max(MAX_EVIDENCE_VAULT_KEY_LENGTH);

export const RecordNcmecPortalReceiptArtifactInputSchema = z
  .object({
    caseId: safetyCaseIdSchema,
    submissionId: documentIdSegmentSchema,
    evidenceVaultKey: evidenceVaultKeySchema,
    description: textFieldSchema(NCMEC_ARTIFACT_DESCRIPTION_INPUT).optional(),
    confirmation: z.literal(NCMEC_PORTAL_RECEIPT_CONFIRMATION),
  })
  .strict();
export type RecordNcmecPortalReceiptArtifactInput = z.infer<
  typeof RecordNcmecPortalReceiptArtifactInputSchema
>;

export const RecordNcmecPortalReceiptArtifactResultSchema = z.object({
  success: z.literal(true),
  artifactId: z.string().min(1),
  objectGeneration: z.string().min(1),
  sha256: z.string().min(1),
});
export type RecordNcmecPortalReceiptArtifactResult = z.infer<
  typeof RecordNcmecPortalReceiptArtifactResultSchema
>;

export const MarkNcmecPortalCompleteInputSchema = z
  .object({
    caseId: safetyCaseIdSchema,
    submissionId: documentIdSegmentSchema,
    artifactId: documentIdSegmentSchema,
    artifactObjectGeneration: z.string().min(1, 'The artifact object generation is required.'),
    artifactSha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/, 'artifactSha256 must be a 64-character hex string.'),
    proofText: textFieldSchema(NCMEC_PORTAL_PROOF_TEXT_INPUT).optional(),
    ncmecReportId: ncmecReportNumberSchema,
    confirmation: z.literal(NCMEC_MANUAL_PORTAL_FILED_CONFIRMATION),
  })
  .strict();
export type MarkNcmecPortalCompleteInput = z.infer<typeof MarkNcmecPortalCompleteInputSchema>;

export const OperatorStepUpCodeInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(
        new RegExp(`^\\d{${OPERATOR_STEP_UP_CODE_LENGTH}}$`, 'u'),
        `Enter the ${OPERATOR_STEP_UP_CODE_LENGTH}-digit code.`,
      ),
  })
  .strict();
export type OperatorStepUpCodeInput = z.infer<typeof OperatorStepUpCodeInputSchema>;

const operatorStepUpRecoveryCodeSchema = z
  .string()
  .transform((code) => code.toUpperCase().replace(/[\s-]/gu, ''))
  .pipe(
    z
      .string()
      .length(OPERATOR_STEP_UP_RECOVERY_CODE_LENGTH, 'Enter the whole recovery code.')
      .regex(/^[0-9A-HJKMNP-TV-Z]+$/u, 'That is not a recovery code.'),
  );

export const EnrollOperatorStepUpInputSchema = z.union([
  z.object({}).strict(),
  z.object({ currentCode: OperatorStepUpCodeInputSchema.shape.code }).strict(),
  z.object({ recoveryCode: operatorStepUpRecoveryCodeSchema }).strict(),
]);
export type EnrollOperatorStepUpInput = z.infer<typeof EnrollOperatorStepUpInputSchema>;

export const EnrollOperatorStepUpResultSchema = z.object({
  otpauthUri: z.string().min(1),
  secret: z.string().min(1),
});
export type EnrollOperatorStepUpResult = z.infer<typeof EnrollOperatorStepUpResultSchema>;

export const ConfirmOperatorStepUpResultSchema = z.object({
  success: z.literal(true),
  recoveryCodes: z.array(z.string()).length(OPERATOR_STEP_UP_RECOVERY_CODE_COUNT),
});
export type ConfirmOperatorStepUpResult = z.infer<typeof ConfirmOperatorStepUpResultSchema>;

export const VerifyOperatorStepUpResultSchema = z.object({
  grantExpiresAt: z.number(),
});
export type VerifyOperatorStepUpResult = z.infer<typeof VerifyOperatorStepUpResultSchema>;

export const RegenerateOperatorStepUpRecoveryCodesInputSchema = OperatorStepUpCodeInputSchema;
export type RegenerateOperatorStepUpRecoveryCodesInput = z.infer<
  typeof RegenerateOperatorStepUpRecoveryCodesInputSchema
>;

export const RegenerateOperatorStepUpRecoveryCodesResultSchema = z.object({
  recoveryCodes: z.array(z.string()).length(OPERATOR_STEP_UP_RECOVERY_CODE_COUNT),
});
export type RegenerateOperatorStepUpRecoveryCodesResult = z.infer<
  typeof RegenerateOperatorStepUpRecoveryCodesResultSchema
>;

export const RevealCaseEvidenceInputSchema = z
  .object({
    caseId: safetyCaseIdSchema,
    confirmation: z.literal(REVEAL_CASE_EVIDENCE_CONFIRMATION),
    warningAcknowledged: z.literal(true),
  })
  .strict();
export type RevealCaseEvidenceInput = z.infer<typeof RevealCaseEvidenceInputSchema>;

export const RevealedEvidenceMetadataSchema = z.object({
  manifestId: z.string().min(1),
  sourceKind: SafetyEvidenceManifestV1Schema.shape.sourceKind,
  original: z
    .object({ contentType: z.string(), sizeBytes: z.number(), sha256: z.string(), md5: z.string() })
    .optional(),
  variants: z
    .array(z.object({ variantKey: z.string(), sha256: z.string(), sizeBytes: z.number() }))
    .optional(),
  detectorSource: z.string().optional(),
});
export type RevealedEvidenceMetadata = z.infer<typeof RevealedEvidenceMetadataSchema>;

export const RevealCaseEvidenceResultSchema = z.object({
  success: z.literal(true),
  caseId: safetyCaseIdSchema,
  metadata: RevealedEvidenceMetadataSchema,
  expiresAt: z.number(),
  noStore: z.literal(true),
});
export type RevealCaseEvidenceResult = z.infer<typeof RevealCaseEvidenceResultSchema>;

export const RecordNcmecPortalCorrectionInputSchema = z
  .object({
    caseId: safetyCaseIdSchema,
    ncmecReportId: ncmecReportNumberSchema,
    correctionFiledAt: z.number(),
    reason: textFieldSchema(NCMEC_CORRECTION_REASON_INPUT),
    confirmation: z.literal(NCMEC_PORTAL_CORRECTION_CONFIRMATION),
  })
  .strict();
export type RecordNcmecPortalCorrectionInput = z.infer<
  typeof RecordNcmecPortalCorrectionInputSchema
>;

export const RecordNcmecPortalCorrectionResultSchema = z.object({
  success: z.literal(true),
  caseId: z.string().min(1),
  correctionId: z.string().min(1),
});
export type RecordNcmecPortalCorrectionResult = z.infer<
  typeof RecordNcmecPortalCorrectionResultSchema
>;

export const reportCommentFieldSchema = textFieldSchema(REPORT_COMMENT_INPUT);
export const adminTaskResolutionFieldSchema = textFieldSchema(ADMIN_TASK_RESOLUTION_INPUT);

export const SubmitReportInputSchema = z
  .object({
    itemType: ReportableItemTypeSchema,
    reportedItemId: reportTargetItemIdSchema,
    parentItemId: reportTargetParentRefSchema.optional(),
    reportedUserId: reportTargetUserIdSchema.optional(),
    reason: ReportReasonSchema,
    comment: reportCommentFieldSchema,
    narrative: textFieldSchema(REPORT_NARRATIVE_INPUT).optional(),
    confirmUpgrade: z.boolean().optional(),
  })
  .strict();
export type SubmitReportInput = z.infer<typeof SubmitReportInputSchema>;
