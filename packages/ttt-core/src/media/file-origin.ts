import { z } from "zod";

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
  'chapter-photo',
  'tune-track-photo',
  'tune-track-audio',
  'television-episode-photo',
  'television-episode-video',
  'guild-chat-message-attachment',
  'work-asset',
]);

export type FileOrigin = z.infer<typeof FileOriginSchema>;

