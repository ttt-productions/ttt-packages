// Shared NCII / TAKE IT DOWN intake derivations (Trust & Safety IMPLEMENTATION_PLAN
// Phase NCII-2/3/4, Appendix A §A11). Pure, deterministic id/key/summary derivations
// used by BOTH the public Next.js intake route and the Cloud Functions deadline/scan
// workers. These used to be hand-mirrored in two app TS projects (the Cloud Functions
// graph AND the App Hosting route graph, which cannot cross-import). This is now the ONE
// canonical declaration (ARCH-102 / Cross-Boundary Type Invariant): both module graphs
// import these derivations from ttt-core so the deterministic id/key contracts can never
// drift between the two runtimes.
//
// These are LOAD-BEARING KEYSPACE CONTRACTS. A formula (or version-tag) change re-keys
// EVERY existing intake request doc / receipt / snapshot — treat any such change as a
// breaking migration of the intake keyspace, never a routine edit. The per-function
// version-bump warnings below are not decorative.
//
// node:crypto sha256 keeps this pure + server-safe: this module lives behind the
// `./safety` entry (never on the main barrel), so the frontend bundle never loads it.
// The completeness predicate + intake-facts shape are NOT here — they are canonical on
// `./doc-schemas` (beside `computeCompleteness`); import those from there.

import { resourceKeyHash } from './resource-keys.js';
import type {
  TakeItDownFieldCode,
  TakeItDownRequesterRole,
  TargetLocatorV1,
  TargetLocatorSummaryV1,
} from '../doc-schemas/index.js';

/**
 * sha256-hex chokepoint. Aliased to `resourceKeyHash` (the single canonical hashing
 * helper in `./resource-keys`) so the whole `./safety` surface has ONE sha256
 * implementation, never two. Named `sha256Hex` here because these intake derivations
 * hash arbitrary keyspace strings, not resource keys.
 */
export const sha256Hex = resourceKeyHash;

/** Unit separator — illegal in any id/url/field we join, so a flat separator-joined
 *  string is stable by construction (no key-ordering ambiguity, no JSON). */
const SEP = '\x1f';

// ===========================================================================
// Deterministic ids ([H-07] idempotent intake)
// ===========================================================================

/** Version tag for the deterministic intake requestId. A bump re-keys EVERY
 *  request doc id — treat as a breaking migration of the intake keyspace. */
const REQUEST_ID_VERSION = 'takeItDownRequest:v1';

/** Deterministic `nciiTemporaryHolds/{holdId}` doc id for a request. ONE definition shared
 *  by intake (which writes the row) and the removal saga (which reads its `target` locator as
 *  the fallback when a public-form request has no case-linked allegation). */
export function tempHoldId(requestId: string): string {
  return sha256Hex(`nciiTemporaryHold:v1:${requestId}`);
}

/**
 * Canonical, collision-resistant key for a request target. For a resolvable
 * TTT-hosted locator the key is the locator discriminant + its identity fields;
 * for an external/unresolvable locator (a bare URL or free text) it is the
 * `url`/`additionalText` payload. The SAME logical target ALWAYS normalizes to the
 * SAME key so two submissions about the same content with the same idempotencyKey
 * resolve to ONE request doc, and two DIFFERENT targets never collide.
 *
 * No JSON — a flat unit-separator-joined string (the separator is illegal in any
 * id/url field) is stable by construction (no key-ordering ambiguity).
 */
export function normalizedTargetKey(locator: TargetLocatorV1): string {
  const k = locator.kind;
  switch (locator.kind) {
    case 'mediaAsset':
      return [k, locator.mediaAssetId].join(SEP);
    case 'hallItem':
      return [k, locator.hallItemId, locator.subItemId ?? ''].join(SEP);
    case 'squarePost':
      return [k, locator.postId].join(SEP);
    case 'profileImage':
      return [k, locator.profileUid].join(SEP);
    case 'username':
      return [k, locator.profileUid].join(SEP);
    case 'craftSkill':
      return [k, locator.profileUid, locator.craftSkillId].join(SEP);
    case 'commissionListing':
      return [k, locator.commissionListingId].join(SEP);
    case 'audition':
      return [k, locator.auditionId].join(SEP);
    case 'auditionEntry':
      return [k, locator.auditionId, locator.auditionEntryId].join(SEP);
    case 'guildInviteMessage':
      return [k, locator.channelId, locator.messageId].join(SEP);
    case 'chatAttachment':
      return [k, locator.channelId, locator.messageId, locator.attachmentId].join(SEP);
    case 'guildChatMessage':
      return [k, locator.channelId, locator.messageId].join(SEP);
    case 'adminWorkMessage':
      return [k, locator.adminDispatchId, locator.messageId].join(SEP);
    case 'commissionProposal':
      return [k, locator.commissionListingId, locator.commissionProposalId].join(SEP);
    case 'workProject':
      return [k, locator.workProjectId].join(SEP);
    case 'workAsset':
      return [k, locator.workProjectId, locator.workAssetId].join(SEP);
    case 'workRealm':
      return [k, locator.workRealmId].join(SEP);
    case 'url':
      // Normalize the URL (trim + lowercase scheme/host) so trivially-different
      // spellings of the same external link collapse to one request.
      return [k, normalizeExternalUrl(locator.url)].join(SEP);
    case 'additionalText':
      return [k, locator.textRef].join(SEP);
  }
}

