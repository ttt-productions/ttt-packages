import { z } from 'zod';
import { workProjectIdSchema, stakeSharesOfferedSchema } from '../schemas/atoms.js';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';
import {
  MIN_CURATED_AUDITION_OPTIONS,
  MAX_CURATED_AUDITION_OPTIONS,
} from '../constants/business.js';
import { AUDITION_DESCRIPTION_INPUT, AUDITION_TITLE_INPUT } from '../constants/text-fields.js';
import { textFieldSchema } from '../schemas/text-field.js';
import { AuditionDeadlineSchema, refineAuditionDeadlineOrder } from '../constants/audition-deadlines.js';


export const CreateWorkProjectAuditionVariablesSchema = z.object({
  title: textFieldSchema(AUDITION_TITLE_INPUT),
  description: textFieldSchema(AUDITION_DESCRIPTION_INPUT),
  videoFile: z.instanceof(File).or(z.instanceof(Blob)),

  // Untrusted client claim of what the user's action implies (advisory; the

  // server byte inspection is the only classification authority).

  claim: ClientMediaClaimSchema.optional(),
  // The poster's two deadlines, epoch ms — the same fields and constraints as the target info.
  entriesCloseAt: AuditionDeadlineSchema,
  auditionCloseAt: AuditionDeadlineSchema,
  workProjectId: workProjectIdSchema,
  stakeSharesOffered: stakeSharesOfferedSchema.optional(),
  // Curated vs open (default 'open' when absent). 'curated' → the creating work posts the option
  // videos itself and users may ONLY vote. The strict schema is why this MUST live on the variables
  // (MEDIA-005: the hook parses variables strictly, so the mode cannot ride in targetInfo).
  mode: z.enum(['open', 'curated']).optional(),
  // Curated only: the fixed number of creator option videos (2..8) being uploaded as one batch, so
  // the server knows when the whole atomic batch has landed. Required by the callable when mode
  // === 'curated'; ignored for open auditions.
  expectedOptionCount: z.number().int().min(MIN_CURATED_AUDITION_OPTIONS).max(MAX_CURATED_AUDITION_OPTIONS).optional(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict().superRefine(refineAuditionDeadlineOrder);
export type CreateWorkProjectAuditionVariables = z.infer<typeof CreateWorkProjectAuditionVariablesSchema>;
