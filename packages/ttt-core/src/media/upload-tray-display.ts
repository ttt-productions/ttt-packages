import type { FileOrigin } from './file-origin.js';

export const fileOriginRowLabel: Record<FileOrigin, string> = {
  'profile-picture': 'Profile picture',
  'craft-skill-media': 'Craft',
  squareStreetz: 'Square post',
  'commission-posting': 'Commission posting',
  'commission-proposal': 'Commission proposal',
  'audition-prompt': 'Audition',
  'admin-audition-prompt': 'Admin audition',
  'audition-entry': 'Audition entry',
  'audition-curated-option': 'Audition option',
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

export const UPLOAD_ROW_RELATIVE_TIME_CUTOFF_MS = 6 * 60 * 60 * 1000;

export const UPLOAD_ROW_DISPLAY_COPY = {
  justNow: 'just now',
  minutesAgo: (minutes: number) => `${minutes}m ago`,
  hoursAgo: (hours: number) => `${hours}h ago`,
  yesterdayAt: (time: string) => `Yesterday ${time}`,
  dateAt: (date: string, time: string) => `${date}, ${time}`,
  fileType: { image: 'Image', video: 'Video', audio: 'Audio', other: 'File' },
} as const;

export const MAX_UPLOADS_MARKED_SEEN_PER_CALL = 200;
