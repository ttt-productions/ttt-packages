import { z } from 'zod';
import { AWARD_NAME_INPUT_FORMAT } from '../input-formats/input-formats.js';
import { countSchema, documentIdSegmentSchema, epochMsSchema, textFieldSchema } from './atoms.js';
import { pictureIdSchema } from './gallery.js';

export const awardIdSchema = documentIdSegmentSchema;

export const awardNameSchema = textFieldSchema(AWARD_NAME_INPUT_FORMAT);

export const AwardDefinitionSchema = z.strictObject({
  name: awardNameSchema,
  badgePictureId: pictureIdSchema.optional(),
  holderCount: countSchema,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
});
export type AwardDefinition = z.infer<typeof AwardDefinitionSchema>;
