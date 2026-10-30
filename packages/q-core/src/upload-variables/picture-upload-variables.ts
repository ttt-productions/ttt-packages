import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { PICTURE_ORIGIN_KEYS } from '../media/file-origins.js';
import type { PictureOrigin } from '../media/file-origins.js';
import { PICTURE_TARGETS } from '../schemas/uploads.js';
import { onProgressSchema } from './on-progress.js';

export type PictureUploadTarget = {
  [O in PictureOrigin]: { origin: O; targetInfo: z.infer<(typeof PICTURE_TARGETS)[O]['schema']> };
}[PictureOrigin];

const pictureUploadTargetOptions = PICTURE_ORIGIN_KEYS.map((origin) =>
  z.object({ origin: z.literal(origin), targetInfo: PICTURE_TARGETS[origin].schema }).strict(),
);

// The mapped options are one object schema per origin; TypeScript cannot follow the origin-to-target
// pairing through the map, so the union is typed by `PictureUploadTarget`, which states it.
export const PictureUploadTargetSchema = z.discriminatedUnion(
  'origin',
  pictureUploadTargetOptions as [
    (typeof pictureUploadTargetOptions)[number],
    ...(typeof pictureUploadTargetOptions)[number][],
  ],
) as unknown as z.ZodType<PictureUploadTarget>;

export const PictureUploadVariablesSchema = z
  .object({
    target: PictureUploadTargetSchema,
    file: z.instanceof(File),
    claim: ClientMediaClaimSchema.optional(),
    onProgress: onProgressSchema,
    signal: z.instanceof(AbortSignal).optional(),
  })
  .strict();
export type PictureUploadVariables = z.infer<typeof PictureUploadVariablesSchema>;
