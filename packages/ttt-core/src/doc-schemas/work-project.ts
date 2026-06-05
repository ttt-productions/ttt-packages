// WorkProject / Realm / Guild Firestore document SCHEMAS — single source of truth.
// Covers allWorkProjects/{workProjectId}, its guildmateUsers/publicGuildmateUsers/
// workAssets subcollections, publicWorkProjects/{workProjectId}, workRealms/{workRealmId},
// and the guildInviteConversations invite shell. Types are inferred via z.infer so a
// document's shape and its TypeScript type cannot drift apart.
//
// Terminology: the current-owner field is `workStewardUid` (locked rename from the old
// `ownerUid`; see docs/design/terminology-naming-convention.md — Steward row). The original
// creator is `foundingArtisanUid` (locked rename from the old `createdByUid`; Founding Artisan).

import { z } from 'zod';
import { HALL_WING_TYPE_KEYS, WORK_PROJECT_TYPE_KEYS } from '../types/content.js';
import { ShortWorkProjectSchema } from '../media/atoms.js';
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
});
export type GuildmateUser = z.infer<typeof GuildmateUserSchema>;

export const PublicGuildmateUserSchema = z.object({
  uid: z.string(),
  tradeProfessions: z.array(z.string()),
  joinedAt: z.number(),
  status: GuildmateStatusSchema,
});
export type PublicGuildmateUser = z.infer<typeof PublicGuildmateUserSchema>;

export const WorkAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  createdAt: z.number(),
  size: z.number(),
  type: z.string(),
  createdBy: userRefSchema,
});
export type WorkAsset = z.infer<typeof WorkAssetSchema>;

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
  coverImageUrl: z.string().optional(),
  workStewardUid: z.string(),
  foundingArtisanUid: z.string(),
  createdOn: z.number(),
  updatedOn: z.number(),
});
export type PublicWorkProject = z.infer<typeof PublicWorkProjectSchema>;

// Realm source of truth and Realm search/tag surface. Server/callable-written only.
export const WorkRealmSchema = z.object({
  workRealmId: z.string(),
  realmType: z.enum(['public', 'standalone']),
  realmStatus: z.enum(['draft', 'released']),
  realmHidden: z.boolean(),
  workingTitle: z.string(),
  workingTitle_lowercase: z.string(),
  workingDescription: z.string(),
  workStewardUid: z.string(),
  foundingArtisanUid: z.string(),
  foundingWorkProjectId: z.string(),
  createdOn: z.number(),
  updatedOn: z.number(),
});
export type WorkRealm = z.infer<typeof WorkRealmSchema>;

export const GuildInviteSchema = z.object({
  guildInviteId: z.string(),
  createdBy: userRefSchema,
  createdOn: z.number(),
  message: z.string(),
  workProject: ShortWorkProjectSchema,
  status: z.enum(['pending', 'accepted', 'declined']),
  lastUpdatedAt: z.number(),
});
export type GuildInvite = z.infer<typeof GuildInviteSchema>;
