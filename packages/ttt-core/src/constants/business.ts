// Business rule constants shared between frontend and backend

/** The absolute maximum number of shares a workProject can have. */
export const MAX_WORK_PROJECT_STAKE_SHARES = 1000;

/** The maximum character length for a SquareStreetz post created on behalf of a workProject. */
export const MAX_SQUARE_STREETZ_DESCRIPTION_LENGTH = 150;

// --- Admin Task Priority System ---

export const TASK_PRIORITY = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
} as const;

export type TaskPriorityLevel = (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY];

export const TASK_PRIORITY_LABELS = {
  4: 'CRITICAL',
  3: 'HIGH',
  2: 'NORMAL',
  1: 'LOW',
} as const;

// --- Short Links ---

/** The length of the generated ID for short links. */
export const SHORT_LINK_LENGTH = 6;

/** The maximum number of attempts to generate a unique short link ID before failing. */
export const SHORT_LINK_MAX_ATTEMPTS = 5;

/** Character set for short link IDs. Excludes ambiguous characters (0, O, l, 1, I). */
export const SHORT_LINK_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

// --- Firestore Limits ---

/** Maximum operations in a single Firestore write batch. */
export const FIRESTORE_BATCH_LIMIT = 500;

// --- User Display Names ---

/** Minimum length for a user display name (inclusive). */
export const USERNAME_MIN_LENGTH = 3;

/** Maximum length for a user display name (inclusive). */
export const USERNAME_MAX_LENGTH = 20;

/** Allowed characters in a user display name: letters and numbers only. */
export const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;

// --- User Profile Skills ---

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

// --- WorkProject Titles & Descriptions ---

/** Maximum length for a workProject title. */
export const MAX_WORK_PROJECT_TITLE_LENGTH = 150;

/** Maximum length for a workProject description. */
export const MAX_WORK_PROJECT_DESCRIPTION_LENGTH = 300;

/** Maximum number of files attached to a workProject. */
export const MAX_WORK_ASSETS = 5;

/** Maximum file size for workProject file attachments, in bytes (5MB). */
export const MAX_WORK_ASSET_FILE_SIZE = 5 * 1024 * 1024;

/** Allowed characters in titles: letters, numbers, spaces. */
export const TITLE_PATTERN = /^[a-zA-Z0-9 ]+$/;

/** Maximum number of auditions a single workProject can have open at once. */
export const MAX_WORK_PROJECT_AUDITIONS = 3;

// --- WorkProject Subtypes (Tales / Tunes / Television) ---
// Length aliases — kept as named exports so call sites read clearly.

export const MAX_TALE_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;
export const MAX_TALE_DESCRIPTION_LENGTH = MAX_WORK_PROJECT_DESCRIPTION_LENGTH;

export const MAX_TUNE_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;
export const MAX_TUNE_DESCRIPTION_LENGTH = MAX_WORK_PROJECT_DESCRIPTION_LENGTH;

export const MAX_TELEVISION_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;
export const MAX_TELEVISION_DESCRIPTION_LENGTH = MAX_WORK_PROJECT_DESCRIPTION_LENGTH;

/** Maximum number of chapters a Tale can have. */
export const MAX_CHAPTERS = 10;

/** Maximum length for a chapter title. */
export const MAX_CHAPTER_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;

/** Maximum length for chapter body content. */
export const MAX_CHAPTER_CONTENT_LENGTH = 2500;

/** Maximum number of tracks a Tunes workProject can have. */
export const MAX_TUNE_TRACKS = 10;

/** Maximum length for a track title. */
export const MAX_TUNE_TRACK_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;

/** Maximum length for a track description. */
export const MAX_TUNE_TRACK_DESCRIPTION_LENGTH = MAX_WORK_PROJECT_DESCRIPTION_LENGTH;

/** Maximum number of episodes a Television workProject can have. */
export const MAX_TELEVISION_EPISODES = 10;

/** Maximum length for an episode title. */
export const MAX_TELEVISION_EPISODE_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;

