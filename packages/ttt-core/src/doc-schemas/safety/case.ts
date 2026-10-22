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

export const ChildSafetySignalKindSchema = z.enum([
  'hashMatch',
  'report',
  'aiFlag',
  'manual',
  'copyMatch',
]);
export type ChildSafetySignalKind = z.infer<typeof ChildSafetySignalKindSchema>;

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

export const ChildSafetyPreservationStatusSchema = z.enum([
  'preReportHold',
  'statutoryHold',
  'extendedHold',
  'dispositionPending',
  'destroyed',
]);
export type ChildSafetyPreservationStatus = z.infer<typeof ChildSafetyPreservationStatusSchema>;

export const ChildSafetyAccountActionStatusSchema = z.enum([
  'noAccountActionRequired',
  'operatorDecisionPending',
  'pending',
  'resolved',
]);
export type ChildSafetyAccountActionStatus = z.infer<typeof ChildSafetyAccountActionStatusSchema>;

export const ChildSafetyReportStateSchema = z.enum([
  'reportAsSoonAsReasonablyPossible',
  'submissionInProgress',
  'completed',
]);
export type ChildSafetyReportState = z.infer<typeof ChildSafetyReportStateSchema>;

export const ChildSafetyDecisionKindSchema = z.enum([
  'workStatus',
  'accountAction',
  'reportDisposition',
  'reasonUpdate',
  'caseClosed',
]);
export type ChildSafetyDecisionKind = z.infer<typeof ChildSafetyDecisionKindSchema>;

export const ChildSafetyAccountRoleSchema = z.enum([
  'uploader',
  'requester',
  'distributor',
  'questionable',
]);
export type ChildSafetyAccountRole = z.infer<typeof ChildSafetyAccountRoleSchema>;

export const ChildSafetyAccountSubjectDispositionSchema = z.enum([
  'subject',
  'questionable',
  'excluded',
]);
export type ChildSafetyAccountSubjectDisposition = z.infer<
  typeof ChildSafetyAccountSubjectDispositionSchema
>;

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

export const ChildSafetyNcmecSubmissionKindSchema = z.enum([
  'initial',
  'supplemental',
  'correction',
]);
export type ChildSafetyNcmecSubmissionKind = z.infer<typeof ChildSafetyNcmecSubmissionKindSchema>;

export const ChildSafetyNcmecCompletionChannelSchema = z.enum(['manualPortal']);
export type ChildSafetyNcmecCompletionChannel = z.infer<
  typeof ChildSafetyNcmecCompletionChannelSchema
>;

export const ChildSafetyNcmecCompletionProofTypeSchema = z.enum(['portalConfirmation']);
export type ChildSafetyNcmecCompletionProofType = z.infer<
  typeof ChildSafetyNcmecCompletionProofTypeSchema
>;

export const ChildSafetyNcmecFileInfoStateSchema = z.enum(['pending', 'sent', 'ack']);
export type ChildSafetyNcmecFileInfoState = z.infer<typeof ChildSafetyNcmecFileInfoStateSchema>;

export const ChildSafetyLegalProcessKindSchema = z.enum([
  'leWatch',
  'leDataRequest',
  'leShutdown',
  'leDestruction',
  'disclosure',
]);
export type ChildSafetyLegalProcessKind = z.infer<typeof ChildSafetyLegalProcessKindSchema>;

export const ChildSafetySourceSignalSummarySchema = z
  .object({
    count: z.number(),
    latestKind: ChildSafetySignalKindSchema,
    latestAt: z.number(),
  })
  .strict();
export type ChildSafetySourceSignalSummary = z.infer<typeof ChildSafetySourceSignalSummarySchema>;

export const ChildSafetyCaseListV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    revision: z.number(),
    canonicalIncidentKey: z.string(),
    incidentClass: ChildSafetyIncidentClassSchema,
    sourceSignalSummary: ChildSafetySourceSignalSummarySchema,
    workStatus: ChildSafetyWorkStatusSchema,
    preservationStatus: ChildSafetyPreservationStatusSchema,
    ncmecStatus: NcmecSubmissionStateSchema,
    accountActionStatus: ChildSafetyAccountActionStatusSchema,
    reportDisposition: ReportDispositionSchema,
    actualKnowledgeAt: z.number().optional(),
    reportState: ChildSafetyReportStateSchema.optional(),
    submissionCompletedAt: z.number().optional(),
    preserveUntil: z.number().optional(),
    openHoldCount: z.number(),
    relatedCaseIds: z.array(z.string().min(1)).optional(),
    contextResolutionPending: z.boolean().optional(),
    testListDrill: z.literal(true).optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict();
