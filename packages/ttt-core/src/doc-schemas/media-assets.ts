import { z } from 'zod';
import { StructuredErrorSchema } from '@ttt-productions/edge-protocol-core';
import {
  TIMED_MEDIA_MAIN_OUTPUT_KEY,
  VIDEO_POSTER_OUTPUT_KEY,
} from '@ttt-productions/media-schemas';
import { FileOriginSchema } from '../media/file-origin.js';

export const MediaAccessTierSchema = z.enum(['broad', 'scoped', 'artisan', 'adminOnly']);
export type MediaAccessTier = z.infer<typeof MediaAccessTierSchema>;

export const MediaServingStatusSchema = z.enum(['servable', 'hidden', 'quarantined', 'deleted']);
export type MediaServingStatus = z.infer<typeof MediaServingStatusSchema>;

export const MediaAssetOwnerTypeSchema = z.enum([
  'userProfile',
  'craftSkill',
  'squareStreetzPost',
  'workProject',
  'workContent',
  'hallItem',
  'commissionListing',
  'commissionProposal',
  'audition',
  'auditionEntry',
  'conversationFile',
  'realmFile',
  'safetyEvidence',
  'systemContent',
]);
export type MediaAssetOwnerType = z.infer<typeof MediaAssetOwnerTypeSchema>;

export const ContentMediaKindSchema = z.enum(['image', 'video', 'audio']);
export type ContentMediaKind = z.infer<typeof ContentMediaKindSchema>;

export const MEDIA_VARIANT_KEYS = [
  'full',
  'medium',
  'small',
  TIMED_MEDIA_MAIN_OUTPUT_KEY,
  VIDEO_POSTER_OUTPUT_KEY,
] as const;
export const MediaVariantKeySchema = z.enum(MEDIA_VARIANT_KEYS);
export type MediaVariantKey = z.infer<typeof MediaVariantKeySchema>;

export const PROFILE_PICTURE_VARIANT_KEYS = [
  'full',
  'medium',
  'small',
] as const satisfies readonly MediaVariantKey[];
export type ProfilePictureVariantKey = (typeof PROFILE_PICTURE_VARIANT_KEYS)[number];

export const MEDIA_DISPLAY_VARIANT_PRECEDENCE = [
  TIMED_MEDIA_MAIN_OUTPUT_KEY,
  ...PROFILE_PICTURE_VARIANT_KEYS,
] as const satisfies readonly MediaVariantKey[];

export const MediaCopyReasonSchema = z.enum([
  'original',
  'variant',
  'hall_publish',
  'profile_derivative',
  'moderation_copy',
  'evidence_copy',
  'other',
]);
export type MediaCopyReason = z.infer<typeof MediaCopyReasonSchema>;

export const MediaOriginLineageV1Schema = z
  .object({
    lineageVersion: z.literal(1),
    rootIngestId: z.string().min(1),
    rootAssetId: z.string().min(1),
    sourceAssetId: z.string().min(1).optional(),
    originatingUploaderUid: z.string().min(1),
    originatingUploadEventId: z.string(),
    originalUploadCreatedAt: z.number(),
    // Not `.min(1)`: no hash is computed at finalize, so a fresh asset carries ''.
    rootSha256: z.string(),
    originalSha256: z.string().min(1).optional(),
    // `z.partialRecord`, not `z.record`: in Zod 4 a record over an enum demands every key.
    variantSha256s: z.partialRecord(MediaVariantKeySchema, z.string().min(1)),
    copyReason: MediaCopyReasonSchema,
    createdFromOwnerType: MediaAssetOwnerTypeSchema.optional(),
    createdFromOwnerId: z.string().min(1).optional(),
    copyActorUid: z.string().min(1).optional(),
    currentOwnerType: MediaAssetOwnerTypeSchema,
    currentOwnerId: z.string().min(1),
  })
  .strict();
export type MediaOriginLineageV1 = z.infer<typeof MediaOriginLineageV1Schema>;

