import { z } from 'zod';
import { MediaOriginLineageV1Schema } from '../media-assets.js';

export const MAX_MANIFEST_VARIANTS = 64;
export const MAX_MANIFEST_PROVENANCE_REFS = 64;
export const MAX_MANIFEST_NCMEC_RECEIPTS = 32;
export const MAX_COMMUNICATION_ATTACHMENTS = 256;

export const SafetyEvidenceSourceKindSchema = z.enum(['media', 'communication', 'externalFact']);
export type SafetyEvidenceSourceKind = z.infer<typeof SafetyEvidenceSourceKindSchema>;

export const SafetyEvidenceOriginalV1Schema = z
  .object({
    bucket: z.string().min(1),
    key: z.string().min(1),
    generation: z.string().min(1),
    contentType: z.string().min(1),
    filename: z.string().min(1).optional(),
    sizeBytes: z.number(),
    md5: z.string().min(1),
    sha256: z.string().min(1),
    capturedAt: z.number(),
  })
  .strict();
export type SafetyEvidenceOriginalV1 = z.infer<typeof SafetyEvidenceOriginalV1Schema>;

export const SafetyEvidenceVariantV1Schema = z
  .object({
    variantKey: z.string().min(1),
    sha256: z.string().min(1),
    sizeBytes: z.number(),
  })
  .strict();
export type SafetyEvidenceVariantV1 = z.infer<typeof SafetyEvidenceVariantV1Schema>;

export const SafetyEvidenceCommunicationV1Schema = z
  .object({
    channelId: z.string().min(1),
    messageSeqStart: z.number(),
    messageSeqEnd: z.number(),
    transcriptObjectRef: z.string().min(1),
    attachmentItemIds: z.array(z.string().min(1)).max(MAX_COMMUNICATION_ATTACHMENTS),
  })
  .strict();
export type SafetyEvidenceCommunicationV1 = z.infer<typeof SafetyEvidenceCommunicationV1Schema>;

export const SafetyEvidenceExternalFactKindSchema = z.enum([
  'lawEnforcement',
  'thirdPartyReport',
  'operatorKnowledge',
  'other',
]);
export type SafetyEvidenceExternalFactKind = z.infer<typeof SafetyEvidenceExternalFactKindSchema>;

export const SafetyEvidenceExternalFactV1Schema = z
  .object({
    factKind: SafetyEvidenceExternalFactKindSchema,
    narrativeRef: z.string().min(1),
    establishedActualKnowledgeAt: z.number().optional(),
    sourceContactRef: z.string().min(1).optional(),
  })
  .strict();
export type SafetyEvidenceExternalFactV1 = z.infer<typeof SafetyEvidenceExternalFactV1Schema>;

export const SafetyEvidenceDetectorV1Schema = z
  .object({
    source: z.string().min(1),
    listId: z.string().min(1),
    sdkVersion: z.string().min(1),
    requestTraceId: z.string().min(1),
    matchResult: z.string().min(1),
  })
  .strict();
export type SafetyEvidenceDetectorV1 = z.infer<typeof SafetyEvidenceDetectorV1Schema>;

export const SafetyEvidenceCopyV1Schema = z
  .object({
    destinationBucket: z.string().min(1),
    destinationKey: z.string().min(1),
    keyVersion: z.string().min(1),
    verifyMethod: z.string().min(1),
    verifyResult: z.string().min(1),
  })
  .strict();
export type SafetyEvidenceCopyV1 = z.infer<typeof SafetyEvidenceCopyV1Schema>;

export const SafetyEvidenceReporterV1Schema = z
  .object({
    reporterUidRef: z.string().min(1),
    narrativeRef: z.string().min(1),
  })
  .strict();
export type SafetyEvidenceReporterV1 = z.infer<typeof SafetyEvidenceReporterV1Schema>;

