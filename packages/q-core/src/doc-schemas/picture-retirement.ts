import { z } from 'zod';
import { PICTURE_RETIREMENT_REASON_KEYS } from '../types/uploads.js';
import { epochMsSchema } from './atoms.js';
import { galleryOwnerKindSchema, pictureIdSchema } from './gallery.js';

export const pictureRetirementReasonSchema = z.enum(PICTURE_RETIREMENT_REASON_KEYS);

export const PictureRetirementTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('picture'), pictureId: pictureIdSchema }).strict(),
  z
    .object({
      kind: z.literal('gallery'),
      ownerKind: galleryOwnerKindSchema,
      ownerId: z.string().min(1),
    })
    .strict(),
]);
export type PictureRetirementTarget = z.infer<typeof PictureRetirementTargetSchema>;

export const PictureRetirementSchema = z.object({
  target: PictureRetirementTargetSchema,
  requestedAt: epochMsSchema,
  reason: pictureRetirementReasonSchema,
});
export type PictureRetirement = z.infer<typeof PictureRetirementSchema>;
