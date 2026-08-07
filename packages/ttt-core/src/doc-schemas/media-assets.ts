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
  // A file in a conversation's flat Conversation Files list (guild-invite or
  // admin-support). Replaces the removed `guildChatAttachment` owner type — chat
  // messages no longer own media.
  'conversationFile',
  // Realm shared files are the deliberate MUTATE-IN-PLACE exception: a promoted work file
  // keeps its ONE `workFile`-owned asset doc and flips tier in place, so no asset is ever
  // owned by `realmFile` today. The owner type stays declared for a future realm-owned
  // media surface; it is NOT the seam realm sharing rides (that is `realmFileCanonStatus`
  // + `realmId` + `realmFileFolderId` on the work file's own asset).
  'realmFile',
  'safetyEvidence', // inert system sentinel — synthetic NCII-evidence assets (never an account surface)
]);
export type MediaAssetOwnerType = z.infer<typeof MediaAssetOwnerTypeSchema>;

// ===== Media origin lineage (Appendix A0) =====
// One canonical lineage used by media, CSAM, and safety. Embedded on every
// media asset + every copy.

/** The ONE canonical stored content media kind (what the pipeline produces and the
 * asset doc records). Distinct from the 4-value display/transport MediaTypeSchema
 * (doc-schemas/social.ts, adds 'other') and media-schemas' generic MediaKindSchema. */
export const ContentMediaKindSchema = z.enum(['image', 'video', 'audio']);
export type ContentMediaKind = z.infer<typeof ContentMediaKindSchema>;

/**
 * The named-variant key set for `variantSha256s` — declared ONCE here; every declared
 * `image.variants[].key` in `TTT_MEDIA_SPECS` is compile-checked against this union
 * (the specs type their variant keys as `MediaVariantKey`), so an undeclared variant
 * name fails the BUILD — no sync test needed. Never an open `string`.
 */
export const MEDIA_VARIANT_KEYS = ['full', 'medium', 'small', 'main'] as const;
export const MediaVariantKeySchema = z.enum(MEDIA_VARIANT_KEYS);
export type MediaVariantKey = z.infer<typeof MediaVariantKeySchema>;

/** Why this asset was created from its source (A0).
 *
 * `chat_derivative` was REMOVED with the chat-attachment architecture: chat is
 * text-only and owns no media, so no copy can be made "for a chat message". A
 * Conversation File is an ORIGINAL (`original`), never a chat derivative; nothing
 * ever set the retired value. */
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
  /**
   * Server-owned filename the gateway puts in `Content-Disposition` for a
   * `?download=1` request. VARIANT-specific on purpose: the downloadable bytes are
   * a PROCESSED variant, so the extension must match THIS variant's actual
   * `contentType` — a transcoded JPEG/WebP/MP4 is never labelled with the original
   * upload's incompatible extension.
   *
   * Written ONLY by backend publishers, and ONLY for surfaces that intentionally
   * offer a Download action — Work Files (including the same asset shared to a
   * Realm), Conversation Files, and downloadable Hall media. Profiles, posts,
   * covers, and every other surface leave it ABSENT so no private original filename
   * is ever exposed; an absent value serves the safe bare `attachment` disposition.
   *
   * Always produced by `normalizeDownloadFilename` (media/download-filename.ts) —
   * that helper owns the sanitization rules and the UTF-8 byte cap, so no bound is
   * restated here. A client query parameter is NEVER the filename authority.
   * Filenames are user content: never log this value.
   */
  downloadFilename: z.string().min(1).optional(),
}).strict();
export type MediaAssetVariant = z.infer<typeof MediaAssetVariantSchema>;

export const MediaRetentionPolicySchema = z.enum([
  'standard', // staging original deleted ~24h after verified mirror
  'preserveForTrustAndSafety',
  'legalHold',
]);
export type MediaRetentionPolicy = z.infer<typeof MediaRetentionPolicySchema>;

// Realm shared-files: a work file's standing in its realm's shared pool. ONE seam — the
// approval gate is a value in this union, never a parallel status field.
//   none            — not shared to the realm (default)
//   pendingApproval — a Work file admin has REQUESTED promotion; the Realm steward has not
//                     decided yet. The file is NOT served to the Realm (tier stays `scoped`)
//                     and is invisible to the member gallery, whose query selects only
//                     nonCanon|canon — so pending rows are excluded structurally, not by a
//                     filter someone can forget.
//   nonCanon        — approved into the realm's pool (in a steward-chosen folder), non-canon
//   canon           — approved and marked canon (realm steward toggles canon ↔ nonCanon)
// Moderation/takedown is NOT a value here — a hidden file is hidden via the shared
// media path (`servingStatus: 'hidden'`), so the gallery filters on servingStatus.
//
// Each member is declared ONCE as a named constant below and every set is assembled from
// those names, so a member constant and the sets that contain it cannot drift apart.

