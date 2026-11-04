import { z } from 'zod';
import { leagueIdSchema, teamIdSchema, userIdSchema } from '../doc-schemas/atoms.js';
import {
  waiverTemplateIdSchema,
  waiverTemplateVersionNumberSchema,
} from '../doc-schemas/waiver-template.js';
import { stagingUploadPathSchema } from './uploads.js';
import { CreateUserProfileInputSchema } from './users.js';

export const GhostPlayerInviteSignatureSchema = z
  .object({
    waiverTemplateId: waiverTemplateIdSchema,
    waiverTemplateVersion: waiverTemplateVersionNumberSchema,
    storagePath: stagingUploadPathSchema,
  })
  .strict();
export type GhostPlayerInviteSignature = z.infer<typeof GhostPlayerInviteSignatureSchema>;

export const UpdateGhostPlayerLinkInviteInputSchema = z
  .object({
    teamId: teamIdSchema,
    ghostUserId: userIdSchema,
    signature: GhostPlayerInviteSignatureSchema.optional(),
    registration: CreateUserProfileInputSchema.optional(),
  })
  .strict();
export type UpdateGhostPlayerLinkInviteInput = z.infer<
  typeof UpdateGhostPlayerLinkInviteInputSchema
>;

export const UpdateGhostPlayerLinkInviteResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('linked'),
      leagueId: leagueIdSchema,
      teamId: teamIdSchema,
      userId: userIdSchema,
    })
    .strict(),
  z.object({ status: z.literal('registrationExpired') }).strict(),
]);
export type UpdateGhostPlayerLinkInviteResult = z.infer<
  typeof UpdateGhostPlayerLinkInviteResultSchema
>;
