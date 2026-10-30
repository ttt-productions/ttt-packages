import { z } from 'zod';
import { MAX_GAME_LOCATION_SUB_LOCATIONS } from '../constants/business.js';
import { textFieldSchema } from '../doc-schemas/atoms.js';
import { gameLocationIdSchema } from '../doc-schemas/game-location.js';
import {
  GAME_LOCATION_MEMO_INPUT_FORMAT,
  GAME_LOCATION_NAME_INPUT_FORMAT,
  GAME_LOCATION_STREET_ADDRESS_INPUT_FORMAT,
  GAME_LOCATION_SUB_LOCATION_INPUT_FORMAT,
} from '../input-formats/input-formats.js';

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
  .object({
    gameLocationId: gameLocationIdSchema,
    name: gameLocationNameSchema.optional(),
    streetAddress: gameLocationStreetAddressSchema.optional(),
    subLocations: gameLocationSubLocationsSchema.optional(),
    memo: gameLocationMemoSchema.optional(),
  })
  .strict()
  .refine(
    ({ gameLocationId: _gameLocationId, ...fields }) =>
      Object.values(fields).some((value) => value !== undefined),
    { message: 'Change at least one field.' },
  );
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
