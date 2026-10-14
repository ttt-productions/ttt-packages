// `pendingMedia/{pendingMediaId}` — one accepted picture upload: the durable hand-off from the
// accepting callable to the processing trigger. Its id is the upload's staging id, which is also
// the picture's id; rows are never deleted, so no two uploads ever share an id.
//
// The shape is media-schemas' generic pending-media lifecycle composed with Q-Sports' origins and
// domain events. Every field is written by the server: `originalFileName` and `clientContext`,
// which the generic shape requires, hold the staging id and the origin, so no client-authored
// metadata reaches the row. `targetInfo` is the server-normalized `PendingMediaTarget`.

import { z } from 'zod';
import { createPendingMediaSchemas } from '@ttt-productions/media-schemas';
import { DomainEventSchema } from '../domain-events/domain-events.js';
import { FILE_ORIGIN_KEYS, PICTURE_ORIGIN_KEYS } from '../media/file-origins.js';
import { AWARD_DEFINITION_OWNER_KIND } from '../types/picture-owners.js';
import { awardNameSchema } from './catalogs.js';
import { pictureOwnerKindSchema } from './gallery.js';

export const fileOriginSchema = z.enum(FILE_ORIGIN_KEYS);
export const pictureOriginSchema = z.enum(PICTURE_ORIGIN_KEYS);

// A stored object, by bucket and path — never a URL. A retained signature is recorded this way, and
// so is the source a carried picture was read from.
export const StorageObjectRefSchema = z
  .object({ bucket: z.string().min(1), path: z.string().min(1) })
  .strict();
export type StorageObjectRef = z.infer<typeof StorageObjectRefSchema>;

// The document a picture belongs to. A landing page picture's owner id is `SPECIAL_DOCS.LANDING_PAGE`.
export const PictureOwnerRefSchema = z
  .object({ kind: pictureOwnerKindSchema, id: z.string().min(1) })
  .strict();
export type PictureOwnerRef = z.infer<typeof PictureOwnerRefSchema>;

export const PendingMediaTargetSchema = z
  .object({
    owner: PictureOwnerRefSchema,
    // The object a carried picture was read from. Written only by the migration console's picture
    // carry, never from a callable's input; a carried picture fills only an empty slot.
    carriedFrom: StorageObjectRefSchema.optional(),
    // A badge upload that creates its award: the award's name, which the publication writes with
    // the award. The owner's id is then the upload's staging id.
    newAwardName: awardNameSchema.optional(),
  })
  .strict()
  .refine((target) => target.newAwardName === undefined || target.owner.kind === AWARD_DEFINITION_OWNER_KIND, {
    message: 'Only a badge upload creates an award.',
    path: ['newAwardName'],
  });
export type PendingMediaTarget = z.infer<typeof PendingMediaTargetSchema>;

const schemas = createPendingMediaSchemas({
  fileOriginSchema,
  domainEventSchema: DomainEventSchema,
});

export const PendingMediaErrorCategorySchema = schemas.PendingMediaErrorCategorySchema;
export const PendingMediaResultSchema = schemas.PendingMediaResultSchema;
export const PendingMediaPendingSchema = schemas.PendingMediaPendingSchema;
export const PendingMediaProcessingSchema = schemas.PendingMediaProcessingSchema;
export const PendingMediaCompletedSchema = schemas.PendingMediaCompletedSchema;
export const PendingMediaFailedSchema = schemas.PendingMediaFailedSchema;
export const PendingMediaRejectedSchema = schemas.PendingMediaRejectedSchema;
export const PendingMediaSchema = schemas.PendingMediaSchema;

export type PendingMediaErrorCategory = z.infer<typeof PendingMediaErrorCategorySchema>;
export type PendingMediaResult = z.infer<typeof PendingMediaResultSchema>;
export type PendingMediaPending = z.infer<typeof PendingMediaPendingSchema>;
export type PendingMediaProcessing = z.infer<typeof PendingMediaProcessingSchema>;
export type PendingMediaCompleted = z.infer<typeof PendingMediaCompletedSchema>;
export type PendingMediaFailed = z.infer<typeof PendingMediaFailedSchema>;
export type PendingMediaRejected = z.infer<typeof PendingMediaRejectedSchema>;
export type PendingMedia = z.infer<typeof PendingMediaSchema>;
