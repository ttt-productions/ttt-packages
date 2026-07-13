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

// --- Admin console config-content text caps ---
// Every number the system uses lives HERE — even a field only one surface consumes
// today, because any future client (TV / phone / admin app) reads ttt-core.

export const MAX_FUTURE_PLAN_TITLE_LENGTH = 200;
export const MAX_FUTURE_PLAN_DESCRIPTION_LENGTH = 4000;
export const MAX_PLATFORM_RULE_TITLE_LENGTH = 200;
export const MAX_PLATFORM_RULE_DESCRIPTION_LENGTH = 4000;
export const MAX_AGREEMENT_POINT_LENGTH = 2000;
export const MAX_CONTENT_PAGE_HEADING_LENGTH = 300;
export const MAX_CONTENT_PAGE_BODY_LENGTH = 20000;
export const MAX_TAKE_IT_DOWN_COPY_LENGTH = 8000;
export const MAX_MAINTENANCE_MESSAGE_LENGTH = 2000;

/** Admin notes on a content-appeal review (reviewContentAppeal). */
export const MAX_APPEAL_REVIEW_NOTES_LENGTH = 2000;

/** Admin reason on a Work/Realm forced-retitle remedy. */
export const MAX_REQUIRE_RETITLE_REASON_LENGTH = 500;

/** Optional user-facing DETAIL text on a normal-report resolution. */
export const MAX_USER_FACING_REASON_DETAIL_LENGTH = 2000;

/** Admin broadcast / user notification message body. */
export const MAX_NOTIFICATION_MESSAGE_LENGTH = 2000;

/** Admin user-search query input. */
export const MAX_USER_SEARCH_QUERY_LENGTH = 100;

// --- NCII / child-safety statutory + operator text caps ---

/** Operator reason on the admin "mark as NCII linked evidence" intake. */
export const MAX_NCII_EVIDENCE_REASON_LENGTH = 1000;

/** Operator written rationale on a TAKE IT DOWN validity decision (immutable row). */
export const MAX_NCII_RATIONALE_LENGTH = 4000;

/** Requester's statement of nonconsent (statutory intake — in-app and no-login). */
export const MAX_NCII_NONCONSENT_STATEMENT_LENGTH = 4000;

/** Typed-name electronic signature on a statutory request. */
export const MAX_NCII_SIGNED_NAME_LENGTH = 256;

/** Requester's optional supporting facts (statutory intake). */
export const MAX_NCII_SUPPORTING_FACTS_LENGTH = 8000;

/** Bounded, non-sensitive summary on an NCII request action row. */
export const MAX_NCII_ACTION_SUMMARY_LENGTH = 280;

/** Operator description of a registered evidence artifact (e.g. portal screenshot). */
export const MAX_SAFETY_ARTIFACT_DESCRIPTION_LENGTH = 500;

/** Operator proof note on a manual NCMEC portal filing. */
export const MAX_NCMEC_PORTAL_PROOF_TEXT_LENGTH = 2000;

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
