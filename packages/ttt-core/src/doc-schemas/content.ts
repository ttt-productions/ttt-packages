import { z } from 'zod';
import { HALL_WING_TYPE_KEYS, RULE_GROUP_KEYS, WORK_PROJECT_TYPE_KEYS } from '../types/content.js';
import {
  ModerationDecisionNumberSchema,
  ModerationEdgeSyncOpSchema,
  ModerationEdgeSyncStateSchema,
  ModerationHiddenBySchema,
} from './moderation.js';
import { MAX_THRESHOLD_PUBLISH_PARKED_REASON_LENGTH } from '../constants/business-admin.js';
import { FIRESTORE_INDEXED_VALUE_MAX_BYTES } from '../constants/business-platform.js';
import { WORK_PROJECT_SPECIFIC_GENRES } from '../constants/options.js';
import {
  HALL_CONTENT_DETAIL_SURFACES,
  HALL_CONTENT_SUB_ITEM_SURFACES,
} from '../constants/hall-content-routing.js';
import { LegalReviewNoticeReceiptSchema } from './legal-review-notice.js';

const contentStatusSchema = z.enum(['unpublished', 'pending_approval', 'published']);

const moderationClearedFieldsShape = {
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
};

export const ItemsKeySchema = z.enum(['tuneTracks', 'chapters', 'televisionEpisodes']);
export type ItemsKey = z.infer<typeof ItemsKeySchema>;

export const FullTaleSchema = z.object({
  uid: z.string(),
  createdOn: z.number(),
  coverSquareAssetId: z.string().optional(),
  coverPosterAssetId: z.string().optional(),
  coverCinematicAssetId: z.string().optional(),
  workGenres: z.array(z.enum(WORK_PROJECT_SPECIFIC_GENRES.Tales)).optional(),
});
export type FullTale = z.infer<typeof FullTaleSchema>;

export const FullChapterSchema = z.object({
  uid: z.string(),
  title: z.string(),
  content: z.string(),
  description: z.string(),
  order: z.number(),
  photoAssetId: z.string().optional(),
  status: contentStatusSchema,
  createdOn: z.number(),
  ...moderationClearedFieldsShape,
  moderatedAt: z.number().optional(),
});
export type FullChapter = z.infer<typeof FullChapterSchema>;

export const FullTuneSchema = z.object({
  uid: z.string(),
  coverSquareAssetId: z.string().optional(),
  coverPosterAssetId: z.string().optional(),
  coverCinematicAssetId: z.string().optional(),
  workGenres: z.array(z.enum(WORK_PROJECT_SPECIFIC_GENRES.Tunes)),
  createdOn: z.number(),
});
export type FullTune = z.infer<typeof FullTuneSchema>;

export const FullTuneTrackSchema = z.object({
  uid: z.string(),
  title: z.string(),
  description: z.string().optional(),
  audioAssetId: z.string().optional(),
  mediaType: z.string().optional(),
  order: z.number(),
  photoAssetId: z.string().optional(),
  status: contentStatusSchema,
  createdOn: z.number(),
  ...moderationClearedFieldsShape,
  moderatedAt: z.number().optional(),
});
export type FullTuneTrack = z.infer<typeof FullTuneTrackSchema>;

export const FullTelevisionSchema = z.object({
  uid: z.string(),
  createdOn: z.number(),
  coverSquareAssetId: z.string().optional(),
  coverPosterAssetId: z.string().optional(),
  coverCinematicAssetId: z.string().optional(),
  workGenres: z.array(z.enum(WORK_PROJECT_SPECIFIC_GENRES.Television)),
});
export type FullTelevision = z.infer<typeof FullTelevisionSchema>;

export const FullTelevisionEpisodeSchema = z.object({
  uid: z.string(),
  title: z.string(),
  description: z.string().optional(),
  videoAssetId: z.string(),
  mediaType: z.string().optional(),
  order: z.number(),
  photoAssetId: z.string().optional(),
  status: contentStatusSchema,
  createdOn: z.number(),
  ...moderationClearedFieldsShape,
  moderatedAt: z.number().optional(),
});
export type FullTelevisionEpisode = z.infer<typeof FullTelevisionEpisodeSchema>;