/** Maximum length for an episode description. */
export const MAX_TELEVISION_EPISODE_DESCRIPTION_LENGTH = MAX_WORK_PROJECT_DESCRIPTION_LENGTH;

// --- Commission Board & Applications ---

/** Maximum number of open commissions a workProject can have. */
export const MAX_COMMISSION_LISTINGS = 5;

/** Maximum number of proposal artisans saved to a commission. */
export const MAX_SAVED_PROPOSAL_ARTISANS = 5;

/** Maximum length for a commission title. */
export const MAX_COMMISSION_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;

/** Maximum length for a commission description / cover letter. */
export const MAX_COMMISSION_DESCRIPTION_LENGTH = 400;

// --- Opportunities ---

/** Maximum length for an audition title. */
export const MAX_AUDITION_TITLE_LENGTH = 150;

/** Maximum length for an audition description. */
export const MAX_AUDITION_DESCRIPTION_LENGTH = 1000;

// --- SquareStreetz (Social Feed) ---

/** Maximum length for a SquareStreetz post. */
export const MAX_POST_LENGTH = 500;

/** Maximum number of mentions allowed in a single SquareStreetz post. */
export const MAX_MENTIONS = 3;

/** Maximum characters of a mention's display name shown before truncation. */
export const MAX_MENTION_DISPLAY_LENGTH = 30;

// --- Messages & Invites ---

/** Maximum length for a workProject-invite message. */
export const MAX_INVITE_MESSAGE_LENGTH = 500;

/** Maximum length for a pledgePayment message. */
export const MAX_PLEDGE_PAYMENT_MESSAGE_LENGTH = 500;

// --- Admin Messages ---

/** Maximum length for an admin-message subject line. */
export const MAX_ADMIN_MESSAGE_SUBJECT_LENGTH = 100;

/** Maximum length for the initial body text of an admin message. */
export const MAX_ADMIN_MESSAGE_INITIAL_TEXT_LENGTH = 1000;

// --- Content Moderation Workflow ---

/** Maximum length for a content-violation appeal message. */
export const MAX_APPEAL_MESSAGE_LENGTH = 1000;

/** Maximum length for a feedback suggestion. */
export const MAX_FEEDBACK_SUGGESTION_LENGTH = 100;

/** Maximum number of distinct submitters tracked per feedback suggestion. */
export const MAX_FEEDBACK_SUBMITTERS = 100;

/**
 * Canonical list of feedback types accepted by `submitFeedback`. Used both
 * for runtime validation in the schema (`SubmitFeedbackInputSchema`) and
 * for type-safe consumer props on the frontend `<FeedbackSubmission />`
 * component. Adding a new type here is the single source of truth — no
 * mirroring in callers required.
 */
export const FEEDBACK_TYPES = [
  'professionSuggestions',
  'skillTagSuggestions',
  'talesCategorySuggestions',
  'tunesCategorySuggestions',
  'televisionCategorySuggestions',
] as const;

/** Union of canonical feedback types. */
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** Maximum number of items submitted in a single hallLibrary-review submission. */
export const MAX_HALL_LIBRARY_SUBMIT_BATCH = 50;

// --- Admin Tasks ---

/** Admin task lifecycle statuses. */
export const ADMIN_TASK_STATUS = {
  PENDING: 'pending',
  CHECKED_OUT: 'checkedOut',
  WORK_LATER: 'workLater',
  COMPLETED: 'completed',
} as const;

// --- Payments ---

/**
 * Maximum pledgePayment amount accepted by the Stripe checkout flow, in cents
 * (USD). $500,000.00. Well below Stripe's hard per-charge ceiling, but
 * high enough that legitimate large gifts pass without friction. Anything
 * above this is rejected by the schema before a Stripe session is created
 * or any rate-limit / audit-event side effects are incurred.
 */
export const MAX_PLEDGE_PAYMENT_AMOUNT_CENTS = 50_000_000;