export type ChildSafetyCaseListV1 = z.infer<typeof ChildSafetyCaseListV1Schema>;

export const ChildSafetyCaseV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    evidenceManifestId: z.string().min(1),
    currentReasonInternal: z.string(),
    leaseOwner: z.string().min(1).optional(),
    leaseExpiresAt: z.number().optional(),
    fencingOwnerToken: z.string().min(1).optional(),
    fencingGeneration: z.number().optional(),
    chatMessageLocator: TargetLocatorV1Schema.optional(),
    contextResolutionPending: z.boolean().optional(),
    crossoverLegs: z
      .object({
        servingDeny: SafetyCrossoverLegStatusSchema.optional(),
        photoDna: SafetyCrossoverLegStatusSchema.optional(),
        itemsCursor: SweepRollingCursorSchema.optional(),
      })
      .strict()
      .superRefine((legs, ctx) => {
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
      })
      .optional(),
  })
  .strict();
export type ChildSafetyCaseV1 = z.infer<typeof ChildSafetyCaseV1Schema>;

export function isCrossoverItemRegistrationDone(
  itemsCursor: SweepRollingCursor | undefined,
): boolean {
  return itemsCursor?.state === 'done';
}

export function rollupCrossoverLegStatus(
  statuses: readonly (SafetyCrossoverLegStatus | undefined)[],
  itemsCursor: SweepRollingCursor | undefined,
): SafetyCrossoverLegStatus | undefined {
  const present = statuses.filter(
    (status): status is SafetyCrossoverLegStatus => status !== undefined,
  );
  if (present.includes('failed')) return 'failed';
  if (!isCrossoverItemRegistrationDone(itemsCursor)) return 'pending';
  if (present.includes('pending')) return 'pending';
  if (present.includes('done')) return 'done';
  return undefined;
}

export const ChildSafetyCrossoverItemV1Schema = z
  .object({
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
  })
  .strict()
  .superRefine((item, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const legs = [
      {
        status: item.servingDeny,
        doneAt: 'servingDeniedAt',
        failedAt: 'servingDenyFailedAt',
        lastError: 'servingDenyLastError',
      },
      {
        status: item.photoDna,
        doneAt: 'photoDnaScannedAt',
        failedAt: 'photoDnaFailedAt',
        lastError: 'photoDnaLastError',
      },
    ] as const;
    for (const leg of legs) {
      const doneAt = item[leg.doneAt];
      const failedAt = item[leg.failedAt];
      const lastError = item[leg.lastError];
      if (leg.status === undefined) {
        if (doneAt !== undefined)
          issue(leg.doneAt, 'a leg that never applied has no completion stamp');
        if (failedAt !== undefined)
          issue(leg.failedAt, 'a leg that never applied has no failure stamp');
        if (lastError !== undefined) issue(leg.lastError, 'a leg that never applied has no error');
        continue;
      }
      if (leg.status === 'done' && doneAt === undefined)
        issue(leg.doneAt, 'a done leg carries its completion stamp');
      if (leg.status !== 'done' && doneAt !== undefined)
        issue(leg.doneAt, 'only a done leg carries a completion stamp');
      if (leg.status === 'failed' && failedAt === undefined)
        issue(leg.failedAt, 'a failed leg carries its failure stamp');
      if (leg.status === 'pending' && failedAt !== undefined)
        issue(leg.failedAt, 'a pending leg has not failed');
      if (lastError !== undefined && failedAt === undefined)
        issue(leg.lastError, 'an error accompanies a failure stamp');
    }
  });
export type ChildSafetyCrossoverItemV1 = z.infer<typeof ChildSafetyCrossoverItemV1Schema>;

export const ChildSafetySourceSignalV1Schema = z
  .object({
    at: z.number(),
    kind: ChildSafetySignalKindSchema,
    detector: z.string().min(1).optional(),
    sourceRef: z.string(),
    actorId: z.string().min(1).optional(),
  })
  .strict();
export type ChildSafetySourceSignalV1 = z.infer<typeof ChildSafetySourceSignalV1Schema>;

export const ChildSafetyDecisionV1Schema = z
  .object({
    at: z.number(),
    actorId: z.string().min(1),
    kind: ChildSafetyDecisionKindSchema,
    from: z.string(),
    to: z.string(),
    reasonInternal: z.string(),
    reasonUserFacing: z.string().optional(),
    evidenceItemsViewedCount: z.number(),
    closure: SafetyCaseClosureV1Schema.optional(),
  })
  .strict();
