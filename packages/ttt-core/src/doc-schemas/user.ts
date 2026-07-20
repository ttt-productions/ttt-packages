// User-related Firestore document SCHEMAS — the single source of truth for the
// `userProfiles/{uid}` doc, its `privateData/{uid}` subdoc, and craft-skill shapes.
// (The `publicUsers/{uid}` mirror lives in ./publicUser.) TypeScript types are
// inferred from these schemas via `z.infer`, so a document's shape and its type
// cannot drift apart. See docs/design/firestore-schema-registry.md (ttt-prod).

import { z } from 'zod';
import { HALL_WING_TYPE_KEYS } from '../types/content.js';
import { MAX_ARTISAN_LOCATION_LENGTH } from '../constants/business.js';
import { CRAFT_SKILL_TAG_VALUES } from '../constants/options.js';
import { userPrivateDataAgeFieldsShape } from './safety/age.js';
import { ContentMediaKindSchema } from './media-assets.js';

// The canonical stored media kind — declared once in doc-schemas/media-assets.ts.
const mediaKindSchema = ContentMediaKindSchema;

/** The ONE canonical application account status (userProfiles.status is the
 * authoritative value; the chat access projection and the status-reconcile queue
 * derive from the same set). Never re-declare inline. */
export const UserAccountStatusSchema = z.enum(['active', 'suspended', 'banned']);
export type UserAccountStatus = z.infer<typeof UserAccountStatusSchema>;

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
  // Canonical discipline-tag allowlist — never open strings (DJ ruling 2026-07-13).
  tags: z.array(z.enum(CRAFT_SKILL_TAG_VALUES)),
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
  tags: z.array(z.enum(CRAFT_SKILL_TAG_VALUES)),
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
  // Charter honor stamp: written once at registration by /api/register/complete as
  // byMode(true, false) — true only for accounts created during Charter Season. The
  // flip publish makes new signups false automatically; no backfill, no date math.
  // Backend-only-writable, cosmetic, not PII (docs/charter-season/honor-roll-and-badges.md).
  charterSignupMember: z.boolean().optional(),
  status: UserAccountStatusSchema.optional(),
  // Chat-edge-rebuild account-access domain (Contract B / round-10 blocker 1): the
  // single ban/unban ordering version + state the chat `accountAccess` sync events key
  // on. Backend-only-writable. Deliberate defaults when ABSENT: a never-touched account
  // is `{ accountAccessVersion: 0, accountAccessState: 'active' }` (NOT banned) — bumped
  // atomically on suspend/ban/unban, which enqueue the accountAccessChanged fanout.
  accountAccessVersion: z.number().optional(),
  accountAccessState: UserAccountStatusSchema.optional(),
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
 * First-visit site-tour state (account-durable, server-written) stored on
 * `privateData/{uid}.siteTour`. A missing `siteTour` field means the member has never
 * handled the tour. Automatic-invitation eligibility is evaluated in this order:
 *   1. `automaticInvitesDisabledAt` present → never invite automatically ("Don't show
 *      this again");
 *   2. `notTodayDate` equals the member's current LOCAL calendar date → do not invite
 *      that day ("Not today");
 *   3. `completedVersion` equals `SITE_TOUR_CURRENT_VERSION` → already handled;
 *   4. otherwise → offer the tour.
 * Written ONLY by the `updateSiteTourPreference` callable via the Admin SDK; never
 * client-written. `notTodayDate` is a strict `YYYY-MM-DD` local-date string (same
 * date-string convention as the age cluster's `attestedDateOfBirth`). See
 * docs/design/landing-backstage-guide-and-first-visit-plan.md §10.
 */
export const UserSiteTourStateSchema = z.object({
  // The tour version the member completed. The callable stamps SITE_TOUR_CURRENT_VERSION
  // server-side at completion (the version is server-owned, never client-supplied);
  // absent until a completion is recorded.
  completedVersion: z.number().int().optional(),
  // Epoch ms when the tour was completed.
  completedAt: z.number().optional(),
  // The member's LOCAL calendar date (YYYY-MM-DD) recorded by "Not today"; the automatic
  // invitation is suppressed for exactly that date, then offered again on a later date.
  notTodayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // 'YYYY-MM-DD'
  // Epoch ms when the member chose "Don't show this again" (permanent automatic-invite
  // dismissal). Manual replay from Help ignores this without clearing it.
  automaticInvitesDisabledAt: z.number().optional(),
});
export type UserSiteTourState = z.infer<typeof UserSiteTourStateSchema>;

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
      country: z.string().min(1).max(MAX_ARTISAN_LOCATION_LENGTH),
      region: z.string().max(MAX_ARTISAN_LOCATION_LENGTH).optional(),
      requestedAt: z.number(),
    })
    .optional(),
  squareStreetzAgreementsDate: z.number().optional(),
  // Epoch ms when the user accepted the one-time Hall download acknowledgement
  // (personal offline use only, no redistribution). Written server-side by the
  // acceptHallDownloadAcknowledgement callable; gates the Hall download button.
  hallDownloadAcknowledgedAt: z.number().optional(),
  agreements: UserAgreementsSchema.optional(),
  // First-visit site-tour state (account-durable; the SOLE authority for tour
  // eligibility — no local-storage cache/mirror). Absent = never handled. Written only
  // by the updateSiteTourPreference callable. See UserSiteTourStateSchema above.
  siteTour: UserSiteTourStateSchema.optional(),
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
