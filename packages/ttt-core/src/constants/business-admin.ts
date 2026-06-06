// Admin + content-moderation business-rule constants — task priority, dispatches,
// the moderation/feedback workflow, and admin-task lifecycle.

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

// --- Admin Dispatches ---

/** Maximum length for an admin-dispatch subject line. */
export const MAX_ADMIN_DISPATCH_SUBJECT_LENGTH = 100;

/** Maximum length for the initial body text of an admin dispatch. */
export const MAX_ADMIN_DISPATCH_INITIAL_TEXT_LENGTH = 1000;

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
  'tradeProfessionSuggestions',
  'craftSkillTagSuggestions',
  'talesWorkGenreSuggestions',
  'tunesWorkGenreSuggestions',
  'televisionWorkGenreSuggestions',
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