export const MediaAssetVariantSchema = z
  .object({
    contentType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    durationSec: z.number().positive().optional(),
    downloadFilename: z.string().min(1).optional(),
  })
  .strict();
export type MediaAssetVariant = z.infer<typeof MediaAssetVariantSchema>;

export const MediaRetentionPolicySchema = z.enum([
  'standard',
  'preserveForTrustAndSafety',
  'legalHold',
]);
export type MediaRetentionPolicy = z.infer<typeof MediaRetentionPolicySchema>;

export const REALM_FILE_NONE_STATUS = 'none' as const;
export const REALM_FILE_PENDING_APPROVAL_STATUS = 'pendingApproval' as const;
export const REALM_FILE_NON_CANON_STATUS = 'nonCanon' as const;
export const REALM_FILE_CANON_STATUS = 'canon' as const;

export const REALM_FILE_CANON_STATUS_VALUES = [
  REALM_FILE_NONE_STATUS,
  REALM_FILE_PENDING_APPROVAL_STATUS,
  REALM_FILE_NON_CANON_STATUS,
  REALM_FILE_CANON_STATUS,
] as const;
export const RealmFileCanonStatusSchema = z.enum(REALM_FILE_CANON_STATUS_VALUES);
export type RealmFileCanonStatus = z.infer<typeof RealmFileCanonStatusSchema>;

export const REALM_FILE_APPROVED_STATUS_VALUES = [
  REALM_FILE_NON_CANON_STATUS,
  REALM_FILE_CANON_STATUS,
] as const;
export const RealmFileApprovedStatusSchema = z.enum(REALM_FILE_APPROVED_STATUS_VALUES);
export type RealmFileApprovedStatus = z.infer<typeof RealmFileApprovedStatusSchema>;

export const RealmFilePendingApprovalStatusSchema = z.literal(REALM_FILE_PENDING_APPROVAL_STATUS);
export type RealmFilePendingApprovalStatus = z.infer<typeof RealmFilePendingApprovalStatusSchema>;

export const REALM_FILE_ACTIVE_STATUS_VALUES = [
  REALM_FILE_PENDING_APPROVAL_STATUS,
  ...REALM_FILE_APPROVED_STATUS_VALUES,
] as const;
export const RealmFileActiveStatusSchema = z.enum(REALM_FILE_ACTIVE_STATUS_VALUES);
export type RealmFileActiveStatus = z.infer<typeof RealmFileActiveStatusSchema>;

export const MediaAuthoritySyncStateSchema = z.enum(['pending', 'applied', 'deadLetter']);
export type MediaAuthoritySyncState = z.infer<typeof MediaAuthoritySyncStateSchema>;

export const MediaAssetPublicationStateSchema = z.enum(['unpublished', 'published', 'retired']);
export type MediaAssetPublicationState = z.infer<typeof MediaAssetPublicationStateSchema>;

export const MediaServingScopeSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('workProject'),
      workProjectId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('workFileFolder'),
      workProjectId: z.string().min(1),
      workFileFolderId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('guildInvite'),
      guildInviteId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('adminSupport'),
      adminDispatchId: z.string().min(1),
    })
    .strict(),
]);
export type MediaServingScope = z.infer<typeof MediaServingScopeSchema>;

export const MediaPublicationKindSchema = z.enum([
  'profilePicture',
  'squarePostMedia',
  'workAsset',
  'hallCover',
  'realmCover',
  'workContentMedia',
  'auditionMedia',
  'commissionListingMedia',
  'commissionProposalMedia',
  'craftSkillMedia',
  'conversationFile',
  'systemVideoSlot',
]);
export type MediaPublicationKind = z.infer<typeof MediaPublicationKindSchema>;

export const MediaServingAuthorityRecordSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    assetId: z.string().min(1),
    authorityVersion: z.number().int().nonnegative(),
    operationId: z.string().min(1),
    payloadHash: z.string().min(1),

    servingStatus: MediaServingStatusSchema,
    accessTier: MediaAccessTierSchema,

    ownerType: MediaAssetOwnerTypeSchema,
    ownerId: z.string().min(1),
    scope: MediaServingScopeSchema.nullable(),

    variants: z.record(z.string(), MediaAssetVariantSchema),

    updatedAtMs: z.number(),
  })
  .strict();
