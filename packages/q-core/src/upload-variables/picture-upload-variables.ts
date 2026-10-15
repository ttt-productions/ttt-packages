import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { PICTURE_ORIGIN_KEYS } from '../media/file-origins.js';
import type { PictureOrigin } from '../media/file-origins.js';
import { PICTURE_TARGETS } from '../schemas/uploads.js';
import { onProgressSchema } from './on-progress.js';

/** What a picture is uploaded for: its origin, and that origin's target — the owner, by id. */
export type PictureUploadTarget = {
  [O in PictureOrigin]: { origin: O; targetInfo: z.infer<(typeof PICTURE_TARGETS)[O]['schema']> };
}[PictureOrigin];

// One member per picture origin, each pairing the origin with its own target schema, built from
// `PICTURE_TARGETS` so a new origin joins it with no change here.
const pictureUploadTargetOptions = PICTURE_ORIGIN_KEYS.map((origin) =>
  z.object({ origin: z.literal(origin), targetInfo: PICTURE_TARGETS[origin].schema }).strict(),
);

// The mapped options are one object schema per origin; TypeScript cannot follow the origin-to-target
// pairing through the map, so the union is typed by `PictureUploadTarget`, which states it.
export const PictureUploadTargetSchema = z.discriminatedUnion(
  'origin',
  pictureUploadTargetOptions as [(typeof pictureUploadTargetOptions)[number], ...(typeof pictureUploadTargetOptions)[number][]],
) as unknown as z.ZodType<PictureUploadTarget>;

export const PictureUploadVariablesSchema = z.object({
  target: PictureUploadTargetSchema,
  file: z.instanceof(File),
  // Untrusted client claim of what the user's action implies (advisory; the
  // server byte inspection is the only classification authority).
  claim: ClientMediaClaimSchema.optional(),
  onProgress: onProgressSchema,
  signal: z.instanceof(AbortSignal).optional(),
}).strict();
export type PictureUploadVariables = z.infer<typeof PictureUploadVariablesSchema>;
