import { z } from 'zod';
import { GalleryPictureSchema, pictureIdSchema } from '../doc-schemas/gallery.js';
import { PictureOwnerRefSchema } from '../doc-schemas/pending-media.js';
import { DomainEventSchema } from '../domain-events/domain-events.js';

export const GalleryPictureEntrySchema = GalleryPictureSchema.extend({
  id: pictureIdSchema,
}).strict();
export type GalleryPictureEntry = z.infer<typeof GalleryPictureEntrySchema>;

export const AdminUpdateGalleryPictureMoveInputSchema = z
  .object({
    pictureId: pictureIdSchema,
    afterPictureId: pictureIdSchema.nullable(),
  })
  .strict();
export type AdminUpdateGalleryPictureMoveInput = z.infer<
  typeof AdminUpdateGalleryPictureMoveInputSchema
>;
export const AdminUpdateGalleryPictureMoveResultSchema = z
  .object({ picture: GalleryPictureEntrySchema, event: DomainEventSchema })
  .strict();
export type AdminUpdateGalleryPictureMoveResult = z.infer<
  typeof AdminUpdateGalleryPictureMoveResultSchema
>;

export const AdminUpdateGalleryPictureFeaturedInputSchema = z
  .object({ pictureId: pictureIdSchema })
  .strict();
export type AdminUpdateGalleryPictureFeaturedInput = z.infer<
  typeof AdminUpdateGalleryPictureFeaturedInputSchema
>;
export const AdminUpdateGalleryPictureFeaturedResultSchema = z
  .object({ picture: GalleryPictureEntrySchema, event: DomainEventSchema })
  .strict();
export type AdminUpdateGalleryPictureFeaturedResult = z.infer<
  typeof AdminUpdateGalleryPictureFeaturedResultSchema
>;

export const AdminDeleteGalleryPictureInputSchema = z
  .object({
    owner: PictureOwnerRefSchema.strict(),
    pictureId: pictureIdSchema,
  })
  .strict();
export type AdminDeleteGalleryPictureInput = z.infer<typeof AdminDeleteGalleryPictureInputSchema>;
export const AdminDeleteGalleryPictureResultSchema = z
  .object({ owner: PictureOwnerRefSchema, pictureId: pictureIdSchema, event: DomainEventSchema })
  .strict();
export type AdminDeleteGalleryPictureResult = z.infer<typeof AdminDeleteGalleryPictureResultSchema>;
