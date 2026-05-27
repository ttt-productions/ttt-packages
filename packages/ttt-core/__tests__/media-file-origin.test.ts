import { describe, it, expect } from 'vitest';
import { FileOriginSchema, type FileOrigin } from '../src/media/file-origin.js';

describe('FileOriginSchema', () => {
  it('accepts every known origin', () => {
    const origins: FileOrigin[] = [
      'profile-picture', 'craftSkill-media', 'squareStreetz', 'commission-posting',
      'commission-reply', 'audition-prompt', 'audition-reply',
      'admin-audition-prompt', 'hallLibrary-cover-square',
      'hallLibrary-cover-poster', 'hallLibrary-cover-cinematic',
      'chapter-photo', 'song-photo', 'song-audio', 'show-photo',
      'show-video', 'chat-attachment', 'workProject-file',
    ];
    for (const o of origins) {
      expect(FileOriginSchema.parse(o)).toBe(o);
    }
  });

  it('rejects unknown origin', () => {
    expect(() => FileOriginSchema.parse('unknown')).toThrow();
  });
});
