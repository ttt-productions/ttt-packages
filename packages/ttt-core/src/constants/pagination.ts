// Pagination page sizes and hallLibrary UX constants.
import { ACTIVE_LIMITS } from './app-mode.js';

/** Default pagination size when no other size applies. */
export const ITEMS_PER_PAGE_GENERAL = 5;

export const ITEMS_PER_PAGE_MESSAGES = 5;
export const ITEMS_PER_PAGE_ADMIN_DISPATCH_MESSAGES = 6;
export const ITEMS_PER_PAGE_COMMISSION_BOARD = 5;
export const ITEMS_PER_PAGE_GUILDMATE_USERS = 3;
export const ITEMS_PER_PAGE_GUILD_INVITES = 10;
export const ITEMS_PER_PAGE_OWNED_WORK_PROJECTS = 3;
export const ITEMS_PER_PAGE_ASSOCIATED_WORK_PROJECTS = 3;
export const ITEMS_PER_PAGE_CHAPTERS = 5;
export const ITEMS_PER_PAGE_TUNE_TRACKS = 3;
export const ITEMS_PER_PAGE_TELEVISION_EPISODES = 3;
export const ITEMS_PER_PAGE_PROPOSAL_ARTISANS = 5;
export const ITEMS_PER_PAGE_FOLLOWED_USERS = 10;
export const ITEMS_PER_PAGE_ADMIN_DISPATCH_THREADS = 10;

// --- Hook-specific page sizes ---

/** Page size for the pledge-payments list hook. */
export const PLEDGE_PAYMENTS_PER_PAGE = 20;

/** Page size for the pending-media archive list hook. */
export const ARCHIVE_PER_PAGE = 10;

/** Page size for the workProject-channels list hook. */
export const CHANNELS_PER_PAGE = 10;

/** Page size for the social feed hook. */
export const POSTS_PER_PAGE = 20;

/** Page size for the content-violation list hook. */
export const VIOLATIONS_PER_PAGE = 5;

/** Page size for the craft-skills list hook. */
export const CRAFT_SKILL_MEDIA_PER_PAGE = 12;

/**
 * Hard page limit for the Realm shared-files gallery projection (`getRealmSharedFiles`).
 * The query was previously unbounded; this is the named cap the input schema derives its
 * `limit` bound from and the server clamps to, so one Realm's pool can never be read (or
 * requested) in a single unbounded page. Matches the card-grid rhythm of the gallery.
 */
export const REALM_SHARED_FILES_PAGE_LIMIT = 24;

/**
 * Hard page limit for the steward/admin realm-file promotion queue
 * (`getRealmFilePromotionQueue`). Smaller than the gallery page: the queue is a decision
 * surface a steward works through, not a browse grid.
 */
export const REALM_FILE_PROMOTION_QUEUE_PAGE_LIMIT = 20;

/** Maximum number of recent posts the trending-feed scheduled commission processes per run. Mode-varied. */
export const TRENDING_FEED_PROCESS_LIMIT = ACTIVE_LIMITS.batches.trendingFeedProcessLimit;

// --- HallLibrary UX constants ---

/** HallLibrary page-level UX values (page size, recency window, search debounce, per-item tag cap). */
export const HALL_LIBRARY_PAGE_CONSTANTS = {
  ITEMS_PER_PAGE: 20,
  MAX_RECENT_VIEWS: 50,
  MAX_TAGS_PER_ITEM: 10,
  SEARCH_DEBOUNCE_MS: 300,
} as const;