/** Best-effort URL normalization for the external-locator key. A non-parseable
 *  string is lowercased + trimmed (still deterministic). NEVER throws. */
export function normalizeExternalUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}

/**
 * [H-07] The deterministic intake requestId:
 *   sha256('takeItDownRequest:v1:' + idempotencyKey + ':' + normalizedTargetKey).
 * A retry with the SAME client idempotencyKey + the SAME target re-derives the SAME
 * id, so the create-if-absent transaction is a no-op and re-returns the same receipt
 * (never double-arms a clock / double-commits a hold).
 */
export function deterministicRequestId(idempotencyKey: string, targetKey: string): string {
  return sha256Hex(`${REQUEST_ID_VERSION}:${idempotencyKey}:${targetKey}`);
}

/**
 * The opaque public `requestReference` printed on the one-time receipt and stored on the
 * public-status projection. Since the status token was removed, this is a deterministic
 * derivation of the internal `requestId` — a separate sha256 so the raw `requestId` is
 * never recoverable from the reference (which appears on the receipt / projection).
 * 32 hex chars is ample entropy for an opaque, non-enumerable capability.
 */
export function deriveRequestReference(requestId: string): string {
  return sha256Hex(`takeItDownRequestRef:v1:${requestId}`).slice(0, 32);
}

// ===========================================================================
// Cumulative submission snapshot hash (the immutable receipt fingerprint)
// ===========================================================================

/**
 * Deterministic hash of the cumulative request state as of a submission — recorded
 * on `TakeItDownSubmissionV1.cumulativeRequestSnapshotHash`. Built from the SORTED
 * supplied field codes + the normalized target key + the requester role so the same
 * cumulative state always fingerprints identically (append-order independent).
 */
export function cumulativeSnapshotHash(args: {
  requesterRole: TakeItDownRequesterRole;
  targetKey: string;
  suppliedFieldCodes: readonly TakeItDownFieldCode[];
}): string {
  const sorted = [...args.suppliedFieldCodes].sort();
  return sha256Hex(
    ['takeItDownSnapshot:v1', args.requesterRole, args.targetKey, sorted.join(',')].join(SEP),
  );
}

// ===========================================================================
// Privacy-safe target summary (root + public projection — NO narrative / PII)
// ===========================================================================

/** A short, non-sensitive surface label per locator kind (no ids, no narrative). */
export function surfaceLabelFor(locator: TargetLocatorV1): string {
  switch (locator.kind) {
    case 'mediaAsset':
      return 'Media item';
    case 'hallItem':
      return 'Hall library item';
    case 'squarePost':
      return 'Square Streetz post';
    case 'profileImage':
      return 'Profile image';
    case 'username':
      return 'Username';
    case 'craftSkill':
      return 'Craft skill';
    case 'commissionListing':
      return 'Commission listing';
    case 'audition':
      return 'Audition';
    case 'auditionEntry':
      return 'Audition entry';
    case 'guildInviteMessage':
      return 'Guild invite message';
    case 'chatAttachment':
      return 'Chat attachment';
    case 'guildChatMessage':
      return 'Guild chat message';
    case 'adminWorkMessage':
      return 'Work correspondence message';
    case 'commissionProposal':
      return 'Commission proposal';
    case 'workProject':
      return 'Work project';
    case 'workAsset':
      return 'Work file';
    case 'workRealm':
      return 'Work realm';
    case 'url':
      return 'External link';
    case 'additionalText':
      return 'Described content';
  }
}

/** Build the privacy-safe `TargetLocatorSummaryV1` (kind + surface label +
 *  whether a TTT-hosted target was server-resolved). NEVER the narrative or ids. */
export function targetLocatorSummary(
  locator: TargetLocatorV1,
  hasResolvedTarget: boolean,
): TargetLocatorSummaryV1 {
  return {
    kind: locator.kind,
    surfaceLabel: surfaceLabelFor(locator),
    hasResolvedTarget,
  };
}

/** TTT-hosted locator kinds the intake will synchronously server-resolve +
 *  snapshot + temp-hold. `url` / `additionalText` are external/unresolvable: store
 *  the locator + submission, invent NO target. */
const TTT_HOSTED_KINDS: ReadonlySet<TargetLocatorV1['kind']> = new Set([
  'mediaAsset',
  'hallItem',
  'squarePost',
  'profileImage',
  'username',
  'craftSkill',
  'commissionListing',
  'audition',
  'auditionEntry',
  'guildInviteMessage',
  'chatAttachment',
]);

/** True when the locator points at a TTT-hosted surface (server-resolvable). */
export function isTttHostedLocator(locator: TargetLocatorV1): boolean {
  return TTT_HOSTED_KINDS.has(locator.kind);
}

// The intake temp hold is placed on the canonical key(s) every destructive guard checks — the
// content-doc key (`contentDocResourceKey(docPath, 'current')` in `./resource-keys`) + the
// mediaAsset byte key when the target is media-backed. There is intentionally NO bespoke
// `nciiTemporaryTarget` key builder here: that namespace was consulted by NO guard, so a hold
// placed on it never blocked deletion ([H3] void). The route-side mirror's `contentDocCanonicalKey`
// is likewise NOT ported — it duplicated `contentDocResourceKey(docPath, 'current')`, which is the
// single key authority.
