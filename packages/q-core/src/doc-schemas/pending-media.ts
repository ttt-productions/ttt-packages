import { z } from 'zod';
import { createPendingMediaSchemas } from '@ttt-productions/media-schemas';
import { DomainEventSchema } from '../domain-events/domain-events.js';
import { FILE_ORIGIN_KEYS, PICTURE_ORIGIN_KEYS } from '../media/file-origins.js';
import { AWARD_DEFINITION_OWNER_KIND } from '../types/picture-owners.js';
import { countSchema } from './atoms.js';
import { awardNameSchema } from './catalogs.js';
import { pictureOwnerKindSchema } from './gallery.js';

export const fileOriginSchema = z.enum(FILE_ORIGIN_KEYS);
export const pictureOriginSchema = z.enum(PICTURE_ORIGIN_KEYS);

export const StorageObjectRefSchema = z
  .object({ bucket: z.string().min(1), path: z.string().min(1) })
  .strict();
export type StorageObjectRef = z.infer<typeof StorageObjectRefSchema>;

export const PictureOwnerRefSchema = z
  .object({ kind: pictureOwnerKindSchema, id: z.string().min(1) })
  .strict();
export type PictureOwnerRef = z.infer<typeof PictureOwnerRefSchema>;

export const PendingMediaTargetSchema = z
  .object({
    owner: PictureOwnerRefSchema,
    carriedFrom: StorageObjectRefSchema.optional(),
    sourceIndex: countSchema.optional(),
    newAwardName: awardNameSchema.optional(),
  })
  .strict()
  .refine(
    (target) =>
      target.newAwardName === undefined || target.owner.kind === AWARD_DEFINITION_OWNER_KIND,
    {
      message: 'Only a badge upload creates an award.',
      path: ['newAwardName'],
    },
  )
  .refine((target) => target.sourceIndex === undefined || target.carriedFrom !== undefined, {
    message: 'Only a carried picture has a source position.',
    path: ['sourceIndex'],
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
