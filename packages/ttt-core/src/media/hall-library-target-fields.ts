import type { FileOrigin } from './file-origin.js';

// Server-side mapping from hallLibrary/sub-item fileOrigin to the doc field
// that receives the processed media URL.
//
// Owned in ttt-core because it's a contract fact about the upload
// pipeline — same tier as TTT_MEDIA_SPECS and PATH_BUILDERS. Frontend
// never reads this. Processors look the field up after deriving the
// target doc path from the typed IDs in targetInfo.
//
// The Partial<Record<FileOrigin, string>> constraint guarantees only
// valid FileOrigin strings are keys.
export const LIBRARY_TARGET_FIELDS = {
  'hallLibrary-cover-square':    'coverPhotoSquare',
  'hallLibrary-cover-poster':    'coverPhotoPoster',
  'hallLibrary-cover-cinematic': 'coverPhotoCinematic',
  'chapter-photo':           'photoUrl',
  'song-photo':              'photoUrl',
  'song-audio':              'fileUrl',
  'show-photo':              'photoUrl',
  'show-video':              'videoUrl',
} as const satisfies Partial<Record<FileOrigin, string>>;

export type LibraryFileOrigin = keyof typeof LIBRARY_TARGET_FIELDS;
export type LibraryTargetField = typeof LIBRARY_TARGET_FIELDS[LibraryFileOrigin];
