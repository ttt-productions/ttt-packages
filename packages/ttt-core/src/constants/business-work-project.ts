// WorkProject + subtype (Tales / Tunes / Television) business-rule constants.
import { ACTIVE_LIMITS } from './app-mode.js';

/** The absolute maximum number of stakes a workProject can have. */
export const MAX_WORK_PROJECT_STAKE_SHARES = 1000;

/** Maximum number of active guildmates per work project. Mode-varied. */
export const MAX_GUILD_SIZE = ACTIVE_LIMITS.workProject.maxGuildSize;

/**
 * Stake shares minted to the realm's founding-Work holder when a Work is
 * created into an EXISTING public realm. Counts toward MAX_WORK_PROJECT_STAKE_SHARES.
 */
export const EXISTING_REALM_STAKE_SHARES = 75;

// --- WorkProject Titles & Descriptions ---

/** Maximum length for a workProject title. */
export const MAX_WORK_PROJECT_TITLE_LENGTH = 150;

/** Maximum length for a workProject description. */
export const MAX_WORK_PROJECT_DESCRIPTION_LENGTH = 300;

/** Maximum number of file folders per workProject. Mode-varied. */
export const MAX_FILE_FOLDERS = ACTIVE_LIMITS.workProject.maxFileFolders;

/** Maximum number of files across a workProject's folders. Mode-varied. */
export const MAX_WORK_FILES = ACTIVE_LIMITS.workProject.maxWorkFiles;

/** Maximum total file-storage bytes per workProject. Mode-varied. */
export const MAX_WORK_FILE_STORAGE_BYTES = ACTIVE_LIMITS.workProject.maxWorkFileStorageBytes;

/** Allowed characters in titles: letters, numbers, spaces. */
export const TITLE_PATTERN = /^[a-zA-Z0-9 ]+$/;

/** Maximum number of auditions a single workProject can have open at once. Mode-varied. */
export const MAX_WORK_PROJECT_AUDITIONS = ACTIVE_LIMITS.workProject.maxWorkProjectAuditions;

// --- WorkProject Subtypes (Tales / Tunes / Television) ---
// Length aliases — kept as named exports so call sites read clearly.

export const MAX_TALE_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;
export const MAX_TALE_DESCRIPTION_LENGTH = MAX_WORK_PROJECT_DESCRIPTION_LENGTH;

export const MAX_TUNE_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;
export const MAX_TUNE_DESCRIPTION_LENGTH = MAX_WORK_PROJECT_DESCRIPTION_LENGTH;

export const MAX_TELEVISION_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;
export const MAX_TELEVISION_DESCRIPTION_LENGTH = MAX_WORK_PROJECT_DESCRIPTION_LENGTH;

/** Maximum number of chapters a Tale can have. Mode-varied. */
export const MAX_CHAPTERS = ACTIVE_LIMITS.workProject.maxChapters;

/** Maximum length for a chapter title. */
export const MAX_CHAPTER_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;

/** Maximum length for chapter body content. */
export const MAX_CHAPTER_CONTENT_LENGTH = 2500;

/** Maximum number of tracks a Tunes workProject can have. Mode-varied. */
export const MAX_TUNE_TRACKS = ACTIVE_LIMITS.workProject.maxTuneTracks;

/** Maximum length for a track title. */
export const MAX_TUNE_TRACK_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;

/** Maximum length for a track description. */
export const MAX_TUNE_TRACK_DESCRIPTION_LENGTH = MAX_WORK_PROJECT_DESCRIPTION_LENGTH;

/** Maximum number of episodes a Television workProject can have. Mode-varied. */
export const MAX_TELEVISION_EPISODES = ACTIVE_LIMITS.workProject.maxTelevisionEpisodes;

/** Maximum length for an episode title. */
export const MAX_TELEVISION_EPISODE_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;

/** Maximum length for an episode description. */
export const MAX_TELEVISION_EPISODE_DESCRIPTION_LENGTH = MAX_WORK_PROJECT_DESCRIPTION_LENGTH;
