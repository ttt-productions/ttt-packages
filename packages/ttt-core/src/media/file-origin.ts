import { z } from 'zod';

export const FileOriginSchema = z.enum([
  'profile-picture',
  'craft-skill-media',
  'squareStreetz',
  'commission-posting',
  'commission-proposal',
  'audition-prompt',
  'audition-entry',
  'admin-audition-prompt',
  'hallLibrary-cover-square',
  'hallLibrary-cover-poster',
  'hallLibrary-cover-cinematic',
  'realm-cover',
  'chapter-photo',
  'tune-track-photo',
  'tune-track-audio',
  'television-episode-photo',
  'television-episode-video',
  'conversation-file',
  'work-asset',
  'system-content',
  'ncii-evidence',
]);

export type FileOrigin = z.infer<typeof FileOriginSchema>;