export const HallSubmissionReservationSchema = z
  .object({
    hallItemId: z.string().min(1),
    createdAt: z.number(),
  })
  .strict();
export type HallSubmissionReservation = z.infer<typeof HallSubmissionReservationSchema>;

export const ThresholdItemSchema = z.object({
  thresholdItemId: z.string(),
  hallItemId: z.string(),
  workProjectId: z.string(),
  workProjectType: z.enum(WORK_PROJECT_TYPE_KEYS),
  itemId: z.string(),
  itemsKey: ItemsKeySchema,
  order: z.number(),
  hallWingType: z.enum(HALL_WING_TYPE_KEYS),
  submittedAt: z.number(),
  reviewStatus: z.enum(['pending', 'needs_revision', 'approved']),
  adminNotes: z.string().optional(),
  reviewedAt: z.number().optional(),
  reviewedBy: z.string().optional(),
  hasRealPeople: z.boolean(),
  attestConsistentFormat: z.literal(true),
  attestNoCredits: z.literal(true),
  attestNoBegging: z.literal(true),
  attestHumanMadeOriginal: z.literal(true),
  attestPublishStewardship: z.literal(true),
  attestedAt: z.number(),
  attestationsVersion: z.number().int().positive(),
  legalReviewNotice: LegalReviewNoticeReceiptSchema.optional(),
  confirmedNoBegging: z.literal(true).optional(),
  confirmedNoCredits: z.literal(true).optional(),
  confirmedConsistentFormat: z.literal(true).optional(),
  confirmedRealPeopleAttestation: z.literal(true).optional(),
  publishParkedReason: z.string().max(MAX_THRESHOLD_PUBLISH_PARKED_REASON_LENGTH).optional(),
  publishParkedAt: z.number().optional(),
});
export type ThresholdItem = z.infer<typeof ThresholdItemSchema>;

export const HallContentTextSurfaceSchema = z.enum([
  ...HALL_CONTENT_DETAIL_SURFACES,
  ...HALL_CONTENT_SUB_ITEM_SURFACES,
  'workRealm',
]);
export type HallContentTextSurface = z.infer<typeof HallContentTextSurfaceSchema>;

export const HallSubItemTypeSchema = z.enum(['chapter', 'track', 'episode']);
export type HallSubItemType = z.infer<typeof HallSubItemTypeSchema>;

export const PublishedHallItemStatusSchema = z.enum(['published', 'paused', 'banned']);
export type PublishedHallItemStatus = z.infer<typeof PublishedHallItemStatusSchema>;

// Firestore truncates an indexed value past its limit, which would make the equality query inexact.
export const hallContentChangeRequestTargetKeySchema = z
  .string()
  .min(1)
  .refine((key) => new TextEncoder().encode(key).length <= FIRESTORE_INDEXED_VALUE_MAX_BYTES, {
    message: 'A change-request target key is longer than Firestore indexes exactly.',
  });

export const HallContentChangeRequestSchema = z.object({
  changeRequestId: z.string(),
  requestKind: z.literal('text'),
  targetKey: hallContentChangeRequestTargetKeySchema,
  hallItemId: z.string().nullable(),
  workProjectId: z.string(),
  workProjectType: z.enum(WORK_PROJECT_TYPE_KEYS).nullable(),
  surface: HallContentTextSurfaceSchema,
  workRealmId: z.string().nullable(),
  subItemId: z.string().nullable(),
  proposerUid: z.string(),
  proposedFields: z.record(z.string(), z.string()),
  status: z.enum(['requested', 'approved', 'denied']),
  createdAt: z.number(),
  lastUpdatedAt: z.number(),
  resolvedAt: z.number().optional(),
  resolvedBy: z.string().optional(),
  resolutionReason: z.string().optional(),
});
export type HallContentChangeRequest = z.infer<typeof HallContentChangeRequestSchema>;

