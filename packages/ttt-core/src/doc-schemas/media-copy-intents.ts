// No native TTL: an intent removed before its objects are reaped strands those objects.

import { z } from 'zod';
import {
  MEDIA_VARIANT_KEYS,
  MediaAssetOwnerTypeSchema,
  MediaVariantKeySchema,
} from './media-assets.js';

export const MediaCopyIntentStateSchema = z.enum(['copying', 'reaping']);
export type MediaCopyIntentState = z.infer<typeof MediaCopyIntentStateSchema>;

export const MediaCopyIntentKindSchema = z.enum(['copy', 'ingest']);
export type MediaCopyIntentKind = z.infer<typeof MediaCopyIntentKindSchema>;

const intentLifecycleShape = {
  newAssetId: z.string().min(1),
  state: MediaCopyIntentStateSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  reapAfter: z.number().int().nonnegative(),
  reapAttemptCount: z.number().int().nonnegative(),
  reapClaimedAt: z.number().int().nonnegative().optional(),
};

export const MediaAssetCopyIntentSchema = z
  .object({
    kind: z.literal('copy'),
    ...intentLifecycleShape,
    sourceAssetId: z.string().min(1),
    ownerType: MediaAssetOwnerTypeSchema,
    ownerId: z.string().min(1),
    variantKeys: z.array(MediaVariantKeySchema).min(1).max(MEDIA_VARIANT_KEYS.length),
  })
  .strict();
export type MediaAssetCopyIntent = z.infer<typeof MediaAssetCopyIntentSchema>;

export const MediaIngestIntentSchema = z
  .object({
    kind: z.literal('ingest'),
    ...intentLifecycleShape,
    pendingMediaId: z.string().min(1),
  })
  .strict();
export type MediaIngestIntent = z.infer<typeof MediaIngestIntentSchema>;

export const MediaCopyIntentSchema = z
  .discriminatedUnion('kind', [MediaAssetCopyIntentSchema, MediaIngestIntentSchema])
  .superRefine((val, ctx) => {
    if (val.kind === 'copy' && new Set(val.variantKeys).size !== val.variantKeys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['variantKeys'],
        message: 'variantKeys names each variant at most once',
      });
    }
    if (val.state === 'reaping' && val.reapClaimedAt === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['reapClaimedAt'],
        message: 'a reaping intent records when it was claimed',
      });
    }
    if (val.state === 'copying' && val.reapClaimedAt !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['reapClaimedAt'],
        message: 'a copying intent has not been claimed',
      });
    }
    if (val.reapAfter < val.updatedAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['reapAfter'],
        message: 'an intent is never due before the write last recorded it',
      });
    }
  });
export type MediaCopyIntent = z.infer<typeof MediaCopyIntentSchema>;
