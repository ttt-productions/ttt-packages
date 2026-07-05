// Content-surface business-rule constants — commissions, auditions, the social
// feed, and messaging.
import { MAX_WORK_PROJECT_TITLE_LENGTH } from "./business-work-project.js";
import { ACTIVE_LIMITS } from './app-mode.js';

/** The maximum character length for a SquareStreetz post created on behalf of a workProject. */
export const MAX_SQUARE_STREETZ_DESCRIPTION_LENGTH = 150;

// --- Commission Board & Proposals ---

/** Maximum number of open commissions a workProject can have. Mode-varied. */
export const MAX_COMMISSION_LISTINGS = ACTIVE_LIMITS.workProject.maxCommissionListings;

/** Maximum number of proposal artisans saved to a commission. */
export const MAX_SAVED_PROPOSAL_ARTISANS = 5;

/** Maximum length for a commission title. */
export const MAX_COMMISSION_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;

/** Maximum length for a commission description / cover letter. */
export const MAX_COMMISSION_DESCRIPTION_LENGTH = 400;

// --- Published hall-content text fields (change requests + moderation text-clear) ---

/**
 * The raw doc field names each published hall-content surface exposes as changeable TEXT.
 * Cross-boundary: the member "Update details" field picker offers this set per surface and
 * the change-request submit runner validates against it. Detail surfaces (tale/tune/
 * television) live on the hall parent doc; sub-item surfaces on the published chapter/
 * track/episode doc. Mirrors the hall surfaces of the backend moderation text-clear
 * allowlist (functions moderationClearText.ts) — keep the two in lockstep.
 */
export const HALL_CONTENT_TEXT_FIELDS = {
  tale: ['title', 'description'],
  tune: ['title', 'description'],
  television: ['title', 'description'],
  chapter: ['title', 'content'],
  tuneTrack: ['title', 'description'],
  televisionEpisode: ['title', 'description'],
} as const satisfies Record<string, readonly string[]>;

/** Per-field max lengths for proposed hall-content text (matches the authoring input
 *  schemas: titleSchema 200 / description 5000 / chapter content 100000). */
export const HALL_CONTENT_TEXT_FIELD_MAX = {
  title: 200,
  description: 5000,
  content: 100000,
} as const satisfies Record<string, number>;

// --- Hall library per-user viewing-state doc (hall-viewing-experience Area 2, ruled 2026-07-04) ---

/**
 * Caps for the per-user Hall viewing-state doc (`HallLibraryPreferencesSchema`,
 * `userProfiles/{uid}/privateData/hallLibraryPreferences`). Every list on that doc is
 * capped for launch — no unbounded per-user lists. `hiddenWorkIds`/`inkedWorkIds` are
 * oldest-pruned (or the write is rejected with a friendly message once full);
 * `inProgress` is LRU-pruned by `updatedAt`; `recentlyViewed` is capped, newest-kept.
 * Enforcement lives in the backend core (`runX`) that owns this doc — this is the
 * shared source of truth for the cap values themselves.
 */
export const HALL_LIBRARY_PREFS_CAPS = {
  hiddenWorkIds: 200,
  inkedWorkIds: 200,
  inProgress: 50,
  recentlyViewed: 20,
} as const satisfies Record<string, number>;

// --- Auditions ---

/** Maximum length for an audition title. */
export const MAX_AUDITION_TITLE_LENGTH = 150;

/** Maximum length for an audition description. */
export const MAX_AUDITION_DESCRIPTION_LENGTH = 1000;

/**
 * Maximum sponsored-audition payout amount in whole USD accepted at the upload
 * trust boundary. Mirrors MAX_PLEDGE_PAYMENT_AMOUNT_CENTS ($500,000) expressed
 * in dollars — a finite ceiling that rejects absurd/garbage amounts before any
 * downstream processing.
 */
export const MAX_SPONSORED_AUDITION_AMOUNT_USD = 500_000;

// --- SquareStreetz (Social Feed) ---

/** Maximum length for a SquareStreetz post. */
export const MAX_POST_LENGTH = 500;

/** Maximum number of mentions allowed in a single SquareStreetz post. */
export const MAX_MENTIONS = 3;

/** Maximum characters of a mention's display name shown before truncation. */
export const MAX_MENTION_DISPLAY_LENGTH = 30;

// --- Messages & Invites ---

/** Maximum length for a guild-invite message. */
export const MAX_GUILD_INVITE_MESSAGE_LENGTH = 500;

/** Maximum length for a pledgePayment message. */
export const MAX_PLEDGE_PAYMENT_MESSAGE_LENGTH = 500;

/** Maximum length for a chat reply-to preview snippet stored on an attachment. */
export const MAX_CHAT_REPLY_PREVIEW_LENGTH = 280;
