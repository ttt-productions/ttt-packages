import { z } from 'zod';
import {
  epochMsSchema,
  leagueIdSchema,
  teamIdSchema,
  userIdSchema,
  waiverWitnessAuthoritySchema,
} from '../doc-schemas/atoms.js';
import {
  waiverTemplateIdSchema,
  waiverTemplateVersionNumberSchema,
} from '../doc-schemas/waiver-template.js';
import { stagingUploadPathSchema } from './uploads.js';

export const ghostWaiverSubjectSchema = z
  .object({ ghostUserId: userIdSchema, teamId: teamIdSchema })
  .strict();

const displayedWaiverFields = {
  waiverTemplateId: waiverTemplateIdSchema,
  waiverTemplateVersion: waiverTemplateVersionNumberSchema,
};

export const CreateSignedWaiverInputSchema = z
  .object({
    leagueId: leagueIdSchema,
    ...displayedWaiverFields,
    storagePath: stagingUploadPathSchema,
    ghost: ghostWaiverSubjectSchema.optional(),
  })
  .strict();
export type CreateSignedWaiverInput = z.infer<typeof CreateSignedWaiverInputSchema>;

export const AdminCreateSignedWaiverInputSchema = z
  .object({
    leagueId: leagueIdSchema,
    ...displayedWaiverFields,
    storagePath: stagingUploadPathSchema,
    ghost: ghostWaiverSubjectSchema,
  })
  .strict();
export type AdminCreateSignedWaiverInput = z.infer<typeof AdminCreateSignedWaiverInputSchema>;

export const CreateSignedWaiverResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    userId: userIdSchema,
    signedAt: epochMsSchema,
    alreadySigned: z.boolean(),
  })
  .strict();
export type CreateSignedWaiverResult = z.infer<typeof CreateSignedWaiverResultSchema>;

export const GetLeagueTeamWaiverStatusesInputSchema = z.object({ teamId: teamIdSchema }).strict();
export type GetLeagueTeamWaiverStatusesInput = z.infer<
  typeof GetLeagueTeamWaiverStatusesInputSchema
>;

export const leagueTeamWaiverStatusSchema = z
  .object({
    userId: userIdSchema,
    signedAt: epochMsSchema.nullable(),
    witnessUserId: userIdSchema.nullable(),
    witnessAuthority: waiverWitnessAuthoritySchema.nullable(),
  })
  .strict();
export type LeagueTeamWaiverStatus = z.infer<typeof leagueTeamWaiverStatusSchema>;

export const GetLeagueTeamWaiverStatusesResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    requiresWaiver: z.boolean(),
    statuses: z.array(leagueTeamWaiverStatusSchema),
  })
  .strict();
export type GetLeagueTeamWaiverStatusesResult = z.infer<
  typeof GetLeagueTeamWaiverStatusesResultSchema
>;

export const GetSignedWaiverFileInputSchema = z
  .object({ leagueId: leagueIdSchema, userId: userIdSchema, teamId: teamIdSchema.optional() })
  .strict();
export type GetSignedWaiverFileInput = z.infer<typeof GetSignedWaiverFileInputSchema>;

export const SignatureFileResultSchema = z
  .object({ contentType: z.string().min(1), dataBase64: z.string() })
  .strict();
export type SignatureFileResult = z.infer<typeof SignatureFileResultSchema>;
