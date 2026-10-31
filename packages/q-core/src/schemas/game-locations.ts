import { z } from 'zod';
import {
  gameLocationIdSchema,
  gameLocationMemoSchema,
  gameLocationNameSchema,
  gameLocationStreetAddressSchema,
  gameLocationSubLocationsSchema,
} from '../doc-schemas/game-location.js';

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
