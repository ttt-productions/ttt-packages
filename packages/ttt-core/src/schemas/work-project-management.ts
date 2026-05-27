import { z } from 'zod';
import {
  workProjectIdSchema,
  userIdSchema,
  addRemoveActionSchema,
  workProjectTypeSchema,
  commissionListingIdSchema,
  commissionProposalIdSchema,
  auditionIdSchema,
  auditionEntryIdSchema,
  craftSkillIdSchema,
} from './atoms.js';
import { TRADE_PROFESSION_OPTIONS } from '../constants/options.js';
import { GUILD_STANDING_VALUES } from '../permissions/index.js';
import { MAX_GUILD_INVITE_MESSAGE_LENGTH } from '../constants/business.js';

const baseFields = {
  workingTitle: z.string().min(1).max(200),
  workingDescription: z.string().min(1).max(2000),
  workProjectType: workProjectTypeSchema,
  hallWingType: z.string().min(1),
};

export const CreateWorkProjectInputSchema = z.discriminatedUnion('origin', [
  z.object({
    ...baseFields,
    origin: z.literal('newWorkRealm'),
  }).strict(),
  z.object({
    ...baseFields,
    origin: z.literal('existingWorkRealm'),
    workRealmId: z.string().min(1),
  }).strict(),
  z.object({
    ...baseFields,
    origin: z.literal('standalone'),
  }).strict(),
]);
export type CreateWorkProjectInput = z.infer<typeof CreateWorkProjectInputSchema>;

export const DeleteWorkAssetInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  file: z.object({
    id: z.string().optional(),
    url: z.string().min(1),
    name: z.string().optional(),
  }),
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
    data: z.object({
      commissionListingId: commissionListingIdSchema,
      commissionProposalId: commissionProposalIdSchema,
      commissionTitle: z.string().min(1).max(200),
      proposalArtisanUserId: userIdSchema,
      postingStakeSharesOffered: z.number().int().min(1),
    }).strict(),
  }).strict(),
  z.object({
    type: z.literal('audition'),
    data: z.object({
      auditionId: auditionIdSchema,
      auditionEntryId: auditionEntryIdSchema,
      auditionTitle: z.string().min(1).max(200),
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

export const ListGuildInvitesInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  statuses: z.array(z.enum(['pending', 'accepted', 'declined', 'cancelled'])).min(1),
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




