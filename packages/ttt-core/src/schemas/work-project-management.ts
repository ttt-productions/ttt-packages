import { z } from 'zod';
import {
  workProjectIdSchema,
  userIdSchema,
  addRemoveActionSchema,
  workProjectTypeSchema,
  hallWingTypeSchema,
  commissionListingIdSchema,
  commissionProposalIdSchema,
  auditionIdSchema,
  auditionEntryIdSchema,
  craftSkillIdSchema,
} from './atoms.js';
import { TRADE_PROFESSION_OPTIONS } from '../constants/options.js';
import { GUILD_STANDING_VALUES } from '../permissions/index.js';
import { MAX_GUILD_INVITE_MESSAGE_LENGTH } from '../constants/business.js';
import { RealmFileCanonStatusSchema } from '../doc-schemas/media-assets.js';

// ===========================================================================
// S7 realm shared-files gallery (ARTISAN-ONLY). `mediaAssets` is client-unreadable, so the gallery
// reads realm-shared work files via THIS server projection callable (never a client query). The
// callable is artisan-gated; the whole section is hidden from non-artisans. Serving is the reserved
// `'artisan'` media tier (mutate-in-place scoped→artisan on promote). V1 = view + download.
// ===========================================================================

export const RealmSharedFileProjectionSchema = z.object({
  mediaAssetId: z.string(),
  mediaKind: z.enum(['image', 'video', 'audio']),
  // 'nonCanon' | 'canon' for a shared file (never 'none' — that means not-shared).
  realmFileCanonStatus: RealmFileCanonStatusSchema,
  creatorUid: z.string(),
  // For the per-file steward canon toggle + download (updateWorkFileRealmCanon takes these).
  workProjectId: z.string(),
  workFileId: z.string(),
}).strict();
export type RealmSharedFileProjection = z.infer<typeof RealmSharedFileProjectionSchema>;

export const GetRealmSharedFilesInputSchema = z.object({
  realmId: z.string().min(1),
}).strict();
export type GetRealmSharedFilesInput = z.infer<typeof GetRealmSharedFilesInputSchema>;

const baseFields = {
  workingTitle: z.string().min(1).max(200),
  workingDescription: z.string().min(1).max(2000),
  workProjectType: workProjectTypeSchema,
  hallWingType: hallWingTypeSchema,
};

// A Realm working title is reserved under `reservedRealmNames/{UPPER(title)}` — the
// UPPERCASED title IS the Firestore doc ID (runCreateWorkRealm.reservedRealmNameRef).
// Firestore doc IDs cannot contain `/` and cannot be exactly `.` or `..`, so a title
// that would produce an invalid/ambiguous doc ID must be rejected at the callable
// boundary (both the create transaction and the soft availability check) rather than
// hard-failing with an opaque `internal` error deep inside ref construction. Length is
// min(1).max(200); only the doc-ID-breaking characters are forbidden. Keep
// CheckRealmNameAvailableInputSchema in lockstep so a valid-at-create name is never
// rejected at form time (and vice-versa).
export const realmWorkingTitleSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((v) => !v.includes('/'), { message: 'Realm name cannot contain a slash (/).' })
  .refine((v) => v !== '.' && v !== '..', { message: 'Realm name cannot be "." or "..".' });

export const RealmCreationModeSchema = z.enum([
  'newPublicRealm',
  'newStandaloneRealm',
  'existingPublicRealm',
]);
export type RealmCreationMode = z.infer<typeof RealmCreationModeSchema>;

export const CreateWorkProjectInputSchema = z.discriminatedUnion('realmCreationMode', [
  z.object({
    ...baseFields,
    realmCreationMode: z.literal('newPublicRealm'),
    realmWorkingTitle: realmWorkingTitleSchema,
    realmWorkingDescription: z.string().min(1).max(2000),
  }).strict(),
  z.object({
    ...baseFields,
    realmCreationMode: z.literal('newStandaloneRealm'),
    realmWorkingTitle: realmWorkingTitleSchema,
    realmWorkingDescription: z.string().min(1).max(2000),
  }).strict(),
  z.object({
    ...baseFields,
    realmCreationMode: z.literal('existingPublicRealm'),
    workRealmId: z.string().min(1),
  }).strict(),
]);
export type CreateWorkProjectInput = z.infer<typeof CreateWorkProjectInputSchema>;

