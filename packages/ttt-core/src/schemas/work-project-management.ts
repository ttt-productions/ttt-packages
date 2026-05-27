import { z } from 'zod';
import {
  workProjectIdSchema,
  userIdSchema,
  addRemoveActionSchema,
  workProjectTypeSchema,
  commissionListingIdSchema,
  auditionIdSchema,
  auditionEntryIdSchema,
  craftSkillIdSchema,
} from './atoms.js';
import { PROFESSION_OPTIONS } from '../constants/options.js';
import { PROJECT_ROLE_IDS } from '../permissions/index.js';
import { MAX_INVITE_MESSAGE_LENGTH } from '../constants/business.js';

const baseFields = {
  workingTitle: z.string().min(1).max(200),
  workingDescription: z.string().min(1).max(2000),
  type: workProjectTypeSchema,
  libraryType: z.string().min(1),
};

export const CreateProjectInputSchema = z.discriminatedUnion('origin', [
  z.object({
    ...baseFields,
    origin: z.literal('newUniverse'),
  }).strict(),
  z.object({
    ...baseFields,
    origin: z.literal('existingUniverse'),
    universeId: z.string().min(1),
  }).strict(),
  z.object({
    ...baseFields,
    origin: z.literal('standalone'),
  }).strict(),
]);
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const DeleteProjectFileInputSchema = z.object({
  projectId: workProjectIdSchema,
  file: z.object({
    id: z.string().optional(),
    url: z.string().min(1),
    name: z.string().optional(),
  }),
}).strict();
export type DeleteProjectFileInput = z.infer<typeof DeleteProjectFileInputSchema>;

export const InviteSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('standalone'),
  }).strict(),
  z.object({
    type: z.literal('craftSkill'),
    data: z.object({
      skillId: craftSkillIdSchema,
      skillOwnerUserId: userIdSchema,
      skillName: z.string().min(1).max(200),
    }).strict(),
  }).strict(),
  z.object({
    type: z.literal('commission'),
    data: z.object({
      jobId: commissionListingIdSchema,
      replyId: auditionEntryIdSchema,
      jobTitle: z.string().min(1).max(200),
      applicantUserId: userIdSchema,
      postingSharesOffered: z.number().int().min(1),
    }).strict(),
  }).strict(),
  z.object({
    type: z.literal('audition'),
    data: z.object({
      opportunityId: auditionIdSchema,
      replyId: auditionEntryIdSchema,
      opportunityTitle: z.string().min(1).max(200),
      respondentUserId: userIdSchema,
      postingSharesOffered: z.number().int().min(1),
    }).strict(),
  }).strict(),
]);
export type InviteSource = z.infer<typeof InviteSourceSchema>;
export type InviteSourceType = InviteSource['type'];

export const InviteUserToProjectInputSchema = z.object({
  projectId: workProjectIdSchema,
  inviteeUid: userIdSchema,
  message: z.string().min(1).max(MAX_INVITE_MESSAGE_LENGTH),
  sharesOffered: z.number().int().min(1),
  source: InviteSourceSchema,
}).strict();
export type InviteUserToProjectInput = z.infer<typeof InviteUserToProjectInputSchema>;

export const ListProjectInvitesInputSchema = z.object({
  projectId: workProjectIdSchema,
  statuses: z.array(z.enum(['pending', 'accepted', 'declined', 'cancelled'])).min(1),
}).strict();
export type ListProjectInvitesInput = z.infer<typeof ListProjectInvitesInputSchema>;

const PROFESSION_VALUES = [...PROFESSION_OPTIONS] as [string, ...string[]];

export const UpdateProjectMemberProfessionsInputSchema = z.object({
  projectId: workProjectIdSchema,
  userId: userIdSchema,
  tradeProfession: z.enum(PROFESSION_VALUES),
  action: addRemoveActionSchema,
}).strict();
export type UpdateProjectMemberProfessionsInput = z.infer<typeof UpdateProjectMemberProfessionsInputSchema>;

const ROLE_VALUES = PROJECT_ROLE_IDS as [typeof PROJECT_ROLE_IDS[number], ...typeof PROJECT_ROLE_IDS[number][]];

export const UpdateProjectMemberRoleInputSchema = z.object({
  projectId: workProjectIdSchema,
  userId: userIdSchema,
  role: z.enum(ROLE_VALUES),
  action: addRemoveActionSchema,
}).strict();
export type UpdateProjectMemberRoleInput = z.infer<typeof UpdateProjectMemberRoleInputSchema>;

export const UpdatePublicProjectDetailsInputSchema = z.object({
  projectId: workProjectIdSchema,
  workingTitle: z.string().min(1).max(200),
  workingDescription: z.string().min(1).max(2000),
}).strict();
export type UpdatePublicProjectDetailsInput = z.infer<typeof UpdatePublicProjectDetailsInputSchema>;
