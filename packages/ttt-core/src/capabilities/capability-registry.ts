// ============================================================================
// CAPABILITY REGISTRY — the ONE declaration of the age/eligibility capability
// model (Phase 6). Consolidated here 2026-07-13 from the former byte-for-byte
// mirrors in ttt-prod `src/lib/capabilities/capability-registry.ts` and
// `functions/src/shared/capability-registry.ts` (both trees now import this;
// the two-tree sync tests are deleted). Upload origins are compile-linked to
// the canonical `FileOrigin` union — an origin rename fails the build here.
// ============================================================================

import type { FileOrigin } from '../media/file-origin.js';

/** Every age/eligibility-gated capability id. Past-tense/imperative-neutral,
 * dotted-namespace. Adding a value here REQUIRES adding it to CAPABILITY_REGISTRY
 * (the exhaustive test enforces the 1:1). */
export type CapabilityId =
  | 'account.becomeArtisan'
  | 'square.post'
  | 'square.acceptAgreements'
  | 'pledge.create'
  | 'messaging.guildInvite'
  | 'messaging.send'
  | 'messaging.attachment'
  | 'collaboration.commissionProposal'
  | 'collaboration.auditionEntry'
  | 'stakeShares.hold'
  | 'upload.origin';

/** The age requirement a capability imposes. */
export type CapabilityAgeRequirement =
  | 'adult18Plus' // both actor (and, for messaging, recipient) must be 18+
  | 'none'; // available to any eligible (13+) account

export interface CapabilityDefinition {
  id: CapabilityId;
  /** Human-facing summary (admin/debug only; not user copy). */
  description: string;
  /** The age gate. `adult18Plus` capabilities are server-enforced; the claim is
   * NOT the sole authority (accountCapabilityVersion + privateData re-check). */
  ageRequirement: CapabilityAgeRequirement;
  /** When true, BOTH ends must satisfy the requirement (no-minor-messaging). */
  bilateral: boolean;
  /** Upload origins this capability governs (for the startUpload gate). Empty
   * unless the capability is `upload.origin`-adjacent. */
  uploadOrigins: readonly FileOrigin[];
}

/** Upload origins that require an 18+ account to initiate (origin-level gate, not
 * just the create callable — Phase 6 item 3). Origins tied to artisan-only
 * surfaces (collaboration, hall publication, work assets) are 18+ because only
 * 18+ accounts can be artisan creators / hold stake shares. */
export const ADULT_ONLY_UPLOAD_ORIGINS = [
  'squareStreetz',
  'commission-posting',
  'commission-proposal',
  'audition-prompt',
  'audition-entry',
  'hallLibrary-cover-square',
  'hallLibrary-cover-poster',
  'hallLibrary-cover-cinematic',
  'realm-cover',
  'chapter-photo',
  'tune-track-photo',
  'tune-track-audio',
  'television-episode-photo',
  'television-episode-video',
  'guild-chat-message-attachment',
  'work-asset',
] as const satisfies readonly FileOrigin[];

export const CAPABILITY_REGISTRY: Record<CapabilityId, CapabilityDefinition> = {
  'account.becomeArtisan': {
    id: 'account.becomeArtisan',
    description: 'Become an artisan creator (privilege + stake-share eligibility).',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: [],
  },
  'square.post': {
    id: 'square.post',
    description: 'Create a Square Streetz post.',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: ['squareStreetz'],
  },
  'square.acceptAgreements': {
    id: 'square.acceptAgreements',
    description: 'Accept the Square Streetz posting agreements.',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: [],
  },
  'pledge.create': {
    id: 'pledge.create',
    description: 'Create a pledge / payment (18+ only, pledge-only payments).',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: [],
  },
  'messaging.guildInvite': {
    id: 'messaging.guildInvite',
    description: 'Send a guild invite (opens an invite-conversation thread).',
    ageRequirement: 'adult18Plus',
    bilateral: true,
    uploadOrigins: [],
  },
  'messaging.send': {
    id: 'messaging.send',
    description: 'Send a chat / invite-thread message.',
    ageRequirement: 'adult18Plus',
    bilateral: true,
    uploadOrigins: [],
  },
  'messaging.attachment': {
    id: 'messaging.attachment',
    description: 'Attach media to a chat / invite message.',
    ageRequirement: 'adult18Plus',
    bilateral: true,
    uploadOrigins: ['guild-chat-message-attachment'],
  },
  'collaboration.commissionProposal': {
    id: 'collaboration.commissionProposal',
    description: 'Submit a commission proposal (artisan collaboration surface).',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: ['commission-proposal'],
  },
  'collaboration.auditionEntry': {
    id: 'collaboration.auditionEntry',
    description: 'Submit an audition entry (artisan collaboration surface).',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: ['audition-entry'],
  },
  'stakeShares.hold': {
    id: 'stakeShares.hold',
    description: 'Hold stake shares (guild membership / revenue).',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: [],
  },
  'upload.origin': {
    id: 'upload.origin',
    description: 'Initiate an upload for an adult-only origin (startUpload gate).',
    ageRequirement: 'adult18Plus',
    bilateral: false,
    uploadOrigins: ADULT_ONLY_UPLOAD_ORIGINS,
  },
};

/** All capability ids (for exhaustiveness tests + iteration). */
export const ALL_CAPABILITY_IDS = Object.keys(CAPABILITY_REGISTRY) as CapabilityId[];

/** The actor's age-relevant view, derived server-side from privateData (the
 * claim is corroborating, never sole authority). */
export interface AgeCapabilityContext {
  is18Plus: boolean;
  accountCapabilityVersion: number;
}

/** Does this context satisfy a capability's age requirement? */
export function contextSatisfies(
  capability: CapabilityId,
  ctx: AgeCapabilityContext,
): boolean {
  const def = CAPABILITY_REGISTRY[capability];
  if (def.ageRequirement === 'none') return true;
  return ctx.is18Plus === true;
}

/** Is the given upload origin 18+-gated? */
export function uploadOriginRequires18Plus(origin: string): boolean {
  return (ADULT_ONLY_UPLOAD_ORIGINS as readonly string[]).includes(origin);
}
