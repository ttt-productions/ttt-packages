import { ACTIVE_LIMITS } from './app-mode.js';
import { MAX_WORK_PROJECT_TITLE_LENGTH } from './business-work-project.js';
import { MAX_SEARCH_QUERY_LENGTH } from './business-platform.js';
import { EMAIL_MAX_LENGTH } from './business-user.js';
import type { AdminTaskType } from '../doc-schemas/report-docs.js';

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

export const TASK_PRIORITY_SCORE = {
  LOW: 50,
  NORMAL: 200,
  HIGH: 800,
  CRITICAL: 1000,
  MONEY_ANOMALY: 1100,
} as const;

export type TaskPriorityScore = (typeof TASK_PRIORITY_SCORE)[keyof typeof TASK_PRIORITY_SCORE];

export const TASK_PRIORITY_LEVEL_TO_SCORE = {
  [TASK_PRIORITY.LOW]: TASK_PRIORITY_SCORE.LOW,
  [TASK_PRIORITY.NORMAL]: TASK_PRIORITY_SCORE.NORMAL,
  [TASK_PRIORITY.HIGH]: TASK_PRIORITY_SCORE.HIGH,
  [TASK_PRIORITY.CRITICAL]: TASK_PRIORITY_SCORE.CRITICAL,
} as const;

export const MAX_ADMIN_DISPATCH_SUBJECT_LENGTH = 100;

export const MAX_ADMIN_DISPATCH_INITIAL_TEXT_LENGTH = 1000;

export const MAX_APPEAL_MESSAGE_LENGTH = 1000;

export const MAX_THRESHOLD_REVIEW_NOTES_LENGTH = 2000;

export const MAX_THRESHOLD_PUBLISH_PARKED_REASON_LENGTH = 2000;

export const MAX_INTERNAL_REASON_LENGTH = 2000;

export const MAX_UNDER_13_CLOSE_REASON_LENGTH = 1000;

export const MAX_USER_FACING_REASON_LENGTH = 280;

export const MAX_SAFETY_RESOLUTION_SUMMARY_LENGTH = 2000;

export const MAX_SAFETY_ADMIN_NOTE_LENGTH = 4000;

export const MAX_REPORT_NARRATIVE_LENGTH = 4000;

export const MAX_REPORT_TARGET_ID_LENGTH = 256;

export const MAX_REPORT_COMMENT_LENGTH = 1000;

export const MIN_SAFETY_RATIONALE_LENGTH = 10;

export const MAX_CHAT_MODERATION_REASON_LENGTH = 1000;

export const MAX_BROADCAST_EXPLICIT_UIDS = 2000;

export const STEP_UP_ENROLL_REQUIRED = 'OPERATOR_STEP_UP_ENROLL_REQUIRED';
export const STEP_UP_REQUIRED = 'OPERATOR_STEP_UP_REQUIRED';

export const STEP_UP_CURRENT_CODE_REQUIRED = 'OPERATOR_STEP_UP_CURRENT_CODE_REQUIRED';

export const OPERATOR_STEP_UP_CODE_LENGTH = 6;

export const OPERATOR_STEP_UP_RECOVERY_CODE_COUNT = 10;

// Crockford base32 characters, shown as two groups of five.
export const OPERATOR_STEP_UP_RECOVERY_CODE_LENGTH = 10;

export const MAX_REPORT_SNAPSHOT_TEXT_LENGTH = 4000;

export const MAX_FUTURE_PLAN_TITLE_LENGTH = 200;
export const MAX_FUTURE_PLAN_DESCRIPTION_LENGTH = 4000;
export const MAX_PLATFORM_RULE_TITLE_LENGTH = 200;
export const MAX_PLATFORM_RULE_DESCRIPTION_LENGTH = 4000;
export const MAX_AGREEMENT_POINT_LENGTH = 2000;
export const MAX_PUBLIC_DOCUMENT_INTRO_LENGTH = 4000;
export const MAX_PUBLIC_DOCUMENT_INTENTION_LENGTH = 1000;
export const MAX_FUTURE_PLAN_GROUP_NAME_LENGTH = 200;
export const MAX_FUTURE_PLAN_GROUPS = 50;
export const MAX_FUTURE_PLANS = 200;
export const MAX_PLATFORM_RULES = 500;
export const MAX_AGREEMENT_POINTS = 200;
export const MAX_CONTENT_PAGE_HEADING_LENGTH = 300;
export const MAX_CONTENT_PAGE_BODY_LENGTH = 20000;
export const MAX_CONTENT_PAGE_SECTIONS = 300;
export const MAX_TAKE_IT_DOWN_COPY_LENGTH = 8000;
export const MAX_DMCA_CONTACT_BLOCKS = 10;
export const MAX_DMCA_CONTACT_ROWS = 20;
export const MAX_DMCA_CONTACT_LABEL_LENGTH = 100;
export const MAX_DMCA_CONTACT_VALUE_LENGTH = 500;
export const MAX_MAINTENANCE_MESSAGE_LENGTH = 2000;

