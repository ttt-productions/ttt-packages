// `pictureRetirements/{retirementId}` — the durable obligation to delete picture files. No client
// access.
//
// It is written in the same transaction that drops a picture's last reference, fails its upload, or
// deletes its owner, and the media maintenance sweep carries it out and then deletes the row.
// Retirement is the only way files under the picture prefix are deleted, and the only way a deleted
// owner's gallery documents go: a picture target's id is the picture id, and a gallery target's is
// `buildGalleryRetirementId(ownerKind, ownerId)`.

import { z } from 'zod';
import { PICTURE_RETIREMENT_REASON_KEYS } from '../types/uploads.js';
import { epochMsSchema } from './atoms.js';
import { galleryOwnerKindSchema, pictureIdSchema } from './gallery.js';

export const pictureRetirementReasonSchema = z.enum(PICTURE_RETIREMENT_REASON_KEYS);

export const PictureRetirementTargetSchema = z.discriminatedUnion('kind', [
  // One picture: its three stored sizes.
  z.object({ kind: z.literal('picture'), pictureId: pictureIdSchema }).strict(),
  // A deleted owner's whole gallery: every one of its gallery documents and their sizes.
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
