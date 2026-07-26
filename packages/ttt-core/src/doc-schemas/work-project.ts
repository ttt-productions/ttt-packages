// WorkProject / Realm / Guild Firestore document SCHEMAS — single source of truth.
// Covers allWorkProjects/{workProjectId}, its guildmateUsers/publicGuildmateUsers/
// workAssets subcollections, publicWorkProjects/{workProjectId}, workRealms/{workRealmId},
// and the guildInviteConversations invite shell. Types are inferred via z.infer so a
// document's shape and its TypeScript type cannot drift apart.
//
// Terminology: the current-owner field is `workStewardUid` (locked rename from the old
// `ownerUid`; see ttt-prod docs/design/terminology-naming-convention.md — Steward row). The original
// creator is `foundingArtisanUid` (locked rename from the old `createdByUid`; Founding Artisan).

import { z } from 'zod';
import { HALL_WING_TYPE_KEYS, WORK_PROJECT_TYPE_KEYS } from '../types/content.js';
import { isGuildStandingId, type GuildStandingId } from '../permissions/index.js';

const guildStandingIdSchema = z.custom<GuildStandingId>(isGuildStandingId);
const userRefSchema = z.object({ uid: z.string() });

export const GuildmateStatusSchema = z.enum(['active', 'departed']);
export type GuildmateStatus = z.infer<typeof GuildmateStatusSchema>;

export const GuildmateUserSchema = z.object({
  uid: z.string(),
  guildStandings: z.array(guildStandingIdSchema),
  tradeProfessions: z.array(z.string()),
  stakeShareCount: z.number(),
  joinedAt: z.number(),
  status: GuildmateStatusSchema,
  /**
   * Holder kind for this stake entry. Absent/`'user'` = a real guildmate person.
   * `'foundingWork'` = the realm founding-Work holder (keyed by the founding
   * workProjectId, NOT a user uid).
   */
  holderType: z.enum(['user', 'foundingWork']).optional(),
  /**
   * Per-(user, workProject) monotonic INPUT-trigger version for the chat
   * channel-auth projection (chat-edge-rebuild Contract B / P3). Absent ⇒ 0.
   * Bumped atomically in the authoritative mutation on member create/reactivate,
   * departure/removal, standing change, AND trade-profession change; the
   * `workChannelsForUser` fanout keys on the POST-increment value. It NEVER
   * increments or replaces the per-pair OUTPUT `channelAuthVersion`.
   */
  guildAuthInputVersion: z.number().optional(),
  /**
   * N3 data-deletion / account-end forfeiture tombstone. Set together with
   * `status: 'departed'` when a member leaves involuntarily-of-record: their
   * stake shares STAY in the immutable 1000-split (never removed) but are
   * forfeited — the future payout engine routes a tombstone's slice to the
   * community fund and excludes it from active distribution. `departedReason`
   * distinguishes the cause; `'bannedForCause'` is reserved for the future
   * ban-forfeiture path (included now so it needs no second package publish).
   *
   * `'selfLeave'` is DIFFERENT share semantics: a PRE-PUBLISH voluntary guild
   * exit (leaveWorkProject). There the 1000-split is still fluid, so the
   * member's `stakeShareCount` is ZEROED and returned to the pool for the
   * steward to re-allocate — NOT retained as a community-fund tombstone. A
   * self-leave is impossible once `status: 'published'` (the stake-share freeze
   * blocks it), so the tombstone and the pool-return dispositions never overlap
   * in a single Work's lifecycle.
   */
  departedReason: z.enum(['voluntaryDeletion', 'bannedForCause', 'selfLeave']).optional(),
  departedAt: z.number().optional(),
});
export type GuildmateUser = z.infer<typeof GuildmateUserSchema>;

export const PublicGuildmateUserSchema = z.object({
  uid: z.string(),
  tradeProfessions: z.array(z.string()),
  joinedAt: z.number(),
  status: GuildmateStatusSchema,
});
export type PublicGuildmateUser = z.infer<typeof PublicGuildmateUserSchema>;

export const PendingStakeSharesSchema = z.record(
  z.string(),
  z.object({ amount: z.number(), createdAt: z.number() }),
);
export type PendingStakeShares = z.infer<typeof PendingStakeSharesSchema>;

export const FullWorkProjectSchema = z.object({
  workProjectId: z.string(),
  createdOn: z.number(),
  type: z.string(),
  workingDescription: z.string(),
  workingTitle: z.string(),
  hallWingType: z.enum(HALL_WING_TYPE_KEYS),
  createdBy: userRefSchema,
  status: z.enum(['open', 'pendingVerification', 'published', 'rejected']),
  guildmateUserIds: z.record(z.string(), z.boolean()).optional(),
  invitedUserIds: z.record(z.string(), z.boolean()).optional(),
  workRealmId: z.string(),
  realmCanonStatus: z.enum(['canon', 'nonCanon']),
  pendingStakeShares: PendingStakeSharesSchema.optional(),
  // Moderation "require retitle" remedy (work/realm report path). When an admin
  // upholds a report on an abusive public title/description, they may replace the
  // text with a generic placeholder and set this flag; the steward is prompted to
  // re-enter compliant text the next time they open the work (unpublished = direct
  // self-edit clears it; published = via the post-launch change-request flow).
  // Distinct from the `publicWorkHidden` hide (DMCA/copyright) — this keeps the
  // work visible under the placeholder. Backend-only-writable.
  moderationRetitleRequired: z.boolean().optional(),
  moderationRetitleReason: z.string().optional(),
  // Per-field extension of the retitle remedy (uniform with the Tale/Tune/Television content family):
  // which text fields ('title', 'description', …) an admin cleared to a placeholder — "all or any",
  // instead of the always-both retitle — and the operator's reason surfaced on the steward's edit
  // surface. Empty/absent when nothing was cleared. Backend-only-writable.
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
  moderatedAt: z.number().optional(),
});
export type FullWorkProject = z.infer<typeof FullWorkProjectSchema>;

