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
