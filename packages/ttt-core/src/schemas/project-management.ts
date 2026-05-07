import { z } from 'zod';
import { projectIdSchema, userIdSchema, addRemoveActionSchema, projectTypeSchema } from './atoms.js';
import { PROFESSION_OPTIONS, USER_ROLE_OPTIONS_MAP } from '../constants/options.js';

const baseFields = {
  workingTitle: z.string().min(1).max(200),
  workingDescription: z.string().min(1).max(2000),
  type: projectTypeSchema,
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
  projectId: projectIdSchema,
  file: z.object({
    url: z.string().min(1),
    name: z.string().optional(),
  }),
}).strict();
export type DeleteProjectFileInput = z.infer<typeof DeleteProjectFileInputSchema>;

export const InviteUserToProjectInputSchema = z.object({
  projectId: projectIdSchema,
  inviteeUid: userIdSchema,
  message: z.string().min(1).max(2000),
  sharesOffered: z.number().int().min(1),
  source: z.object({
    type: z.literal('skill'),
    data: z.object({ skillName: z.string().min(1) }),
  }).optional(),
}).strict();
export type InviteUserToProjectInput = z.infer<typeof InviteUserToProjectInputSchema>;

export const ListProjectInvitesInputSchema = z.object({
  projectId: projectIdSchema,
  statuses: z.array(z.enum(['pending', 'accepted', 'declined', 'cancelled'])).min(1),
}).strict();
export type ListProjectInvitesInput = z.infer<typeof ListProjectInvitesInputSchema>;

const PROFESSION_VALUES = [...PROFESSION_OPTIONS] as [string, ...string[]];

export const UpdateProjectMemberProfessionsInputSchema = z.object({
  projectId: projectIdSchema,
  userId: userIdSchema,
  profession: z.enum(PROFESSION_VALUES),
  action: addRemoveActionSchema,
}).strict();
export type UpdateProjectMemberProfessionsInput = z.infer<typeof UpdateProjectMemberProfessionsInputSchema>;

const ROLE_VALUES = Object.keys(USER_ROLE_OPTIONS_MAP) as [string, ...string[]];

export const UpdateProjectMemberRoleInputSchema = z.object({
  projectId: projectIdSchema,
  userId: userIdSchema,
  role: z.enum(ROLE_VALUES),
  action: addRemoveActionSchema,
}).strict();
export type UpdateProjectMemberRoleInput = z.infer<typeof UpdateProjectMemberRoleInputSchema>;

export const UpdatePublicProjectDetailsInputSchema = z.object({
  projectId: projectIdSchema,
  workingTitle: z.string().min(1).max(200),
  workingDescription: z.string().min(1).max(2000),
}).strict();
export type UpdatePublicProjectDetailsInput = z.infer<typeof UpdatePublicProjectDetailsInputSchema>;
