import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';
import {
  MAX_AUDITION_TITLE_LENGTH,
  MAX_AUDITION_DESCRIPTION_LENGTH,
  MIN_CURATED_AUDITION_OPTIONS,
  MAX_CURATED_AUDITION_OPTIONS,
} from '../constants/business.js';
import { AuditionDeadlineSchema, refineAuditionDeadlineOrder } from '../constants/audition-deadlines.js';
import { SponsoredAuditionAmountUSDSchema } from '../media/target-info.js';

// The admin audition variables both types share.
const adminAuditionVariableFields = {
  title: z.string().min(1).max(MAX_AUDITION_TITLE_LENGTH),
  description: z.string().max(MAX_AUDITION_DESCRIPTION_LENGTH),
  videoFile: z.instanceof(File).or(z.instanceof(Blob)),
  // Untrusted client claim of what the user's action implies (advisory; the
  // server byte inspection is the only classification authority).
  claim: ClientMediaClaimSchema.optional(),
  // The poster's two deadlines, epoch ms — the same fields and constraints as the target info.
  entriesCloseAt: AuditionDeadlineSchema,
  auditionCloseAt: AuditionDeadlineSchema,
  // Curated vs open (default 'open' when absent). 'curated' → the admin posts the option videos and
  // users may ONLY vote. Must live on the variables (MEDIA-005 strict-parse), not targetInfo.
  mode: z.enum(['open', 'curated']).optional(),
  // Curated only: the fixed number of option videos (2..8) uploaded as one atomic batch. Required by
  // the callable when mode === 'curated'; ignored for open auditions.
  expectedOptionCount: z.number().int().min(MIN_CURATED_AUDITION_OPTIONS).max(MAX_CURATED_AUDITION_OPTIONS).optional(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
};

/** By type, like the target info: a sponsored audition carries its prize; a platform one none. */
export const CreateAdminAuditionVariablesSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('platformAudition'), ...adminAuditionVariableFields }).strict(),
    z
      .object({
        type: z.literal('sponsoredAudition'),
        ...adminAuditionVariableFields,
        sponsoredAuditionAmountUSD: SponsoredAuditionAmountUSDSchema,
      })
      .strict(),
  ])
  .superRefine(refineAuditionDeadlineOrder);
export type CreateAdminAuditionVariables = z.infer<typeof CreateAdminAuditionVariablesSchema>;
