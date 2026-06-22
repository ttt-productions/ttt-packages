// App mode + the charter/full limit sets — the single published constant that
// drives the whole app's cost posture. The flip to full-live is: change
// APP_MODE → publish ttt-core → install in ttt-prod (root + functions) →
// deploy. There is NO runtime mode flag and NO console toggle.
// See ttt-prod docs/design/charter-season-and-app-mode.md.
//
// Only real cost/abuse drivers vary by mode: media specs (ttt-media-specs.ts),
// rate-limit values, count caps, batch sizes. Text-length limits and payment
// min/max are deliberately mode-invariant.

export type AppMode = 'charter' | 'full';

/** The deployed mode. Changing this constant (and publishing) IS the flip. */
export const APP_MODE: AppMode = 'charter';

/** Pick the active value for a mode-varied limit. */
export const byMode = <T>(charter: T, full: T): T =>
  (APP_MODE as AppMode) === 'charter' ? charter : full;

/** Upstash-style sliding-window duration, e.g. '1 h'. */
export type RateLimitWindow = `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`;

export interface RateLimitValue {
  maxRequests: number;
  window: RateLimitWindow;
}

export interface TttLimits {
  mode: AppMode;
  user: {
    maxCraftSkills: number;
    maxOwnedWorkProjects: number;
    maxAssociatedWorkProjects: number;
  };
  workProject: {
    maxGuildSize: number;
    maxFileFolders: number;
    maxWorkFiles: number;
    maxWorkFileStorageBytes: number;
    maxWorkProjectAuditions: number;
    maxCommissionListings: number;
    maxChapters: number;
    maxTuneTracks: number;
    maxTelevisionEpisodes: number;
  };
  hall: {
    maxSubmitBatch: number;
  };
  batches: {
    trendingFeedProcessLimit: number;
    maxFeedbackSubmitters: number;
  };
  /** Values for the backend rate limiters. Prefixes/factory stay in functions. */
  rateLimits: {
    UPLOAD: RateLimitValue;
    VOTE: RateLimitValue;
    MODERATION: RateLimitValue;
    SENSITIVE_ACTION: RateLimitValue;
    DISPLAY_NAME_CHECK: RateLimitValue;
    CHAT_MESSAGE: RateLimitValue;
    ADMIN_TASK: RateLimitValue;
    APPEAL_REVIEW: RateLimitValue;
    BAN_ACTION: RateLimitValue;
    SHARE_TRANSFER: RateLimitValue;
    CONTENT_REPORT: RateLimitValue;
    SHORT_LINK_CLICK: RateLimitValue;
    FOLLOW: RateLimitValue;
    MENTION_HISTORY: RateLimitValue;
    ADMIN_MESSAGE_READ: RateLimitValue;
    NOTIFICATION_BROADCAST: RateLimitValue;
    NOTIFICATION_ARCHIVE: RateLimitValue;
    NOTIFICATION_MARK_SEEN: RateLimitValue;
    FEEDBACK: RateLimitValue;
    SHORT_LINK_CREATE: RateLimitValue;
    INVITE_ACTION: RateLimitValue;
    LIBRARY_SUBMISSION: RateLimitValue;
    CHANNEL_CREATE: RateLimitValue;
    CHECKOUT_CREATE: RateLimitValue;
  };
}

