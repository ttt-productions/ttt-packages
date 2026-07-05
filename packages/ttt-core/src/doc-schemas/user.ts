// User-related Firestore document SCHEMAS — the single source of truth for the
// `userProfiles/{uid}` doc, its `privateData/{uid}` subdoc, and craft-skill shapes.
// (The `publicUsers/{uid}` mirror lives in ./publicUser.) TypeScript types are
// inferred from these schemas via `z.infer`, so a document's shape and its type
// cannot drift apart. See docs/design/firestore-schema-registry.md (ttt-prod).

import { z } from 'zod';
import { HALL_WING_TYPE_KEYS } from '../types/content.js';
import { userPrivateDataAgeFieldsShape } from './safety/age.js';

const mediaKindSchema = z.enum(['image', 'video', 'audio']);

// Craft-skill kind — mandatory choice at upload, no default (see
// CODE_CHANGE_craft_skill_kinds.md). 'original' = the artisan's own original creation;
// 'mimicOnTtt' = a performance/recreation of work that originated in the TTT community
// (requires a source reference); 'mimicOffTtt' = a performance/recreation of work from
// outside TTT (covers covers + public-domain works, no source reference).
export const CraftSkillKindSchema = z.enum(['original', 'mimicOnTtt', 'mimicOffTtt']);
export type CraftSkillKind = z.infer<typeof CraftSkillKindSchema>;

// Source reference for a 'mimicOnTtt' skill — the original artisan OR the original work,
// linked mention-style (id only, no name snapshots, resolved at render per the Display
// Identity Invariant). 'workProject' is the safe framing today; linking a specific hall
// item is optional future scope.
export const CraftSkillSourceReferenceSchema = z
  .object({
    type: z.enum(['user', 'workProject']),
    id: z.string().min(1),
  })
  .strict();
export type CraftSkillSourceReference = z.infer<typeof CraftSkillSourceReferenceSchema>;

// The agreed attestation recorded on the doc: which statement (keyed by kind) the
// uploader agreed to, its version, and when (epoch ms, always a number — never a
// Firestore Timestamp).
export const CraftSkillAttestationSchema = z
  .object({
    statementKind: CraftSkillKindSchema,
    statementVersion: z.number().int().min(1),
    agreedAt: z.number(),
  })
  .strict();
export type CraftSkillAttestation = z.infer<typeof CraftSkillAttestationSchema>;

// Base craft-skill fields shared across all kinds. The `kind` + `source` relationship is
// layered on top as a discriminated union so an invalid combination (e.g. a source on an
// 'original', or a missing source on a 'mimicOnTtt') fails schema validation.
const craftSkillBaseShape = {
  id: z.string(),
  name: z.string(),
  mediaAssetId: z.string(),
  tags: z.array(z.string()),
  createdAt: z.number(),
  type: mediaKindSchema,
  // Moderation visibility flag. Absent/false = visible; true = hidden by the
  // craft-skill hide cascade (report auto-hide or admin action). Mirrored onto
  // every taggedCraftSkills index doc so discovery surfaces can filter it.
  hidden: z.boolean(),
  attestation: CraftSkillAttestationSchema,
};

export const CraftSkillSchema = z.discriminatedUnion('kind', [
  z.object({
    ...craftSkillBaseShape,
    kind: z.literal('original'),
  }),
  z.object({
    ...craftSkillBaseShape,
    kind: z.literal('mimicOnTtt'),
    // REQUIRED for the on-TTT mimic kind: the linked original artisan or work.
    source: CraftSkillSourceReferenceSchema,
  }),
  z.object({
    ...craftSkillBaseShape,
    kind: z.literal('mimicOffTtt'),
  }),
]);
export type CraftSkill = z.infer<typeof CraftSkillSchema>;

export const CraftSkillReferenceSchema = z.object({
  craftSkillId: z.string(),
  compositeId: z.string(),
  userId: z.string(),
  craftSkillName: z.string(),
  craftSkillAssetId: z.string(),
  craftSkillType: mediaKindSchema,
  tags: z.array(z.string()),
  createdAt: z.number(),
  // Mirror of CraftSkill.hidden; lets the tag-browse filter hidden skills out.
  hidden: z.boolean(),
  // Mirror of CraftSkill.kind so the tag-browse card can render the kind badge without a
  // second read.
  kind: CraftSkillKindSchema,
  // Mirror of CraftSkill.source — present ONLY when kind === 'mimicOnTtt' (the source-doc
  // discriminated union guarantees that invariant on the authoritative side). Lets the
  // browse card render the clickable "someone performed my work" source link.
  source: CraftSkillSourceReferenceSchema.optional(),
});
export type CraftSkillReference = z.infer<typeof CraftSkillReferenceSchema>;

export const MinimalCraftSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  mediaAssetId: z.string(),
  type: mediaKindSchema,
});
export type MinimalCraftSkill = z.infer<typeof MinimalCraftSkillSchema>;

export const OwnedWorkProjectSchema = z.object({
  workProjectId: z.string(),
  workingTitle: z.string(),
  workingDescription: z.string(),
  type: z.string(),
  createdOn: z.number(),
  hallWingType: z.enum(HALL_WING_TYPE_KEYS),
});
export type OwnedWorkProject = z.infer<typeof OwnedWorkProjectSchema>;

