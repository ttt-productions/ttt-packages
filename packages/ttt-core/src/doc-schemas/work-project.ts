import { z } from 'zod';
import { HALL_WING_TYPE_KEYS, WORK_PROJECT_TYPE_KEYS } from '../types/content.js';
import { isGuildStandingId } from '../permissions/work-project-permissions.js';
import { type GuildStandingId } from '../permissions/work-project-permissions-data.js';
import { ModerationHiddenBySchema } from './moderation.js';
import { ContentMediaKindSchema } from './media-assets.js';

const guildStandingIdSchema = z.custom<GuildStandingId>(isGuildStandingId);
const userRefSchema = z.object({ uid: z.string() });

export const GuildmateStatusSchema = z.enum(['active', 'departed']);
export type GuildmateStatus = z.infer<typeof GuildmateStatusSchema>;

export const RealmCanonStatusSchema = z.enum(['canon', 'nonCanon']);
export type RealmCanonStatus = z.infer<typeof RealmCanonStatusSchema>;

export const FOUNDING_WORK_HOLDER_TYPE = 'foundingWork' as const;

export const GuildmateUserSchema = z.object({
  uid: z.string(),
  guildStandings: z.array(guildStandingIdSchema),
  tradeProfessions: z.array(z.string()),
  stakeShareCount: z.number().int().nonnegative(),
  joinedAt: z.number(),
  status: GuildmateStatusSchema,
  holderType: z.enum(['user', FOUNDING_WORK_HOLDER_TYPE]).optional(),
  guildAuthInputVersion: z.number().optional(),
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
  z.object({ amount: z.number().int().positive(), createdAt: z.number() }),
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
  status: z.enum(['open', 'published']),
  guildmateUserIds: z.record(z.string(), z.boolean()).optional(),
  invitedUserIds: z.record(z.string(), z.boolean()).optional(),
  workRealmId: z.string(),
  realmCanonStatus: RealmCanonStatusSchema,
  pendingStakeShares: PendingStakeSharesSchema.optional(),
  moderationRetitleRequired: z.boolean().optional(),
  moderationRetitleReason: z.string().optional(),
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
  moderatedAt: z.number().optional(),
});
export type FullWorkProject = z.infer<typeof FullWorkProjectSchema>;

export const PublicWorkProjectSchema = z.object({
  workProjectId: z.string(),
  publicWorkStatus: z.enum(['draft', 'released']),
  publicWorkHidden: z.boolean(),
  publicWorkHiddenBy: ModerationHiddenBySchema.optional(),
  workRealmId: z.string(),
  realmCanonStatus: RealmCanonStatusSchema,
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

export const WorkFileFolderSchema = z.object({
  workFileFolderId: z.string(),
  workProjectId: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  canViewTradeProfessions: z.array(z.string()),
  canUploadTradeProfessions: z.array(z.string()),
  canDeleteTradeProfessions: z.array(z.string()),
  fileCount: z.number(),
  storageBytes: z.number(),
  createdBy: userRefSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type WorkFileFolder = z.infer<typeof WorkFileFolderSchema>;

export const WorkFileSchema = z.object({
  workFileId: z.string(),
  workProjectId: z.string(),
  workFileFolderId: z.string(),
  name: z.string(),
  mediaAssetId: z.string(),
  contentType: z.string(),
  mediaKind: ContentMediaKindSchema,
  sizeBytes: z.number(),
  uploadedBy: userRefSchema,
  createdAt: z.number(),
});
export type WorkFile = z.infer<typeof WorkFileSchema>;

export const WorkRealmSchema = z.object({
  workRealmId: z.string(),
  realmType: z.enum(['public', 'standalone']),
  realmStatus: z.enum(['draft', 'released']),
  realmHidden: z.boolean(),
  realmHiddenBy: ModerationHiddenBySchema.optional(),
  workingTitle: z.string(),
  workingTitle_lowercase: z.string(),
  workingDescription: z.string(),
  realmCoverAssetId: z.string().optional(),
  workStewardUid: z.string(),
  foundingArtisanUid: z.string(),
  foundingWorkProjectId: z.string(),
  createdOn: z.number(),
  updatedOn: z.number(),
  hasEverPublishedWork: z.boolean().optional(),
  moderationRetitleRequired: z.boolean().optional(),
  moderationRetitleReason: z.string().optional(),
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
  moderatedAt: z.number().optional(),
});
export type WorkRealm = z.infer<typeof WorkRealmSchema>;

export const RealmFileFolderSchema = z.object({
  realmFileFolderId: z.string(),
  workRealmId: z.string(),
  name: z.string(),
  name_lowercase: z.string(),
  createdBy: userRefSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type RealmFileFolder = z.infer<typeof RealmFileFolderSchema>;
