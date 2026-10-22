import { z } from 'zod';
import { AuditionModeSchema } from '../doc-schemas/commissions.js';
import { workProjectIdSchema, stakeSharesOfferedSchema } from '../schemas/atoms.js';
import { textFieldSchema } from '../schemas/text-field.js';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';
import {
  MIN_CURATED_AUDITION_OPTIONS,
  MAX_CURATED_AUDITION_OPTIONS,
} from '../constants/business-content.js';
import { AUDITION_DESCRIPTION_INPUT, AUDITION_TITLE_INPUT } from '../constants/text-fields.js';
import {
  AuditionDeadlineSchema,
  refineAuditionDeadlineOrder,
} from '../constants/audition-deadlines.js';

export const CreateWorkProjectAuditionVariablesSchema = z
  .object({
    title: textFieldSchema(AUDITION_TITLE_INPUT),
    description: textFieldSchema(AUDITION_DESCRIPTION_INPUT),
    videoFile: z.instanceof(File).or(z.instanceof(Blob)),

    claim: ClientMediaClaimSchema.optional(),
    entriesCloseAt: AuditionDeadlineSchema,
    auditionCloseAt: AuditionDeadlineSchema,
    workProjectId: workProjectIdSchema,
    stakeSharesOffered: stakeSharesOfferedSchema.optional(),
    // On the variables, not targetInfo: the hook parses variables strictly (RULE-STD-MEDIA-005).
    mode: AuditionModeSchema.optional(),
    expectedOptionCount: z
      .number()
      .int()
      .min(MIN_CURATED_AUDITION_OPTIONS)
      .max(MAX_CURATED_AUDITION_OPTIONS)
      .optional(),
    onProgress: onProgressSchema,
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict()
  .superRefine(refineAuditionDeadlineOrder);
export type CreateWorkProjectAuditionVariables = z.infer<
  typeof CreateWorkProjectAuditionVariablesSchema
>;
