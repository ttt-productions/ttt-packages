// Business rule constants shared between frontend and backend

/** The absolute maximum number of shares a project can have. */
export const MAX_PROJECT_SHARES = 1000;

/** The maximum character length for a Streetz post created on behalf of a project. */
export const MAX_STREETZ_DESCRIPTION_LENGTH = 150;

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

/** Maximum number of skills a user can upload to their profile. */
export const SKILL_LIMIT = 8;

/** Maximum number of tags allowed per skill. */
export const MAX_SKILL_TAGS = 5;

// --- Mention History ---

/** Maximum number of recent mentions kept in the user's mention-history hook. */
export const MAX_HISTORY_ITEMS = 10;

// --- Search ---

/** Maximum number of results returned by the search hook. */
export const SEARCH_RESULT_LIMIT = 6;

// --- Project Titles & Descriptions ---

/** Maximum length for a project title. */
export const MAX_PROJECT_TITLE_LENGTH = 150;

/** Maximum length for a project description. */
export const MAX_PROJECT_DESCRIPTION_LENGTH = 300;

/** Maximum number of files attached to a project. */
export const MAX_PROJECT_FILES = 5;

/** Maximum file size for project file attachments, in bytes (5MB). */
export const MAX_PROJECT_FILE_SIZE = 5 * 1024 * 1024;

/** Allowed characters in titles: letters, numbers, spaces. */
export const TITLE_PATTERN = /^[a-zA-Z0-9 ]+$/;

/** Maximum number of opportunities a single project can have open at once. */
export const MAX_PROJECT_OPPORTUNITIES = 3;

// --- Project Subtypes (Tales / Tunes / Television) ---
// Length aliases — kept as named exports so call sites read clearly.

export const MAX_TALE_TITLE_LENGTH = MAX_PROJECT_TITLE_LENGTH;
export const MAX_TALE_DESCRIPTION_LENGTH = MAX_PROJECT_DESCRIPTION_LENGTH;

export const MAX_TUNE_TITLE_LENGTH = MAX_PROJECT_TITLE_LENGTH;
export const MAX_TUNE_DESCRIPTION_LENGTH = MAX_PROJECT_DESCRIPTION_LENGTH;

export const MAX_TELEVISION_TITLE_LENGTH = MAX_PROJECT_TITLE_LENGTH;
export const MAX_TELEVISION_DESCRIPTION_LENGTH = MAX_PROJECT_DESCRIPTION_LENGTH;

/** Maximum number of chapters a Tale can have. */
export const MAX_CHAPTERS = 10;

/** Maximum length for a chapter title. */
export const MAX_CHAPTER_TITLE_LENGTH = MAX_PROJECT_TITLE_LENGTH;

/** Maximum length for chapter body content. */
export const MAX_CHAPTER_CONTENT_LENGTH = 2500;

/** Maximum number of songs a Tunes project can have. */
export const MAX_SONGS = 10;

/** Maximum length for a song title. */
export const MAX_SONG_TITLE_LENGTH = MAX_PROJECT_TITLE_LENGTH;

/** Maximum length for a song description. */
export const MAX_SONG_DESCRIPTION_LENGTH = MAX_PROJECT_DESCRIPTION_LENGTH;

/** Maximum number of shows a Television project can have. */
export const MAX_SHOWS = 10;

/** Maximum length for a show title. */
export const MAX_SHOW_TITLE_LENGTH = MAX_PROJECT_TITLE_LENGTH;

/** Maximum length for a show description. */
export const MAX_SHOW_DESCRIPTION_LENGTH = MAX_PROJECT_DESCRIPTION_LENGTH;

// --- Job Board & Applications ---

/** Maximum number of open jobs a project can have. */
export const MAX_JOBS = 5;

/** Maximum number of applicants saved to a job. */
export const MAX_SAVED_APPLICANTS = 5;

/** Maximum length for a job title. */
export const MAX_JOB_TITLE_LENGTH = MAX_PROJECT_TITLE_LENGTH;

/** Maximum length for a job description / cover letter. */
export const MAX_JOB_DESCRIPTION_LENGTH = 400;

// --- Opportunities ---

/** Maximum length for an opportunity title. */
export const MAX_OPPORTUNITY_TITLE_LENGTH = 150;

/** Maximum length for an opportunity description. */
export const MAX_OPPORTUNITY_DESCRIPTION_LENGTH = 1000;

// --- Streetz (Social Feed) ---

/** Maximum length for a Streetz post. */
export const MAX_POST_LENGTH = 500;

/** Maximum number of mentions allowed in a single Streetz post. */
export const MAX_MENTIONS = 3;

/** Maximum characters of a mention's display name shown before truncation. */
export const MAX_MENTION_DISPLAY_LENGTH = 30;

// --- Messages & Invites ---

/** Maximum length for a project-invite message. */
export const MAX_INVITE_MESSAGE_LENGTH = 500;

/** Maximum length for a donation message. */
export const MAX_DONATION_MESSAGE_LENGTH = 500;

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

/** Maximum number of items submitted in a single library-review submission. */
export const MAX_LIBRARY_SUBMIT_BATCH = 50;

// --- Admin Tasks ---

/** Admin task lifecycle statuses. */
export const ADMIN_TASK_STATUS = {
  PENDING: 'pending',
  CHECKED_OUT: 'checkedOut',
  WORK_LATER: 'workLater',
  COMPLETED: 'completed',
} as const;
