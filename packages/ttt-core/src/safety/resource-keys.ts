// Canonical safety-hold resource keys (Trust & Safety IMPLEMENTATION_PLAN Appendix A3).
//
// A safety hold is keyed by the PHYSICAL resource it protects, not by the case or
// the request that created it. The `canonicalResourceKey` is a deterministic string
// built from exactly the identity fields that pin a physical resource:
//
//   - a Firestore content target  = document path + immutable revision/generation
//   - a storage object            = bucket + key + generation
//   - a media target              = mediaAsset identity (and, incident-wide, its
//                                   MediaOriginLineageV1.rootIngestId)
//   - a chat message range        = channelId + sequence/epoch boundary
//   - a channel                   = channelId
//   - an account                  = uid
//
// `resourceKeyHash = sha256(canonicalResourceKey)` is the Firestore doc id for both
// `safetyHoldResources/{resourceKeyHash}` (the O(1) per-flag counter aggregate) and
// the `{caseId}__{resourceKeyHash}` ref. THE SAME PHYSICAL RESOURCE MUST ALWAYS HASH
// IDENTICALLY — that is the whole correctness story: every hold over the same bytes
// joins the same aggregate, and every destructive guard consults the same doc.
//
// This is the ONE canonical declaration (ARCH-102). Both TTT app TS projects (the Cloud
// Functions graph AND the App Hosting route graph) import these builders from ttt-core
// rather than hand-mirroring the format — a re-key would otherwise drift the two runtimes
// apart. node:crypto sha256 keeps it pure + server-safe (this module lives behind the
// `./safety` entry, never on the main barrel, so the frontend bundle never loads it).
//
// Determinism rules (do not change without a key-version bump):
//   - Format is `v1` + a type tag + the identity fields, joined by the unit-separator
//     control char (\x1f), which cannot appear in a Firestore path, bucket name, key,
//     uid, or channel id. No JSON (key ordering / whitespace is not load-bearing here;
//     a flat separator-joined string is stable by construction).
//   - The type tag prevents cross-type collisions (a contentDoc whose path happens to
//     equal a storage key never shares a hash with that storage object).
//   - A bump to the format string ('v1') is a hold-key migration and is NOT backward
//     compatible — every existing ref/aggregate would re-key. Treat it as a breaking
//     change to the entire hold authority.

import { createHash } from 'node:crypto';
import type { MediaAsset, SafetyHoldResourceType } from '../doc-schemas/index.js';

/** Format/version tag for every canonical key. Bumping this re-keys ALL holds. */
const KEY_FORMAT = 'safetyHoldKey/v1';

/** Unit separator — illegal in every identity field we join, so it is an unambiguous
 *  field delimiter that never appears inside a path, key, uid, or channel id. */
const SEP = '\x1f';

/** A canonical resource key paired with its sha256 hash (the Firestore doc id). */
export interface ResourceKey {
  /** The hold `resourceType` this key belongs to (Appendix A3 enum). */
  readonly resourceType: SafetyHoldResourceType;
  /** A natural identifier for the resource, stored on the ref as `resourceId`
   *  (human-debuggable; NOT used for hashing — the canonical key is). */
  readonly resourceId: string;
  /** The deterministic canonical key string (Appendix A3). */
  readonly canonicalResourceKey: string;
  /** `sha256(canonicalResourceKey)` hex — the `safetyHoldResources` doc id. */
  readonly resourceKeyHash: string;
}

/** sha256-hex of a canonical key string. The single hashing chokepoint. */
export function resourceKeyHash(canonicalResourceKey: string): string {
  return createHash('sha256').update(canonicalResourceKey, 'utf8').digest('hex');
}

