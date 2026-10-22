import { z } from 'zod';

export const SAFETY_ALIAS_VERSION = 'v1';

export const ChildSafetyOwningAliasTypeSchema = z.enum([
  'incidentKey',
  'rootIngest',
  'canonicalTarget',
  'messageRange',
]);
export type ChildSafetyOwningAliasType = z.infer<typeof ChildSafetyOwningAliasTypeSchema>;

export const ChildSafetyOwningAliasV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    aliasType: ChildSafetyOwningAliasTypeSchema,
    canonicalValueHash: z.string(),
    createdAt: z.number(),
    generation: z.number().optional(),
    updatedAt: z.number().optional(),
  })
  .strict();
export type ChildSafetyOwningAliasV1 = z.infer<typeof ChildSafetyOwningAliasV1Schema>;
