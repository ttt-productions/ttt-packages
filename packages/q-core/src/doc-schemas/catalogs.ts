import { z } from 'zod';
import { AWARD_NAME_INPUT } from '../constants/text-fields.js';
import { countSchema, documentIdSegmentSchema, epochMsSchema } from './atoms.js';
import { textFieldSchema } from '../schemas/text-field.js';
import { pictureIdSchema } from './gallery.js';

export const awardIdSchema = documentIdSegmentSchema;

export const awardNameSchema = textFieldSchema(AWARD_NAME_INPUT);

export const AwardDefinitionSchema = z.strictObject({
  name: awardNameSchema,
  badgePictureId: pictureIdSchema.optional(),
  holderCount: countSchema,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
});
export type AwardDefinition = z.infer<typeof AwardDefinitionSchema>;
