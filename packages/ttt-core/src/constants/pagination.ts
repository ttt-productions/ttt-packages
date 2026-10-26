import { ACTIVE_LIMITS } from './app-mode.js';

export const ITEMS_PER_PAGE_GENERAL: number = 5;

export const ITEMS_PER_PAGE_MESSAGES: number = 5;
export const ITEMS_PER_PAGE_ADMIN_DISPATCH_MESSAGES: number = 6;
export const ITEMS_PER_PAGE_COMMISSION_BOARD: number = 5;
export const ITEMS_PER_PAGE_GUILDMATE_USERS: number = 3;
export const ITEMS_PER_PAGE_GUILD_INVITES: number = 10;
export const ITEMS_PER_PAGE_OWNED_WORK_PROJECTS: number = 3;
export const ITEMS_PER_PAGE_ASSOCIATED_WORK_PROJECTS: number = 3;
export const ITEMS_PER_PAGE_CHAPTERS: number = 5;
export const ITEMS_PER_PAGE_TUNE_TRACKS: number = 3;
export const ITEMS_PER_PAGE_TELEVISION_EPISODES: number = 3;
export const ITEMS_PER_PAGE_PROPOSAL_ARTISANS: number = 5;
export const ITEMS_PER_PAGE_FOLLOWED_USERS: number = 10;
export const ITEMS_PER_PAGE_ADMIN_DISPATCH_THREADS: number = 10;
export const ITEMS_PER_PAGE_ADMIN_DISPATCH_BROWSE: number = 12;
export const ITEMS_PER_PAGE_ADMIN_TASK_BROWSE: number = 12;

export const PLEDGE_PAYMENTS_PER_PAGE: number = 20;

export const ARCHIVE_PER_PAGE: number = 10;

export const CHANNELS_PER_PAGE: number = 10;

export const POSTS_PER_PAGE: number = 20;

export const VIOLATIONS_PER_PAGE: number = 5;

export const CRAFT_SKILL_MEDIA_PER_PAGE: number = 12;

export const ITEMS_PER_PAGE_REALM_WORKS: number = 12;

export const REALM_SHARED_FILES_PAGE_LIMIT: number = 24;

export const REALM_FILE_PROMOTION_QUEUE_PAGE_LIMIT: number = 20;

export const TRENDING_FEED_PROCESS_LIMIT = ACTIVE_LIMITS.batches.trendingFeedProcessLimit;

export const HALL_LIBRARY_PAGE_CONSTANTS = {
  ITEMS_PER_PAGE: 20,
  MAX_RECENT_VIEWS: 50,
  MAX_TAGS_PER_ITEM: 10,
  SEARCH_DEBOUNCE_MS: 300,
} as const;

export const SAFETY_CASE_TRAY_COUNT_CAP: number = 100;

export const SAFETY_CASE_TRAY_READ_LIMIT = SAFETY_CASE_TRAY_COUNT_CAP + 1;

export function formatSafetyCaseTrayCount(loadedRows: number): string {
  return loadedRows > SAFETY_CASE_TRAY_COUNT_CAP
    ? `${SAFETY_CASE_TRAY_COUNT_CAP}+`
    : String(loadedRows);
}
