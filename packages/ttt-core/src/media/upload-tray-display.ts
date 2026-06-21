import type { FileOrigin } from './file-origin.js';
import { getSimplifiedMediaType } from '@ttt-productions/media-schemas';

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
  'admin-audition-prompt': 'Sponsored audition',
  'audition-entry': 'Audition entry',
  'hallLibrary-cover-square': 'Work cover',
  'hallLibrary-cover-poster': 'Work cover',
  'hallLibrary-cover-cinematic': 'Work cover',
  'chapter-photo': 'Chapter photo',
  'tune-track-photo': 'Track photo',
  'tune-track-audio': 'Track audio',
  'television-episode-photo': 'Episode photo',
  'television-episode-video': 'Episode video',
  'work-asset': 'Work asset',
  'guild-chat-message-attachment': 'Guild chat attachment',
  'ncii-evidence': 'Take-it-down evidence',
};

// =============================================================================
// Timestamp formatting
// =============================================================================
//
// Cutoff after which the upload row stops showing relative time
// ("2 minutes ago") and switches to absolute local time ("3:42 PM").
// Default: 6 hours.

export const DEFAULT_RELATIVE_TIME_CUTOFF_MS = 6 * 60 * 60 * 1000;

/**
 * Format an upload's createdAt timestamp for display in a tray row.
 *
 * - Within `cutoffMs` of now: relative ("just now", "Xm ago", "Xh ago").
 * - Older: absolute local time. Today: "3:42 PM". Yesterday: "Yesterday 3:42 PM".
 *   Older: short date + time, e.g. "May 21, 3:42 PM".
 *
 * Both `createdAtMs` and `nowMs` are millisecond epochs.
 */
export function formatUploadTimestamp(
  createdAtMs: number,
  nowMs: number,
  cutoffMs: number = DEFAULT_RELATIVE_TIME_CUTOFF_MS,
): string {
  const diffMs = Math.max(0, nowMs - createdAtMs);

  if (diffMs < cutoffMs) {
    // Relative path.
    if (diffMs < 60_000) return 'just now';
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(diffMs / 3_600_000);
    return `${hours}h ago`;
  }

  // Absolute path.
  const created = new Date(createdAtMs);
  const now = new Date(nowMs);

  const timeStr = created.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

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

  const dateStr = created.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return `${dateStr}, ${timeStr}`;
}

// =============================================================================
// File type labeling
// =============================================================================
//
// Friendly label for a content type string. Wraps getSimplifiedMediaType
// from media-schemas with capitalization for tray display.
// Returns null when contentType is undefined/empty.

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

