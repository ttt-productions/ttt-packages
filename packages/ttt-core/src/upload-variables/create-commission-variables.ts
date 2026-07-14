import { z } from 'zod';
import { onProgressSchema } from './on-progress.js';
import { TRADE_PROFESSION_OPTIONS, TRADE_PROFESSION_VALUES } from '../constants/options.js';
import {
  MAX_COMMISSION_TITLE_LENGTH,
  MAX_COMMISSION_DESCRIPTION_LENGTH,
  MAX_WORK_PROJECT_STAKE_SHARES,
} from '../constants/business.js';

export const CreateCommissionVariablesSchema = z.object({
  workProjectId: z.string().min(1),
  commissionListingData: z.object({
    title: z.string().min(1).max(MAX_COMMISSION_TITLE_LENGTH),
    description: z.string().max(MAX_COMMISSION_DESCRIPTION_LENGTH),
    requiredTradeProfessions: z.array(z.enum(TRADE_PROFESSION_VALUES)).max(TRADE_PROFESSION_OPTIONS.length),
    stakeSharesOffered: z.number().int().min(0).max(MAX_WORK_PROJECT_STAKE_SHARES),
  }).strict(),
  file: z.instanceof(File).or(z.instanceof(Blob)),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type CreateCommissionVariables = z.infer<typeof CreateCommissionVariablesSchema>;

