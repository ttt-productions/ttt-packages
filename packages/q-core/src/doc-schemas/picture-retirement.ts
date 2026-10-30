import { z } from 'zod';
import { PICTURE_RETIREMENT_REASON_KEYS } from '../types/uploads.js';
import { isPictureOwnerId } from '../paths/picture-owner-paths.js';
import { documentIdSegmentSchema, epochMsSchema } from './atoms.js';
import { galleryOwnerKindSchema, pictureIdSchema } from './gallery.js';

export const pictureRetirementReasonSchema = z.enum(PICTURE_RETIREMENT_REASON_KEYS);

export const PictureRetirementTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('picture'), pictureId: pictureIdSchema }).strict(),
  z
    .object({
      kind: z.literal('gallery'),
      ownerKind: galleryOwnerKindSchema,
      ownerId: documentIdSegmentSchema,
    })
    .strict()
    .refine((target) => isPictureOwnerId(target.ownerKind, target.ownerId), {
      message: 'Not an owner of that kind.',
      path: ['ownerId'],
    }),
]);
export type PictureRetirementTarget = z.infer<typeof PictureRetirementTargetSchema>;

export const PictureRetirementSchema = z.object({
  target: PictureRetirementTargetSchema,
  requestedAt: epochMsSchema,
  reason: pictureRetirementReasonSchema,
});
export type PictureRetirement = z.infer<typeof PictureRetirementSchema>;
