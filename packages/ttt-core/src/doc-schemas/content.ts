// Content Firestore document SCHEMAS — Tales/Tunes/Television sub-documents, the
// Threshold + Hall library item shapes, Hall library user preferences, and the
// `_config` singleton docs (futurePlans, rulesAndAgreements). Types are inferred via
// z.infer. The enum-key consts (HALL_WING_TYPE_KEYS / WORK_PROJECT_TYPE_KEYS) and the
// UI-only filter/view types remain in ../types/content.ts.

import { z } from 'zod';
import { HALL_WING_TYPE_KEYS, WORK_PROJECT_TYPE_KEYS } from '../types/content.js';

const contentStatusSchema = z.enum(['unpublished', 'pending_approval', 'published']);

// Per-field moderation text-clear remedy (shared shape across the content family — Tale/Tune/
// Television details, their chapter/track/episode sub-items, and the published Hall projections of
// both). `moderationClearedFields` lists which text fields (e.g. 'title', 'description', 'content')
// an admin cleared to a neutral placeholder and which now await steward re-entry; empty/absent when
// nothing was cleared. `moderationClearedReason` is the operator's reason, surfaced on the member's
// edit surface. Extends the workProject/workRealm placeholder remedy per-field. Backend-only-writable.
const moderationClearedFieldsShape = {
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
};

export const ItemsKeySchema = z.enum(['tuneTracks', 'chapters', 'televisionEpisodes']);
export type ItemsKey = z.infer<typeof ItemsKeySchema>;

// --- WorkProject content sub-docs ---

export const FullTaleSchema = z.object({
  uid: z.string(),
  title: z.string(),
  description: z.string(),
  createdOn: z.number(),
  coverSquareAssetId: z.string().optional(),
  coverPosterAssetId: z.string().optional(),
  coverCinematicAssetId: z.string().optional(),
  workGenres: z.array(z.string()).optional(),
  ...moderationClearedFieldsShape,
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
});
export type FullChapter = z.infer<typeof FullChapterSchema>;

export const FullTuneSchema = z.object({
  uid: z.string(),
  title: z.string(),
  description: z.string(),
  coverSquareAssetId: z.string().optional(),
  coverPosterAssetId: z.string().optional(),
  coverCinematicAssetId: z.string().optional(),
  workGenres: z.array(z.string()),
  createdOn: z.number(),
  ...moderationClearedFieldsShape,
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
});
export type FullTuneTrack = z.infer<typeof FullTuneTrackSchema>;

export const FullTelevisionSchema = z.object({
  uid: z.string(),
  title: z.string(),
  description: z.string(),
  createdOn: z.number(),
  coverSquareAssetId: z.string().optional(),
  coverPosterAssetId: z.string().optional(),
  coverCinematicAssetId: z.string().optional(),
  workGenres: z.array(z.string()),
  ...moderationClearedFieldsShape,
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
  // Parody / real-people AUTHOR ATTESTATION (R3, 2026-07-12). The submitting artisan
  // attests at threshold SUBMIT time that this work depicts real people (parody /
  // satire / commentary); stored with the submission and displayed READ-ONLY to the
  // reviewer. Admins never set or edit it — a reviewer who believes the flag is
  // needed and missing sends the item back needs-revision. The disclaimer shown on
  // published items is the ONE standard platform message
  // (REAL_PEOPLE_DISCLAIMER_MESSAGE) — there is no free-text disclaimer anywhere.
  hasRealPeople: z.boolean(),
});
export type ThresholdItem = z.infer<typeof ThresholdItemSchema>;

// --- Published change requests (launch: text-only) ---

/** The published hall-content surfaces whose TEXT fields a change request (and the
 *  moderation text-clear remedy) can target. Detail surfaces live on the hall parent;
 *  sub-item surfaces on the published chapter/track/episode doc; the `workRealm`
 *  surface targets the single `workRealms/{id}` doc (the realm grain of the one
 *  text-change pipeline — R1, 2026-07-12). */
export const HallContentTextSurfaceSchema = z.enum([
  'tale',
  'tune',
  'television',
  'chapter',
  'tuneTrack',
  'televisionEpisode',
  'workRealm',
]);
export type HallContentTextSurface = z.infer<typeof HallContentTextSurfaceSchema>;

/** The ONE canonical hall sub-item kind (a Tale chapter / Tune track / Television
 * episode) as carried on notification metadata and Streetz post payloads. Distinct
 * from `HallContentTextSurfaceSchema` (which keys text-change surfaces and uses the
 * compound `tuneTrack`/`televisionEpisode` identifiers). Never re-declare inline. */
export const HallSubItemTypeSchema = z.enum(['chapter', 'track', 'episode']);
export type HallSubItemType = z.infer<typeof HallSubItemTypeSchema>;

