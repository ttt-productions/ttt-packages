import { z } from 'zod';
import { leagueIdSchema } from '../doc-schemas/atoms.js';
import {
  waiverTemplateIdSchema,
  waiverTemplateVersionNumberSchema,
} from '../doc-schemas/waiver-template.js';
import { actingEntrySchema } from '../schemas/atoms.js';
import { ghostWaiverSubjectSchema } from '../schemas/signed-waivers.js';

export const WaiverSubjectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('self') }).strict(),
  ghostWaiverSubjectSchema.extend({ kind: z.literal('ghost'), entry: actingEntrySchema }).strict(),
]);
export type WaiverSubject = z.infer<typeof WaiverSubjectSchema>;

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
