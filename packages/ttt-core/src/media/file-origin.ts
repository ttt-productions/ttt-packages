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
  // Realm cover art (square). Optional while a realm is a draft; REQUIRED to
  // release the realm — enforced in the realm release callable, not at founding
  // (realms are founded by a work; the image never blocks work creation).
  'realm-cover',
  'chapter-photo',
  'tune-track-photo',
  'tune-track-audio',
  'television-episode-photo',
  'television-episode-video',
  'guild-chat-message-attachment',
  'work-asset',
  // NCII / TAKE IT DOWN evidence upload (App-Check, no login). Preserved byte-exact,
  // never transcoded, never served — lands in the admin-only nciiEvidence bucket.
  'ncii-evidence',
]);

export type FileOrigin = z.infer<typeof FileOriginSchema>;

