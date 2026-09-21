import type { WorkProjectType } from '../types/content.js';

/**
 * Canonical identities for the Hall detail and sub-item surfaces owned by each Work type.
 * Higher-level routing maps project fields and upload origins from this table so the surface
 * literals are declared once without creating a constants <-> media dependency cycle.
 */
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

/**
 * The detail-surface identities as a typed, non-empty tuple PROJECTED from the map above, so a
 * `z.enum(...)` or option list consumes the canonical names instead of restating them. A package
 * test proves the tuple still equals the map's projection, so a new work type cannot leave an
 * enum-shaped consumer behind.
 */
export const HALL_CONTENT_DETAIL_SURFACES = [
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tales.detailSurface,
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.detailSurface,
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Television.detailSurface,
] as const satisfies readonly [HallContentDetailSurface, ...HallContentDetailSurface[]];

/** The sub-item-surface identities as a typed, non-empty tuple, projected the same way. */
export const HALL_CONTENT_SUB_ITEM_SURFACES = [
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tales.subItemSurface,
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.subItemSurface,
  HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Television.subItemSurface,
] as const satisfies readonly [HallContentSubItemSurface, ...HallContentSubItemSurface[]];
