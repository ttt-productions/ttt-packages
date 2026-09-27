// mediaCopyIntents/{newAssetId} — the intent of one media write in flight: a cross-owner copy
// (`copy`) or a first ingest (`ingest`). Both write their variant objects to deterministic keys
// under the new asset id BEFORE its asset doc exists, so a write that stops partway leaves
// objects no asset doc references. The intent is recorded before the first object is written and
// cleared in the transaction that creates the asset doc; an intent that outlives its write is how
// the objects it names are found and removed. Server-only (`allow read, write: if false`).
//
// No native-TTL field — `reapAfter` only schedules the sweep: an intent removed before its
// objects are reaped strands those objects.

import { z } from 'zod';
import { MEDIA_VARIANT_KEYS, MediaAssetOwnerTypeSchema, MediaVariantKeySchema } from './media-assets.js';

export const MediaCopyIntentStateSchema = z.enum([
  'copying', // recorded before the first object is written; the write may still complete
  'reaping', // claimed by the sweep, which is deleting the written objects
]);
export type MediaCopyIntentState = z.infer<typeof MediaCopyIntentStateSchema>;

/** Which write the intent covers — the kind decides how its objects are named and removed. */
export const MediaCopyIntentKindSchema = z.enum([
  'copy', // a cross-owner copy of an existing asset's variants
  'ingest', // the first ingest of an upload: the processed variants of a newly minted asset
]);
export type MediaCopyIntentKind = z.infer<typeof MediaCopyIntentKindSchema>;

const intentLifecycleShape = {
  newAssetId: z.string().min(1),
  state: MediaCopyIntentStateSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  // The earliest epoch ms the sweep may take this intent up; the sweep lists due intents in
  // this order. Recording sets it HALL_MEDIA_ORPHAN_GRACE_MS out, so a write in flight is never
  // due; a sweep that defers the intent pushes it out again, so an intent that cannot finish
  // yet rotates behind the ones that can instead of holding the head of every page.
  reapAfter: z.number().int().nonnegative(),
  // How many times the sweep has taken this intent up and deferred it — the count the
  // HALL_MEDIA_REAPER_BACKOFF_BASE_MS / HALL_MEDIA_REAPER_BACKOFF_MAX_MS backoff grows from.
  reapAttemptCount: z.number().int().nonnegative(),
  reapClaimedAt: z.number().int().nonnegative().optional(),
};

/** A cross-owner copy: its objects are copies of `sourceAssetId`'s variants, removed only
 * through the object store's provenance-checked copy delete. */
export const MediaAssetCopyIntentSchema = z
  .object({
    kind: z.literal('copy'),
    ...intentLifecycleShape,
    sourceAssetId: z.string().min(1),
    ownerType: MediaAssetOwnerTypeSchema,
    ownerId: z.string().min(1),
    // Variant NAMES, never object keys: each key derives from an asset id and a variant.
    variantKeys: z.array(MediaVariantKeySchema).min(1).max(MEDIA_VARIANT_KEYS.length),
  })
  .strict();
export type MediaAssetCopyIntent = z.infer<typeof MediaAssetCopyIntentSchema>;

/** A first ingest: the pipeline writes the upload's processed variants under the minted
 * `newAssetId`, and every key it can write is a canonical variant name, so the intent names
 * all of them without listing them — its reap deletes each canonical variant key under the
 * asset id, and a key that was never written is already absent. `pendingMediaId` is the
 * upload being ingested, which becomes the asset's root-ingest id, so the reap's safety-hold
 * check needs nothing beyond the intent. */
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
      ctx.addIssue({ code: 'custom', path: ['variantKeys'], message: 'variantKeys names each variant at most once' });
    }
    if (val.state === 'reaping' && val.reapClaimedAt === undefined) {
      ctx.addIssue({ code: 'custom', path: ['reapClaimedAt'], message: 'a reaping intent records when it was claimed' });
    }
    if (val.state === 'copying' && val.reapClaimedAt !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['reapClaimedAt'], message: 'a copying intent has not been claimed' });
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
