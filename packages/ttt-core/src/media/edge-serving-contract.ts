import { z } from 'zod';
import { documentIdSegmentSchema } from '../schemas/atoms.js';
import {
  MediaAssetOwnerTypeSchema,
  MediaServingAuthorityRecordSchema,
  type MediaAccessTier,
  type MediaAssetOwnerType,
  type MediaAssetVariant,
  type MediaServingStatus,
  type MediaServingScope,
} from '../doc-schemas/media-assets.js';

export const MEDIA_AUTHORITY_APPLY_PATH = '/internal/media-authority/apply';

export const MEDIA_AUTHORITY_APPLY_MAX_BODY_BYTES = 64 * 1024;

export const MediaAuthorityApplyRequestSchema = z
  .object({
    record: MediaServingAuthorityRecordSchema,
    requiredVariants: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((val, ctx) => {
    const own = new Set(Object.keys(val.record.variants));
    const seen = new Set<string>();
    val.requiredVariants.forEach((key, index) => {
      if (!own.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['requiredVariants', index],
          message: "a required variant is one of the record's own variants",
        });
      }
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['requiredVariants', index],
          message: 'a required variant is named once',
        });
      }
      seen.add(key);
    });
    if (val.record.servingStatus === 'servable' && (seen.size === 0 || seen.size !== own.size)) {
      ctx.addIssue({
        code: 'custom',
        path: ['requiredVariants'],
        message: 'a servable record requires every one of its own variant keys',
      });
    }
  });
export type MediaAuthorityApplyRequest = z.infer<typeof MediaAuthorityApplyRequestSchema>;

export type EdgeServingVariant = Pick<
  MediaAssetVariant,
  'contentType' | 'sizeBytes' | 'downloadFilename'
>;

export interface EdgeServingRecord {
  servingStatus: MediaServingStatus;
  accessTier: MediaAccessTier;
  ownerType: MediaAssetOwnerType;
  ownerId: string;
  workProjectId?: string;
  scope?: MediaServingScope | null;
  variants: Record<string, EdgeServingVariant>;
}

export interface MediaAuthorityApplyAck {
  applied: boolean;
  idempotent: boolean;
  stale: boolean;
  authorityVersion: number;
  payloadHash: string;
  servingStatus: MediaServingStatus;
  kvCache: 'warmed' | 'deleted' | 'deferred';
}

export const MediaSessionTokenPayloadSchema = z
  .object({
    v: z.literal(1),
    typ: z.literal('session'),
    uid: z.string().min(1),
    art: z.union([z.literal(0), z.literal(1)]),
    adm: z.union([z.literal(0), z.literal(1)]),
    hdl: z.union([z.literal(0), z.literal(1)]),
    iat: z.number(),
    exp: z.number(),
  })
  .strict();
export type SessionTokenPayload = z.infer<typeof MediaSessionTokenPayloadSchema>;

export function mediaDownloadAllowed(
  record: Pick<EdgeServingRecord, 'ownerType'>,
  session: Pick<SessionTokenPayload, 'hdl'>,
): boolean {
  return record.ownerType !== 'hallItem' || session.hdl === 1;
}

const grantIdSchema = documentIdSegmentSchema;

export const MediaGrantScopeSchema = z.union([
  z.object({ w: grantIdSchema }).strict(),
  z.object({ t: MediaAssetOwnerTypeSchema, o: grantIdSchema }).strict(),
  z.object({ wf: z.object({ w: grantIdSchema, f: grantIdSchema }).strict() }).strict(),
  z.object({ gi: grantIdSchema }).strict(),
  z.object({ as: z.object({ d: grantIdSchema }).strict() }).strict(),
  z.object({ ar: grantIdSchema }).strict(),
  z.object({ rp: grantIdSchema }).strict(),
]);
export type MediaGrantScope = z.infer<typeof MediaGrantScopeSchema>;

export const MediaGrantTokenPayloadSchema = z
  .object({
    v: z.literal(1),
    typ: z.literal('grant'),
    uid: grantIdSchema,
    exp: z.number(),
    scope: MediaGrantScopeSchema,
  })
  .strict();
export type GrantTokenPayload = z.infer<typeof MediaGrantTokenPayloadSchema>;

export const MEDIA_BROAD_BROWSER_MAX_AGE_SEC = 900;

export const MEDIA_BROWSER_NO_STORE = 'private, no-store';

export const MEDIA_BROWSER_CACHE_CONTROL_BY_ACCESS_TIER = {
  broad: `private, max-age=${MEDIA_BROAD_BROWSER_MAX_AGE_SEC}`,
  scoped: MEDIA_BROWSER_NO_STORE,
  artisan: MEDIA_BROWSER_NO_STORE,
  adminOnly: MEDIA_BROWSER_NO_STORE,
} as const satisfies Record<MediaAccessTier, string> &
  Record<'scoped' | 'adminOnly', typeof MEDIA_BROWSER_NO_STORE>;

export function mediaBrowserCacheControl(args: {
  readonly accessTier: MediaAccessTier;
  readonly ownerType: MediaAssetOwnerType;
  readonly servedUnderGrant: boolean;
}): string {
  if (args.servedUnderGrant || args.ownerType === MediaAssetOwnerTypeSchema.enum.safetyEvidence) {
    return MEDIA_BROWSER_NO_STORE;
  }
  return MEDIA_BROWSER_CACHE_CONTROL_BY_ACCESS_TIER[args.accessTier];
}