/** The ONE canonical published-hall-item lifecycle status. */
export const PublishedHallItemStatusSchema = z.enum(['published', 'paused', 'banned']);
export type PublishedHallItemStatus = z.infer<typeof PublishedHallItemStatusSchema>;

// A member's proposal to change TEXT fields on a PUBLISHED hall item (Ruling 2 of the
// admin-work-correspondence order). The live published item is NEVER unlocked and never
// edited by the member — this doc carries the PROPOSED values only; OLD values render
// live from the published docs. Approve = server writes the values onto the published
// item + its live in-Work source doc; deny = nothing changes, `resolutionReason` shown
// to the member. Writes are callable-only; reads are the owning work's active guildmates
// + admins. `requestKind` future-proofs a media variant (new kind, no schema break).
export const HallContentChangeRequestSchema = z.object({
  changeRequestId: z.string(),
  requestKind: z.literal('text'),
  // One-open-per-target enforcement/query key. Hall grains:
  // `${hallItemId}_${subItemId ?? 'detail'}`; realm grain: `realm_${workRealmId}`.
  targetKey: z.string(),
  // null ⇒ the workRealm grain (no hall item involved).
  hallItemId: z.string().nullable(),
  // Always set. On the workRealm grain this is the realm's foundingWorkProjectId
  // (server-derived) so the owner list read, rules, and admin-task fields keep
  // one uniform key across all grains.
  workProjectId: z.string(),
  // null ⇒ the workRealm grain (a realm has no work-project type).
  workProjectType: z.enum(WORK_PROJECT_TYPE_KEYS).nullable(),
  surface: HallContentTextSurfaceSchema,
  // Set ⇒ the workRealm grain; null on the hall grains.
  workRealmId: z.string().nullable(),
  // null ⇒ the hall parent DETAIL (or the workRealm grain); set ⇒ a
  // chapter/track/episode sub-item.
  subItemId: z.string().nullable(),
  proposerUid: z.string(),
  // Raw doc field name → proposed new text. Allowlist + per-field caps enforced by the
  // submit runner against HALL_CONTENT_TEXT_FIELDS / HALL_CONTENT_TEXT_FIELD_MAX.
  proposedFields: z.record(z.string(), z.string()),
  status: z.enum(['requested', 'approved', 'denied']),
  createdAt: z.number(),
  lastUpdatedAt: z.number(),
  resolvedAt: z.number().optional(),
  resolvedBy: z.string().optional(),
  // Admin's reason, surfaced to the member (required on a deny).
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
  coverSquareAssetId: z.string().optional(),
  coverPosterAssetId: z.string().optional(),
  coverCinematicAssetId: z.string().optional(),
  workGenres: z.array(z.string()).optional(),
  followerCount: z.number().optional(),
  hidden: z.boolean(),
  // Whether the current hide was applied DIRECTly to this item or propagated by a moderation
  // CASCADE from a parent (realm/work). Absent when not hidden. Backend-only-writable.
  hiddenBy: z.enum(['direct', 'cascade']).optional(),
  // Moderation text-clear remedy (extends the workProject/workRealm placeholder family, per-field):
  // which text fields an admin cleared to a neutral placeholder and now await steward re-entry
  // (e.g. ['title', 'description']). Empty/absent when nothing was cleared. `moderationClearedReason`
  // is the operator's reason (shown on the steward's edit surface). Backend-only-writable.
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
  // Parody / real-people flag (carried from the approved ThresholdItem's AUTHOR
  // attestation — R3, 2026-07-12). When true, display surfaces render the ONE
  // standard platform message (REAL_PEOPLE_DISCLAIMER_MESSAGE) prominently on the
  // published Work — never a stored free-text disclaimer. Backend-written at publish.
  hasRealPeople: z.boolean().optional(),
});
export type PublishedHallItem = z.infer<typeof PublishedHallItemSchema>;

export const PublishedTuneTrackSchema = z.object({
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  audioAssetId: z.string(),
  photoAssetId: z.string().optional(),
  hidden: z.boolean(),
  // Direct hide vs cascade-from-parent (see PublishedHallItemSchema). Absent when not hidden.
  hiddenBy: z.enum(['direct', 'cascade']).optional(),
  // Per-field moderation text-clear remedy (see PublishedHallItemSchema): which text fields were
  // cleared to a neutral placeholder and await steward re-entry, plus the operator's reason.
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
});
export type PublishedTuneTrack = z.infer<typeof PublishedTuneTrackSchema>;

export const PublishedChapterSchema = z.object({
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  content: z.string(),
  photoAssetId: z.string().optional(),
  hidden: z.boolean(),
  // Direct hide vs cascade-from-parent (see PublishedHallItemSchema). Absent when not hidden.
  hiddenBy: z.enum(['direct', 'cascade']).optional(),
  // Per-field moderation text-clear remedy (see PublishedHallItemSchema): which text fields were
  // cleared to a neutral placeholder and await steward re-entry, plus the operator's reason.
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
});
export type PublishedChapter = z.infer<typeof PublishedChapterSchema>;