export const CHARTER_LIMITS: TttLimits = {
  mode: 'charter',
  user: {
    maxCraftSkills: 8,
    maxOwnedWorkProjects: 3,
    maxAssociatedWorkProjects: 10,
  },
  workProject: {
    maxGuildSize: 25,
    maxFileFolders: 10,
    maxWorkFiles: 100,
    maxWorkFileStorageBytes: 2_684_354_560, // 2.5 GiB
    maxWorkProjectAuditions: 3,
    maxCommissionListings: 3,
    maxChapters: 5,
    maxTuneTracks: 5,
    maxTelevisionEpisodes: 3,
  },
  hall: { maxSubmitBatch: 10 },
  batches: { trendingFeedProcessLimit: 250, maxFeedbackSubmitters: 25 },
  rateLimits: {
    // Uploads are charged ONCE per upload (in startUpload); the processor-side
    // check is a non-charging guard.
    UPLOAD: { maxRequests: 15, window: '1 h' },
    VOTE: { maxRequests: 100, window: '1 h' },
    MODERATION: { maxRequests: 50, window: '1 h' },
    SENSITIVE_ACTION: { maxRequests: 5, window: '1 h' },
    DISPLAY_NAME_CHECK: { maxRequests: 20, window: '1 h' },
    CHAT_MESSAGE: { maxRequests: 125, window: '1 h' },
    ADMIN_TASK: { maxRequests: 60, window: '1 h' },
    APPEAL_REVIEW: { maxRequests: 30, window: '1 h' },
    BAN_ACTION: { maxRequests: 20, window: '1 h' },
    SHARE_TRANSFER: { maxRequests: 10, window: '1 h' },
    CONTENT_REPORT: { maxRequests: 5, window: '1 h' },
    SHORT_LINK_CLICK: { maxRequests: 60, window: '1 h' },
    FOLLOW: { maxRequests: 20, window: '1 m' },
    MENTION_HISTORY: { maxRequests: 120, window: '1 h' },
    ADMIN_MESSAGE_READ: { maxRequests: 60, window: '1 h' },
    NOTIFICATION_BROADCAST: { maxRequests: 10, window: '1 h' },
    NOTIFICATION_ARCHIVE: { maxRequests: 120, window: '1 h' },
    NOTIFICATION_MARK_SEEN: { maxRequests: 120, window: '1 h' },
    FEEDBACK: { maxRequests: 10, window: '1 h' },
    SHORT_LINK_CREATE: { maxRequests: 30, window: '1 h' },
    INVITE_ACTION: { maxRequests: 30, window: '1 h' },
    LIBRARY_SUBMISSION: { maxRequests: 10, window: '1 h' },
    CHANNEL_CREATE: { maxRequests: 5, window: '1 h' },
    CHECKOUT_CREATE: { maxRequests: 5, window: '1 h' },
  },
};

export const FULL_LIMITS: TttLimits = {
  mode: 'full',
  user: {
    maxCraftSkills: 24,
    maxOwnedWorkProjects: 25,
    maxAssociatedWorkProjects: 100,
  },
  workProject: {
    maxGuildSize: 250,
    maxFileFolders: 25,
    maxWorkFiles: 1000,
    maxWorkFileStorageBytes: 26_843_545_600, // 25 GiB
    maxWorkProjectAuditions: 10,
    maxCommissionListings: 10,
    maxChapters: 50,
    maxTuneTracks: 50,
    maxTelevisionEpisodes: 25,
  },
  hall: { maxSubmitBatch: 50 },
  batches: { trendingFeedProcessLimit: 1000, maxFeedbackSubmitters: 100 },
  rateLimits: {
    UPLOAD: { maxRequests: 30, window: '1 h' },
    VOTE: { maxRequests: 200, window: '1 h' },
    MODERATION: { maxRequests: 50, window: '1 h' },
    SENSITIVE_ACTION: { maxRequests: 5, window: '1 h' },
    DISPLAY_NAME_CHECK: { maxRequests: 20, window: '1 h' },
    CHAT_MESSAGE: { maxRequests: 150, window: '1 h' },
    ADMIN_TASK: { maxRequests: 60, window: '1 h' },
    APPEAL_REVIEW: { maxRequests: 30, window: '1 h' },
    BAN_ACTION: { maxRequests: 20, window: '1 h' },
    SHARE_TRANSFER: { maxRequests: 10, window: '1 h' },
    CONTENT_REPORT: { maxRequests: 20, window: '1 h' },
    SHORT_LINK_CLICK: { maxRequests: 60, window: '1 h' },
    FOLLOW: { maxRequests: 60, window: '1 m' },
    MENTION_HISTORY: { maxRequests: 120, window: '1 h' },
    ADMIN_MESSAGE_READ: { maxRequests: 60, window: '1 h' },
    NOTIFICATION_BROADCAST: { maxRequests: 10, window: '1 h' },
    NOTIFICATION_ARCHIVE: { maxRequests: 120, window: '1 h' },
    NOTIFICATION_MARK_SEEN: { maxRequests: 120, window: '1 h' },
    FEEDBACK: { maxRequests: 10, window: '1 h' },
    SHORT_LINK_CREATE: { maxRequests: 30, window: '1 h' },
    INVITE_ACTION: { maxRequests: 60, window: '1 h' },
    LIBRARY_SUBMISSION: { maxRequests: 20, window: '1 h' },
    CHANNEL_CREATE: { maxRequests: 20, window: '1 h' },
    CHECKOUT_CREATE: { maxRequests: 20, window: '1 h' },
  },
};

/** The resolved limit set for the deployed mode. Import THIS (or the alias
 * constants that re-export from it), never CHARTER_/FULL_ directly. */
export const ACTIVE_LIMITS: TttLimits = byMode(CHARTER_LIMITS, FULL_LIMITS);
