// Callable contracts for accepting a picture upload.
//
// A client stages its bytes at its own staging path and hands that path, the origin, and the origin's
// target to `adminStartUpload`. Nothing about any path is negotiable: the target names the owner by
// id, and every path the picture is later written to is derived on the server.

import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import { MAX_STAGING_UPLOAD_PATH_LENGTH } from '../constants/media.js';
import { leagueIdSchema, stagingIdSchema, teamIdSchema } from '../doc-schemas/atoms.js';
import { awardIdSchema, awardNameSchema } from '../doc-schemas/catalogs.js';
import { gameLocationIdSchema } from '../doc-schemas/game-location.js';
import { pictureOriginSchema } from '../doc-schemas/pending-media.js';
import type { PictureOwnerRef } from '../doc-schemas/pending-media.js';
import type { PictureOrigin } from '../media/file-origins.js';
import { SPECIAL_DOCS } from '../paths/collections.js';
import { AWARD_DEFINITION_OWNER_KIND } from '../types/picture-owners.js';
import type { PictureOwnerKind } from '../types/picture-owners.js';

export const stagingUploadPathSchema = z.string().min(1).max(MAX_STAGING_UPLOAD_PATH_LENGTH);

// Each picture origin's target: which owner the picture is for, by id.
export const LeaguePictureTargetInfoSchema = z.object({ leagueId: leagueIdSchema }).strict();
export const TeamPictureTargetInfoSchema = z.object({ teamId: teamIdSchema }).strict();
// There is one landing page, so its target names nothing.
export const LandingPictureTargetInfoSchema = z.object({}).strict();
export const LocationPictureTargetInfoSchema = z.object({ gameLocationId: gameLocationIdSchema }).strict();
// A badge either replaces an existing award's (`awardId`) or creates the award it is the first badge
// of (`newAwardName`), whose id is the upload's staging id.
export const ExistingAwardBadgeTargetInfoSchema = z.object({ awardId: awardIdSchema }).strict();
export const NewAwardBadgeTargetInfoSchema = z.object({ newAwardName: awardNameSchema }).strict();
export const AwardBadgeTargetInfoSchema = z.union([ExistingAwardBadgeTargetInfoSchema, NewAwardBadgeTargetInfoSchema]);

interface PictureTarget<TSchema extends z.ZodTypeAny> {
  readonly schema: TSchema;
  /** The kind of document a picture of this origin belongs to. */
  readonly ownerKind: PictureOwnerKind;
  /** The owner's id. A target naming an owner that does not exist yet takes the upload's staging id. */
  readonly ownerId: (target: z.infer<TSchema>, stagingId: string | undefined) => string;
}

function pictureTarget<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  ownerKind: PictureOwnerKind,
  ownerId: (target: z.infer<TSchema>, stagingId: string | undefined) => string,
): PictureTarget<TSchema> {
  return { schema, ownerKind, ownerId };
}

export const PICTURE_TARGETS = {
  'league-picture': pictureTarget(LeaguePictureTargetInfoSchema, 'sportLeague', (target) => target.leagueId),
  'team-picture': pictureTarget(TeamPictureTargetInfoSchema, 'leagueTeam', (target) => target.teamId),
  'landing-picture': pictureTarget(LandingPictureTargetInfoSchema, 'landingPage', () => SPECIAL_DOCS.LANDING_PAGE),
  'location-picture': pictureTarget(
    LocationPictureTargetInfoSchema,
    'gameLocation',
    (target) => target.gameLocationId,
  ),
  'award-badge': pictureTarget(AwardBadgeTargetInfoSchema, AWARD_DEFINITION_OWNER_KIND, (target, stagingId) => {
    if ('awardId' in target) return target.awardId;
    if (stagingId === undefined) throw new Error("A new award's id is its badge upload's staging id, which was not given.");
    return stagingId;
  }),
} as const satisfies Record<PictureOrigin, PictureTarget<z.ZodTypeAny>>;

export type PictureTargetInfo = {
  [O in PictureOrigin]: z.infer<(typeof PICTURE_TARGETS)[O]['schema']>;
}[PictureOrigin];

/**
 * Parse a picture upload's target with its origin's schema and normalize it to the owner the
 * picture belongs to — the form an upload row stores. A badge creating its award names the award by
 * the upload's `stagingId`. Throws the schema's error on a target that does not fit the origin.
 */
export function parseTargetInfo(fileOrigin: PictureOrigin, targetInfo: unknown, stagingId?: string): PictureOwnerRef {
  const target = PICTURE_TARGETS[fileOrigin] as PictureTarget<z.ZodTypeAny>;
  return { kind: target.ownerKind, id: target.ownerId(target.schema.parse(targetInfo), stagingId) };
}

/** The name of the award a badge upload creates, or `undefined` for every other upload. */
export function newAwardNameOf(fileOrigin: PictureOrigin, targetInfo: unknown): string | undefined {
  if (PICTURE_TARGETS[fileOrigin].ownerKind !== AWARD_DEFINITION_OWNER_KIND) return undefined;
  const target = AwardBadgeTargetInfoSchema.parse(targetInfo);
  return 'newAwardName' in target ? target.newAwardName : undefined;
}

export const AdminStartUploadInputSchema = z
  .object({
    fileOrigin: pictureOriginSchema,
    // The full staging path the client uploaded to. Only its last segment, the staging id, is
    // taken from it; the server rebuilds the rest and refuses anything not exactly equal.
    storagePath: stagingUploadPathSchema,
    // Checked against the origin's own target schema below, so a target that does not fit its
    // origin is refused with the rest of a malformed payload.
    targetInfo: z.unknown(),
    // What the admin actually did — chose a file in the picker, an advisory claim. Untrusted
    // context kept on the row for the processing pipeline; the byte inspection alone decides what
    // the file is, and a request without it is inspected all the same.
    clientMediaClaim: ClientMediaClaimSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const target = PICTURE_TARGETS[input.fileOrigin] as PictureTarget<z.ZodTypeAny>;
    const parsed = target.schema.safeParse(input.targetInfo);
    if (!parsed.success) {
      context.addIssue({
        code: 'custom',
        path: ['targetInfo'],
        message: `The target does not fit a ${input.fileOrigin} upload: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
      });
    }
  });
export type AdminStartUploadInput = z.infer<typeof AdminStartUploadInputSchema>;

export const AdminStartUploadResultSchema = z
  .object({
    // The upload's row, which the uploading control follows to its end. It is also the picture's id.
    pendingMediaId: stagingIdSchema,
    // A badge's award: the existing one it replaces, or the one its publication will create.
    awardId: awardIdSchema.optional(),
  })
  .strict();
export type AdminStartUploadResult = z.infer<typeof AdminStartUploadResultSchema>;