export const SafetyEvidenceManifestV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    manifestId: z.string().min(1),
    caseId: z.string().min(1),
    createdAt: z.number(),
    sourceKind: SafetyEvidenceSourceKindSchema,
    original: SafetyEvidenceOriginalV1Schema.optional(),
    variants: z.array(SafetyEvidenceVariantV1Schema).max(MAX_MANIFEST_VARIANTS).optional(),
    lineage: MediaOriginLineageV1Schema.optional(),
    communication: SafetyEvidenceCommunicationV1Schema.optional(),
    externalFact: SafetyEvidenceExternalFactV1Schema.optional(),
    subjectAccountsRef: z.string().min(1),
    provenanceRefs: z.array(z.string().min(1)).max(MAX_MANIFEST_PROVENANCE_REFS),
    contentDocSnapshotRef: z.string().min(1).optional(),
    contentDocRevision: z.number().optional(),
    detector: SafetyEvidenceDetectorV1Schema.optional(),
    evidenceCopy: SafetyEvidenceCopyV1Schema.optional(),
    reporter: SafetyEvidenceReporterV1Schema.optional(),
    ncmecReceiptRefs: z.array(z.string().min(1)).max(MAX_MANIFEST_NCMEC_RECEIPTS),
  })
  .strict()
  .superRefine((val, ctx) => {
    const present = (field: string) =>
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: `${field} is only allowed when sourceKind matches`,
      });
    const missing = (field: string) =>
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: `${field} is required for this sourceKind`,
      });

    if (val.sourceKind === 'media') {
      if (val.original === undefined) missing('original');
      if (val.lineage === undefined) missing('lineage');
      if (val.communication !== undefined) present('communication');
      if (val.externalFact !== undefined) present('externalFact');
    } else if (val.sourceKind === 'communication') {
      if (val.communication === undefined) missing('communication');
      if (val.original !== undefined) present('original');
      if (val.variants !== undefined) present('variants');
      if (val.lineage !== undefined) present('lineage');
      if (val.evidenceCopy !== undefined) present('evidenceCopy');
      if (val.externalFact !== undefined) present('externalFact');
    } else {
      if (val.externalFact === undefined) missing('externalFact');
      if (val.original !== undefined) present('original');
      if (val.variants !== undefined) present('variants');
      if (val.lineage !== undefined) present('lineage');
      if (val.evidenceCopy !== undefined) present('evidenceCopy');
      if (val.communication !== undefined) present('communication');
    }
  });
export type SafetyEvidenceManifestV1 = z.infer<typeof SafetyEvidenceManifestV1Schema>;

export const SafetyEvidenceJobPhaseSchema = z.enum(['capture', 'verify', 'disposition']);
export type SafetyEvidenceJobPhase = z.infer<typeof SafetyEvidenceJobPhaseSchema>;

export const SafetyEvidenceJobStatusSchema = z.enum([
  'pending',
  'running',
  'verified',
  'disposed',
  'deadLetter',
]);
export type SafetyEvidenceJobStatus = z.infer<typeof SafetyEvidenceJobStatusSchema>;

export const SafetyEvidenceJobV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: z.string().min(1),
    caseId: z.string().min(1),
    phase: SafetyEvidenceJobPhaseSchema,
    commandId: z.string().min(1),
    status: SafetyEvidenceJobStatusSchema,
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    leaseOwner: z.string().min(1).optional(),
    leaseExpiresAt: z.number().optional(),
    lastErrorCode: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    completedAt: z.number().optional(),
    disposedAt: z.number().optional(),
    deadLetterAt: z.number().optional(),
  })
  .strict();
export type SafetyEvidenceJobV1 = z.infer<typeof SafetyEvidenceJobV1Schema>;

export const SafetyEvidenceJobItemRoleSchema = z.enum(['source', 'destination']);
export type SafetyEvidenceJobItemRole = z.infer<typeof SafetyEvidenceJobItemRoleSchema>;

export const SafetyEvidenceJobItemVerifyResultSchema = z.enum(['pending', 'ok', 'mismatch']);
export type SafetyEvidenceJobItemVerifyResult = z.infer<
  typeof SafetyEvidenceJobItemVerifyResultSchema
>;

