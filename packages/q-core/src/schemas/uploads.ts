import { z } from 'zod';
import { ClientMediaClaimSchema } from '@ttt-productions/media-schemas';
import {
  MAX_STAGING_UPLOAD_PATH_LENGTH,
  MAX_UPLOADS_MARKED_SEEN_PER_CALL,
} from '../constants/media.js';
import {
  countSchema,
  leagueIdSchema,
  stagingIdSchema,
  teamIdSchema,
} from '../doc-schemas/atoms.js';
import { awardIdSchema, awardNameSchema } from '../doc-schemas/catalogs.js';
import { gameLocationIdSchema } from '../doc-schemas/game-location.js';
import { pictureOriginSchema } from '../doc-schemas/pending-media.js';
import type { PictureOwnerRef } from '../doc-schemas/pending-media.js';
import type { PictureOrigin } from '../media/file-origins.js';
import { SPECIAL_DOCS } from '../paths/collections.js';
import { AWARD_DEFINITION_OWNER_KIND } from '../types/picture-owners.js';
import type { PictureOwnerKind } from '../types/picture-owners.js';

export const stagingUploadPathSchema = z.string().min(1).max(MAX_STAGING_UPLOAD_PATH_LENGTH);

export const LeaguePictureTargetInfoSchema = z.object({ leagueId: leagueIdSchema }).strict();
export const TeamPictureTargetInfoSchema = z.object({ teamId: teamIdSchema }).strict();
export const LandingPictureTargetInfoSchema = z.object({}).strict();
export const LocationPictureTargetInfoSchema = z
  .object({ gameLocationId: gameLocationIdSchema })
  .strict();
export const ExistingAwardBadgeTargetInfoSchema = z.object({ awardId: awardIdSchema }).strict();
export const NewAwardBadgeTargetInfoSchema = z.object({ newAwardName: awardNameSchema }).strict();
export const AwardBadgeTargetInfoSchema = z.union([
  ExistingAwardBadgeTargetInfoSchema,
  NewAwardBadgeTargetInfoSchema,
]);

interface PictureTarget<TSchema extends z.ZodTypeAny> {
  readonly schema: TSchema;
  readonly ownerKind: PictureOwnerKind;
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
  'league-picture': pictureTarget(
    LeaguePictureTargetInfoSchema,
    'sportLeague',
    (target) => target.leagueId,
  ),
  'team-picture': pictureTarget(
    TeamPictureTargetInfoSchema,
    'leagueTeam',
    (target) => target.teamId,
  ),
  'landing-picture': pictureTarget(
    LandingPictureTargetInfoSchema,
    'landingPage',
    () => SPECIAL_DOCS.LANDING_PAGE,
  ),
  'location-picture': pictureTarget(
    LocationPictureTargetInfoSchema,
    'gameLocation',
    (target) => target.gameLocationId,
  ),
  'award-badge': pictureTarget(
    AwardBadgeTargetInfoSchema,
    AWARD_DEFINITION_OWNER_KIND,
    (target, stagingId) => {
      if ('awardId' in target) return target.awardId;
      if (stagingId === undefined)
        throw new Error("A new award's id is its badge upload's staging id, which was not given.");
      return stagingId;
    },
  ),
} as const satisfies Record<PictureOrigin, PictureTarget<z.ZodTypeAny>>;

export type PictureTargetInfo = {
  [O in PictureOrigin]: z.infer<(typeof PICTURE_TARGETS)[O]['schema']>;
}[PictureOrigin];

export function parseTargetInfo(
  fileOrigin: PictureOrigin,
  targetInfo: unknown,
  stagingId?: string,
): PictureOwnerRef {
  const target = PICTURE_TARGETS[fileOrigin] as PictureTarget<z.ZodTypeAny>;
  return { kind: target.ownerKind, id: target.ownerId(target.schema.parse(targetInfo), stagingId) };
}

export function newAwardNameOf(fileOrigin: PictureOrigin, targetInfo: unknown): string | undefined {
  if (PICTURE_TARGETS[fileOrigin].ownerKind !== AWARD_DEFINITION_OWNER_KIND) return undefined;
  const target = AwardBadgeTargetInfoSchema.parse(targetInfo);
  return 'newAwardName' in target ? target.newAwardName : undefined;
}

export const AdminStartUploadInputSchema = z
  .object({
    fileOrigin: pictureOriginSchema,
    storagePath: stagingUploadPathSchema,
    targetInfo: z.unknown(),
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
    pendingMediaId: stagingIdSchema,
    awardId: awardIdSchema.optional(),
  })
  .strict();
export type AdminStartUploadResult = z.infer<typeof AdminStartUploadResultSchema>;

export const AdminMarkUploadsSeenInputSchema = z
  .object({
    pendingMediaIds: z.array(stagingIdSchema).min(1).max(MAX_UPLOADS_MARKED_SEEN_PER_CALL),
  })
  .strict();
export type AdminMarkUploadsSeenInput = z.infer<typeof AdminMarkUploadsSeenInputSchema>;
export const AdminMarkUploadsSeenResultSchema = z.object({ marked: countSchema }).strict();
export type AdminMarkUploadsSeenResult = z.infer<typeof AdminMarkUploadsSeenResultSchema>;

export const AdminClearUploadActivityInputSchema = z
  .object({ pendingMediaId: stagingIdSchema })
  .strict();
export type AdminClearUploadActivityInput = z.infer<typeof AdminClearUploadActivityInputSchema>;
export const AdminClearUploadActivityResultSchema = z.object({ cleared: z.literal(true) }).strict();
export type AdminClearUploadActivityResult = z.infer<typeof AdminClearUploadActivityResultSchema>;
