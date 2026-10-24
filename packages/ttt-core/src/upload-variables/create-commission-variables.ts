import { z } from 'zod';
import { workProjectIdSchema, stakeSharesOfferedSchema } from '../schemas/atoms.js';
import { textFieldSchema } from '../schemas/text-field.js';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { onProgressSchema } from './on-progress.js';
import { TRADE_PROFESSION_OPTIONS } from '../constants/options.js';
import { COMMISSION_DESCRIPTION_INPUT, COMMISSION_TITLE_INPUT } from '../constants/text-fields.js';

export const CreateCommissionVariablesSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    commissionListingData: z
      .object({
        title: textFieldSchema(COMMISSION_TITLE_INPUT),
        description: textFieldSchema(COMMISSION_DESCRIPTION_INPUT),
        requiredTradeProfessions: z
          .array(z.enum(TRADE_PROFESSION_OPTIONS))
          .max(TRADE_PROFESSION_OPTIONS.length),
        stakeSharesOffered: stakeSharesOfferedSchema,
      })
      .strict(),
    file: z.instanceof(File).or(z.instanceof(Blob)),

    claim: ClientMediaClaimSchema.optional(),
    onProgress: onProgressSchema,
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict();
export type CreateCommissionVariables = z.infer<typeof CreateCommissionVariablesSchema>;
