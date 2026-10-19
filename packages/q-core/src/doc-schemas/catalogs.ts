// The award catalog. Each award is its own document, keeping the id granted awards already
// reference. The venue catalog is ./game-location.ts.

import { z } from 'zod';
import { AWARD_NAME_INPUT_FORMAT } from '../input-formats/input-formats.js';
import { countSchema, documentIdSegmentSchema, epochMsSchema, textFieldSchema } from './atoms.js';
import { pictureIdSchema } from './gallery.js';

// An award's id, which every grant names and so never changes: an award created by its badge upload
// takes that upload's staging id.
export const awardIdSchema = documentIdSegmentSchema;

// An award's name, as the catalog stores it and the creating upload sends it.
export const awardNameSchema = textFieldSchema(AWARD_NAME_INPUT_FORMAT);

// `awardDefinitions/{awardId}` — one award in the catalog. It is created by the publication of its
// first badge, so an award created that way always has one; an award with no badge yet gets one from
// the next badge upload for it. A badge is replaced only by a newer upload, never removed on its own.
//
// `holderCount` is how many accounts hold the award now. Every grant and revoke moves it in the
// transaction that writes the grant, so a deletion — refused while anyone holds the award — and a
// concurrent grant conflict on this document instead of racing past each other.
export const AwardDefinitionSchema = z.strictObject({
  name: awardNameSchema,
  badgePictureId: pictureIdSchema.optional(),
  holderCount: countSchema,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
});
export type AwardDefinition = z.infer<typeof AwardDefinitionSchema>;
