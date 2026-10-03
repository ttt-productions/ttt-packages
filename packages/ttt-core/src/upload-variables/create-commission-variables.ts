import { z } from 'zod';
import { workProjectIdSchema, stakeSharesOfferedSchema } from '../schemas/atoms.js';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';
import { TRADE_PROFESSION_OPTIONS, TRADE_PROFESSION_VALUES } from '../constants/options.js';
import {
  MAX_COMMISSION_TITLE_LENGTH,
  MAX_COMMISSION_DESCRIPTION_LENGTH,
} from '../constants/business.js';

export const CreateCommissionVariablesSchema = z.object({
  workProjectId: workProjectIdSchema,
  commissionListingData: z.object({
    title: z.string().min(1).max(MAX_COMMISSION_TITLE_LENGTH),
    description: z.string().max(MAX_COMMISSION_DESCRIPTION_LENGTH),
    requiredTradeProfessions: z.array(z.enum(TRADE_PROFESSION_VALUES)).max(TRADE_PROFESSION_OPTIONS.length),
    stakeSharesOffered: stakeSharesOfferedSchema,
  }).strict(),
  file: z.instanceof(File).or(z.instanceof(Blob)),

  // Untrusted client claim of what the user's action implies (advisory; the

  // server byte inspection is the only classification authority).

  claim: ClientMediaClaimSchema.optional(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type CreateCommissionVariables = z.infer<typeof CreateCommissionVariablesSchema>;

