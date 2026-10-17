import { describe, it, expect } from 'vitest';
import {
  fileOriginRowLabel,
  UPLOAD_ROW_DISPLAY_COPY,
  UPLOAD_ROW_RELATIVE_TIME_CUTOFF_MS,
  MAX_UPLOADS_MARKED_SEEN_PER_CALL,
} from '../src/media/upload-tray-display.js';
import { MarkUploadsSeenRequestSchema } from '../src/schemas/uploads.js';
import { FileOriginSchema } from '../src/media/file-origin.js';
import { AdminAuditionPromptTargetInfoSchema } from '../src/media/target-info.js';

describe('fileOriginRowLabel', () => {
  it('gives every canonical fileOrigin a non-empty label', () => {
    for (const origin of FileOriginSchema.options) {
      expect(fileOriginRowLabel[origin].length).toBeGreaterThan(0);
    }
  });

  it('labels the admin audition origin neutrally — it creates BOTH audition types', () => {
    // The origin's own target-info accepts platformAudition AND sponsoredAudition, so a
    // type-specific label (it used to say "Sponsored audition") is wrong half the time.
    const accepted = AdminAuditionPromptTargetInfoSchema.options.map((member) => member.shape.type.value);
    expect([...accepted].sort()).toEqual(['platformAudition', 'sponsoredAudition']);
    expect(fileOriginRowLabel['admin-audition-prompt']).toBe('Admin audition');
  });
});

describe('upload row display copy', () => {
  it('says each relative time and calendar day in the row words', () => {
    expect(UPLOAD_ROW_DISPLAY_COPY.justNow).toBe('just now');
    expect(UPLOAD_ROW_DISPLAY_COPY.minutesAgo(5)).toBe('5m ago');
    expect(UPLOAD_ROW_DISPLAY_COPY.hoursAgo(3)).toBe('3h ago');
    expect(UPLOAD_ROW_DISPLAY_COPY.yesterdayAt('3:42 PM')).toBe('Yesterday 3:42 PM');
    expect(UPLOAD_ROW_DISPLAY_COPY.dateAt('May 21', '3:42 PM')).toBe('May 21, 3:42 PM');
  });

  it('names every file kind', () => {
    expect(UPLOAD_ROW_DISPLAY_COPY.fileType).toEqual({ image: 'Image', video: 'Video', audio: 'Audio', other: 'File' });
  });

  it('keeps a row relative for six hours', () => {
    expect(UPLOAD_ROW_RELATIVE_TIME_CUTOFF_MS).toBe(6 * 60 * 60 * 1000);
  });
});

describe('MAX_UPLOADS_MARKED_SEEN_PER_CALL', () => {
  const ids = (count: number) => Array.from({ length: count }, (_, i) => `pm${i}`);

  it('is the mark-seen wire cap: a full call is accepted and one more id is refused', () => {
    expect(MarkUploadsSeenRequestSchema.safeParse({ pendingMediaIds: ids(MAX_UPLOADS_MARKED_SEEN_PER_CALL) }).success).toBe(true);
    expect(MarkUploadsSeenRequestSchema.safeParse({ pendingMediaIds: ids(MAX_UPLOADS_MARKED_SEEN_PER_CALL + 1) }).success).toBe(false);
  });
});
