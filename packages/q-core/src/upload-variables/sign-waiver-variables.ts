import { z } from 'zod';
import { leagueIdSchema } from '../doc-schemas/atoms.js';
import {
  waiverTemplateIdSchema,
  waiverTemplateVersionNumberSchema,
} from '../doc-schemas/waiver-template.js';
import { actingEntrySchema } from '../schemas/atoms.js';
import { ghostWaiverSubjectSchema } from '../schemas/signed-waivers.js';

// Whose waiver a signing is for: the signer's own, or a ghost's, witnessed through the entry the
// signer acts at.
export const WaiverSubjectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('self') }).strict(),
  ghostWaiverSubjectSchema.extend({ kind: z.literal('ghost'), entry: actingEntrySchema }).strict(),
]);
export type WaiverSubject = z.infer<typeof WaiverSubjectSchema>;

// Variables for the waiver-signing mutation hook (MEDIA-005). The template id and version are the
// wording the signing dialog displayed; the signature is the drawing as the canvas exported it.
export const SignWaiverVariablesSchema = z
  .object({
    leagueId: leagueIdSchema,
    waiverTemplateId: waiverTemplateIdSchema,
    waiverTemplateVersion: waiverTemplateVersionNumberSchema,
    signature: z.instanceof(Blob),
    subject: WaiverSubjectSchema,
  })
  .strict();
export type SignWaiverVariables = z.infer<typeof SignWaiverVariablesSchema>;
