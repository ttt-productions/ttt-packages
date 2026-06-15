// mediaAssets/{mediaAssetId} — the canonical media registry. One doc per
// logical uploaded media item; all variants inside. Content docs reference
// media ONLY by `*AssetId` fields — never URLs. Serving authority is the
// gateway Worker (cookie/grant + KV blocklist); this doc is the server-side
// truth the edge records derive from. NO client reads, NO client writes.
// See ttt-prod docs/design/media-assets-and-protected-serving.md.

import { z } from 'zod';
import { StructuredErrorSchema } from '@ttt-productions/edge-protocol-core';
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

// ===== Serving authority (Durable Object) + publication gating =====
// See MEDIA_AUTHORITY_DO_DESIGN.md §6–§9/§13 and media-assets-and-protected-serving.md.

/** Whether the canonical serving record has been applied to the DO authority. */
export const MediaAuthoritySyncStateSchema = z.enum(['pending', 'applied', 'deadLetter']);
export type MediaAuthoritySyncState = z.infer<typeof MediaAuthoritySyncStateSchema>;

/** Whether the asset is referenced by a visible owner doc. Orthogonal to the
 * upload's processing outcome (`pendingMedia.status`) and to `servingStatus`. */
export const MediaAssetPublicationStateSchema = z.enum(['unpublished', 'published', 'retired']);
export type MediaAssetPublicationState = z.infer<typeof MediaAssetPublicationStateSchema>;

/**
 * Typed immutable serving scope for scoped-tier assets. Guild-chat attachments
 * carry an EXACT channel/invite scope — NEVER a bare matchable `workProjectId`
 * (a whole-Work `{w}` grant must not match a restricted channel's attachment).
 * Frozen in chat-realtime-system.md Contract E ("Chat attachment authorization").
 * `null` scope = no scope match required beyond the access tier (e.g. broad).
 */
export const MediaServingScopeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('guildChannel'),
    workProjectId: z.string().min(1),
    guildChatChannelId: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal('guildInvite'),
    guildInviteId: z.string().min(1),
  }).strict(),
]);
export type MediaServingScope = z.infer<typeof MediaServingScopeSchema>;

/**
 * The typed owner adapter a publication goes through (§11). The activation job
 * carries this kind; a server-side registry validates per-kind `publicationArgs`
 * and performs the idempotent owner write. Chat is the non-Firestore-owner
 * adapter (publishes via its durable attachmentFlip ack, not an owner txn).
 */
export const MediaPublicationKindSchema = z.enum([
  'profilePicture',
  'squarePostMedia',
  'workAsset',
  'hallCover',
  'auditionMedia',
  'commissionListingMedia',
  'commissionProposalMedia',
  'craftSkillMedia',
  'chatAttachment',
]);
export type MediaPublicationKind = z.infer<typeof MediaPublicationKindSchema>;

/**
 * The normalized serving record (§7) — the SAME contract used to generate both
 * the DO authority row and the KV cache payload (one function, so they can't
 * drift). The R2 object key stays deterministic (`mediaAssets/{assetId}/{key}`)
 * and is NOT persisted here. `payloadHash` is computed over the canonical
 * payload EXCLUDING the hash itself (see edge-protocol-core `hashPayload`).
 */
export const MediaServingAuthorityRecordSchema = z.object({
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
}).strict();
export type MediaServingAuthorityRecord = z.infer<typeof MediaServingAuthorityRecordSchema>;

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

  // Serving authority + publication gating (§13). Additive/optional so assets
  // written before the authority build still parse: absent authorityVersion ⇒
  // 0/never-applied, absent publicationState ⇒ 'unpublished'. Every
  // serving-record mutation increments authorityVersion in an authoritative txn.
  authorityVersion: z.number().int().nonnegative().optional(),
  authorityPayloadHash: z.string().optional(),
  authoritySyncState: MediaAuthoritySyncStateSchema.optional(),
  publicationState: MediaAssetPublicationStateSchema.optional(),
  scope: MediaServingScopeSchema.optional(),
  authorityAppliedAt: z.number().optional(),
  publishedAt: z.number().optional(),
  lastAuthorityError: StructuredErrorSchema.optional(),

  createdAt: z.number(),
  updatedAt: z.number(),
}).strict();
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
