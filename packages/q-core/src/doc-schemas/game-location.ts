// `gameLocations/{gameLocationId}` — one venue games are played at. Games name it by id
// (`gameLocationId`) beside their own free-text label, so a game still reads correctly after its
// venue is deleted.

import { z } from 'zod';
import { documentIdSegmentSchema, epochMsSchema } from './atoms.js';
import { pictureIdSchema } from './gallery.js';

export const gameLocationIdSchema = documentIdSegmentSchema;

export const GameLocationSchema = z.object({
  name: z.string().min(1),
  streetAddress: z.string(),
  // Courts, sheets, or rooms within the venue.
  subLocations: z.array(z.string()),
  // Directions for players; absent when there are none.
  memo: z.string().min(1).optional(),
  // The venue's picture. Only the picture pipeline writes it (ARCH-001); the location callables
  // write the fields above and never this one.
  pictureId: pictureIdSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
});
export type GameLocation = z.infer<typeof GameLocationSchema>;
