// Content-surface business-rule constants — commissions, auditions, the social
// feed, and messaging.
import {
  MAX_WORK_PROJECT_TITLE_LENGTH,
  MAX_WORK_PROJECT_DESCRIPTION_LENGTH,
  MAX_CHAPTER_CONTENT_LENGTH,
  MAX_WORK_REALM_TITLE_LENGTH,
  MAX_WORK_REALM_DESCRIPTION_LENGTH,
} from "./business-work-project.js";
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
  // Realm grain (R1, 2026-07-12): targets the `workRealms/{id}` doc directly.
  workRealm: ['workingTitle', 'workingDescription'],
} as const satisfies Record<string, readonly string[]>;

/** Per-field max lengths for proposed hall-content text. DERIVED from the owning
 *  constants — never independent numbers — so the change-request pipeline can never
 *  drift from the authoring limits again (the pre-2026-07-13 copy carried its own
 *  200/5000/100000 set while authoring enforced 150/300/2500). */
export const HALL_CONTENT_TEXT_FIELD_MAX = {
  title: MAX_WORK_PROJECT_TITLE_LENGTH,
  description: MAX_WORK_PROJECT_DESCRIPTION_LENGTH,
  content: MAX_CHAPTER_CONTENT_LENGTH,
  workingTitle: MAX_WORK_REALM_TITLE_LENGTH,
  workingDescription: MAX_WORK_REALM_DESCRIPTION_LENGTH,
} as const satisfies Record<string, number>;

/** Admin decision reason on a published change request (required on a deny; shown to
 *  the member). One owner for the review callable schema AND the admin work-view input. */
export const MAX_HALL_CHANGE_REQUEST_REASON_LENGTH = 2000;

// --- Real-people / parody disclaimer (R3, 2026-07-12) ---

/**
 * The ONE standard platform disclaimer rendered on every published work whose
 * author attested it depicts real people (parody / satire / commentary). Two
 * layers, always shown together (DJ, 2026-07-12): the themed playbill HEADER
 * on top, the plain legal MESSAGE underneath. There is no free-text disclaimer
 * anywhere — these constants are the only wording, so a wording change is a
 * single edit here (display surfaces and any backend consumer read these; the
 * text is never persisted on docs). The MESSAGE deliberately never ADMITS the
 * work depicts real people — it hedges ("even those based on real people",
 * the standard film-boilerplate move) so the disclaimer never hands over the
 * depiction element of a claim. Legal wording pending counsel confirmation
 * (tracked in docs/ttt-prod-legal/).
 */
export const REAL_PEOPLE_DISCLAIMER_HEADER =
  'A Notice from the Management: the faces may be familiar, but the players are pure ' +
  'invention — parody and satire, in the grand old tradition of the stage.';

export const REAL_PEOPLE_DISCLAIMER_MESSAGE =
  'All characters, statements, and events in this work, even those based on real people, ' +
  'are entirely fictional and are presented as parody, satire, or commentary. Any voices, ' +
  'likenesses, or portrayals of real people are impersonated or fictionalized, and nothing ' +
  'in this work should be understood as a statement of fact about, or as speech by, any ' +
  'real person. This work is not created by, affiliated with, sponsored by, or endorsed by ' +
  'any real person portrayed or referenced in it.';

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

/** Curated-audition option-video batch bounds (the fixed 2..8 option count carried
 * from the Create click through targetInfo/upload-variables to the create core's
 * re-check). ONE declaration — every `.min()/.max()` derives from these. */
export const MIN_CURATED_AUDITION_OPTIONS = 2;
export const MAX_CURATED_AUDITION_OPTIONS = 8;

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
