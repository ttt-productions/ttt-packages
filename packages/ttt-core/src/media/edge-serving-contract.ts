// ============================================================================
// MEDIA EDGE-SERVING CONTRACT — the ONE declaration of the wire contracts shared
// by the backend (functions media-authority client / edge-sync / media-session
// route / createMediaGrant) and the Cloudflare media-worker. Consolidated here
// 2026-07-13 from the former hand-mirrored pair (media-worker/src/types.ts +
// apply-endpoint.ts ↔ functions media-authority-client.ts / edge-sync.ts); the
// worker's "deliberately dependency-free" rationale no longer holds — it already
// imports @ttt-productions/edge-protocol-core, and these shapes are TTT media
// business truth, so they live in ttt-core. Tier/status/scope derive from the
// canonical doc-schemas enums — the worker never re-declares them again.
// ============================================================================

import { z } from 'zod';
import {
  MediaAssetOwnerTypeSchema,
  MediaServingAuthorityRecordSchema,
  type MediaAccessTier,
  type MediaAssetOwnerType,
  type MediaAssetVariant,
  type MediaServingStatus,
  type MediaServingScope,
} from '../doc-schemas/media-assets.js';

/** The signed internal apply route — one declaration; the functions client posts to
 * it and the worker routes on it. */
export const MEDIA_AUTHORITY_APPLY_PATH = '/internal/media-authority/apply';

/** The most bytes the apply endpoint reads from a request body before it verifies the signature.
 * A real envelope is one serving record (ids, a handful of canonical variants with a content type,
 * a size, and a normalized download filename) plus its required-variant list — a few KiB at most —
 * so this leaves wide headroom while bounding what an unsigned request can make the Worker buffer. */
export const MEDIA_AUTHORITY_APPLY_MAX_BODY_BYTES = 64 * 1024;

/**
 * The signed body the Functions authority client posts to MEDIA_AUTHORITY_APPLY_PATH and the Worker
 * parses after verifying its signature: the full serving record, plus the variant keys the Worker must
 * find in the object store before it accepts a `servable` record. Whatever the status, the list names
 * only the record's own variant keys, each once, so no unknown key can be checked or smuggled in; a
 * `servable` record names every one of them — so a record can never go live with an incomplete or
 * mismatched variant list.
 */
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
        ctx.addIssue({ code: 'custom', path: ['requiredVariants', index], message: 'a required variant is one of the record\'s own variants' });
      }
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['requiredVariants', index], message: 'a required variant is named once' });
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

/**
 * The serving-relevant projection of a variant carried on the edge record. DERIVED
 * from the canonical `MediaAssetVariant` (ARCH-102) — the edge needs the served
 * contentType, the recorded size for the range pre-gate, and the server-owned
 * `downloadFilename` the Worker builds `Content-Disposition` from. Pixel dimensions
 * and duration are deliberately NOT projected; the edge has no use for them.
 */
export type EdgeServingVariant = Pick<
  MediaAssetVariant,
  'contentType' | 'sizeBytes' | 'downloadFilename'
>;

/** The derived edge serving record (built by functions edge-sync
 * `buildEdgeServingRecord`, stored in the shard DO + KV cache, read by the worker's
 * serving path). A projection of MediaServingAuthorityRecord — same enums. */
export interface EdgeServingRecord {
  servingStatus: MediaServingStatus;
  accessTier: MediaAccessTier;
  ownerType: MediaAssetOwnerType;
  ownerId: string;
  /** Work-project scoped media (work files, pre-publish content). A conversation-file
   * asset never sets this — a conversation scope carries no workProjectId. */
  workProjectId?: string;
  /** Typed scope for scoped-tier assets; absent/null for everything else. The
   * serving path EXACT-matches a grant against it. */
  scope?: MediaServingScope | null;
  variants: Record<string, EdgeServingVariant>;
}

/** The apply endpoint's authoritative ack (the worker's MediaAuthorityApplyResult;
 * the functions client verifies the exact version + hash off it). */
