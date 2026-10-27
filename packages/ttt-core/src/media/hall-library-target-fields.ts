import type { FileOrigin } from './file-origin.js';
import {
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE,
  type HallContentSubItemSurface,
} from '../constants/hall-content-routing.js';
import { WORK_SECTION_PATHS_BY_TYPE, type WorkSectionPaths } from '../paths/work-section-paths.js';
import { WORK_PROJECT_TYPE_KEYS } from '../types/content.js';

export const HALL_LIBRARY_TARGET_FIELDS = {
  'hallLibrary-cover-square': 'coverSquareAssetId',
  'hallLibrary-cover-poster': 'coverPosterAssetId',
  'hallLibrary-cover-cinematic': 'coverCinematicAssetId',
  'chapter-photo': 'photoAssetId',
  'tune-track-photo': 'photoAssetId',
  'tune-track-audio': 'audioAssetId',
  'television-episode-photo': 'photoAssetId',
  'television-episode-video': 'videoAssetId',
} as const satisfies Partial<Record<FileOrigin, string>>;

export type HallLibraryFileOrigin = keyof typeof HALL_LIBRARY_TARGET_FIELDS;
export type HallLibraryTargetField = (typeof HALL_LIBRARY_TARGET_FIELDS)[HallLibraryFileOrigin];

export type HallLibraryCoverFileOrigin = Extract<
  HallLibraryFileOrigin,
  `hallLibrary-cover-${string}`
>;
export type HallLibrarySubItemFileOrigin = Exclude<
  HallLibraryFileOrigin,
  HallLibraryCoverFileOrigin
>;

export const HALL_LIBRARY_COVER_TARGET_FIELDS = {
  'hallLibrary-cover-square': HALL_LIBRARY_TARGET_FIELDS['hallLibrary-cover-square'],
  'hallLibrary-cover-poster': HALL_LIBRARY_TARGET_FIELDS['hallLibrary-cover-poster'],
  'hallLibrary-cover-cinematic': HALL_LIBRARY_TARGET_FIELDS['hallLibrary-cover-cinematic'],
} as const satisfies Pick<typeof HALL_LIBRARY_TARGET_FIELDS, HallLibraryCoverFileOrigin>;

export const HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS = {
  'chapter-photo': HALL_LIBRARY_TARGET_FIELDS['chapter-photo'],
  'tune-track-photo': HALL_LIBRARY_TARGET_FIELDS['tune-track-photo'],
  'tune-track-audio': HALL_LIBRARY_TARGET_FIELDS['tune-track-audio'],
  'television-episode-photo': HALL_LIBRARY_TARGET_FIELDS['television-episode-photo'],
  'television-episode-video': HALL_LIBRARY_TARGET_FIELDS['television-episode-video'],
} as const satisfies Pick<typeof HALL_LIBRARY_TARGET_FIELDS, HallLibrarySubItemFileOrigin>;

export const HALL_LIBRARY_SUB_ITEM_FILE_ORIGINS = Object.keys(
  HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS,
) as [HallLibrarySubItemFileOrigin, ...HallLibrarySubItemFileOrigin[]];

export type HallLibraryCoverTargetField =
  (typeof HALL_LIBRARY_COVER_TARGET_FIELDS)[HallLibraryCoverFileOrigin];
export type HallLibrarySubItemTargetField =
  (typeof HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS)[HallLibrarySubItemFileOrigin];

export type HallLibrarySubItemSurface = HallContentSubItemSurface;

export const HALL_LIBRARY_SUB_ITEM_SURFACE_BY_ORIGIN = {
  'chapter-photo': HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tales.subItemSurface,
  'tune-track-photo': HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.subItemSurface,
  'tune-track-audio': HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.subItemSurface,
  'television-episode-photo': HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Television.subItemSurface,
  'television-episode-video': HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Television.subItemSurface,
} as const satisfies Record<HallLibrarySubItemFileOrigin, HallLibrarySubItemSurface>;

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

export const HALL_LIBRARY_SUB_ITEM_MEDIA_SLOTS: Readonly<
  Record<HallLibrarySubItemFileOrigin, HallLibrarySubItemMediaSlot>
> = Object.freeze(
  Object.fromEntries(
    (Object.keys(HALL_LIBRARY_SUB_ITEM_SURFACE_BY_ORIGIN) as HallLibrarySubItemFileOrigin[]).map(
      (origin) => [
        origin,
        Object.freeze({
          surface: HALL_LIBRARY_SUB_ITEM_SURFACE_BY_ORIGIN[origin],
          ownerDoc: subItemBuilderForSurface(HALL_LIBRARY_SUB_ITEM_SURFACE_BY_ORIGIN[origin]),
          field: HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS[origin],
        }),
      ],
    ),
  ) as Record<HallLibrarySubItemFileOrigin, HallLibrarySubItemMediaSlot>,
);

export function isHallLibraryCoverFileOrigin(origin: string): origin is HallLibraryCoverFileOrigin {
  return Object.prototype.hasOwnProperty.call(HALL_LIBRARY_COVER_TARGET_FIELDS, origin);
}

export function isHallLibrarySubItemFileOrigin(
  origin: string,
): origin is HallLibrarySubItemFileOrigin {
  return Object.prototype.hasOwnProperty.call(HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS, origin);
}

function distinctFields<F extends string>(
  fieldsByOrigin: Readonly<Record<string, F>>,
): readonly F[] {
  return [...new Set(Object.values(fieldsByOrigin))];
}

export const HALL_LIBRARY_COVER_ASSET_FIELDS: readonly HallLibraryCoverTargetField[] =
  distinctFields(HALL_LIBRARY_COVER_TARGET_FIELDS);

export const HALL_LIBRARY_SUB_ITEM_ASSET_FIELDS: readonly HallLibrarySubItemTargetField[] =
  distinctFields(HALL_LIBRARY_SUB_ITEM_TARGET_FIELDS);