export const MAX_APP_VERSION_LENGTH = 64;

export const MAX_ANNOUNCEMENT_MESSAGE_LENGTH = 300;

export const MAX_APPEAL_REVIEW_NOTES_LENGTH = 2000;

export const MAX_REQUIRE_RETITLE_REASON_LENGTH = 500;

export const MAX_USER_FACING_REASON_DETAIL_LENGTH = 2000;

export const MAX_NOTIFICATION_MESSAGE_LENGTH = 2000;

export const MAX_BROADCAST_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;

export const MAX_USER_SEARCH_QUERY_LENGTH = MAX_SEARCH_QUERY_LENGTH;

export const MAX_NCII_RATIONALE_LENGTH = 4000;

export const MAX_NCII_NONCONSENT_STATEMENT_LENGTH = 4000;

export const MAX_NCII_SIGNED_NAME_LENGTH = 256;

export const MAX_NCII_SUPPORTING_FACTS_LENGTH = 8000;

export const MAX_NCII_ACTION_SUMMARY_LENGTH = 280;

export const MAX_SAFETY_ARTIFACT_DESCRIPTION_LENGTH = 500;

export const MAX_NCMEC_PORTAL_PROOF_TEXT_LENGTH = 2000;

export const MAX_NCMEC_REPORT_NUMBER_LENGTH = 64;

// Cloud Storage caps an object name at 1,024 bytes.
export const MAX_EVIDENCE_VAULT_KEY_LENGTH = 1024;

export const MAX_NCII_REQUESTER_NAME_LENGTH = 256;

export const MAX_NCII_REPRESENTED_PERSON_NAME_LENGTH = 256;

export const MAX_NCII_AUTHORITY_BASIS_LENGTH = 2000;

export const MAX_NCII_AUTHORITY_EVIDENCE_REF_LENGTH = 512;

export const MAX_NCII_LOCATOR_URL_LENGTH = 2048;

export const NCII_IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const NCII_IDEMPOTENCY_KEY_MAX_LENGTH = 256;

export const MAX_NCII_CONTACT_EMAIL_LENGTH = EMAIL_MAX_LENGTH;

export const NCII_CONTACT_PHONE_MIN_LENGTH = 3;
export const NCII_CONTACT_PHONE_MAX_LENGTH = 64;

export const MAX_FEEDBACK_SUGGESTION_LENGTH = 100;

export const MAX_FEEDBACK_SUBMITTERS = ACTIVE_LIMITS.batches.maxFeedbackSubmitters;

export const FEEDBACK_TYPES = [
  'tradeProfessionSuggestions',
  'craftSkillTagSuggestions',
  'talesWorkGenreSuggestions',
  'tunesWorkGenreSuggestions',
  'televisionWorkGenreSuggestions',
] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const MAX_HALL_LIBRARY_SUBMIT_BATCH = ACTIVE_LIMITS.hall.maxSubmitBatch;

export const ADMIN_TASK_STATUS = {
  PENDING: 'pending',
  CHECKED_OUT: 'checkedOut',
  WORK_LATER: 'workLater',
  COMPLETED: 'completed',
} as const;

export const ADMIN_TASK_RESOLUTION_OWNERS = [
  'checkin',
  'reportResolution',
  'thresholdReview',
  'appealReview',
  'refundDecision',
  'changeRequestReview',
  'dispatchClose',
] as const;
export type AdminTaskResolutionOwner = (typeof ADMIN_TASK_RESOLUTION_OWNERS)[number];

export const ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE = {
  adminDispatch: 'dispatchClose',
  thresholdLibraryReview: 'thresholdReview',
  userReport: 'reportResolution',
  'content-appeal': 'appealReview',
  stakeShareAnomaly: 'checkin',
  pledgeLedgerAnomaly: 'checkin',
  pledgePaymentRepairNeeded: 'checkin',
  pledgeDisputeOpened: 'checkin',
  pledgeRefundRequested: 'refundDecision',
  pledgeRefundFailed: 'refundDecision',
  hallContentChangeRequest: 'changeRequestReview',
} as const satisfies Record<AdminTaskType, AdminTaskResolutionOwner>;

export function isAdminTaskResolvedByCheckin(taskType: string): boolean {
  return (
    Object.hasOwn(ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE, taskType) &&
    ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE[taskType as AdminTaskType] === 'checkin'
  );
}

export const MAX_SYSTEM_UID_LIST = 25;
