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