export type MediaServingAuthorityRecord = z.infer<typeof MediaServingAuthorityRecordSchema>;

export const MediaAssetRetirementDeferralSchema = z.enum(['held', 'failed']);
export type MediaAssetRetirementDeferral = z.infer<typeof MediaAssetRetirementDeferralSchema>;

export const MediaAssetRetirementSchema = z
  .object({
    requestedAt: z.number().int().nonnegative(),
    pendingVariantKeys: z.array(z.string().min(1)),
    attemptCount: z.number().int().nonnegative(),
    nextAttemptAt: z.number().int().nonnegative(),
    lastDeferral: MediaAssetRetirementDeferralSchema.optional(),
    lastError: StructuredErrorSchema.optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (new Set(val.pendingVariantKeys).size !== val.pendingVariantKeys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingVariantKeys'],
        message: 'a variant key is owed at most once',
      });
    }
    if (val.lastError !== undefined && val.lastDeferral !== 'failed') {
      ctx.addIssue({
        code: 'custom',
        path: ['lastError'],
        message: 'an error is recorded only for a failed attempt',
      });
    }
  });
export type MediaAssetRetirement = z.infer<typeof MediaAssetRetirementSchema>;

export const MediaAssetSchema = z
  .object({
    mediaAssetId: z.string().min(1),
    mediaKind: ContentMediaKindSchema,
    fileOrigin: FileOriginSchema,

    ownerType: MediaAssetOwnerTypeSchema,
    ownerId: z.string().min(1),
    workProjectId: z.string().optional(),
    realmId: z.string().optional(),
    createdByUid: z.string().min(1),

    accessTier: MediaAccessTierSchema,
    servingStatus: MediaServingStatusSchema,

    variants: z.record(z.string(), MediaAssetVariantSchema),

    moderationStatus: z.enum(['approved', 'quarantined']),
    retentionPolicy: MediaRetentionPolicySchema,
    legalHold: z.boolean(),
    originalDeletedAt: z.number().optional(),

    originLineage: MediaOriginLineageV1Schema.optional(),

    realmFileCanonStatus: RealmFileCanonStatusSchema,

    realmFileFolderId: z.string().min(1).optional(),

    realmFileShareRequestId: z.string().min(1).optional(),
    realmFileShareRequestedByUid: z.string().min(1).optional(),
    realmFileShareRequestedAt: z.number().optional(),

    authorityVersion: z.number().int().nonnegative().optional(),
    authorityPayloadHash: z.string().optional(),
    authoritySyncState: MediaAuthoritySyncStateSchema.optional(),
    publicationState: MediaAssetPublicationStateSchema.optional(),
    scope: MediaServingScopeSchema.optional(),
    authorityAppliedAt: z.number().optional(),
    publishedAt: z.number().optional(),
    lastAuthorityError: StructuredErrorSchema.optional(),
    authoritySyncAttemptCount: z.number().int().nonnegative().optional(),
    authoritySyncNextAttemptAt: z.number().optional(),

    retirement: MediaAssetRetirementSchema.optional(),

    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.retirement !== undefined) {
      if (val.servingStatus === 'servable') {
        ctx.addIssue({
          code: 'custom',
          path: ['servingStatus'],
          message: 'an asset owing retirement is never servable',
        });
      }
      if (val.publicationState === 'retired') {
        ctx.addIssue({
          code: 'custom',
          path: ['retirement'],
          message: 'a retired asset owes no retirement',
        });
      }
      for (const key of val.retirement.pendingVariantKeys) {
        if (!Object.prototype.hasOwnProperty.call(val.variants, key)) {
          ctx.addIssue({
            code: 'custom',
            path: ['retirement', 'pendingVariantKeys'],
            message: `${key} is not one of this asset's variants`,
          });
        }
      }
    }

    const requestFields = [
      ['realmFileShareRequestId', val.realmFileShareRequestId],
      ['realmFileShareRequestedByUid', val.realmFileShareRequestedByUid],
      ['realmFileShareRequestedAt', val.realmFileShareRequestedAt],
    ] as const;

    const forbid = (path: string, value: unknown, message: string) => {
      if (value !== undefined) ctx.addIssue({ code: 'custom', path: [path], message });
    };
    const require_ = (path: string, value: unknown, message: string) => {
      if (value === undefined) ctx.addIssue({ code: 'custom', path: [path], message });
    };

    if (val.realmFileCanonStatus === 'none') {
      forbid(
        'realmId',
        val.realmId,
        'realmId is only set on a realm-shared or pending asset (realmFileCanonStatus is "none")',
      );
      forbid(
        'realmFileFolderId',
        val.realmFileFolderId,
        'realmFileFolderId is only set on an APPROVED realm-shared asset (realmFileCanonStatus is "none")',
      );
      for (const [path, value] of requestFields) {
        forbid(
          path,
          value,
          `${path} is only set while a promotion request is pending (realmFileCanonStatus is "none")`,
        );
      }
      return;
    }

    require_(
      'realmId',
      val.realmId,
      `realmId is required whenever realmFileCanonStatus is "${val.realmFileCanonStatus}"`,
    );

    if (val.realmFileCanonStatus === 'pendingApproval') {
      forbid(
        'realmFileFolderId',
        val.realmFileFolderId,
        'a pending request has no folder yet — the steward assigns the folder AT approval',
      );
      for (const [path, value] of requestFields) {
        require_(
          path,
          value,
          `${path} is required while realmFileCanonStatus is "pendingApproval"`,
        );
      }
      return;
    }

    require_(
      'realmFileFolderId',
      val.realmFileFolderId,
      `realmFileFolderId is required on an approved realm file (realmFileCanonStatus is "${val.realmFileCanonStatus}")`,
    );
    for (const [path, value] of requestFields) {
      forbid(
        path,
        value,
        `${path} must be cleared once the request is resolved (realmFileCanonStatus is "${val.realmFileCanonStatus}")`,
      );
    }
  });
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const MediaAssetReapCandidateSchema = z.object({
  mediaAssetId: MediaAssetSchema.shape.mediaAssetId,
  ownerId: MediaAssetSchema.shape.ownerId,
  createdAt: MediaAssetSchema.shape.createdAt,
  publicationState: MediaAssetSchema.shape.publicationState,
  retirement: MediaAssetSchema.shape.retirement,
});
export type MediaAssetReapCandidate = z.infer<typeof MediaAssetReapCandidateSchema>;

export const MediaAssetCopySourceHoldFieldsSchema = z.object({
  mediaAssetId: MediaAssetSchema.shape.mediaAssetId,
  originLineage: MediaAssetSchema.shape.originLineage,
  legalHold: MediaAssetSchema.shape.legalHold,
});
export type MediaAssetCopySourceHoldFields = z.infer<typeof MediaAssetCopySourceHoldFieldsSchema>;

export type MediaAssetRetirementStanding = 'absent' | 'retired' | 'owed' | 'none';

export function mediaAssetRetirementStanding(
  asset: Pick<MediaAsset, 'publicationState' | 'retirement'> | undefined,
): MediaAssetRetirementStanding {
  if (asset === undefined) return 'absent';
  if (asset.publicationState === 'retired') return 'retired';
  if (asset.retirement !== undefined) return 'owed';
  return 'none';
}

export function servingStatusOnRetirementRequest(current: MediaServingStatus): MediaServingStatus {
  return current === 'servable' ? 'hidden' : current;
}

export function servingStatusOnRetirementComplete(current: MediaServingStatus): MediaServingStatus {
  return current === 'quarantined' ? 'quarantined' : 'deleted';
}
