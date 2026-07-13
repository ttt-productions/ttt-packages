// Admin + content-moderation business-rule constants — task priority, dispatches,
// the moderation/feedback workflow, and admin-task lifecycle.
import { ACTIVE_LIMITS } from './app-mode.js';

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

/**
 * Canonical NUMERIC priority scale for `adminTasks.priority`, shared by BOTH
 * priority systems so `checkoutNextImportantTask` (orderBy priority desc across all
 * task types) compares commensurable values. The userReport report-core score formula
 * already writes on this scale (≈40–2250); the level-based types (thresholdLibraryReview,
 * content-appeal, adminDispatch) map their TASK_PRIORITY level onto these numbers instead
 * of writing the raw 1–4.
 *
 * Resulting order: safety reports (1200–2250) > money anomalies (1100) >
 * CRITICAL (1000) > HIGH (800) > routine reports interleave below > spam-tier (~80).
 */
export const TASK_PRIORITY_SCORE = {
  LOW: 50,
  NORMAL: 200,
  HIGH: 800,
  CRITICAL: 1000,
  /** Money-integrity anomaly (stake-share / pledge-ledger corruption signal) — outranks
   * everything except safety-class reports. The three anomaly creators that previously
   * hardcoded `priority: 1` (LOW) all write this. */
  MONEY_ANOMALY: 1100,
} as const;

export type TaskPriorityScore = (typeof TASK_PRIORITY_SCORE)[keyof typeof TASK_PRIORITY_SCORE];

/** Maps a level-based TASK_PRIORITY value (1–4) to its canonical numeric score. */
export const TASK_PRIORITY_LEVEL_TO_SCORE = {
  [TASK_PRIORITY.LOW]: TASK_PRIORITY_SCORE.LOW,
  [TASK_PRIORITY.NORMAL]: TASK_PRIORITY_SCORE.NORMAL,
  [TASK_PRIORITY.HIGH]: TASK_PRIORITY_SCORE.HIGH,
  [TASK_PRIORITY.CRITICAL]: TASK_PRIORITY_SCORE.CRITICAL,
} as const;

// --- Admin Dispatches ---

/** Maximum length for an admin-dispatch subject line. */
export const MAX_ADMIN_DISPATCH_SUBJECT_LENGTH = 100;

/** Maximum length for the initial body text of an admin dispatch. */
export const MAX_ADMIN_DISPATCH_INITIAL_TEXT_LENGTH = 1000;

// --- Content Moderation Workflow ---

/** Maximum length for a content-violation appeal message. */
export const MAX_APPEAL_MESSAGE_LENGTH = 1000;

/** Threshold-review reviewer notes (revision notes shown to the author). One owner for
 *  the review callable schema AND the admin work-view input. */
export const MAX_THRESHOLD_REVIEW_NOTES_LENGTH = 2000;

// --- Moderation / safety operator text caps ---
// Each is declared ONCE here and derived by every input schema AND persisted doc schema
// that carries the field — the numbers must never be re-hardcoded at an enforcement point.

/** Operator-facing INTERNAL reason/rationale (LE-loggable; account actions, case reopens). */
export const MAX_INTERNAL_REASON_LENGTH = 2000;

/** The generic owner-readable (user-facing) reason — deliberately short, no detail leaks. */
export const MAX_USER_FACING_REASON_LENGTH = 280;

/** Structured close-out summary on report/safety-case resolutions. */
export const MAX_SAFETY_RESOLUTION_SUMMARY_LENGTH = 2000;

/** Optional operator note attached to a close-out. */
export const MAX_SAFETY_ADMIN_NOTE_LENGTH = 4000;

// --- Report intake text caps ---

/** Reporter free-text narrative/comment (segregated private doc; never on the root). */
export const MAX_REPORT_NARRATIVE_LENGTH = 4000;

/** The frozen report-time captured text snapshot (edit-to-evade guard; NO PII). */
export const MAX_REPORT_SNAPSHOT_TEXT_LENGTH = 4000;

/** Maximum length for a feedback suggestion. */
export const MAX_FEEDBACK_SUGGESTION_LENGTH = 100;

/** Maximum number of distinct submitters tracked per feedback suggestion. Mode-varied. */
export const MAX_FEEDBACK_SUBMITTERS = ACTIVE_LIMITS.batches.maxFeedbackSubmitters;

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

/** Maximum number of items submitted in a single hallLibrary-review submission. Mode-varied. */
export const MAX_HALL_LIBRARY_SUBMIT_BATCH = ACTIVE_LIMITS.hall.maxSubmitBatch;

// --- Admin Tasks ---

/** Admin task lifecycle statuses. */
export const ADMIN_TASK_STATUS = {
  PENDING: 'pending',
  CHECKED_OUT: 'checkedOut',
  WORK_LATER: 'workLater',
  COMPLETED: 'completed',
} as const;
