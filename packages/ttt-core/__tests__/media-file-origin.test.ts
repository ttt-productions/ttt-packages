import { describe, it, expect } from 'vitest';
import { FileOriginSchema, type FileOrigin } from '../src/media/file-origin.js';

describe('FileOriginSchema', () => {
  it('accepts every known origin', () => {
    const origins: FileOrigin[] = [
      'profile-picture', 'craft-skill-media', 'squareStreetz', 'commission-posting',
      'commission-proposal', 'audition-prompt', 'audition-entry',
      'admin-audition-prompt', 'hallLibrary-cover-square',
      'hallLibrary-cover-poster', 'hallLibrary-cover-cinematic',
      'chapter-photo', 'tune-track-photo', 'tune-track-audio', 'television-episode-photo',
      'television-episode-video', 'guild-chat-message-attachment', 'work-asset',
    ];
    for (const o of origins) {
      expect(FileOriginSchema.parse(o)).toBe(o);
    }
  });

  it('rejects unknown origin', () => {
    expect(() => FileOriginSchema.parse('unknown')).toThrow();
  });
});

