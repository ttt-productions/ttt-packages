import type { FileOrigin } from './file-origin.js';
import {
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE,
  type HallContentSubItemSurface,
} from '../constants/hall-content-routing.js';
import { WORK_SECTION_PATHS_BY_TYPE, type WorkSectionPaths } from '../paths/work-section-paths.js';
import { WORK_PROJECT_TYPE_KEYS } from '../types/content.js';

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

/** The working sub-item surface addressed by a Hall-library sub-item upload. */
export type HallLibrarySubItemSurface = HallContentSubItemSurface;

/**
 * Canonical upload-origin → working-sub-item routing. The processor uses this to derive
 * publicationArgs, and the publication adapter uses the same declaration to reject a
 * malformed persisted job before it can attach a media field to the wrong document shape.
 */
export const HALL_LIBRARY_SUB_ITEM_SURFACE_BY_ORIGIN = {
  'chapter-photo': HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tales.subItemSurface,
  'tune-track-photo': HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.subItemSurface,
  'tune-track-audio': HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.subItemSurface,
  'television-episode-photo': HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Television.subItemSurface,
  'television-episode-video': HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Television.subItemSurface,
} as const satisfies Record<HallLibrarySubItemFileOrigin, HallLibrarySubItemSurface>;

/** Where one sub-item upload lands: the working surface it addresses, the canonical builder of
 *  that surface's sub-item document, and the field it fills. */
export interface HallLibrarySubItemMediaSlot {
  readonly surface: HallLibrarySubItemSurface;
  readonly ownerDoc: WorkSectionPaths['subItem'];
  readonly field: HallLibrarySubItemTargetField;
}

function subItemBuilderForSurface(surface: HallLibrarySubItemSurface): WorkSectionPaths['subItem'] {
  const workType = WORK_PROJECT_TYPE_KEYS.find(
    (type) => HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE[type].subItemSurface === surface,
  );
  if (!workType) throw new Error(`no Work type owns the sub-item surface ${surface}`);
  return WORK_SECTION_PATHS_BY_TYPE[workType].subItem;
}

/**
 * One entry per sub-item upload origin, derived from the routing and field maps above: a writer
 * takes the document it writes AND the field it fills from the same lookup, so the two cannot name
 * different origins, and a job whose addressed surface is not its entry's surface is refused.
 */
export const HALL_LIBRARY_SUB_ITEM_MEDIA_SLOTS: Readonly<Record<HallLibrarySubItemFileOrigin, HallLibrarySubItemMediaSlot>> =
  Object.freeze(
    Object.fromEntries(
      (Object.keys(HALL_LIBRARY_SUB_ITEM_SURFACE_BY_ORIGIN) as HallLibrarySubItemFileOrigin[]).map((origin) => [
        origin,
        Object.freeze({
          surface: HALL_LIBRARY_SUB_ITEM_SURFACE_BY_ORIGIN[origin],
          ownerDoc: subItemBuilderForSurface(HALL_LIBRARY_SUB_ITEM_SURFACE_BY_ORIGIN[origin]),
          field: HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS[origin],
        }),
      ]),
    ) as Record<HallLibrarySubItemFileOrigin, HallLibrarySubItemMediaSlot>,
  );

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


function distinctFields<F extends string>(fieldsByOrigin: Readonly<Record<string, F>>): readonly F[] {
  return [...new Set(Object.values(fieldsByOrigin))];
}

/** Every asset-reference field a Hall parent (the Work's tale / tune / television section, and its
 *  published Hall item) can carry — derived from the cover map, never restated. */
export const HALL_LIBRARY_COVER_ASSET_FIELDS: readonly HallLibraryCoverTargetField[] =
  distinctFields(HALL_LIBRARY_COVER_TARGET_FIELDS);

/** Every asset-reference field a chapter / track / episode can carry — derived from the sub-item
 *  map, never restated (several origins share one field, so each appears once). */
export const HALL_LIBRARY_SUB_ITEM_ASSET_FIELDS: readonly HallLibrarySubItemTargetField[] =
  distinctFields(HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS);
