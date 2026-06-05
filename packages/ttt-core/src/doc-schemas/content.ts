// Content Firestore document SCHEMAS — Tales/Tunes/Television sub-documents, the
// Threshold + Hall library item shapes, Hall library user preferences, and the
// `_config` singleton docs (futurePlans, rulesAndAgreements). Types are inferred via
// z.infer. The enum-key consts (HALL_WING_TYPE_KEYS / WORK_PROJECT_TYPE_KEYS) and the
// UI-only filter/view types remain in ../types/content.ts.

import { z } from 'zod';
import { HALL_WING_TYPE_KEYS, WORK_PROJECT_TYPE_KEYS } from '../types/content.js';

const contentStatusSchema = z.enum(['unpublished', 'pending_approval', 'published']);

export const ItemsKeySchema = z.enum(['tuneTracks', 'chapters', 'televisionEpisodes']);
export type ItemsKey = z.infer<typeof ItemsKeySchema>;

// --- WorkProject content sub-docs ---

export const FullTaleSchema = z.object({
  uid: z.string(),
  title: z.string(),
  description: z.string(),
  createdOn: z.number(),
  coverPhotoSquare: z.string().optional(),
  coverPhotoPoster: z.string().optional(),
  coverPhotoCinematic: z.string().optional(),
  workGenres: z.array(z.string()).optional(),
});
export type FullTale = z.infer<typeof FullTaleSchema>;

export const FullChapterSchema = z.object({
  uid: z.string(),
  title: z.string(),
  content: z.string(),
  description: z.string(),
  order: z.number(),
  photoUrl: z.string().optional(),
  status: contentStatusSchema,
  createdOn: z.number(),
});
export type FullChapter = z.infer<typeof FullChapterSchema>;

export const FullTuneSchema = z.object({
  uid: z.string(),
  title: z.string(),
  description: z.string(),
  coverPhotoSquare: z.string().optional(),
  coverPhotoPoster: z.string().optional(),
  coverPhotoCinematic: z.string().optional(),
  workGenres: z.array(z.string()),
  createdOn: z.number(),
});
export type FullTune = z.infer<typeof FullTuneSchema>;

export const FullTuneTrackSchema = z.object({
  uid: z.string(),
  title: z.string(),
  description: z.string().optional(),
  fileUrl: z.string().optional(),
  mediaType: z.string().optional(),
  order: z.number(),
  photoUrl: z.string().optional(),
  status: contentStatusSchema,
  createdOn: z.number(),
});
export type FullTuneTrack = z.infer<typeof FullTuneTrackSchema>;

export const FullTelevisionSchema = z.object({
  uid: z.string(),
  title: z.string(),
  description: z.string(),
  createdOn: z.number(),
  coverPhotoSquare: z.string().optional(),
  coverPhotoPoster: z.string().optional(),
  coverPhotoCinematic: z.string().optional(),
  workGenres: z.array(z.string()),
});
export type FullTelevision = z.infer<typeof FullTelevisionSchema>;

export const FullTelevisionEpisodeSchema = z.object({
  uid: z.string(),
  title: z.string(),
  description: z.string().optional(),
  videoUrl: z.string(),
  mediaType: z.string().optional(),
  order: z.number(),
  photoUrl: z.string().optional(),
  status: contentStatusSchema,
  createdOn: z.number(),
});
export type FullTelevisionEpisode = z.infer<typeof FullTelevisionEpisodeSchema>;

// --- Threshold + Hall library items ---

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
});
export type ThresholdItem = z.infer<typeof ThresholdItemSchema>;

export const PublishedHallItemSchema = z.object({
  hallItemId: z.string(),
  workProjectId: z.string(),
  workProjectType: z.enum(WORK_PROJECT_TYPE_KEYS),
  status: z.enum(['published', 'paused', 'banned']),
  createdOn: z.number(),
  publishedAt: z.number().optional(),
  hallWingType: z.enum(HALL_WING_TYPE_KEYS),
  title: z.string().optional(),
  description: z.string().optional(),
  coverPhotoSquare: z.string().optional(),
  coverPhotoPoster: z.string().optional(),
  coverPhotoCinematic: z.string().optional(),
  workGenres: z.array(z.string()).optional(),
  totalPledgePayments: z.number().optional(),
  pledgePaymentCount: z.number().optional(),
  viewCount: z.number().optional(),
  followerCount: z.number().optional(),
  hidden: z.boolean().optional(),
});
export type PublishedHallItem = z.infer<typeof PublishedHallItemSchema>;

export const PublishedTuneTrackSchema = z.object({
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  fileUrl: z.string(),
  photoUrl: z.string().optional(),
  hidden: z.boolean().optional(),
});
export type PublishedTuneTrack = z.infer<typeof PublishedTuneTrackSchema>;

export const PublishedChapterSchema = z.object({
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  content: z.string(),
  photoUrl: z.string().optional(),
  hidden: z.boolean().optional(),
});
export type PublishedChapter = z.infer<typeof PublishedChapterSchema>;

export const PublishedTelevisionEpisodeSchema = z.object({
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  videoUrl: z.string(),
  photoUrl: z.string().optional(),
  hidden: z.boolean().optional(),
});
export type PublishedTelevisionEpisode = z.infer<typeof PublishedTelevisionEpisodeSchema>;

// --- Hall library user preferences ---

export const HallLibraryPreferencesSchema = z.object({
  userId: z.string(),
  hiddenItems: z.array(z.string()),
  followedItems: z.array(z.string()),
  bookmarkedItems: z.array(z.string()),
  inProgressItems: z.array(z.string()),
  recentlyViewed: z.array(z.object({ itemId: z.string(), viewedAt: z.number() })),
  lastUpdated: z.number(),
});
export type HallLibraryPreferences = z.infer<typeof HallLibraryPreferencesSchema>;

// --- _config singleton docs ---

export const FuturePlanItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  order: z.number(),
  videoUrl: z.string().optional(),
  mediaType: z.enum(['video', 'image', 'audio', 'other']).optional(),
});
export type FuturePlanItem = z.infer<typeof FuturePlanItemSchema>;

export const FuturePlansDocumentSchema = z.object({
  lastUpdated: z.number(),
  plans: z.array(FuturePlanItemSchema),
});
export type FuturePlansDocument = z.infer<typeof FuturePlansDocumentSchema>;

export const RuleGroupSchema = z.enum(['generic', 'workProjectType', 'hallWingType', 'workRealm', 'merchandising']);
export type RuleGroup = z.infer<typeof RuleGroupSchema>;

export const RuleSubgroupSchema = z.enum(['Tales', 'Tunes', 'Television', 'entertainment', 'educational', 'newsPolitical']);
export type RuleSubgroup = z.infer<typeof RuleSubgroupSchema>;

export const RuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  videoUrl: z.string().optional(),
  group: RuleGroupSchema.optional(),
  subgroup: RuleSubgroupSchema.optional(),
  order: z.number(),
});
export type Rule = z.infer<typeof RuleSchema>;

export const AgreementCategorySchema = z.object({
  points: z.array(z.string()),
  videoUrl: z.string().optional(),
});
export type AgreementCategory = z.infer<typeof AgreementCategorySchema>;

export const RulesAndAgreementsSchema = z.object({
  rules: z.array(RuleSchema),
  agreements: z.object({
    tales: AgreementCategorySchema.optional(),
    tunes: AgreementCategorySchema.optional(),
    television: AgreementCategorySchema.optional(),
  }),
});
export type RulesAndAgreements = z.infer<typeof RulesAndAgreementsSchema>;
