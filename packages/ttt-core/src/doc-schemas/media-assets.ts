// mediaAssets/{mediaAssetId} — the canonical media registry. One doc per
// logical uploaded media item; all variants inside. Content docs reference
// media ONLY by `*AssetId` fields — never URLs. Serving authority is the
// gateway Worker (cookie/grant + KV blocklist); this doc is the server-side
// truth the edge records derive from. NO client reads, NO client writes.
// See ttt-prod docs/design/media-assets-and-protected-serving.md.

import { z } from 'zod';
import { FileOriginSchema } from '../media/file-origin.js';

/** Who may be served the bytes (the Worker's tier check). */
export const MediaAccessTierSchema = z.enum(['broad', 'scoped', 'artisan', 'adminOnly']);
export type MediaAccessTier = z.infer<typeof MediaAccessTierSchema>;

/** Canonical serving state. The edge record derives from this; hide/restore/
 * quarantine flows write it together with the blocklist. */
export const MediaServingStatusSchema = z.enum(['servable', 'hidden', 'quarantined', 'deleted']);
export type MediaServingStatus = z.infer<typeof MediaServingStatusSchema>;

/** The surface that owns this asset. One asset never serves two scopes —
 * publishing to the Hall (or future realm promotion) creates a NEW asset
 * owned by the destination surface. */
export const MediaAssetOwnerTypeSchema = z.enum([
  'userProfile',
  'craftSkill',
  'squareStreetzPost',
  'workProject',
  'workContent', // tale chapter / tune track / television episode media (pre-publish)
  'hallItem',
  'commissionListing',
  'commissionProposal',
  'audition',
  'auditionEntry',
  'guildChatAttachment',
  'realmFile', // reserved seam — realm shared files are post-launch
]);
export type MediaAssetOwnerType = z.infer<typeof MediaAssetOwnerTypeSchema>;

export const MediaAssetVariantSchema = z.object({
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSec: z.number().positive().optional(),
}).strict();
export type MediaAssetVariant = z.infer<typeof MediaAssetVariantSchema>;

export const MediaRetentionPolicySchema = z.enum([
  'standard', // staging original deleted ~24h after verified mirror
  'preserveForTrustAndSafety',
  'legalHold',
]);
export type MediaRetentionPolicy = z.infer<typeof MediaRetentionPolicySchema>;

export const RealmPromotionStatusSchema = z.enum([
  'none', 'candidate', 'pendingReview', 'promoted', 'rejected',
]);
export type RealmPromotionStatus = z.infer<typeof RealmPromotionStatusSchema>;

export const MediaAssetSchema = z.object({
  mediaAssetId: z.string().min(1),
  mediaKind: z.enum(['image', 'video', 'audio']),
  fileOrigin: FileOriginSchema,

  // Ownership / scope. ownerId is the owning doc's id within ownerType's
  // surface; scope ids let the Worker/grant layer match scoped access.
  ownerType: MediaAssetOwnerTypeSchema,
  ownerId: z.string().min(1),
  workProjectId: z.string().optional(),
  realmId: z.string().optional(),
  createdByUid: z.string().min(1),

  // Access + serving (canonical; edge records derive from these).
  accessTier: MediaAccessTierSchema,
  servingStatus: MediaServingStatusSchema,

  // Variants by key. The object key in R2 (and the Storage emulator) is
  // deterministic — mediaAssets/{mediaAssetId}/{variantKey} — never stored.
  variants: z.record(z.string(), MediaAssetVariantSchema),

  // Lifecycle / trust-and-safety.
  moderationStatus: z.enum(['approved', 'quarantined']),
  retentionPolicy: MediaRetentionPolicySchema,
  legalHold: z.boolean(),
  originalDeletedAt: z.number().optional(),

  // Realm-promotion seam (full feature is post-launch).
  realmPromotionStatus: RealmPromotionStatusSchema,
  realmPromotionNote: z.string().max(2000).optional(),
  realmPromotionRequestedByUid: z.string().optional(),
  realmPromotionRequestedAt: z.number().optional(),

  createdAt: z.number(),
  updatedAt: z.number(),
}).strict();
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
