// Picture galleries — the league's, each team's, and the landing page's.
//
// Each picture in a gallery is its own `galleryPictures/{pictureId}` document, publicly readable
// and written only by the picture core. The owner document carries its gallery's summary as its
// optional `pictures` field: a card or a header reads the featured picture off the owner it
// already holds, and `count` tells a display how many pictures there are without a count query.
// An absent `pictures` field is an empty gallery, so no copy action or create core writes one.

import { z } from 'zod';
import { GALLERY_OWNER_KIND_KEYS, PICTURE_OWNER_KIND_KEYS } from '../types/picture-owners.js';
import { countSchema, epochMsSchema, stagingIdSchema } from './atoms.js';

export const pictureOwnerKindSchema = z.enum(PICTURE_OWNER_KIND_KEYS);
export const galleryOwnerKindSchema = z.enum(GALLERY_OWNER_KIND_KEYS);

// A picture id is its upload's staging id; every stored size lives under it.
export const pictureIdSchema = stagingIdSchema;

export const GalleryPictureSchema = z.object({
  ownerKind: galleryOwnerKindSchema,
  // The league or team id; the landing page's gallery uses `SPECIAL_DOCS.LANDING_PAGE`.
  ownerId: z.string().min(1),
  // A fractional sort key: a move rewrites only the moved picture's key, strictly between its new
  // neighbours, and a gallery's first page is read ordered by it.
  position: z.string().min(1),
  createdAt: epochMsSchema,
});
export type GalleryPicture = z.infer<typeof GalleryPictureSchema>;

export const GallerySummarySchema = z
  .object({
    // Exact: every gallery change rewrites the summary inside its own transaction.
    count: countSchema,
    // Always one of the owner's pictures, so no reader needs a fallback rule.
    featuredPictureId: pictureIdSchema.optional(),
    updatedAt: epochMsSchema,
  })
  .refine((summary) => (summary.count > 0) === (summary.featuredPictureId !== undefined), {
    message: 'featuredPictureId is present exactly when the gallery holds a picture',
    path: ['featuredPictureId'],
  });
export type GallerySummary = z.infer<typeof GallerySummarySchema>;
