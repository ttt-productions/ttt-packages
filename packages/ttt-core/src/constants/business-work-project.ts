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

/** Maximum length for a workProject description (DJ ruling 2026-07-13: 1000 — room for
 *  a real paragraph; browse cards render a truncated excerpt with click-to-expand). */
export const MAX_WORK_PROJECT_DESCRIPTION_LENGTH = 1000;

// --- Work Realm titles & descriptions ---
// Aliases of the workProject pair — realms share the platform title/description limits.
// NOTE: a realm working title doubles as the `reservedRealmNames/{UPPER(title)}` doc ID,
// so realmWorkingTitleSchema layers doc-ID character rules on top of this length.

export const MAX_WORK_REALM_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;
export const MAX_WORK_REALM_DESCRIPTION_LENGTH = MAX_WORK_PROJECT_DESCRIPTION_LENGTH;

/** Maximum length for a work-project file-folder name. */
export const MAX_FILE_FOLDER_NAME_LENGTH = 100;

/** Maximum number of file folders per workProject. Mode-varied. */
export const MAX_FILE_FOLDERS = ACTIVE_LIMITS.workProject.maxFileFolders;

/** Maximum number of files across a workProject's folders. Mode-varied. */
export const MAX_WORK_FILES = ACTIVE_LIMITS.workProject.maxWorkFiles;

/** Maximum total file-storage bytes per workProject. Mode-varied. */
export const MAX_WORK_FILE_STORAGE_BYTES = ACTIVE_LIMITS.workProject.maxWorkFileStorageBytes;

/**
 * Maximum number of shared-file folders a Realm steward may create
 * (`workRealms/{workRealmId}/realmFileFolders`).
 *
 * Bounded on purpose: the folder collection is read WHOLE by the gallery projection, by the
 * folder-cap check, and by the case-insensitive name-uniqueness check, so an unbounded
 * collection would turn each of those into an unbounded read. 30 is generous for organizing
 * one Realm's shared pool (Realm folders have no access lists — they are purely
 * organizational) while keeping every one of those reads a single bounded page.
 *
 * NOT mode-varied: unlike the Work-side caps this is an organizational bound on steward
 * housekeeping, not a charter-vs-full consumption allowance.
 *
 * Realm folder NAMES reuse MAX_FILE_FOLDER_NAME_LENGTH above — one folder-name rule
 * platform-wide; there is deliberately no second realm-specific length.
 */
export const MAX_REALM_FILE_FOLDERS = 30;

/**
 * Maximum length of a realm-file promotion `requestId`.
 *
 * This is the FIRST client-minted, client-CHOSEN id in the set that is durably PERSISTED:
 * it lands on the `mediaAssets` doc, in the audit payload, in notification metadata, and in
 * the notification aggregation key. Every one of those is an attacker-reachable write
 * amplification if the id is unbounded, so the bound belongs on the atom, not on each
 * call site.
 *
 * 64 is the smallest bound that comfortably fits what the client actually mints — a
 * `crypto.randomUUID()` is 36 characters — while leaving room for a prefixed variant. It is
 * deliberately TIGHTER than the 200-character opaque-id cap the admin chat-moderation
 * requestIds use (`schemas/chat.ts`): those carry composite operator-supplied ids, whereas
 * this one is always a generated UUID.
 */
export const MAX_REALM_FILE_SHARE_REQUEST_ID_LENGTH = 64;

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

/** Maximum length for chapter body content. Mode-varied (charter 30k / full 100k) —
 *  the ONE mode-varied text limit (DJ 2026-07-13); the flip raises it automatically. */
export const MAX_CHAPTER_CONTENT_LENGTH = ACTIVE_LIMITS.workProject.maxChapterContentLength;

/** Chapter-body EXCERPT length for preview rows (hall reading view chapter list). */
export const CHAPTER_EXCERPT_LENGTH = 180;

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
