import { z } from "zod";

export const FileOriginSchema = z.enum([
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
  'project-file',
]);

export type FileOrigin = z.infer<typeof FileOriginSchema>;
