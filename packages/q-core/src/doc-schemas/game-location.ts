import { z } from 'zod';
import { countSchema, documentIdSegmentSchema, epochMsSchema } from './atoms.js';
import { pictureIdSchema } from './gallery.js';

export const gameLocationIdSchema = documentIdSegmentSchema;

export const GameLocationSchema = z.object({
  name: z.string().min(1),
  streetAddress: z.string(),
  subLocations: z.array(z.string()),
  memo: z.string().min(1).optional(),
  pictureId: pictureIdSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
});
export type GameLocation = z.infer<typeof GameLocationSchema>;

// `_serverData/gameLocationRegistry` — the write fence of the venue cap (RULE-STD-BACKEND-116):
// only its changing matters.
export const GameLocationRegistrySchema = z.strictObject({
  locationRevision: countSchema,
});
export type GameLocationRegistry = z.infer<typeof GameLocationRegistrySchema>;
