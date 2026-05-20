import { describe, it, expect } from 'vitest';
import { FileOriginSchema, type FileOrigin } from '../src/media/file-origin.js';

describe('FileOriginSchema', () => {
  it('accepts every known origin', () => {
    const origins: FileOrigin[] = [
      'profile-picture', 'skill-media', 'streetz', 'job-posting',
      'job-reply', 'opportunity-prompt', 'opportunity-reply',
      'admin-opportunity-prompt', 'library-cover-square',
      'library-cover-poster', 'library-cover-cinematic',
      'chapter-photo', 'song-photo', 'song-audio', 'show-photo',
      'show-video', 'chat-attachment', 'project-file',
    ];
    for (const o of origins) {
      expect(FileOriginSchema.parse(o)).toBe(o);
    }
  });

  it('rejects unknown origin', () => {
    expect(() => FileOriginSchema.parse('unknown')).toThrow();
  });
});