/** Not shared to the realm — the default standing for every work file. */
export const REALM_FILE_NONE_STATUS = 'none' as const;
/** The single AWAITING-DECISION standing. Exported as a VALUE as well as a schema so a
 *  consumer can branch on it (`status === REALM_FILE_PENDING_APPROVAL_STATUS`) without
 *  re-quoting the member — the redeclaration guard pins this literal to this file. */
export const REALM_FILE_PENDING_APPROVAL_STATUS = 'pendingApproval' as const;
/** Approved into the realm's shared pool, not marked canon. */
export const REALM_FILE_NON_CANON_STATUS = 'nonCanon' as const;
/** Approved into the realm's shared pool AND marked canon by the Realm steward. */
export const REALM_FILE_CANON_STATUS = 'canon' as const;

export const REALM_FILE_CANON_STATUS_VALUES = [
  REALM_FILE_NONE_STATUS,
  REALM_FILE_PENDING_APPROVAL_STATUS,
  REALM_FILE_NON_CANON_STATUS,
  REALM_FILE_CANON_STATUS,
] as const;
export const RealmFileCanonStatusSchema = z.enum(REALM_FILE_CANON_STATUS_VALUES);
export type RealmFileCanonStatus = z.infer<typeof RealmFileCanonStatusSchema>;

/** The two APPROVED (steward-accepted, realm-served) standings. The member gallery query
 *  and its projection accept exactly these — never the full status union, so a pending or
 *  unshared row can never be typed into an approved-files response. Derived from the one
 *  union above; consumers import this instead of re-quoting the members (ARCH-102). */
export const REALM_FILE_APPROVED_STATUS_VALUES = [
  REALM_FILE_NON_CANON_STATUS,
  REALM_FILE_CANON_STATUS,
] as const;
export const RealmFileApprovedStatusSchema = z.enum(REALM_FILE_APPROVED_STATUS_VALUES);
export type RealmFileApprovedStatus = z.infer<typeof RealmFileApprovedStatusSchema>;

/** The steward promotion-queue projection accepts only this, so an approved or unshared row
 *  can never be typed into the queue. */
export const RealmFilePendingApprovalStatusSchema = z.literal(REALM_FILE_PENDING_APPROVAL_STATUS);
export type RealmFilePendingApprovalStatus = z.infer<typeof RealmFilePendingApprovalStatusSchema>;

/** Every standing EXCEPT `none` — a file that has entered the request/approval lifecycle at
 *  all. Derived from the two subsets above, so adding a future standing to one of them
 *  reaches this set automatically. Used by the Work-side share-state projection, whose rows
 *  exist only for files that are actually requested or shared. */
export const REALM_FILE_ACTIVE_STATUS_VALUES = [
  REALM_FILE_PENDING_APPROVAL_STATUS,
  ...REALM_FILE_APPROVED_STATUS_VALUES,
] as const;
export const RealmFileActiveStatusSchema = z.enum(REALM_FILE_ACTIVE_STATUS_VALUES);
export type RealmFileActiveStatus = z.infer<typeof RealmFileActiveStatusSchema>;

// ===== Serving authority (Durable Object) + publication gating =====
// See ttt-prod docs/design/media-assets-and-protected-serving.md (the design owner
// for the Durable Object serving authority and publication gating).

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
 * `workProject` scope, never a conversation scope, and a conversation grant is never
 * reachable by a Work asset.
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
 * - `guildInvite` / `adminSupport` — the two Conversation Files scopes; an EXACT
 *   conversation scope, matching the `ConversationFileRef` that owns the file. There is
 *   NO guildChannel scope: guild chat channels have no Conversation Files (guildmates
 *   share files through Work Files, which keeps its own workFileFolder scope).
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
 * The typed owner adapter a publication goes through. The activation job
 * carries this kind; a server-side registry validates per-kind `publicationArgs`
 * and performs the idempotent owner write. Every kind is a Firestore-owner adapter.
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
  // Conversation File: the ONE adapter that creates a visible Conversation File owner
  // record ({conversationParent}/conversationFiles/{conversationFileId}) and transfers
  // the quota reservation to published counters in the same transaction. Replaces the
  // removed `chatAttachment` (Channel-DO flip) and `adminSupportAttachment` (message
  // placeholder flip) kinds. Carries the typed `guildInvite` / `adminSupport`
  // MediaServingScope of the owning conversation.
  'conversationFile',
]);
export type MediaPublicationKind = z.infer<typeof MediaPublicationKindSchema>;

