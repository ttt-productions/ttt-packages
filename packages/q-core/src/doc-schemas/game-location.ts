// `gameLocations/{gameLocationId}` — one venue games are played at. Games name it by id
// (`gameLocationId`) beside their own free-text label, so a game still reads correctly after its
// venue is deleted.

import { z } from 'zod';
import { countSchema, documentIdSegmentSchema, epochMsSchema } from './atoms.js';
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

// `_serverData/gameLocationRegistry` — the fence of the venue cap. Venue creation counts the venues
// in its transaction against MAX_GAME_LOCATIONS, and a query does not lock against an insert, so each
// creation advances `locationRevision` here: two creations at the cap conflict instead of both
// passing (BACKEND-116). Only its changing matters; absent until the first creation.
export const GameLocationRegistrySchema = z.strictObject({
  locationRevision: countSchema,
});
export type GameLocationRegistry = z.infer<typeof GameLocationRegistrySchema>;
