// Pagination page sizes and hallLibrary UX constants.

/** Default pagination size when no other size applies. */
export const ITEMS_PER_PAGE_GENERAL = 5;

export const ITEMS_PER_PAGE_MESSAGES = 5;
export const ITEMS_PER_PAGE_SYSTEM_MESSAGES = 6;
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
export const ITEMS_PER_PAGE_ADMIN_SYSTEM_MESSAGES = 10;

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
export const SKILLS_PER_PAGE = 12;

/** Maximum number of recent posts the trending-feed scheduled commission processes per run. */
export const TRENDING_FEED_PROCESS_LIMIT = 500;

// --- HallLibrary UX constants ---

/** HallLibrary page-level UX values (page size, recency window, search debounce, per-item tag cap). */
export const LIBRARY_CONSTANTS = {
  ITEMS_PER_PAGE: 20,
  MAX_RECENT_VIEWS: 50,
  MAX_TAGS_PER_ITEM: 10,
  SEARCH_DEBOUNCE_MS: 300,
} as const;

