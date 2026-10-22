import type { WorkProjectType } from '../types/content.js';

export const HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE = {
  Tales: {
    detailSurface: 'tale',
    subItemSurface: 'chapter',
  },
  Tunes: {
    detailSurface: 'tune',
    subItemSurface: 'tuneTrack',
  },
  Television: {
    detailSurface: 'television',
    subItemSurface: 'televisionEpisode',
  },
} as const satisfies Record<
  WorkProjectType,
  { readonly detailSurface: string; readonly subItemSurface: string }
>;

export type HallContentDetailSurface =
  (typeof HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE)[WorkProjectType]['detailSurface'];

export type HallContentSubItemSurface =
  (typeof HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE)[WorkProjectType]['subItemSurface'];

export const HALL_CONTENT_DETAIL_SURFACES = [
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tales.detailSurface,
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.detailSurface,
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Television.detailSurface,
] as const satisfies readonly [HallContentDetailSurface, ...HallContentDetailSurface[]];

export const HALL_CONTENT_SUB_ITEM_SURFACES = [
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tales.subItemSurface,
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.subItemSurface,
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Television.subItemSurface,
] as const satisfies readonly [HallContentSubItemSurface, ...HallContentSubItemSurface[]];