// Identified by the workAssets subcollection doc id — never by URL parsing
// (no delete path may depend on a URL; see media-assets-and-protected-serving.md).
export const DeleteWorkAssetInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  workAssetId: z.string().min(1),
}).strict();
export type DeleteWorkAssetInput = z.infer<typeof DeleteWorkAssetInputSchema>;

export const InviteSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('standalone'),
  }).strict(),
  z.object({
    type: z.literal('craftSkill'),
    data: z.object({
      craftSkillId: craftSkillIdSchema,
      craftSkillOwnerUserId: userIdSchema,
      craftSkillName: z.string().min(1).max(200),
    }).strict(),
  }).strict(),
  z.object({
    type: z.literal('commission'),
    // Titles are NOT snapshotted here (Display Identity Invariant — client display text
    // must be re-sourced at render by id). `postingStakeSharesOffered` is not display text;
    // the server re-sources it from the posting doc in the invite transaction (never trusts
    // the client copy) — kept so the shape stays server-writable.
    data: z.object({
      commissionListingId: commissionListingIdSchema,
      commissionProposalId: commissionProposalIdSchema,
      proposalArtisanUserId: userIdSchema,
      postingStakeSharesOffered: z.number().int().min(1),
    }).strict(),
  }).strict(),
  z.object({
    type: z.literal('audition'),
    data: z.object({
      auditionId: auditionIdSchema,
      auditionEntryId: auditionEntryIdSchema,
      respondentUserId: userIdSchema,
      postingStakeSharesOffered: z.number().int().min(1),
    }).strict(),
  }).strict(),
]);
export type InviteSource = z.infer<typeof InviteSourceSchema>;
export type InviteSourceType = InviteSource['type'];

export const InviteUserToGuildInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  inviteeUid: userIdSchema,
  message: z.string().min(1).max(MAX_GUILD_INVITE_MESSAGE_LENGTH),
  stakeSharesOffered: z.number().int().min(1),
  source: InviteSourceSchema,
}).strict();
export type InviteUserToGuildInput = z.infer<typeof InviteUserToGuildInputSchema>;

// `finalized` is the terminal SUCCESS state (`accepted` is a transient state a trigger
// consumes within seconds). Managers must be able to list finalized invites to see the
// guild's actual recruitment history — not only failures and in-flight items. The enum
// mirrors the terminal + in-flight states on GuildInviteConversationSchema (no 'error').
export const ListGuildInvitesInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  statuses: z.array(z.enum(['pending', 'accepted', 'declined', 'cancelled', 'finalized'])).min(1),
}).strict();
export type ListGuildInvitesInput = z.infer<typeof ListGuildInvitesInputSchema>;

const TRADE_PROFESSION_VALUES = [...TRADE_PROFESSION_OPTIONS] as [string, ...string[]];

export const UpdateGuildmateTradeProfessionsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  userId: userIdSchema,
  tradeProfession: z.enum(TRADE_PROFESSION_VALUES),
  action: addRemoveActionSchema,
}).strict();
export type UpdateGuildmateTradeProfessionsInput = z.infer<typeof UpdateGuildmateTradeProfessionsInputSchema>;

const GUILD_STANDING_VALUES_ENUM = GUILD_STANDING_VALUES as [typeof GUILD_STANDING_VALUES[number], ...typeof GUILD_STANDING_VALUES[number][]];

export const UpdateGuildmateStandingInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  userId: userIdSchema,
  guildStanding: z.enum(GUILD_STANDING_VALUES_ENUM),
  action: addRemoveActionSchema,
}).strict();
export type UpdateGuildmateStandingInput = z.infer<typeof UpdateGuildmateStandingInputSchema>;

export const UpdatePublicWorkProjectDetailsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  workingTitle: z.string().min(1).max(200),
  workingDescription: z.string().min(1).max(2000),
}).strict();
export type UpdatePublicWorkProjectDetailsInput = z.infer<typeof UpdatePublicWorkProjectDetailsInputSchema>;

