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
  'safetyEvidence', // inert system sentinel — synthetic NCII-evidence assets (never an account surface)
]);
export type MediaAssetOwnerType = z.infer<typeof MediaAssetOwnerTypeSchema>;

// ===== Media origin lineage (Appendix A0) =====
// One canonical lineage used by media, CSAM, and safety. Embedded on every
// media asset + every copy.

/**
 * The named-variant key set for `variantSha256s`. It is the union of declared
 * `image.variants[].key` values across `TTT_MEDIA_SPECS` (the processing
 * pipeline produces exactly one hash per declared variant), never an open
 * `string`. `media-origin-lineage.test.ts` keeps this enum in sync with the
 * declared variant keys (the same way the PhotoDNA coverage matrix tracks
 * `accept.kinds`); a new declared variant name fails CI until added here.
 */
export const MediaVariantKeySchema = z.enum(['full', 'medium', 'small', 'main']);
export type MediaVariantKey = z.infer<typeof MediaVariantKeySchema>;

/** Why this asset was created from its source (A0). */
export const MediaCopyReasonSchema = z.enum([
  'original',
  'variant',
  'hall_publish',
  'profile_derivative',
  'chat_derivative',
  'moderation_copy',
  'evidence_copy',
  'other',
]);
export type MediaCopyReason = z.infer<typeof MediaCopyReasonSchema>;

/**
 * Canonical media origin lineage (Appendix A0). A copy INHERITS
 * rootIngestId/rootAssetId/originatingUploaderUid/originatingUploadEventId/
 * originalUploadCreatedAt/rootSha256/originalSha256 unchanged; it sets its own
 * sourceAssetId/variantSha256s/copyReason/copyActorUid/currentOwner*. Client
 * requests can NEVER set or override any lineage field. Automatic account
 * action targets ONLY `originatingUploaderUid`; incident-wide blocking
 * enumerates by `rootIngestId`. Missing/corrupt lineage → safetyLocked +
 * manual decision, never a guessed ban.
 */
export const MediaOriginLineageV1Schema = z.object({
  lineageVersion: z.literal(1),
  rootIngestId: z.string().min(1), // first-accepted ingest event id; stable across all copies
  rootAssetId: z.string().min(1), // first asset created from that ingest
  sourceAssetId: z.string().min(1).optional(), // immediate parent copied from (absent on the root)
  originatingUploaderUid: z.string().min(1), // set server-side at first accepted ingest; IMMUTABLE; inherited
  // May be '' for a legacy copy synthesized from a pre-rollout source with no known upload event.
  originatingUploadEventId: z.string(),
  originalUploadCreatedAt: z.number(),
  // '' until content hashing backfills the real sha256 (Phase 5 PhotoDNA / evidence capture).
  // NOT z.string().min(1): the media pipeline does not compute a content hash at finalize yet,
  // so a freshly-ingested asset legitimately carries an empty rootSha256 until it is hashed.
  rootSha256: z.string(),
  originalSha256: z.string().min(1).optional(),
  // PARTIAL map: one hash per PRODUCED variant (an asset produces only the variants its
  // origin declares — e.g. full/medium/small for a profile picture, 'main' for others —
  // never all four). Typed keys, never an open string. `z.partialRecord` (NOT `z.record`):
  // in Zod 4 `z.record(enum,…)` is EXHAUSTIVE (demands every enum key), which would reject
  // every real asset's partial variant set; `partialRecord` makes the keys optional.
  variantSha256s: z.partialRecord(MediaVariantKeySchema, z.string().min(1)),
  copyReason: MediaCopyReasonSchema,
  createdFromOwnerType: MediaAssetOwnerTypeSchema.optional(), // never a bare string
  createdFromOwnerId: z.string().min(1).optional(),
  copyActorUid: z.string().min(1).optional(), // who triggered the copy (distinct from the original uploader)
  currentOwnerType: MediaAssetOwnerTypeSchema, // mutable; the asset's present owner
  currentOwnerId: z.string().min(1),
}).strict();
export type MediaOriginLineageV1 = z.infer<typeof MediaOriginLineageV1Schema>;

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

