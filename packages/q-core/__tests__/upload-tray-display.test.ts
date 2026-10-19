import { describe, it, expect } from 'vitest';
import { FILE_ORIGIN_KEYS } from '../src/media/file-origins.js';
import {
  fileOriginRowLabel,
  UPLOAD_ROW_DISPLAY_COPY,
  UPLOAD_ROW_RELATIVE_TIME_CUTOFF_MS,
} from '../src/media/upload-tray-display.js';

describe('fileOriginRowLabel', () => {
  it('gives every canonical file origin a non-empty label', () => {
    for (const origin of FILE_ORIGIN_KEYS) {
      expect(fileOriginRowLabel[origin].length).toBeGreaterThan(0);
    }
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
    expect(UPLOAD_ROW_DISPLAY_COPY.fileType).toEqual({
      image: 'Image',
      video: 'Video',
      audio: 'Audio',
      other: 'File',
    });
  });

  it('keeps a row relative for six hours', () => {
    expect(UPLOAD_ROW_RELATIVE_TIME_CUTOFF_MS).toBe(6 * 60 * 60 * 1000);
  });
});
