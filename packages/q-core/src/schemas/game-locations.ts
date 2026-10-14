// Callable contracts for game locations: create, edit, and delete one venue. Admin only. The
// venue's picture goes through the upload pipeline, never through these.

import { z } from 'zod';
import { MAX_GAME_LOCATION_SUB_LOCATIONS } from '../constants/business.js';
import { textFieldSchema } from '../doc-schemas/atoms.js';
import { gameLocationIdSchema } from '../doc-schemas/game-location.js';
import {
  GAME_LOCATION_MEMO_INPUT_FORMAT,
  GAME_LOCATION_NAME_INPUT_FORMAT,
  GAME_LOCATION_STREET_ADDRESS_INPUT_FORMAT,
  GAME_LOCATION_SUB_LOCATION_INPUT_FORMAT,
} from '../input-formats/index.js';

export const gameLocationNameSchema = textFieldSchema(GAME_LOCATION_NAME_INPUT_FORMAT);
export const gameLocationStreetAddressSchema = textFieldSchema(GAME_LOCATION_STREET_ADDRESS_INPUT_FORMAT);
// One court, sheet, or room within a venue — as the venue lists it, and as a game names it.
export const gameLocationSubLocationSchema = textFieldSchema(GAME_LOCATION_SUB_LOCATION_INPUT_FORMAT);
export const gameLocationSubLocationsSchema = z
  .array(gameLocationSubLocationSchema)
  .max(MAX_GAME_LOCATION_SUB_LOCATIONS)
  .refine((subLocations) => new Set(subLocations).size === subLocations.length, {
    message: 'Each sub-location may appear only once.',
  });
// An empty memo means the venue has none.
export const gameLocationMemoSchema = textFieldSchema(GAME_LOCATION_MEMO_INPUT_FORMAT);

// The venue's own fields, whole: an edit sends every one of them as the admin wants it to read.
const gameLocationFieldsShape = {
  name: gameLocationNameSchema,
  streetAddress: gameLocationStreetAddressSchema,
  subLocations: gameLocationSubLocationsSchema,
  memo: gameLocationMemoSchema,
};

export const AdminCreateGameLocationInputSchema = z.object(gameLocationFieldsShape).strict();
export type AdminCreateGameLocationInput = z.infer<typeof AdminCreateGameLocationInputSchema>;
export const AdminCreateGameLocationResultSchema = z
  .object({ gameLocationId: gameLocationIdSchema })
  .strict();
export type AdminCreateGameLocationResult = z.infer<typeof AdminCreateGameLocationResultSchema>;

export const AdminUpdateGameLocationInputSchema = z
  .object({ gameLocationId: gameLocationIdSchema, ...gameLocationFieldsShape })
  .strict();
export type AdminUpdateGameLocationInput = z.infer<typeof AdminUpdateGameLocationInputSchema>;
export const AdminUpdateGameLocationResultSchema = z
  .object({ gameLocationId: gameLocationIdSchema })
  .strict();
export type AdminUpdateGameLocationResult = z.infer<typeof AdminUpdateGameLocationResultSchema>;

export const AdminDeleteGameLocationInputSchema = z
  .object({ gameLocationId: gameLocationIdSchema })
  .strict();
export type AdminDeleteGameLocationInput = z.infer<typeof AdminDeleteGameLocationInputSchema>;
export const AdminDeleteGameLocationResultSchema = z
  .object({ gameLocationId: gameLocationIdSchema })
  .strict();
export type AdminDeleteGameLocationResult = z.infer<typeof AdminDeleteGameLocationResultSchema>;
