// mediaCopyIntents/{newAssetId} — the intent of one cross-owner media copy. A copy writes
// its variant objects to deterministic keys BEFORE its asset doc exists, so a copy that
// stops partway leaves objects no asset doc references. The intent is recorded before the
// first object is copied and cleared in the transaction that creates the asset doc; an
// intent that outlives its copy is how the objects it names are found and removed.
// Server-only (`allow read, write: if false`).
//
// No TTL field: an intent removed before its objects are reaped strands those objects.

import { z } from 'zod';
import { MEDIA_VARIANT_KEYS, MediaAssetOwnerTypeSchema, MediaVariantKeySchema } from './media-assets.js';

export const MediaCopyIntentStateSchema = z.enum([
  'copying', // recorded before the first object is copied; the copy may still complete
  'reaping', // claimed by the sweep, which is deleting the copied objects
]);
export type MediaCopyIntentState = z.infer<typeof MediaCopyIntentStateSchema>;

export const MediaCopyIntentSchema = z
  .object({
    newAssetId: z.string().min(1),
    sourceAssetId: z.string().min(1),
    ownerType: MediaAssetOwnerTypeSchema,
    ownerId: z.string().min(1),
    // Variant NAMES, never object keys: each key derives from an asset id and a variant.
    variantKeys: z.array(MediaVariantKeySchema).min(1).max(MEDIA_VARIANT_KEYS.length),
    state: MediaCopyIntentStateSchema,
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    reapClaimedAt: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (new Set(val.variantKeys).size !== val.variantKeys.length) {
      ctx.addIssue({ code: 'custom', path: ['variantKeys'], message: 'variantKeys names each variant at most once' });
    }
    if (val.state === 'reaping' && val.reapClaimedAt === undefined) {
      ctx.addIssue({ code: 'custom', path: ['reapClaimedAt'], message: 'a reaping intent records when it was claimed' });
    }
    if (val.state === 'copying' && val.reapClaimedAt !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['reapClaimedAt'], message: 'a copying intent has not been claimed' });
    }
  });
export type MediaCopyIntent = z.infer<typeof MediaCopyIntentSchema>;