export const SafetyEvidenceJobItemV1Schema = z
  .object({
    role: SafetyEvidenceJobItemRoleSchema,
    bucket: z.string().min(1),
    key: z.string().min(1),
    generation: z.string().min(1).optional(),
    sizeBytes: z.number(),
    sha256: z.string().min(1),
    md5: z.string().min(1).optional(),
    verifyResult: SafetyEvidenceJobItemVerifyResultSchema,
  })
  .strict();
export type SafetyEvidenceJobItemV1 = z.infer<typeof SafetyEvidenceJobItemV1Schema>;

export const SafetyEvidenceCaptureRequestV1Schema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('media'),
      sourceBucket: z.string().min(1),
      sourceKey: z.string().min(1),
      lineage: MediaOriginLineageV1Schema,
      variants: z.array(SafetyEvidenceVariantV1Schema).max(MAX_MANIFEST_VARIANTS).optional(),
      detector: SafetyEvidenceDetectorV1Schema.optional(),
      contentDocSnapshotRef: z.string().min(1).optional(),
      contentDocRevision: z.number().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('communication'),
      communication: SafetyEvidenceCommunicationV1Schema,
      contentDocSnapshotRef: z.string().min(1).optional(),
      contentDocRevision: z.number().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('externalFact'),
      externalFact: SafetyEvidenceExternalFactV1Schema,
      contentDocSnapshotRef: z.string().min(1).optional(),
      contentDocRevision: z.number().optional(),
    })
    .strict(),
]);
export type SafetyEvidenceCaptureRequestV1 = z.infer<typeof SafetyEvidenceCaptureRequestV1Schema>;

export const SafetyEvidenceCaptureRequestKindSchema = z.enum([
  'media',
  'communication',
  'externalFact',
]);
export type SafetyEvidenceCaptureRequestKind = z.infer<
  typeof SafetyEvidenceCaptureRequestKindSchema
>;

export const SafetyEvidenceJobCaptureControlV1Schema = z
  .object({
    role: z.literal('control'),
    sourceDiscriminator: z.string().min(1),
    request: SafetyEvidenceCaptureRequestV1Schema,
    provenanceRefs: z.array(z.string().min(1)).max(MAX_MANIFEST_PROVENANCE_REFS),
  })
  .strict();
export type SafetyEvidenceJobCaptureControlV1 = z.infer<
  typeof SafetyEvidenceJobCaptureControlV1Schema
>;

export const SafetyEvidenceJobVerifyControlV1Schema = z
  .object({
    role: z.literal('control'),
    sourceDiscriminator: z.string().min(1),
    captureJobId: z.string().min(1),
    requestKind: SafetyEvidenceCaptureRequestKindSchema,
  })
  .strict();
export type SafetyEvidenceJobVerifyControlV1 = z.infer<
  typeof SafetyEvidenceJobVerifyControlV1Schema
>;

export const SafetyEvidenceJobItemDocV1Schema = z.union([
  SafetyEvidenceJobItemV1Schema,
  SafetyEvidenceJobCaptureControlV1Schema,
  SafetyEvidenceJobVerifyControlV1Schema,
]);
export type SafetyEvidenceJobItemDocV1 = z.infer<typeof SafetyEvidenceJobItemDocV1Schema>;

export const SafetyEvidenceDispositionMethodSchema = z.enum(['delete', 'cryptoErase']);
export type SafetyEvidenceDispositionMethod = z.infer<typeof SafetyEvidenceDispositionMethodSchema>;

export const SafetyEvidenceDispositionResultSchema = z.enum(['gone', 'leftover']);
export type SafetyEvidenceDispositionResult = z.infer<typeof SafetyEvidenceDispositionResultSchema>;

export const SafetyEvidenceDispositionV1Schema = z
  .object({
    bucket: z.string().min(1),
    key: z.string().min(1),
    generation: z.string().min(1).optional(),
    method: SafetyEvidenceDispositionMethodSchema,
    verifiedAt: z.number(),
    result: SafetyEvidenceDispositionResultSchema,
    leftoverDetail: z.string().min(1).optional(),
  })
  .strict();
export type SafetyEvidenceDispositionV1 = z.infer<typeof SafetyEvidenceDispositionV1Schema>;