export const PublishedHallItemSchema = z.object({
  hallItemId: z.string(),
  workProjectId: z.string(),
  workProjectType: z.enum(WORK_PROJECT_TYPE_KEYS),
  status: PublishedHallItemStatusSchema,
  createdOn: z.number(),
  publishedAt: z.number().optional(),
  hallWingType: z.enum(HALL_WING_TYPE_KEYS),
  title: z.string().optional(),
  description: z.string().optional(),
  coverSquareAssetId: z.string().min(1),
  coverPosterAssetId: z.string().min(1),
  coverCinematicAssetId: z.string().min(1),
  workGenres: z.array(z.string()).optional(),
  followerCount: z.number().optional(),
  hidden: z.boolean(),
  hiddenBy: ModerationHiddenBySchema.optional(),
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
  moderatedAt: z.number().optional(),
  hasRealPeople: z.boolean().optional(),
});
export type PublishedHallItem = z.infer<typeof PublishedHallItemSchema>;

export const PublishedTuneTrackSchema = z.object({
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  audioAssetId: z.string().min(1),
  photoAssetId: z.string().min(1),
  hidden: z.boolean(),
  hiddenBy: ModerationHiddenBySchema.optional(),
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
  moderatedAt: z.number().optional(),
  edgeSyncState: ModerationEdgeSyncStateSchema.nullable().optional(),
  edgeSyncProcessingAt: z.number().optional(),
  edgeSyncOp: ModerationEdgeSyncOpSchema.optional(),
  edgeSyncDecision: ModerationDecisionNumberSchema.optional(),
  edgeSyncAssetIds: z.array(z.string().min(1)).optional(),
  edgeSyncError: z.string().optional(),
  edgeSyncFailedAt: z.number().optional(),
});
export type PublishedTuneTrack = z.infer<typeof PublishedTuneTrackSchema>;

export const PublishedChapterSchema = z.object({
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  content: z.string(),
  photoAssetId: z.string().min(1),
  hidden: z.boolean(),
  hiddenBy: ModerationHiddenBySchema.optional(),
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
  moderatedAt: z.number().optional(),
  edgeSyncState: ModerationEdgeSyncStateSchema.nullable().optional(),
  edgeSyncProcessingAt: z.number().optional(),
  edgeSyncOp: ModerationEdgeSyncOpSchema.optional(),
  edgeSyncDecision: ModerationDecisionNumberSchema.optional(),
  edgeSyncAssetIds: z.array(z.string().min(1)).optional(),
  edgeSyncError: z.string().optional(),
  edgeSyncFailedAt: z.number().optional(),
});
export type PublishedChapter = z.infer<typeof PublishedChapterSchema>;

export const PublishedTelevisionEpisodeSchema = z.object({
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  videoAssetId: z.string().min(1),
  photoAssetId: z.string().min(1),
  hidden: z.boolean(),
  hiddenBy: ModerationHiddenBySchema.optional(),
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
  moderatedAt: z.number().optional(),
  edgeSyncState: ModerationEdgeSyncStateSchema.nullable().optional(),
  edgeSyncProcessingAt: z.number().optional(),
  edgeSyncOp: ModerationEdgeSyncOpSchema.optional(),
  edgeSyncDecision: ModerationDecisionNumberSchema.optional(),
  edgeSyncAssetIds: z.array(z.string().min(1)).optional(),
  edgeSyncError: z.string().optional(),
  edgeSyncFailedAt: z.number().optional(),
});
export type PublishedTelevisionEpisode = z.infer<typeof PublishedTelevisionEpisodeSchema>;

export const HallLibraryInProgressEntrySchema = z.object({
  itemId: z.string(),
  positionSeconds: z.number(),
  durationSeconds: z.number().optional(),
  updatedAt: z.number(),
});
export type HallLibraryInProgressEntry = z.infer<typeof HallLibraryInProgressEntrySchema>;

export const HallLibraryRecentlyViewedEntrySchema = z.object({
  hallItemId: z.string(),
  itemId: z.string().optional(),
  viewedAt: z.number(),
});
export type HallLibraryRecentlyViewedEntry = z.infer<typeof HallLibraryRecentlyViewedEntrySchema>;

export const HallLibrarySettingsSchema = z.object({
  tunesAutoplay: z.boolean(),
});
export type HallLibrarySettings = z.infer<typeof HallLibrarySettingsSchema>;

