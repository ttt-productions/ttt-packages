import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';

const onProgressSchema = z
  .function()
  .args(z.custom<UploadState | null>())
  .returns(z.void())
  .optional();

export const CreateCommissionVariablesSchema = z.object({
  workProjectId: z.string().min(1),
  commissionListingData: z.object({
    title: z.string().min(1),
    description: z.string(),
    requiredTradeProfessions: z.array(z.string()),
    stakeSharesOffered: z.number(),
  }).strict(),
  file: z.instanceof(File).or(z.instanceof(Blob)),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type CreateCommissionVariables = z.infer<typeof CreateCommissionVariablesSchema>;

