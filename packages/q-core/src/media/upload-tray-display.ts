import type { FileOrigin } from './file-origins.js';

export const fileOriginRowLabel: Record<FileOrigin, string> = {
  'league-picture': 'League picture',
  'team-picture': 'Team picture',
  'landing-picture': 'Landing picture',
  'location-picture': 'Venue picture',
  'award-badge': 'Award badge',
  'waiver-signature': 'Waiver signature',
  'hardware-signature': 'Hardware contract signature',
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