/** Build a {canonicalResourceKey, resourceKeyHash} from a type tag + identity parts. */
function buildKey(
  resourceType: SafetyHoldResourceType,
  resourceId: string,
  ...parts: string[]
): ResourceKey {
  const canonicalResourceKey = [KEY_FORMAT, resourceType, ...parts].join(SEP);
  return {
    resourceType,
    resourceId,
    canonicalResourceKey,
    resourceKeyHash: resourceKeyHash(canonicalResourceKey),
  };
}

/**
 * Firestore content document target = document path + immutable revision.
 * `docPath` must be the canonical full path (e.g. via `toPath(PATH_BUILDERS.x(...))`),
 * NOT a client-supplied path. `revision` pins a mutable doc to a specific version so a
 * post-hold edit cannot slip the bytes out from under the hold; pass the revision/
 * version the report froze.
 */
export function contentDocResourceKey(docPath: string, revision: string | number): ResourceKey {
  return buildKey('contentDoc', docPath, docPath, String(revision));
}

/**
 * Storage object target = bucket + key + generation. `generation` pins the exact
 * object version (a re-upload to the same key gets a new generation and is a different
 * physical resource). Pass the generation captured when the hold was placed.
 */
export function storageObjectResourceKey(
  bucket: string,
  key: string,
  generation: string | number,
): ResourceKey {
  return buildKey('storageObject', `${bucket}/${key}`, bucket, key, String(generation));
}

/**
 * Media target. Returns keys for BOTH:
 *   1. the specific `mediaAssetId` (this exact asset/copy), AND
 *   2. its `originLineage.rootIngestId` — when present — as a SEPARATE `mediaAsset`
 *      key so a hold can block the ENTIRE incident lineage (every copy/variant that
 *      inherited the same root ingest), per Appendix A0/A3 incident-wide blocking.
 *
 * The caller decides which key(s) to place a hold on: a single-asset takedown holds
 * key[0]; an incident-wide block over a CSAM/NCII lineage holds the rootIngest key so
 * every existing AND future copy of the same root is denied. Both keys are `mediaAsset`
 * resourceType (rootIngest is a media identity, not a distinct type — A3 has no
 * separate `rootIngest` type; it is modeled as a mediaAsset key over the root id).
 *
 * Order is stable: index 0 = the asset itself; index 1 (if any) = the rootIngest.
 */
export function mediaAssetResourceKeys(asset: Pick<MediaAsset, 'mediaAssetId' | 'originLineage'>): ResourceKey[] {
  const keys: ResourceKey[] = [
    buildKey('mediaAsset', asset.mediaAssetId, 'asset', asset.mediaAssetId),
  ];
  const rootIngestId = asset.originLineage?.rootIngestId;
  if (rootIngestId) {
    keys.push(buildKey('mediaAsset', rootIngestId, 'rootIngest', rootIngestId));
  }
  return keys;
}

/** The mediaAsset key for a bare rootIngestId (no asset doc in hand) — same canonical
 *  shape as `mediaAssetResourceKeys(...)`'s index-1 entry, so it hashes identically. */
export function rootIngestResourceKey(rootIngestId: string): ResourceKey {
  return buildKey('mediaAsset', rootIngestId, 'rootIngest', rootIngestId);
}

/**
 * Chat message-range target = channelId + a sequence/epoch boundary identifying the
 * span of messages held. `messageSeqOrEpoch` is the caller's range identifier (e.g. a
 * sequence number or epoch marker); the SAME range over the same channel must always
 * be passed in the same canonical form by the caller.
 */
export function chatMessageRangeResourceKey(
  channelId: string,
  messageSeqOrEpoch: string | number,
): ResourceKey {
  return buildKey(
    'chatMessageRange',
    `${channelId}#${messageSeqOrEpoch}`,
    channelId,
    String(messageSeqOrEpoch),
  );
}

/** Channel target = channelId. */
export function channelResourceKey(channelId: string): ResourceKey {
  return buildKey('channel', channelId, channelId);
}

/** Account target = uid. */
export function accountResourceKey(uid: string): ResourceKey {
  return buildKey('account', uid, uid);
}
