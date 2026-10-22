import { z } from 'zod';

export const SafetyCaseAlertKindSchema = z.enum(['childSafety', 'ncii']);
export type SafetyCaseAlertKind = z.infer<typeof SafetyCaseAlertKindSchema>;

export const SafetyCaseAlertV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    caseKind: SafetyCaseAlertKindSchema,
    createdAt: z.number(),
  })
  .strict();
export type SafetyCaseAlertV1 = z.infer<typeof SafetyCaseAlertV1Schema>;