// Realm shared-files: a work file's standing in its realm's shared pool.
//   none     — not shared to the realm (default)
//   nonCanon — shared to the realm's pool, non-canon
//   canon    — shared and marked canon (realm steward/owner toggles canon ↔ nonCanon)
// Moderation/takedown is NOT a value here — a hidden file is hidden via the shared
// media path (`servingStatus: 'hidden'`), so the gallery filters on servingStatus.
export const RealmFileCanonStatusSchema = z.enum(['none', 'nonCanon', 'canon']);
export type RealmFileCanonStatus = z.infer<typeof RealmFileCanonStatusSchema>;

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
 * Typed immutable serving scope for scoped-tier assets. The gateway Worker matches
 * a grant against the scope by `kind` — so a whole-Work `{w}` grant matches ONLY a
 * `workProject` scope, NEVER a `guildChannel` scope (even though both carry a
 * `workProjectId`): a restricted channel's attachment is not reachable by a plain
 * Work grant, and a chat grant is not reachable by a Work asset.
 *
 * - `workProject` — pre-publish content media (hall covers / sub-item media during
 *   authoring), scoped to project read membership. Carries the matchable
 *   `workProjectId`. This is the typed home for work scope on the strongly-consistent
 *   serving record so the DO-fallback path can authorize it (the DO persists scope
 *   only as `scopeJson`, no separate column).
 * - `workFileFolder` — a work-project FILE living in a folder. The EXACT folder scope,
 *   NOT the whole-Work `{w}` grant: a custom folder's bytes must be unreachable by a
 *   guildmate outside that folder's view trade-professions, so the grant callable runs
 *   the per-folder view check and the Worker EXACT-matches `{workProjectId,
 *   workFileFolderId}` — a plain Work `{w}` grant NEVER matches a folder file, and a
 *   folder grant NEVER matches a `workProject`-scoped content asset.
 * - `guildChannel` / `guildInvite` — guild-chat attachments; an EXACT channel/
 *   invite scope (Contract E "Chat attachment authorization"). A guildChannel's
 *   `workProjectId` lives ONLY inside this scope, never as a bare matchable field.
 *
 * `null` scope = no scope match required beyond the access tier (e.g. broad).
 */
export const MediaServingScopeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('workProject'),
    workProjectId: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal('workFileFolder'),
    workProjectId: z.string().min(1),
    workFileFolderId: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal('guildChannel'),
    workProjectId: z.string().min(1),
    guildChatChannelId: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal('guildInvite'),
    guildInviteId: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal('adminSupport'),
    adminDispatchId: z.string().min(1),
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
  // Realm cover — Firestore-owner adapter writes `realmCoverAssetId` onto
  // workRealms/{workRealmId} (the 'realm-cover' upload origin).
  'realmCover',
  'workContentMedia', // sub-item media (tale chapter / tune track / television episode) — attaches the *AssetId field on the workContent doc; scoped to the work project
  'auditionMedia',
  'commissionListingMedia',
  'commissionProposalMedia',
  'craftSkillMedia',
  'chatAttachment',
  // Admin-support thread attachment: Firestore-transported (no Durable Object), so its
  // publication adapter does a Firestore owner write (flips the dispatch message placeholder),
  // unlike DO-ack'd `chatAttachment`. Carries the typed `adminSupport` MediaServingScope.
  'adminSupportAttachment',
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

  // T&S provenance lineage (Appendix A0). Additive/optional so assets written
  // before the lineage rollout still parse; set server-side at first accepted
  // ingest, inherited unchanged by every copy/variant. Never client-supplied.
  originLineage: MediaOriginLineageV1Schema.optional(),

  // Realm shared-files seam. A file's standing in its realm's shared pool; set at
  // creation to 'none' and moved by the realm shared-files callables. Attribution
  // fields (who set canon, when) are added by that feature when it ships.
  realmFileCanonStatus: RealmFileCanonStatusSchema,

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
  // Authority-sync retry ledger (M1): the scheduled worker bumps attemptCount + sets a backoff
  // nextAttemptAt on a transient apply failure, and dead-letters (authoritySyncState='deadLetter')
  // past a threshold. Absent ⇒ 0 attempts / immediately due.
  authoritySyncAttemptCount: z.number().int().nonnegative().optional(),
  authoritySyncNextAttemptAt: z.number().optional(),

  createdAt: z.number(),
  updatedAt: z.number(),
}).strict();
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
