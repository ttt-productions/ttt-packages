// User identity + profile business-rule constants — display names, craft skills,
// mention history, and search.

// --- User Display Names ---

/** Minimum length for a user display name (inclusive). */
export const USERNAME_MIN_LENGTH = 3;

/** Maximum length for a user display name (inclusive). */
export const USERNAME_MAX_LENGTH = 20;

/** Allowed characters in a user display name: letters and numbers only. */
export const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;

// --- User Profile Craft Skills ---

/** Maximum number of craft-skills a user can upload to their profile. */
export const CRAFT_SKILL_LIMIT = 8;

/** Maximum number of tags allowed per craftSkill. */
export const MAX_CRAFT_SKILL_TAGS = 5;

// --- Mention History ---

/** Maximum number of recent mentions kept in the user's mention-history hook. */
export const MAX_HISTORY_ITEMS = 10;

// --- Search ---

/** Maximum number of results returned by the search hook. */
export const SEARCH_RESULT_LIMIT = 6;
