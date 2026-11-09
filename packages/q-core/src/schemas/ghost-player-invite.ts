import { z } from 'zod';
import { leagueIdSchema, teamIdSchema, userIdSchema } from '../doc-schemas/atoms.js';
import {
  waiverTemplateIdSchema,
  waiverTemplateVersionNumberSchema,
} from '../doc-schemas/waiver-template.js';
import { stagingUploadPathSchema } from './uploads.js';

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
  })
  .strict();
export type UpdateGhostPlayerLinkInviteInput = z.infer<
  typeof UpdateGhostPlayerLinkInviteInputSchema
>;

export const UpdateGhostPlayerLinkInviteResultSchema = z
  .object({
    status: z.literal('linked'),
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    userId: userIdSchema,
  })
  .strict();
export type UpdateGhostPlayerLinkInviteResult = z.infer<
  typeof UpdateGhostPlayerLinkInviteResultSchema
>;
