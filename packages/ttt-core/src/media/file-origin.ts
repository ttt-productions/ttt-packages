import { z } from "zod";

export const FileOriginSchema = z.enum([
  'profile-picture',
  'craftSkill-media',
  'squareStreetz',
  'commission-posting',
  'commission-reply',
  'audition-prompt',
  'audition-reply',
  'admin-audition-prompt',
  'hallLibrary-cover-square',
  'hallLibrary-cover-poster',
  'hallLibrary-cover-cinematic',
  'chapter-photo',
  'song-photo',
  'song-audio',
  'show-photo',
  'show-video',
  'chat-attachment',
  'workProject-file',
]);

export type FileOrigin = z.infer<typeof FileOriginSchema>;
