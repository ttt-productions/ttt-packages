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