export type ChildSafetyDecisionV1 = z.infer<typeof ChildSafetyDecisionV1Schema>;

export const ChildSafetyDecisionViewV1Schema = z
  .object({
    evidenceItemId: z.string().min(1),
    at: z.number(),
  })
  .strict();
export type ChildSafetyDecisionViewV1 = z.infer<typeof ChildSafetyDecisionViewV1Schema>;

export const ChildSafetyCaseAccountV1Schema = z
  .object({
    role: ChildSafetyAccountRoleSchema,
    subjectDisposition: ChildSafetyAccountSubjectDispositionSchema,
    platformAction: ChildSafetyAccountPlatformActionSchema,
    reasonUserFacing: z.string(),
    reasonInternal: z.string(),
    updatedAt: z.number(),
  })
  .strict();
export type ChildSafetyCaseAccountV1 = z.infer<typeof ChildSafetyCaseAccountV1Schema>;

export const ChildSafetyCaseAccountHistoryV1Schema = z
  .object({
    role: ChildSafetyAccountRoleSchema,
    subjectDisposition: ChildSafetyAccountSubjectDispositionSchema,
    platformAction: ChildSafetyAccountPlatformActionSchema,
    reasonUserFacing: z.string(),
    reasonInternal: z.string(),
    at: z.number(),
  })
  .strict();
export type ChildSafetyCaseAccountHistoryV1 = z.infer<typeof ChildSafetyCaseAccountHistoryV1Schema>;

export const ChildSafetyNcmecSubmissionV1Schema = z
  .object({
    kind: ChildSafetyNcmecSubmissionKindSchema,
    state: NcmecSubmissionStateSchema,
    completionChannel: ChildSafetyNcmecCompletionChannelSchema.optional(),
    submissionCompletedAt: z.number().optional(),
    completionProofType: ChildSafetyNcmecCompletionProofTypeSchema.optional(),
    completionProofRef: z.string().min(1).optional(),
    reportId: z.string().min(1).optional(),
    responseCode: z.number().optional(),
  })
  .strict();
export type ChildSafetyNcmecSubmissionV1 = z.infer<typeof ChildSafetyNcmecSubmissionV1Schema>;

export const ChildSafetyNcmecSubmissionFileV1Schema = z
  .object({
    localEvidenceItemId: z.string().min(1),
    ncmecFileId: z.string().min(1).optional(),
    md5: z.string().min(1).optional(),
    fileInfoState: ChildSafetyNcmecFileInfoStateSchema,
  })
  .strict();
export type ChildSafetyNcmecSubmissionFileV1 = z.infer<
  typeof ChildSafetyNcmecSubmissionFileV1Schema
>;

export const ChildSafetyLegalProcessEventV1Schema = z
  .object({
    at: z.number(),
    kind: ChildSafetyLegalProcessKindSchema,
    verifiedBy: z.string().min(1),
    instruction: z.string(),
    handedOver: z.boolean().optional(),
  })
  .strict();
export type ChildSafetyLegalProcessEventV1 = z.infer<typeof ChildSafetyLegalProcessEventV1Schema>;

const SetReportDispositionInputV1ObjectSchema = z
  .object({
    caseId: z.string().min(1),
    expectedRevision: z.number(),
    disposition: ReportDispositionSchema,
    dispositionReasonCode: ReportDispositionReasonCodeSchema,
    evidenceRefs: z.array(z.string().min(1)).max(MAX_MANIFEST_NCMEC_RECEIPTS),
  })
  .strict();
export const SetReportDispositionInputV1Schema =
  SetReportDispositionInputV1ObjectSchema.superRefine(
    refineReportDispositionReasonCode,
  ).superRefine(refineReportDispositionEvidenceRefs);
export type SetReportDispositionInputV1 = z.infer<typeof SetReportDispositionInputV1Schema>;

export const SetReportDispositionCallableInputSchema =
  SetReportDispositionInputV1ObjectSchema.extend({
    confirmation: z.literal(LEGAL_REPORTING_DISPOSITION_CONFIRMATION),
  })
    .superRefine(refineReportDispositionReasonCode)
    .superRefine(refineReportDispositionEvidenceRefs);
export type SetReportDispositionCallableInput = z.infer<
  typeof SetReportDispositionCallableInputSchema
>;
