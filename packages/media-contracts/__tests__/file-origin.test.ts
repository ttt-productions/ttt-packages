import { describe, it, expect } from 'vitest';
import type { FileOrigin } from '../src/file-origin.js';

// Runtime list mirroring the FileOrigin type union. Must stay in sync.
// If you add a value to FileOrigin, add it here too (and TS will help enforce).
const ALL_FILE_ORIGINS: readonly FileOrigin[] = [
  'profile-picture',
  'skill-media',
  'streetz',
  'job-posting',
  'job-reply',
  'opportunity-prompt',
  'opportunity-reply',
  'library-cover-square',
  'library-cover-poster',
  'library-cover-cinematic',
  'chapter-photo',
  'song-photo',
  'song-audio',
  'show-photo',
  'show-video',
  'chat-attachment',
] as const;

// Kebab-case: lowercase letters, digits, and hyphens only. Must start with a letter.
// No uppercase, no underscores, no spaces, no leading/trailing/double hyphens.
const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

describe('FileOrigin', () => {
  it('has exactly 16 values', () => {
    expect(ALL_FILE_ORIGINS.length).toBe(16);
  });

  it('has no duplicate values', () => {
    const set = new Set(ALL_FILE_ORIGINS);
    expect(set.size).toBe(ALL_FILE_ORIGINS.length);
  });

  it.each(ALL_FILE_ORIGINS)('%s is valid kebab-case', (origin) => {
    expect(origin).toMatch(KEBAB_CASE);
  });

  it('does not contain any deprecated origins', () => {
    const deprecated = [
      'profilePicture',
      'skill',
      'library-cover-tales',
      'library-cover-tunes',
      'library-cover-television',
    ];
    for (const d of deprecated) {
      expect(ALL_FILE_ORIGINS).not.toContain(d as FileOrigin);
    }
  });
});
