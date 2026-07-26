// App mode + the charter/full limit sets — the single published constant that
// drives the whole app's cost posture. The flip to full-live is: change
// APP_MODE → publish ttt-core → install in ttt-prod (root + functions) →
// deploy. There is NO runtime mode flag and NO console toggle.
// See ttt-prod docs/design/charter-season-and-app-mode.md.
//
// Only real cost/abuse drivers vary by mode: media specs (ttt-media-specs.ts),
// rate-limit values, count caps, batch sizes. Text-length limits and payment
// min/max are deliberately mode-invariant — with ONE ruled exception (DJ
// 2026-07-13): chapter body content (maxChapterContentLength), because it
// bounds threshold-review reading effort per item during charter season.

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
    /** Chapter BODY length (chars) — the one mode-varied text limit (DJ 2026-07-13). */
    maxChapterContentLength: number;
    maxTuneTracks: number;
    maxTelevisionEpisodes: number;
  };
  /** Conversation Files container caps — PER CONVERSATION (one guild-invite
   *  conversation or one admin-support dispatch thread). Both scopes share one cap
   *  set; guild chat channels have no Conversation Files. DJ ruling 2026-07-25. */
  conversation: {
    /** Published active Conversation Files allowed in one conversation. */
    maxConversationFiles: number;
    /** Published STORED-OUTPUT bytes allowed in one conversation. */
    maxConversationFileStorageBytes: number;
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
    ADMIN_UPLOAD: RateLimitValue;
    CONTENT_WRITE: RateLimitValue;
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
    USER_LOOKUP: RateLimitValue;
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
    // ~5,000 words — a full real chapter, while keeping the human threshold-review
    // reading effort per item bounded during charter season.
    maxChapterContentLength: 30_000,
    maxTuneTracks: 5,
    maxTelevisionEpisodes: 3,
  },
  // Conversation Files are QUOTA'D PER CONVERSATION (DJ ruling 2026-07-25). Counted on
  // STORED OUTPUT bytes (what actually sits in R2 after transcode), never on raw upload
  // bytes. Rationale: a per-file `maxBytes` cap alone bounds one upload but nothing stops
  // unbounded accumulation across a long-running conversation — this is the abuse brake
  // on that, and it is what `startUpload`'s reservation and the publication transfer both
  // check. Charter: 10 files / 500 MiB per conversation.
  conversation: {
    maxConversationFiles: 10,
    maxConversationFileStorageBytes: 524_288_000, // 500 MiB
  },
  hall: { maxSubmitBatch: 10 },
  batches: { trendingFeedProcessLimit: 250, maxFeedbackSubmitters: 25 },
  rateLimits: {
    // Uploads are charged ONCE per upload (in startUpload); the processor-side
    // check is a non-charging guard.
    UPLOAD: { maxRequests: 15, window: '1 h' },
    // A separate HIGHER bucket for uploads performed through the sanctioned admin
    // authority path — never an exemption. Bulk admin setup work (creating 3
    // auditions is ~5 uploads) exhausts the 15/h user bucket; 60/h covers a real
    // bulk admin session while keeping a brake on a compromised admin token and on
    // third-party quota/cost (Vision / Video Intelligence / R2). DJ ruling 2026-07-25.
    ADMIN_UPLOAD: { maxRequests: 60, window: '1 h' },
    // General content-write throttle for the non-upload write callables (text posts,
    // craft-skill edits, support-thread starts) that used to charge UPLOAD. Sharing
    // the 15/h charter upload window meant heavy text posting blocked real uploads
    // and vice versa; a separate 30/h bucket keeps each cost driver on its own
    // ceiling. DJ ruling 2026-07-25.
    CONTENT_WRITE: { maxRequests: 30, window: '1 h' },
    VOTE: { maxRequests: 100, window: '1 h' },
    MODERATION: { maxRequests: 50, window: '1 h' },
    // 30/h: one bucket is shared by ~35 callables (register, become-artisan,
    // create-work, invites, trades, appeals, …) — a real first-hour artisan does
    // 10-15 legitimate sensitive actions; 5/h blocked the intended golden path
    // (proven live by the hosted-dev E2E, 2026-07-07). DJ ruling 2026-07-08.
    SENSITIVE_ACTION: { maxRequests: 30, window: '1 h' },
    // 120/h (charter): checkDisplayNameAvailable is enforceAppCheck:true, so
    // reCAPTCHA-Enterprise attestation is the real abuse gate — this bucket is a
    // cost/DoS ceiling, not the security boundary. It is IP-keyed (pre-registration,
    // no uid yet) and the register form fires it debounced-LIVE as you type, so one
    // legit registrant spends ~3-8 checks and shared NAT/CGNAT multiplies that across
    // everyone on the IP. The old 20/h false-rejected legitimate shared-IP users and
    // could not fit a full hosted-dev E2E suite run on one IP. DJ ruling 2026-07-21.
    DISPLAY_NAME_CHECK: { maxRequests: 120, window: '1 h' },
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
    // Admin exact-account lookup (searchPublicUsers / lookupUserByEmailOrUid) — a read, so a
    // generous per-minute bucket that still backstops a scripted enumeration sweep. Admin-only
    // and not a cost driver, so the value is the same in both modes (like MODERATION/ADMIN_TASK).
    USER_LOOKUP: { maxRequests: 30, window: '1 m' },
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
    // The intentional design ceiling (~17,000 words; trivially inside Firestore's
    // 1 MiB doc limit) — the audit trail deliberately stores field LENGTHS, not
    // content, because chapters can be this large (runUpdateChapterDetails).
    maxChapterContentLength: 100_000,
    maxTuneTracks: 50,
    maxTelevisionEpisodes: 25,
  },
  // 20 files / 1 GiB (full): the same per-conversation Conversation Files quota as
  // charter, scaled for a public-launch conversation. Still a hard ceiling on
  // unbounded R2 accumulation. See the CHARTER_LIMITS note above. DJ ruling 2026-07-25.
  conversation: {
    maxConversationFiles: 20,
    maxConversationFileStorageBytes: 1_073_741_824, // 1 GiB
  },
  hall: { maxSubmitBatch: 50 },
  batches: { trendingFeedProcessLimit: 1000, maxFeedbackSubmitters: 100 },
  rateLimits: {
    UPLOAD: { maxRequests: 30, window: '1 h' },
    // 120/h (full): the same sanctioned-admin-path upload bucket as charter, scaled
    // with UPLOAD — always HIGHER than the user bucket, never an exemption, so a
    // compromised admin token and third-party media cost stay bounded. See the
    // CHARTER_LIMITS note above. DJ ruling 2026-07-25.
    ADMIN_UPLOAD: { maxRequests: 120, window: '1 h' },
    // 60/h (full): the same non-upload content-write bucket as charter, scaled with
    // UPLOAD so text writes and media uploads never consume each other's ceiling.
    // See the CHARTER_LIMITS note above. DJ ruling 2026-07-25.
    CONTENT_WRITE: { maxRequests: 60, window: '1 h' },
    VOTE: { maxRequests: 200, window: '1 h' },
    MODERATION: { maxRequests: 50, window: '1 h' },
    // 60/h: full-mode power users managing several works do dozens of legitimate
    // management actions per hour; still a hard backstop against scripts.
    // DJ ruling 2026-07-08 (charter 30 / full 60, single bucket; a bucket split
    // is filed post-launch in ttt-prod docs/post-launch/).
    SENSITIVE_ACTION: { maxRequests: 60, window: '1 h' },
    // 300/h (full): same reasoning as the charter value above (App-Check-gated
    // cost ceiling, IP-keyed, debounced-live). Public-launch CGNAT exposure is far
    // larger — hundreds of concurrent legit registrants can sit behind one carrier
    // IP — so err generous; the only cost of "too high" is trivial Firestore reads,
    // while "too low" false-rejects real users. Raise on evidence (watch prod logs
    // for legit 429s) rather than pre-emptively tightening. DJ ruling 2026-07-21.
    DISPLAY_NAME_CHECK: { maxRequests: 300, window: '1 h' },
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
    // Admin exact-account lookup — same read bucket in both modes (see CHARTER_LIMITS note).
    USER_LOOKUP: { maxRequests: 30, window: '1 m' },
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
