import type { FileOrigin } from './file-origin.js';

// =============================================================================
// User-facing labels per fileOrigin
// =============================================================================
//
// Generic labels for upload tray rows. Same regardless of platform (web,
// iOS, Android, smart TV) since they describe TTT domain entities.

export const fileOriginRowLabel: Record<FileOrigin, string> = {
  'profile-picture': 'Profile picture',
  'craft-skill-media': 'Craft',
  'squareStreetz': 'Square post',
  'commission-posting': 'Commission posting',
  'commission-proposal': 'Commission proposal',
  'audition-prompt': 'Audition',
  // Neutral on purpose: this origin creates BOTH Platform and Sponsored auditions
  // (AdminAuditionPromptTargetInfoSchema.type), so it cannot borrow either settled
  // AUDITION_TYPES label without lying about half its uploads.
  'admin-audition-prompt': 'Admin audition',
  'audition-entry': 'Audition entry',
  'hallLibrary-cover-square': 'Work cover',
  'hallLibrary-cover-poster': 'Work cover',
  'hallLibrary-cover-cinematic': 'Work cover',
  'realm-cover': 'Realm cover',
  'chapter-photo': 'Chapter photo',
  'tune-track-photo': 'Track photo',
  'tune-track-audio': 'Track audio',
  'television-episode-photo': 'Episode photo',
  'television-episode-video': 'Episode video',
  'work-asset': 'Work asset',
  'conversation-file': 'Conversation file',
  'system-content': 'System video',
  'ncii-evidence': 'Take-it-down evidence',
};

// =============================================================================
// Row time and file kind
// =============================================================================
//
// The words and cutoff the app hands upload-ui's `createUploadDisplayFormatters`.

/** How long an upload row's time reads as relative ("5m ago") before it reads as a clock time. */
export const UPLOAD_ROW_RELATIVE_TIME_CUTOFF_MS = 6 * 60 * 60 * 1000;

/** An upload row's words for its time and its file's kind. */
export const UPLOAD_ROW_DISPLAY_COPY = {
  justNow: 'just now',
  minutesAgo: (minutes: number) => `${minutes}m ago`,
  hoursAgo: (hours: number) => `${hours}h ago`,
  yesterdayAt: (time: string) => `Yesterday ${time}`,
  dateAt: (date: string, time: string) => `${date}, ${time}`,
  fileType: { image: 'Image', video: 'Video', audio: 'Audio', other: 'File' },
} as const;

// =============================================================================
// Marking rows seen
// =============================================================================

/** The most uploads one `markUploadsSeen` call marks seen; a larger unseen set goes in calls of this size. */
export const MAX_UPLOADS_MARKED_SEEN_PER_CALL = 200;
