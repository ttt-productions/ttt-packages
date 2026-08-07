// User identity + profile business-rule constants — display names, craft skills,
// mention history, and search.

// --- User Display Names ---

/** Minimum length for a user display name (inclusive). */
export const USERNAME_MIN_LENGTH = 3;

/** Maximum length for a user display name (inclusive). */
export const USERNAME_MAX_LENGTH = 20;

/** Allowed characters in a user display name: letters and numbers only. */
export const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;

/**
 * Display-name sentinel for an erased account (N3 data-deletion / GDPR erasure).
 * The `publicUsers/{uid}` doc is kept (so uid→name resolvers keep working) with
 * `displayName` set to this and `anonymizedAt` stamped; uid-keyed authorship /
 * share-tombstone records render with this label.
 */
export const FORMER_MEMBER_DISPLAY_NAME = 'Former member';

/**
 * N3 account deletion / GDPR erasure — the grace window (days) between the deletion
 * request and the destructive scrub. Logging back in during the window is the one cancel.
 * Persisted on each request as `graceDays` (compliance trail) and stated as product policy
 * in the user-facing data-deletion documents — ONE declaration; the callable and the copy
 * both derive from it.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

// --- Account Passwords ---

/**
 * Minimum length (inclusive) for a TTT account password. Counted in JavaScript
 * string length units (UTF-16 code units), consistent with HTML input length
 * behavior and the Firebase Auth SDK. Above Firebase's hard floor of 6 and within
 * the supported hosted password-policy range, which is set from this declaration.
 */
export const PASSWORD_MIN_LENGTH = 7;

/**
 * Maximum length (inclusive) for a TTT account password, in the same UTF-16
 * code-unit units as the minimum. Long enough for passphrases and
 * password-manager output while keeping the product input finite.
 */
export const PASSWORD_MAX_LENGTH = 64;

import { ACTIVE_LIMITS } from './app-mode.js';

// --- User Profile Craft Skills ---

/** Maximum number of craft-skills a user can upload to their profile. Mode-varied. */
export const CRAFT_SKILL_LIMIT = ACTIVE_LIMITS.user.maxCraftSkills;

// --- Work-project participation caps (mode-varied, server-enforced) ---

/** Maximum number of work projects an artisan can own (steward) at once. */
export const MAX_OWNED_WORK_PROJECTS = ACTIVE_LIMITS.user.maxOwnedWorkProjects;

/** Maximum number of active guild memberships a user can hold at once. */
export const MAX_ASSOCIATED_WORK_PROJECTS = ACTIVE_LIMITS.user.maxAssociatedWorkProjects;

/** Maximum number of tags allowed per craftSkill. */
export const MAX_CRAFT_SKILL_TAGS = 5;

/** Maximum length for a craft-skill name. */
export const MAX_CRAFT_SKILL_NAME_LENGTH = 200;

/** Non-US artisan-interest country/region free-text (input schema + privateData doc). */
export const MAX_ARTISAN_LOCATION_LENGTH = 100;

// --- Mention History ---

/** Maximum number of recent mentions kept in the user's mention-history hook. */
export const MAX_HISTORY_ITEMS = 10;

// --- Search ---

/** Maximum number of results returned by the search hook. */
export const SEARCH_RESULT_LIMIT = 6;

// --- First-visit site tour ---

/**
 * Current first-visit site-tour version. The `updateSiteTourPreference` callable stamps
 * this onto `privateData.siteTour.completedVersion` at completion, and the landing
 * eligibility check suppresses the automatic invitation while a member's
 * `completedVersion` equals it. Bump when the permanent-shell-controls tour changes
 * enough to re-invite every member. See
 * ttt-prod docs/design/landing-backstage-guide-and-first-visit-plan.md §10.
 */
export const SITE_TOUR_CURRENT_VERSION = 1;