// Top-level safe signed-in-user Work shell / search projection. Server/callable-written only.
export const PublicWorkProjectSchema = z.object({
  workProjectId: z.string(),
  publicWorkStatus: z.enum(['draft', 'released']),
  publicWorkHidden: z.boolean(),
  workRealmId: z.string(),
  realmCanonStatus: z.enum(['canon', 'nonCanon']),
  type: z.enum(WORK_PROJECT_TYPE_KEYS),
  hallWingType: z.enum(HALL_WING_TYPE_KEYS),
  workingTitle: z.string(),
  workingTitle_lowercase: z.string(),
  workingDescription: z.string(),
  coverAssetId: z.string().optional(),
  workStewardUid: z.string(),
  foundingArtisanUid: z.string(),
  createdOn: z.number(),
  updatedOn: z.number(),
});
export type PublicWorkProject = z.infer<typeof PublicWorkProjectSchema>;

// ===========================================================================
// Work-project FILE FOLDER system (S7) — supersedes the flat workAssets model.
// A default folder (every active guildmate views/uploads) + custom folders whose
// audience is controlled by TRADE PROFESSIONS, while file-system ADMINISTRATION is
// controlled by guild standings (StewardOwner / WorkProjectManager / WorkAssetAdmin).
// See ttt-prod docs/design/work-project-file-folders.md. Realm sharing of a file is the
// `realmFileCanonStatus` seam on the file's mediaAssets doc (media-assets.ts).
// ===========================================================================

/** `allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}`. */
export const WorkFileFolderSchema = z.object({
  workFileFolderId: z.string(),
  workProjectId: z.string(),
  name: z.string(),
  // The auto-created "All Guildmates" folder (view/upload open to every active
  // guildmate; delete/manage needs file-admin). Exactly one per work project.
  isDefault: z.boolean(),
  // Custom-folder access — trade-profession ids (TRADE_PROFESSION_OPTIONS). Empty
  // on the default folder; file admins always see/manage every folder regardless.
  canViewTradeProfessions: z.array(z.string()),
  canUploadTradeProfessions: z.array(z.string()),
  canDeleteTradeProfessions: z.array(z.string()),
  fileCount: z.number(),
  /** Sum of this folder's files' `sizeBytes`. Maintained alongside `fileCount`
   *  (increment on upload, decrement on delete); the project-wide storage usage +
   *  `MAX_WORK_FILE_STORAGE_BYTES` cap are computed by summing this across folders. */
  storageBytes: z.number(),
  createdBy: userRefSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type WorkFileFolder = z.infer<typeof WorkFileFolderSchema>;

/** `allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}/workFiles/{workFileId}`. */
export const WorkFileSchema = z.object({
  workFileId: z.string(),
  workProjectId: z.string(),
  workFileFolderId: z.string(),
  name: z.string(),
  mediaAssetId: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  uploadedBy: userRefSchema,
  createdAt: z.number(),
});
export type WorkFile = z.infer<typeof WorkFileSchema>;

// Realm source of truth and Realm search/tag surface. Server/callable-written only.
export const WorkRealmSchema = z.object({
  workRealmId: z.string(),
  realmType: z.enum(['public', 'standalone']),
  realmStatus: z.enum(['draft', 'released']),
  realmHidden: z.boolean(),
  workingTitle: z.string(),
  workingTitle_lowercase: z.string(),
  workingDescription: z.string(),
  // Square realm cover art (the 'realm-cover' upload origin; processor-written).
  // Optional while the realm is a DRAFT; releasing the realm REQUIRES it — the
  // realm release callable enforces presence (never required at founding, so a
  // work creation is never blocked on realm art).
  realmCoverAssetId: z.string().optional(),
  workStewardUid: z.string(),
  foundingArtisanUid: z.string(),
  foundingWorkProjectId: z.string(),
  createdOn: z.number(),
  updatedOn: z.number(),
  // MONOTONIC publish lock (R1 ruling, 2026-07-12): set true by the hall publish
  // core the first time any work in this realm publishes, and never unset — even
  // if that work later unpublishes (the realm name already went public). While
  // absent/false, realm info is direct-edit; once true, realm text changes route
  // exclusively through the change-request pipeline (surface 'workRealm').
  // Backend-only-writable.
  hasEverPublishedWork: z.boolean().optional(),
  // Moderation "require retitle" remedy (see FullWorkProject above) — admin
  // replaces an abusive realm title/description with a placeholder + sets this so
  // the steward must re-enter compliant text. Distinct from `realmHidden` (the
  // DMCA/copyright takedown). Backend-only-writable.
  moderationRetitleRequired: z.boolean().optional(),
  moderationRetitleReason: z.string().optional(),
  // Per-field extension of the retitle remedy (see FullWorkProject) — which realm text fields an
  // admin cleared to a placeholder ("all or any"), plus the operator's reason. Backend-only-writable.
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
  moderatedAt: z.number().optional(),
});
export type WorkRealm = z.infer<typeof WorkRealmSchema>;
