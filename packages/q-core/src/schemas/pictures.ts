// Callable contracts for managing pictures already published: ordering a gallery, choosing its
// featured picture, and removing a gallery picture or a location's picture. Admin only.
//
// Each result carries the one entry it changed, so a client patches that entry into the gallery
// pages it holds instead of refetching them (FRONTEND-103), and the owner's own update event, which
// refreshes the owner document that carries the gallery's summary.

import { z } from 'zod';
import { GalleryPictureSchema, pictureIdSchema } from '../doc-schemas/gallery.js';
import { PictureOwnerRefSchema } from '../doc-schemas/pending-media.js';
import { DomainEventSchema } from '../domain-events/domain-events.js';

// A gallery picture as a client holds it in its cached pages: the document with its id.
export const GalleryPictureEntrySchema = GalleryPictureSchema.extend({
  id: pictureIdSchema,
}).strict();
export type GalleryPictureEntry = z.infer<typeof GalleryPictureEntrySchema>;

export const AdminMovePictureInputSchema = z
  .object({
    pictureId: pictureIdSchema,
    // The picture it goes directly after, in the same gallery; `null` puts it first.
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
    // The owner the admin is removing it from. A gallery picture must belong to it, and a location's
    // must be its current picture; an award's badge is never removed, only replaced.
    owner: PictureOwnerRefSchema,
    pictureId: pictureIdSchema,
  })
  .strict();
export type AdminDeletePictureInput = z.infer<typeof AdminDeletePictureInputSchema>;
export const AdminDeletePictureResultSchema = z
  .object({ owner: PictureOwnerRefSchema, pictureId: pictureIdSchema, event: DomainEventSchema })
  .strict();
export type AdminDeletePictureResult = z.infer<typeof AdminDeletePictureResultSchema>;