export const HallLibraryPreferencesSchema = z.object({
  userId: z.string(),
  hiddenWorkIds: z.array(z.string()),
  inkedWorkIds: z.array(z.string()),
  inProgress: z.record(z.string(), HallLibraryInProgressEntrySchema),
  recentlyViewed: z.array(HallLibraryRecentlyViewedEntrySchema),
  settings: HallLibrarySettingsSchema,
  lastUpdated: z.number(),
});
export type HallLibraryPreferences = z.infer<typeof HallLibraryPreferencesSchema>;

export const FuturePlanGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
  intention: z.string().optional(),
});
export type FuturePlanGroup = z.infer<typeof FuturePlanGroupSchema>;

export const FuturePlanItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  groupId: z.string(),
  order: z.number(),
});
export type FuturePlanItem = z.infer<typeof FuturePlanItemSchema>;

export const FuturePlansDocumentSchema = z.object({
  lastUpdated: z.number(),
  intro: z.string().optional(),
  groups: z.array(FuturePlanGroupSchema),
  plans: z.array(FuturePlanItemSchema),
  version: z.number().optional(),
});
export type FuturePlansDocument = z.infer<typeof FuturePlansDocumentSchema>;

export const RuleGroupSchema = z.enum(RULE_GROUP_KEYS);

const appliesToTypeFields = {
  workProjectType: z.enum(WORK_PROJECT_TYPE_KEYS).optional(),
  hallWingType: z.enum(HALL_WING_TYPE_KEYS).optional(),
};

export const RuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  group: RuleGroupSchema,
  ...appliesToTypeFields,
  order: z.number(),
});
export type Rule = z.infer<typeof RuleSchema>;

export const AgreementPointSchema = z.object({
  id: z.string(),
  text: z.string(),
  ...appliesToTypeFields,
});
export type AgreementPoint = z.infer<typeof AgreementPointSchema>;

export const ArtisanAgreementsSchema = z.object({
  intention: z.string().optional(),
  points: z.array(AgreementPointSchema),
});
export type ArtisanAgreements = z.infer<typeof ArtisanAgreementsSchema>;

export const RulesAndAgreementsSchema = z.object({
  intro: z.string().optional(),
  groupIntentions: z.partialRecord(RuleGroupSchema, z.string()).optional(),
  rules: z.array(RuleSchema),
  agreements: ArtisanAgreementsSchema,
  version: z.number().optional(),
  lastUpdated: z.number().optional(),
});
export type RulesAndAgreements = z.infer<typeof RulesAndAgreementsSchema>;

export const ContentPageSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  level: z.union([z.literal(1), z.literal(2)]),
  body: z.string(),
  order: z.number(),
});
export type ContentPageSection = z.infer<typeof ContentPageSectionSchema>;

export const LegalPageDocumentSchema = z.object({
  version: z.number(),
  lastUpdated: z.number(),
  sections: z.array(ContentPageSectionSchema),
});
export type LegalPageDocument = z.infer<typeof LegalPageDocumentSchema>;

export const TakeItDownPageCopySchema = z.object({
  version: z.number(),
  lastUpdated: z.number(),
  strings: z.record(z.string(), z.string()),
});
export type TakeItDownPageCopy = z.infer<typeof TakeItDownPageCopySchema>;

export const DmcaContactRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  order: z.number(),
});
export type DmcaContactRow = z.infer<typeof DmcaContactRowSchema>;

export const DmcaContactBlockSchema = z.object({
  id: z.string(),
  heading: z.string(),
  order: z.number(),
  rows: z.array(DmcaContactRowSchema),
});
export type DmcaContactBlock = z.infer<typeof DmcaContactBlockSchema>;

export const DmcaPolicyDocumentSchema = z.object({
  version: z.number(),
  lastUpdated: z.number(),
  intro: z.string(),
  contactBlocks: z.array(DmcaContactBlockSchema),
  sections: z.array(ContentPageSectionSchema),
});
export type DmcaPolicyDocument = z.infer<typeof DmcaPolicyDocumentSchema>;