export const AssociatedWorkProjectSchema = z.object({
  workProjectId: z.string(),
  workingTitle: z.string(),
  workingDescription: z.string(),
  type: z.string(),
  joinedOn: z.number(),
});
export type AssociatedWorkProject = z.infer<typeof AssociatedWorkProjectSchema>;

export const FullUserSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  displayName_lowercase: z.string(),
  // One asset, variants full/medium/small in the mediaAssets registry; URLs
  // are built at render time (media-assets-and-protected-serving.md).
  profilePictureAssetId: z.string().nullable().optional(),
  artisanCreator: z.number().optional(),
  // Cosmetic supporter badge. Set true via the Admin SDK inside the Stripe webhook's
  // pledge-record transaction once the user completes a pledge; rendered on the profile
  // page. Lives here (not publicUsers) because userProfiles/{uid} is already readable by
  // any authenticated user, so other viewers see the badge with no mirror. Not PII.
  // Revoked (→ false) on refund once refunds ship.
  hasPledged: z.boolean().optional(),
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  // Chat-edge-rebuild account-access domain (Contract B / round-10 blocker 1): the
  // single ban/unban ordering version + state the chat `accountAccess` sync events key
  // on. Backend-only-writable. Deliberate defaults when ABSENT: a never-touched account
  // is `{ accountAccessVersion: 0, accountAccessState: 'active' }` (NOT banned) — bumped
  // atomically on suspend/ban/unban, which enqueue the accountAccessChanged fanout.
  accountAccessVersion: z.number().optional(),
  accountAccessState: z.enum(['active', 'suspended', 'banned']).optional(),
  // Moderation: set true by the forceDisplayNameReset callable when an admin resets an
  // abusive display name. The app gates the user into a forced "pick a new name" flow until
  // they complete it via setMyDisplayName (which clears this). Backend-only-writable (like `status`).
  displayNameResetRequired: z.boolean().optional(),
  ownedWorkProjects: z.array(OwnedWorkProjectSchema).optional(),
  associatedWorkProjects: z.array(AssociatedWorkProjectSchema).optional(),
  createdAt: z.number(),
  // N3 data-deletion / GDPR erasure: epoch ms when the account-deletion scrub
  // anonymized this profile in place. When set, the identity fields have been
  // scrubbed (displayName → the FORMER_MEMBER_DISPLAY_NAME sentinel) and the
  // account is a tombstone. Backend-only-writable.
  anonymizedAt: z.number().optional(),
});
export type FullUser = z.infer<typeof FullUserSchema>;

export const UserAgreementsSchema = z.object({
  age: z.boolean().optional(),
  nudity: z.boolean().optional(),
  meet: z.boolean().optional(),
  cookies: z.boolean().optional(),
  terms: z.boolean().optional(),
  agreedOn: z.number().optional(),
});
export type UserAgreements = z.infer<typeof UserAgreementsSchema>;

/**
 * Owner-only account state at `userProfiles/{uid}/privateData/{uid}` (readable
 * only by the owner; never mirrored to publicUsers).
 */
export const UserPrivateDataSchema = z.object({
  email: z.string(),
  // Epoch ms when the user applied for news/political posting (not a boolean) so the
  // applicant queue can be ordered/triaged by application date. Mirrors the
  // `artisanCreator?: number` grant-timestamp pattern. Truthy when set, so existing
  // truthiness reads keep working; absent until the user applies.
  isWaitingForNewsApproval: z.number().optional(),
  // Epoch ms when the user attested they are a U.S.-based person while becoming an artisan
  // (required at artisan signup for now). Mirrors the ageAttested attestation pattern; written
  // server-side by becomeArtisanCreator.
  usPersonAttestedAt: z.number().optional(),
  // Non-U.S. artisan-interest "waitlist" recorded ONLY for adult accounts when a non-U.S. person
  // asks to be notified once creator signups open in their region. Owner-only, backend-written.
  // `requestedAt` is the immutable first-come-first-serve timestamp; `country`/`region` let signups
  // be opened by jurisdiction as each region's laws clear. Mirrors isWaitingForNewsApproval.
  nonUsArtisanInterest: z
    .object({
      country: z.string().min(1).max(100),
      region: z.string().max(100).optional(),
      requestedAt: z.number(),
    })
    .optional(),
  squareStreetzAgreementsDate: z.number().optional(),
  // Epoch ms when the user accepted the one-time Hall download acknowledgement
  // (personal offline use only, no redistribution). Written server-side by the
  // acceptHallDownloadAcknowledgement callable; gates the Hall download button.
  hallDownloadAcknowledgedAt: z.number().optional(),
  agreements: UserAgreementsSchema.optional(),
  // Moderation: human-readable reason for the current account status (set when an
  // admin suspends/bans the user). Written by the setUserStatus callable via the
  // Admin SDK; readable only by the owner (shown in their restricted view).
  // Cleared when the account is reinstated to 'active'.
  statusReason: z.string().optional(),
  statusReasonAt: z.number().optional(),
  // Trust & Safety (§A8): silent interim safety-lock flag. Backend-only-writable,
  // restricted to the owner's view. Set true while a child-safety/NCII action is
  // pending against the account; the app gates the user accordingly.
  safetyLocked: z.boolean().optional(),
  // Trust & Safety (§A7): server-write-only age/registration fields, merged from the
  // standalone age cluster shape (./safety/age.js) so the canonical schema and the
  // age cluster cannot drift.
  ...userPrivateDataAgeFieldsShape,
});
export type UserPrivateData = z.infer<typeof UserPrivateDataSchema>;
