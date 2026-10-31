import { z } from 'zod';
import { MAX_GAME_LOCATION_SUB_LOCATIONS } from '../constants/business.js';
import {
  GAME_LOCATION_MEMO_INPUT_FORMAT,
  GAME_LOCATION_NAME_INPUT_FORMAT,
  GAME_LOCATION_STREET_ADDRESS_INPUT_FORMAT,
  GAME_LOCATION_SUB_LOCATION_INPUT_FORMAT,
} from '../input-formats/input-formats.js';
import { countSchema, documentIdSegmentSchema, epochMsSchema, textFieldSchema } from './atoms.js';
import { pictureIdSchema } from './gallery.js';

export const gameLocationIdSchema = documentIdSegmentSchema;

export const gameLocationNameSchema = textFieldSchema(GAME_LOCATION_NAME_INPUT_FORMAT);
export const gameLocationStreetAddressSchema = textFieldSchema(
  GAME_LOCATION_STREET_ADDRESS_INPUT_FORMAT,
);
export const gameLocationSubLocationSchema = textFieldSchema(
  GAME_LOCATION_SUB_LOCATION_INPUT_FORMAT,
);
export const gameLocationSubLocationsSchema = z
  .array(gameLocationSubLocationSchema)
  .max(MAX_GAME_LOCATION_SUB_LOCATIONS)
  .refine((subLocations) => new Set(subLocations).size === subLocations.length, {
    message: 'Each sub-location may appear only once.',
  });
export const gameLocationMemoSchema = textFieldSchema(GAME_LOCATION_MEMO_INPUT_FORMAT);

export const GameLocationSchema = z.object({
  name: gameLocationNameSchema,
  streetAddress: gameLocationStreetAddressSchema,
  subLocations: gameLocationSubLocationsSchema,
  // An empty memo is stored as no memo.
  memo: gameLocationMemoSchema.pipe(z.string().min(1)).optional(),
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
