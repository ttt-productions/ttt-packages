// Callable contracts for signing a league's waiver and reading the result. The signer is always
// `request.auth.uid`. A signature image arrives only as the staging path the signer uploaded it to;
// the server rebuilds that path from the signer's own uid and derives where the image is kept from
// the records, never from the payload (MEDIA-002).

import { z } from 'zod';
import { epochMsSchema, leagueIdSchema, teamIdSchema, userIdSchema, waiverWitnessAuthoritySchema } from '../doc-schemas/atoms.js';
import { waiverTemplateIdSchema, waiverTemplateVersionNumberSchema } from '../doc-schemas/waiver-template.js';
import { stagingUploadPathSchema } from './uploads.js';

// Signing for a ghost: the ghost, and the team whose membership makes the signer its witness.
export const ghostWaiverSubjectSchema = z.object({ ghostUserId: userIdSchema, teamId: teamIdSchema }).strict();

// The wording the signer saw: the template id and version the signing dialog displayed. A signature
// records exactly that wording, so the core refuses one whose id or version is no longer the league's
// (`waiverChanged`), and the dialog loads the current wording to read again.
const displayedWaiverFields = {
  waiverTemplateId: waiverTemplateIdSchema,
  waiverTemplateVersion: waiverTemplateVersionNumberSchema,
};

// `createSignedWaiver` — the member entry: a player signs their own waiver, or the ghost's team's
// captain or co-captain signs a ghost's. `storagePath` is the full staging path the signer uploaded
// to, under the one name every accepting callable takes it by; only its last segment, the staging
// id, is taken from it.
export const CreateSignedWaiverInputSchema = z
  .object({
    leagueId: leagueIdSchema,
    ...displayedWaiverFields,
    storagePath: stagingUploadPathSchema,
    ghost: ghostWaiverSubjectSchema.optional(),
  })
  .strict();
export type CreateSignedWaiverInput = z.infer<typeof CreateSignedWaiverInputSchema>;

// `adminCreateSignedWaiver` — the admin entry: an admin or a referee signs a ghost's waiver.
export const AdminCreateSignedWaiverInputSchema = z
  .object({
    leagueId: leagueIdSchema,
    ...displayedWaiverFields,
    storagePath: stagingUploadPathSchema,
    ghost: ghostWaiverSubjectSchema,
  })
  .strict();
export type AdminCreateSignedWaiverInput = z.infer<typeof AdminCreateSignedWaiverInputSchema>;

// `alreadySigned` is true when the call found the waiver already recorded with this very signature —
// a retry of a signing that committed — and wrote nothing.
export const CreateSignedWaiverResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    userId: userIdSchema,
    signedAt: epochMsSchema,
    alreadySigned: z.boolean(),
  })
  .strict();
export type CreateSignedWaiverResult = z.infer<typeof CreateSignedWaiverResultSchema>;

// `getLeagueTeamWaiverStatuses` — a team's captain or co-captain reads whether each member of the
// team has signed the league's waiver. Admins and referees read the records directly.
export const GetLeagueTeamWaiverStatusesInputSchema = z.object({ teamId: teamIdSchema }).strict();
export type GetLeagueTeamWaiverStatusesInput = z.infer<typeof GetLeagueTeamWaiverStatusesInputSchema>;

export const leagueTeamWaiverStatusSchema = z
  .object({
    userId: userIdSchema,
    // Null while the member has not signed.
    signedAt: epochMsSchema.nullable(),
    // Present on a ghost's waiver: who signed it for the ghost, and under which authority.
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
export type GetLeagueTeamWaiverStatusesResult = z.infer<typeof GetLeagueTeamWaiverStatusesResultSchema>;

// `getSignedWaiverFile` — the kept signature image, for its audience only. A captain or co-captain
// names `teamId`, the team they manage, because a player may be on two teams in one league; the
// subject, an admin, and a referee need none.
export const GetSignedWaiverFileInputSchema = z
  .object({ leagueId: leagueIdSchema, userId: userIdSchema, teamId: teamIdSchema.optional() })
  .strict();
export type GetSignedWaiverFileInput = z.infer<typeof GetSignedWaiverFileInputSchema>;

export const SignatureFileResultSchema = z
  .object({ contentType: z.string().min(1), dataBase64: z.string() })
  .strict();
export type SignatureFileResult = z.infer<typeof SignatureFileResultSchema>;
