// What an admin's upload tray shows for one upload row: what it was for, the file's kind, and when it
// was accepted.

import type { FileOrigin } from './file-origins.js';

/** The tray row's title for each origin's upload. */
export const fileOriginRowLabel: Record<FileOrigin, string> = {
  'league-picture': 'League picture',
  'team-picture': 'Team picture',
  'landing-picture': 'Landing picture',
  'location-picture': 'Venue picture',
  'award-badge': 'Award badge',
  // A signature never rides the upload tray: it is kept by its signing callable, with no upload row.
  'waiver-signature': 'Waiver signature',
  'hardware-signature': 'Hardware contract signature',
};

/** How long an upload row's time reads as relative ("5m ago") before it reads as a clock time. */
export const UPLOAD_ROW_RELATIVE_TIME_CUTOFF_MS = 6 * 60 * 60 * 1000;

/** An upload row's words for its time and its file's kind, for upload-ui's `createUploadDisplayFormatters`. */
export const UPLOAD_ROW_DISPLAY_COPY = {
  justNow: 'just now',
  minutesAgo: (minutes: number) => `${minutes}m ago`,
  hoursAgo: (hours: number) => `${hours}h ago`,
  yesterdayAt: (time: string) => `Yesterday ${time}`,
  dateAt: (date: string, time: string) => `${date}, ${time}`,
  fileType: { image: 'Image', video: 'Video', audio: 'Audio', other: 'File' },
} as const;
