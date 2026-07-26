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

import type {
  MediaAccessTier,
  MediaAssetVariant,
  MediaServingStatus,
  MediaServingScope,
} from '../doc-schemas/media-assets.js';

/** The signed internal apply route — one declaration; the functions client posts to
 * it and the worker routes on it. */
export const MEDIA_AUTHORITY_APPLY_PATH = '/internal/media-authority/apply';

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
  ownerType: string;
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
 * Signed-token payloads (cookie + grant). Wire format (worker token.ts /
 * edge-protocol-core signToken):
 *   v1.{base64url(JSON payload)}.{base64url(HMAC-SHA256(secret, "v1." + payloadB64))}
 * Timestamps are SECONDS. The app side (Next media-session route, the
 * createMediaGrant callable) signs; the worker verifies — same shapes, ONE home.
 */
export interface SessionTokenPayload {
  v: 1;
  typ: 'session';
  uid: string;
  /** 1 = artisan creator (unlocks the 'artisan' tier). */
  art: 0 | 1;
  /** 1 = admin (unlocks the 'adminOnly' tier). */
  adm: 0 | 1;
  iat: number;
  exp: number;
}

export interface GrantTokenPayload {
  v: 1;
  typ: 'grant';
  /** Must equal the session cookie's uid — grants are user-bound, never bearer. */
  uid: string;
  exp: number;
  scope: {
    /** Grants every scoped asset of this work project. */
    w?: string;
    /** Or one exact owner (e.g. a commission proposal): ownerType + ownerId. */
    t?: string;
    o?: string;
    /** Work-project FILE FOLDER scope — the SAME ids the asset's typed `scope`
     * carries; EXACT-matched (a {w} Work grant never reaches a folder file). */
    wf?: { w: string; f: string };
    /** Guild-INVITE conversation scope (guildInviteId) — a Conversation File in that
     * conversation; EXACT-matched (never a {w} Work grant cross-match). */
    gi?: string;
    /** Admin-SUPPORT thread scope (adminDispatchId) — the SAME id the asset's typed
     * `scope` carries; EXACT-matched (one grant covers the thread's files). */
    as?: { d: string };
    /** Admin-REVIEW reveal scope — bound to exactly ONE mediaAssetId (minted only for
     * a full/jr admin against a report group's server-derived target). EXACT-matched
     * against the REQUESTED asset id, regardless of the record's scope kind. */
    ar?: string;
  };
}
