// Scheduled-job intervals, batch sizes, and source URLs.

// --- Admin task cleanup ---

/** Interval in minutes for the admin-task cleanup scheduled job. */
export const ADMIN_TASK_CLEANUP_INTERVAL = 15;

/** Batch size of expired task checkouts processed per scheduled run. */
export const ADMIN_TASK_EXPIRED_BATCH_SIZE = 500;

/** Safety cap on iterations within a single admin-task cleanup run. */
export const ADMIN_TASK_CLEANUP_MAX_ITERATIONS = 10;

// --- Profanity list sync ---

/** Source URLs the syncProfanityList job pulls word lists from. */
export const WORD_LIST_URLS = [
  'https://raw.githubusercontent.com/zacanger/profane-words/master/words.json',
  'https://raw.githubusercontent.com/RobertJGabriel/Google-profanity-words/master/list.txt',
] as const;
