// What an admin's upload tray shows for one upload row: what it was for, the file's kind, and when it
// was accepted.

import { getSimplifiedMediaType } from '@ttt-productions/media-schemas';
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

/** How long a row's time reads as relative ("5m ago") before it reads as a clock time. */
export const DEFAULT_RELATIVE_TIME_CUTOFF_MS = 6 * 60 * 60 * 1000;

/**
 * An upload's accept time for a tray row. Within `cutoffMs` of now: "just now", "Xm ago", "Xh ago".
 * Older: the local time today, "Yesterday" and the time, or a short date and the time.
 */
export function formatUploadTimestamp(
  createdAtMs: number,
  nowMs: number,
  cutoffMs: number = DEFAULT_RELATIVE_TIME_CUTOFF_MS,
): string {
  const diffMs = Math.max(0, nowMs - createdAtMs);

  if (diffMs < cutoffMs) {
    if (diffMs < 60_000) return 'just now';
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(diffMs / 3_600_000);
    return `${hours}h ago`;
  }

  const created = new Date(createdAtMs);
  const now = new Date(nowMs);
  const timeStr = created.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const sameDay =
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate();
  if (sameDay) return timeStr;

  const yesterday = new Date(nowMs - 24 * 60 * 60 * 1000);
  const isYesterday =
    created.getFullYear() === yesterday.getFullYear() &&
    created.getMonth() === yesterday.getMonth() &&
    created.getDate() === yesterday.getDate();
  if (isYesterday) return `Yesterday ${timeStr}`;

  const dateStr = created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${dateStr}, ${timeStr}`;
}

/** The file's kind for a tray row, from its stored content type; `null` when it has none. */
export function getFileTypeLabel(contentType: string | undefined): string | null {
  if (!contentType) return null;
  switch (getSimplifiedMediaType(contentType)) {
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    default:
      return 'File';
  }
}
