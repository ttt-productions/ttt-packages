import {
  HALL_LIBRARY_SORT_OPTIONS,
  HALL_WING_TYPES,
  WORK_PROJECT_TYPES,
} from '../constants/options.js';
import type {
  HallLibraryFilters,
  HallLibrarySortOption,
  HallWingTypeFilter,
  WorkProjectTypeFilter,
} from '../types/content.js';

export const HALL_BROWSE_VIEW_MODES = ['grid', 'list'] as const;
export type HallBrowseViewMode = (typeof HALL_BROWSE_VIEW_MODES)[number];

export interface HallBrowseState {
  readonly filters: Readonly<HallLibraryFilters>;
  readonly viewMode: HallBrowseViewMode;
}

export interface HallBrowseSearchParams {
  get(name: string): string | null;
}

export const HALL_LIBRARY_QUERY_KEYS = {
  workProjectType: 'workProjectType',
  hallWingType: 'hallWingType',
  sortBy: 'sortBy',
  view: 'view',
  item: 'item',
} as const;

const FILTER_ALL: Extract<WorkProjectTypeFilter, HallWingTypeFilter> = 'All';

export const HALL_BROWSE_DEFAULTS: HallBrowseState = Object.freeze({
  filters: Object.freeze({
    workProjectType: 'Tales',
    hallWingType: 'entertainment',
    sortBy: 'newest',
  } as const),
  viewMode: 'grid',
} as const);

function isMapKey<K extends string>(map: Record<K, unknown>, raw: string | null): raw is K {
  return raw !== null && Object.prototype.hasOwnProperty.call(map, raw);
}

function isHallSortOption(raw: string | null): raw is HallLibrarySortOption {
  return raw !== null && Object.prototype.hasOwnProperty.call(HALL_LIBRARY_SORT_OPTIONS, raw);
}

function isHallBrowseViewMode(raw: string | null): raw is HallBrowseViewMode {
  return raw !== null && (HALL_BROWSE_VIEW_MODES as readonly string[]).includes(raw);
}

export function parseHallBrowseState(searchParams: HallBrowseSearchParams): HallBrowseState {
  const rawWorkProjectType = searchParams.get(HALL_LIBRARY_QUERY_KEYS.workProjectType);
  const rawHallWingType = searchParams.get(HALL_LIBRARY_QUERY_KEYS.hallWingType);
  const rawSortBy = searchParams.get(HALL_LIBRARY_QUERY_KEYS.sortBy);
  const rawView = searchParams.get(HALL_LIBRARY_QUERY_KEYS.view);

  return {
    filters: {
      workProjectType:
        rawWorkProjectType === FILTER_ALL || isMapKey(WORK_PROJECT_TYPES, rawWorkProjectType)
          ? rawWorkProjectType
          : HALL_BROWSE_DEFAULTS.filters.workProjectType,
      hallWingType:
        rawHallWingType === FILTER_ALL || isMapKey(HALL_WING_TYPES, rawHallWingType)
          ? rawHallWingType
          : HALL_BROWSE_DEFAULTS.filters.hallWingType,
      sortBy: isHallSortOption(rawSortBy) ? rawSortBy : HALL_BROWSE_DEFAULTS.filters.sortBy,
    },
    viewMode: isHallBrowseViewMode(rawView) ? rawView : HALL_BROWSE_DEFAULTS.viewMode,
  };
}

export function hallBrowseQueryEntries(state: HallBrowseState): [string, string][] {
  const { filters, viewMode } = state;
  const defaults = HALL_BROWSE_DEFAULTS;
  const entries: [string, string][] = [];
  if (filters.workProjectType !== defaults.filters.workProjectType) {
    entries.push([HALL_LIBRARY_QUERY_KEYS.workProjectType, filters.workProjectType]);
  }
  if (filters.hallWingType !== defaults.filters.hallWingType) {
    entries.push([HALL_LIBRARY_QUERY_KEYS.hallWingType, filters.hallWingType]);
  }
  if (filters.sortBy !== defaults.filters.sortBy) {
    entries.push([HALL_LIBRARY_QUERY_KEYS.sortBy, filters.sortBy]);
  }
  if (viewMode !== defaults.viewMode) {
    entries.push([HALL_LIBRARY_QUERY_KEYS.view, viewMode]);
  }
  return entries;
}