export const UpdateWorkRealmDetailsInputSchema = z.object({
  workRealmId: z.string().min(1),
  workingTitle: z.string().min(1).max(200),
  workingDescription: z.string().min(1).max(2000),
}).strict();
export type UpdateWorkRealmDetailsInput = z.infer<typeof UpdateWorkRealmDetailsInputSchema>;

// Unauthenticated soft-check for a Realm working title. Must match the authoritative
// realmWorkingTitle contract in CreateWorkProjectInputSchema (realmWorkingTitleSchema:
// min(1).max(200), rejecting the doc-ID-breaking `/` and reserved `.`/`..`). Never be
// stricter than the create transaction or a valid-at-create name would be rejected at
// form time — reuse the SAME schema so the two can never drift.
export const CheckRealmNameAvailableInputSchema = z.object({
  workingTitle: realmWorkingTitleSchema,
}).strict();
export type CheckRealmNameAvailableInput = z.infer<typeof CheckRealmNameAvailableInputSchema>;

// ---- work-project file folders (S7) ---------------------------------------------------
// The default "All Guildmates" folder is immutable; custom-folder access is by trade
// profession. All four callables require a file-admin standing via assertCanManageFolders.

const tradeProfessionListSchema = z
  .array(z.enum(TRADE_PROFESSION_VALUES))
  .max(TRADE_PROFESSION_OPTIONS.length);

export const CreateFileFolderInputSchema = z.object({
  workProjectId: z.string().min(1),
  name: z.string().min(1).max(100),
  canViewTradeProfessions: tradeProfessionListSchema,
  canUploadTradeProfessions: tradeProfessionListSchema,
  canDeleteTradeProfessions: tradeProfessionListSchema,
}).strict();
export type CreateFileFolderInput = z.infer<typeof CreateFileFolderInputSchema>;

export const RenameFileFolderInputSchema = z.object({
  workProjectId: z.string().min(1),
  folderId: z.string().min(1),
  name: z.string().min(1).max(100),
}).strict();
export type RenameFileFolderInput = z.infer<typeof RenameFileFolderInputSchema>;

export const UpdateFolderProfessionsInputSchema = z.object({
  workProjectId: z.string().min(1),
  folderId: z.string().min(1),
  canViewTradeProfessions: tradeProfessionListSchema,
  canUploadTradeProfessions: tradeProfessionListSchema,
  canDeleteTradeProfessions: tradeProfessionListSchema,
}).strict();
export type UpdateFolderProfessionsInput = z.infer<typeof UpdateFolderProfessionsInputSchema>;

export const DeleteFileFolderInputSchema = z.object({
  workProjectId: z.string().min(1),
  folderId: z.string().min(1),
}).strict();
export type DeleteFileFolderInput = z.infer<typeof DeleteFileFolderInputSchema>;

// ---- realm shared files ---------------------------------------------------------------

// Delete a single work file (by folder + file id). File-admin authz is enforced in the
// callable/core transaction.
export const DeleteWorkFileInputSchema = z.object({
  workProjectId: z.string().min(1),
  folderId: z.string().min(1),
  workFileId: z.string().min(1),
}).strict();
export type DeleteWorkFileInput = z.infer<typeof DeleteWorkFileInputSchema>;

// Set canon status on a realm shared file. Realm-steward-only authz is enforced inside the
// core's transaction against workRealms/{workRealmId}.workStewardUid.
export const UpdateWorkFileRealmCanonInputSchema = z.object({
  workRealmId: z.string().min(1),
  mediaAssetId: z.string().min(1),
  canon: z.boolean(),
}).strict();
export type UpdateWorkFileRealmCanonInput = z.infer<typeof UpdateWorkFileRealmCanonInputSchema>;

// Share (promote) a work file into its Realm's shared-file pool as non-canon. File-admin
// authz (`workFile.promoteToRealm`) is enforced inside the core's transaction.
export const UpdateWorkFileRealmShareInputSchema = z.object({
  workProjectId: z.string().min(1),
  workFileId: z.string().min(1),
}).strict();
export type UpdateWorkFileRealmShareInput = z.infer<typeof UpdateWorkFileRealmShareInputSchema>;


