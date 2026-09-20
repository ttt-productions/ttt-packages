import type { FileOrigin } from './file-origin.js';

// Server-side mapping from hallLibrary/sub-item fileOrigin to the doc field
// that receives the processed media-asset reference (never a URL — see
// ttt-prod docs/design/media-assets-and-protected-serving.md).
//
// Owned in ttt-core because it's a contract fact about the upload
// pipeline — same tier as TTT_MEDIA_SPECS and PATH_BUILDERS. Frontend
// never reads this. Processors look the field up after deriving the
// target doc path from the typed IDs in targetInfo.
//
// The Partial<Record<FileOrigin, string>> constraint guarantees only
// valid FileOrigin strings are keys.
export const HALL_LIBRARY_TARGET_FIELDS = {
  'hallLibrary-cover-square':    'coverSquareAssetId',
  'hallLibrary-cover-poster':    'coverPosterAssetId',
  'hallLibrary-cover-cinematic': 'coverCinematicAssetId',
  'chapter-photo':           'photoAssetId',
  'tune-track-photo':              'photoAssetId',
  'tune-track-audio':              'audioAssetId',
  'television-episode-photo':              'photoAssetId',
  'television-episode-video':              'videoAssetId',
} as const satisfies Partial<Record<FileOrigin, string>>;

export type HallLibraryFileOrigin = keyof typeof HALL_LIBRARY_TARGET_FIELDS;
export type HallLibraryTargetField = typeof HALL_LIBRARY_TARGET_FIELDS[HallLibraryFileOrigin];

// The same map split by WRITE LEVEL. A cover origin attaches its field on the hall
// PARENT (the Work's tale/tune/television section doc); a sub-item origin attaches on a
// chapter / track / episode doc. A processor owns exactly one level, so indexing the whole
// map there types the write against fields the document it writes never declares.
//
// Both subsets are derived from the one map above — no field name is restated — and the
// `satisfies Pick<...>` constraints close the partition at compile time: an origin added to
// the parent map lands in one of the two key unions and fails to build until it is listed.
export type HallLibraryCoverFileOrigin =
  Extract<HallLibraryFileOrigin, `hallLibrary-cover-${string}`>;
export type HallLibrarySubItemFileOrigin =
  Exclude<HallLibraryFileOrigin, HallLibraryCoverFileOrigin>;

export const HALL_LIBRARY_COVER_TARGET_FIELDS = {
  'hallLibrary-cover-square':    HALL_LIBRARY_TARGET_FIELDS['hallLibrary-cover-square'],
  'hallLibrary-cover-poster':    HALL_LIBRARY_TARGET_FIELDS['hallLibrary-cover-poster'],
  'hallLibrary-cover-cinematic': HALL_LIBRARY_TARGET_FIELDS['hallLibrary-cover-cinematic'],
} as const satisfies Pick<typeof HALL_LIBRARY_TARGET_FIELDS, HallLibraryCoverFileOrigin>;

export const HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS = {
  'chapter-photo':            HALL_LIBRARY_TARGET_FIELDS['chapter-photo'],
  'tune-track-photo':         HALL_LIBRARY_TARGET_FIELDS['tune-track-photo'],
  'tune-track-audio':         HALL_LIBRARY_TARGET_FIELDS['tune-track-audio'],
  'television-episode-photo': HALL_LIBRARY_TARGET_FIELDS['television-episode-photo'],
  'television-episode-video': HALL_LIBRARY_TARGET_FIELDS['television-episode-video'],
} as const satisfies Pick<typeof HALL_LIBRARY_TARGET_FIELDS, HallLibrarySubItemFileOrigin>;

export type HallLibraryCoverTargetField =
  typeof HALL_LIBRARY_COVER_TARGET_FIELDS[HallLibraryCoverFileOrigin];
export type HallLibrarySubItemTargetField =
  typeof HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS[HallLibrarySubItemFileOrigin];

/** True when the origin writes a cover field on the hall parent / Work section doc. */
export function isHallLibraryCoverFileOrigin(
  origin: string,
): origin is HallLibraryCoverFileOrigin {
  return Object.prototype.hasOwnProperty.call(HALL_LIBRARY_COVER_TARGET_FIELDS, origin);
}

/** True when the origin writes a media field on a chapter / track / episode doc. */
export function isHallLibrarySubItemFileOrigin(
  origin: string,
): origin is HallLibrarySubItemFileOrigin {
  return Object.prototype.hasOwnProperty.call(HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS, origin);
}

