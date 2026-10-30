import { z } from 'zod';
import { countSchema, documentIdSegmentSchema, epochMsSchema, userIdSchema } from './atoms.js';

export const waiverTemplateIdSchema = documentIdSegmentSchema;
export const waiverTemplateVersionNumberSchema = z.number().int().min(1);

export const WaiverTemplateSchema = z
  .object({
    title: z.string(),
    waiverText: z.string(),
    version: waiverTemplateVersionNumberSchema,
    createdAt: epochMsSchema,
    updatedAt: epochMsSchema,
    retired: z.boolean(),
    retiredAt: epochMsSchema.optional(),
    // Its own field, so `updatedAt` keeps meaning the template itself changed; the league save
    // writes it so a delete's read of this document conflicts with that save.
    lastChosenAt: epochMsSchema.optional(),
  })
  .refine((template) => template.retired === (template.retiredAt !== undefined), {
    message: 'A template is retired exactly when it records when it was retired.',
    path: ['retired'],
  });
export type WaiverTemplate = z.infer<typeof WaiverTemplateSchema>;

// `_serverData/waiverTemplateRegistry` — the write fence of the offered-template cap
// (RULE-STD-BACKEND-116): only its changing matters.
export const WaiverTemplateRegistrySchema = z.strictObject({
  templateRevision: countSchema,
});
export type WaiverTemplateRegistry = z.infer<typeof WaiverTemplateRegistrySchema>;

export const WaiverTemplateVersionSchema = z.object({
  version: waiverTemplateVersionNumberSchema,
  title: z.string(),
  waiverText: z.string(),
  publishedByUserId: userIdSchema.optional(),
  publishedAt: epochMsSchema,
});
export type WaiverTemplateVersion = z.infer<typeof WaiverTemplateVersionSchema>;
