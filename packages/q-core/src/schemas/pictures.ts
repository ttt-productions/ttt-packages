import { z } from 'zod';
import { GalleryPictureSchema, pictureIdSchema } from '../doc-schemas/gallery.js';
import { PictureOwnerRefSchema } from '../doc-schemas/pending-media.js';
import { DomainEventSchema } from '../domain-events/domain-events.js';

export const GalleryPictureEntrySchema = GalleryPictureSchema.extend({
  id: pictureIdSchema,
}).strict();
export type GalleryPictureEntry = z.infer<typeof GalleryPictureEntrySchema>;

export const AdminMovePictureInputSchema = z
  .object({
    pictureId: pictureIdSchema,
    afterPictureId: pictureIdSchema.nullable(),
  })
  .strict();
export type AdminMovePictureInput = z.infer<typeof AdminMovePictureInputSchema>;
export const AdminMovePictureResultSchema = z
  .object({ picture: GalleryPictureEntrySchema, event: DomainEventSchema })
  .strict();
export type AdminMovePictureResult = z.infer<typeof AdminMovePictureResultSchema>;

export const AdminUpdateFeaturedPictureInputSchema = z
  .object({ pictureId: pictureIdSchema })
  .strict();
export type AdminUpdateFeaturedPictureInput = z.infer<typeof AdminUpdateFeaturedPictureInputSchema>;
export const AdminUpdateFeaturedPictureResultSchema = z
  .object({ picture: GalleryPictureEntrySchema, event: DomainEventSchema })
  .strict();
export type AdminUpdateFeaturedPictureResult = z.infer<
  typeof AdminUpdateFeaturedPictureResultSchema
>;

export const AdminDeletePictureInputSchema = z
  .object({
    owner: PictureOwnerRefSchema,
    pictureId: pictureIdSchema,
  })
  .strict();
export type AdminDeletePictureInput = z.infer<typeof AdminDeletePictureInputSchema>;
export const AdminDeletePictureResultSchema = z
  .object({ owner: PictureOwnerRefSchema, pictureId: pictureIdSchema, event: DomainEventSchema })
  .strict();
export type AdminDeletePictureResult = z.infer<typeof AdminDeletePictureResultSchema>;