export interface MediaAuthorityApplyAck {
  applied: boolean;
  idempotent: boolean;
  stale: boolean;
  authorityVersion: number;
  payloadHash: string;
  servingStatus: MediaServingStatus;
  kvCache: 'warmed' | 'deleted' | 'deferred';
}

/**
 * The media-session cookie payload — the ONE definition the Next media-session route types what it
 * signs with and the Worker validates a verified cookie against. Wire format (edge-protocol-core
 * `signToken` / `verifyToken`):
 *   v1.{base64url(JSON payload)}.{base64url(HMAC-SHA256(secret, "v1." + payloadB64))}
 * Timestamps are SECONDS.
 */
export const MediaSessionTokenPayloadSchema = z
  .object({
    v: z.literal(1),
    typ: z.literal('session'),
    uid: z.string().min(1),
    /** 1 = artisan creator (unlocks the 'artisan' tier). */
    art: z.union([z.literal(0), z.literal(1)]),
    /** 1 = admin (unlocks the 'adminOnly' tier). */
    adm: z.union([z.literal(0), z.literal(1)]),
    iat: z.number(),
    exp: z.number(),
  })
  .strict();
export type SessionTokenPayload = z.infer<typeof MediaSessionTokenPayloadSchema>;

const grantIdSchema = z.string().min(1);

/**
 * A signed grant's scope — the ONE definition the Functions signer types its payload with and the
 * Worker validates a verified grant against. Exactly one kind per grant (each branch is strict, so
 * a scope naming two kinds, or none, is refused), and the Worker matches each kind EXACTLY:
 *   w  — every `workProject`-scoped asset of this Work (never a folder or conversation file);
 *   t,o — one exact owner (ownerType + ownerId) of an unscoped record, e.g. a commission proposal;
 *   wf — one work-project FILE FOLDER (the asset's `workFileFolder` scope ids);
 *   gi — one guild-invite conversation's Conversation Files;
 *   as — one admin-support thread's Conversation Files;
 *   ar — admin review: exactly ONE asset of a report group's server-derived target, matched against
 *        the REQUESTED asset id whatever the record's scope; it alone may reveal a `hidden` asset;
 *   rp — Realm-steward preview: exactly ONE file awaiting the steward's promotion decision, matched
 *        against the REQUESTED asset id; it never reveals a hidden, quarantined, or deleted file.
 */
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

/** A scoped-media grant. `uid` must equal the session cookie's uid — grants are user-bound, never
 * bearer links. */
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

/** How long a browser may reuse broad-tier media bytes without asking the Worker again. */
export const MEDIA_BROAD_BROWSER_MAX_AGE_SEC = 900;

/** The browser directive for protected media a browser must never reuse from its own cache. */
export const MEDIA_BROWSER_NO_STORE = 'private, no-store';

/**
 * The ONE browser-cache policy for served media, by access tier. A browser that already loaded a
 * broad asset can re-show it for up to MEDIA_BROAD_BROWSER_MAX_AGE_SEC after a sign-out or takedown;
 * no new load succeeds, because the Worker checks every request that reaches it. Scoped and
 * adminOnly media are typed to hold only the no-store directive — they can never be given a browser
 * max-age — and `artisan` (Realm shared files) is no-store too. An entry may be added or tightened
 * later, each with its reason stated here.
 */
export const MEDIA_BROWSER_CACHE_CONTROL_BY_ACCESS_TIER = {
  broad: `private, max-age=${MEDIA_BROAD_BROWSER_MAX_AGE_SEC}`,
  scoped: MEDIA_BROWSER_NO_STORE,
  artisan: MEDIA_BROWSER_NO_STORE,
  adminOnly: MEDIA_BROWSER_NO_STORE,
} as const satisfies Record<MediaAccessTier, string> &
  Record<'scoped' | 'adminOnly', typeof MEDIA_BROWSER_NO_STORE>;

/**
 * The browser `Cache-Control` for one successful media response: never a max-age for bytes served
 * under a grant (the admin reveal included) or for safety evidence, whatever the tier; otherwise the
 * tier's entry in MEDIA_BROWSER_CACHE_CONTROL_BY_ACCESS_TIER.
 */
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