/**
 * The normalized serving record — the SAME contract used to generate both
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
  mediaKind: ContentMediaKindSchema,
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

  // ===== Realm shared-files seam (request → steward approval → foldered pool) =====
  // A file's standing in its realm's shared pool; set at creation to 'none' and moved
  // ONLY by the realm shared-files callables. The legal combinations of this field with
  // `realmId`, `realmFileFolderId`, and the three request fields are ENFORCED by the
  // refinement below — the fields are not independently optional.
  realmFileCanonStatus: RealmFileCanonStatusSchema,

  // The steward-chosen folder under `workRealms/{realmId}/realmFileFolders/{id}`. There is
  // no default folder: approval IS the folder assignment, so every approved file is in a
  // folder by construction. Cleared on decline, withdrawal, and admin un-share — but
  // PRESERVED through moderation hide/restore (hide is reversible and changes serving state
  // only; clearing it would restore an approved file with no folder and lose the steward's
  // organization).
  realmFileFolderId: z.string().min(1).optional(),

  // Pending-request metadata, present ONLY while `realmFileCanonStatus === 'pendingApproval'`.
  // `realmFileShareRequestId` is the CLIENT-GENERATED stable request id carried by the
  // request input; approval, decline, and withdrawal all compare against it, so a stale tab
  // can never decide a newer re-request. `realmFileShareRequestedByUid` is the recorded
  // requester — the resolution notification is addressed from THIS field, never guessed from
  // `createdByUid` (the uploader and the promoting file admin are frequently different
  // people). `realmFileShareRequestedAt` is epoch ms (ARCH-105).
  realmFileShareRequestId: z.string().min(1).optional(),
  realmFileShareRequestedByUid: z.string().min(1).optional(),
  realmFileShareRequestedAt: z.number().optional(),

  // Serving authority + publication gating. Additive/optional so assets
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
}).strict().superRefine((val, ctx) => {
  // ===== Realm-file legal-combination invariant =====
  // The realm-file field GROUP is one state machine, not five independently-optional
  // fields. Declared HERE, on the canonical doc schema (ARCH-102), so every writer inherits
  // it from one parse instead of each transition re-deciding — and so no reader ever has to
  // defend against a half-written state (an approved file with no folder, a pending file
  // already flipped into the realm, a decline that left request metadata behind).
  //
  //   none            → no realmId, no folder, no request fields
  //   pendingApproval → realmId + ALL THREE request fields; NO folder (approval assigns it)
  //   nonCanon|canon  → realmId + folder; NO request fields (the request is resolved)
  //
  // DELIBERATELY NOT CONSTRAINED HERE: `accessTier`. Tier is origin-dependent across the
  // whole asset universe (this one schema covers every media origin, not just work files),
  // so binding tier to a realm-file status would misjudge assets that have nothing to do
  // with realms. Tier correctness on these transitions (`scoped` while pending, `artisan`
  // once approved) is enforced by the callable transactions and their tests.
  // `servingStatus` stays orthogonal too — moderation hide/quarantine is independent of a
  // file's realm standing.
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
    forbid('realmId', val.realmId, 'realmId is only set on a realm-shared or pending asset (realmFileCanonStatus is "none")');
    forbid('realmFileFolderId', val.realmFileFolderId, 'realmFileFolderId is only set on an APPROVED realm-shared asset (realmFileCanonStatus is "none")');
    for (const [path, value] of requestFields) {
      forbid(path, value, `${path} is only set while a promotion request is pending (realmFileCanonStatus is "none")`);
    }
    return;
  }

  require_('realmId', val.realmId, `realmId is required whenever realmFileCanonStatus is "${val.realmFileCanonStatus}"`);

  if (val.realmFileCanonStatus === 'pendingApproval') {
    forbid('realmFileFolderId', val.realmFileFolderId, 'a pending request has no folder yet — the steward assigns the folder AT approval');
    for (const [path, value] of requestFields) {
      require_(path, value, `${path} is required while realmFileCanonStatus is "pendingApproval"`);
    }
    return;
  }

  // 'nonCanon' | 'canon' — approved into the pool.
  require_('realmFileFolderId', val.realmFileFolderId, `realmFileFolderId is required on an approved realm file (realmFileCanonStatus is "${val.realmFileCanonStatus}")`);
  for (const [path, value] of requestFields) {
    forbid(path, value, `${path} must be cleared once the request is resolved (realmFileCanonStatus is "${val.realmFileCanonStatus}")`);
  }
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