export const PublishedTelevisionEpisodeSchema = z.object({
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  videoAssetId: z.string(),
  photoAssetId: z.string().optional(),
  hidden: z.boolean(),
  // Direct hide vs cascade-from-parent (see PublishedHallItemSchema). Absent when not hidden.
  hiddenBy: z.enum(['direct', 'cascade']).optional(),
  // Per-field moderation text-clear remedy (see PublishedHallItemSchema): which text fields were
  // cleared to a neutral placeholder and await steward re-entry, plus the operator's reason.
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
});
export type PublishedTelevisionEpisode = z.infer<typeof PublishedTelevisionEpisodeSchema>;

// --- Hall library user preferences (per-user Hall viewing-state doc) ---

// One per-user home, server-synced from day 1 (hall-viewing-experience Area 2, ruled
// 2026-07-04): `userProfiles/{uid}/privateData/hallLibraryPreferences` (see
// PATH_BUILDERS.hallLibraryPreferences). Writes are CALLABLE-ONLY — one core owns this
// doc; heartbeat throttling for playback progress is client-side before the callable
// fires. Every list on this doc is capped for launch (see HALL_LIBRARY_PREFS_CAPS) —
// no unbounded per-user lists.
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
  // Hall items the user personally hid (view filter only — see Area 6 ruling 5). Capped
  // ~200: oldest-pruned, or the hide is rejected with a friendly message once full.
  hiddenWorkIds: z.array(z.string()),
  // The "Inked" save-for-later watchlist (My Playbill Area 7). Capped ~200.
  inkedWorkIds: z.array(z.string()),
  // Resume position per hallItemId, LRU-capped ~50 (see HALL_LIBRARY_PREFS_CAPS.inProgress).
  // Cap enforcement is the backend core's job on write; this schema only models the shape.
  inProgress: z.record(z.string(), HallLibraryInProgressEntrySchema),
  // Server-side Keep-going/History rail source, capped ~20.
  recentlyViewed: z.array(HallLibraryRecentlyViewedEntrySchema),
  settings: HallLibrarySettingsSchema,
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
  // Content version — bumped by the update callable on EVERY save (content-pages
  // migration, DJ ruling 2026-07-06). Optional because pre-migration docs lack
  // it; readers treat absence as version 1.
  version: z.number().optional(),
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
  // Content version — bumped by the update callable on EVERY save (content-pages
  // migration, DJ ruling 2026-07-06). Optional because pre-migration docs lack
  // it; readers treat absence as version 1.
  version: z.number().optional(),
});
export type RulesAndAgreements = z.infer<typeof RulesAndAgreementsSchema>;

// --- Editable content-page docs (content-pages Firestore migration, DJ ruling 2026-07-06) ---
//
// /terms, /privacy, and the /take-it-down page copy render EXCLUSIVELY from
// these `_config` singletons — no hardcoded fallbacks anywhere (banned design).
// Seed callables create them (strict seed-if-empty: doc exists ⇒ no-op); admin
// editors are the only writers after that, and every save bumps `version`.
// Acceptance records (e.g. privateData.agreements.termsVersion) read `version`
// from the DOC server-side at acceptance time — never from a constant.
// There is NO draft flag on any content doc (DJ ruling 2026-07-06).

/** One section of a long-form content page. `level` 1 = section (h2), 2 = subsection (h3). */
export const ContentPageSectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  level: z.union([z.literal(1), z.literal(2)]),
  /** Plain text; blank-line-separated paragraphs. */
  body: z.string(),
  order: z.number(),
});
export type ContentPageSection = z.infer<typeof ContentPageSectionSchema>;

/** Long-form legal page doc — the shape of BOTH `_config/termsOfService` and `_config/privacyPolicy`. */
export const LegalPageDocumentSchema = z.object({
  version: z.number(),
  lastUpdated: z.number(),
  sections: z.array(ContentPageSectionSchema),
});
export type LegalPageDocument = z.infer<typeof LegalPageDocumentSchema>;

/**
 * `_config/takeItDownPageCopy` — the /take-it-down page's user-facing language as
 * a keyed strings map (the page is a functional form, so its copy is discrete
 * labeled strings, not long-form sections). Keys are stable identifiers defined
 * by the page (e.g. `pageTitle`, `introBody`); the admin editor renders one
 * labeled text field per key.
 */
export const TakeItDownPageCopySchema = z.object({
  version: z.number(),
  lastUpdated: z.number(),
  strings: z.record(z.string(), z.string()),
});
export type TakeItDownPageCopy = z.infer<typeof TakeItDownPageCopySchema>;
