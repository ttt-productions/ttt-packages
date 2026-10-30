import { z } from 'zod';
import { GALLERY_OWNER_KIND_KEYS, PICTURE_OWNER_KIND_KEYS } from '../types/picture-owners.js';
import { isPictureOwnerId } from '../paths/picture-owner-paths.js';
import { countSchema, documentIdSegmentSchema, epochMsSchema, stagingIdSchema } from './atoms.js';

export const pictureOwnerKindSchema = z.enum(PICTURE_OWNER_KIND_KEYS);
export const galleryOwnerKindSchema = z.enum(GALLERY_OWNER_KIND_KEYS);

export const pictureIdSchema = stagingIdSchema;

export const GalleryPictureSchema = z
  .object({
    ownerKind: galleryOwnerKindSchema,
    ownerId: documentIdSegmentSchema,
    position: z.string().min(1),
    sourceIndex: countSchema.optional(),
    createdAt: epochMsSchema,
  })
  .refine((picture) => isPictureOwnerId(picture.ownerKind, picture.ownerId), {
    message: 'Not an owner of that kind.',
    path: ['ownerId'],
  });
export type GalleryPicture = z.infer<typeof GalleryPictureSchema>;

export const GallerySummarySchema = z
  .object({
    count: countSchema,
    featuredPictureId: pictureIdSchema.optional(),
    updatedAt: epochMsSchema,
  })
  .refine((summary) => summary.count > 0 === (summary.featuredPictureId !== undefined), {
    message: 'featuredPictureId is present exactly when the gallery holds a picture',
    path: ['featuredPictureId'],
  });
export type GallerySummary = z.infer<typeof GallerySummarySchema>;
