// Content types: Tales, Tunes, Television, HallLibrary

// --- WorkProject content sub-docs (shapes in ../doc-schemas/content.ts) ---
export type {
  FullTale,
  FullChapter,
  FullTune,
  FullTuneTrack,
  FullTelevision,
  FullTelevisionEpisode,
} from '../doc-schemas/content.js';

// --- HallLibrary Types ---

export const HALL_WING_TYPE_KEYS = ['entertainment', 'educational', 'newsPolitical'] as const;
export type HallWingType = (typeof HALL_WING_TYPE_KEYS)[number];

/** HallWingType with 'All' filter option — for UI filtering only, not stored in Firestore */
export type HallWingTypeFilter = HallWingType | 'All';

export const WORK_PROJECT_TYPE_KEYS = ['Tales', 'Tunes', 'Television'] as const;
export type WorkProjectType = (typeof WORK_PROJECT_TYPE_KEYS)[number];

/** WorkProjectType with 'All' filter option — for UI filtering only, not stored in Firestore */
export type WorkProjectTypeFilter = WorkProjectType | 'All';

export type { ItemsKey } from '../doc-schemas/content.js';

// --- Threshold + Hall library items (shapes in ../doc-schemas/content.ts) ---
export type {
  ThresholdItem,
  PublishedHallItem,
  PublishedTuneTrack,
  PublishedChapter,
  PublishedTelevisionEpisode,
  HallContentChangeRequest,
  HallContentTextSurface,
} from '../doc-schemas/content.js';

export type {
  HallLibraryPreferences,
  HallLibraryInProgressEntry,
  HallLibraryRecentlyViewedEntry,
  HallLibrarySettings,
} from '../doc-schemas/content.js';

export type HallLibrarySortOption =
  | 'newest'
  | 'oldest'
  | 'most_followed';

// V1 Hall browse filters on the big categories only (medium coins × wing coins). The genre
// FILTER was removed for launch (DJ, 2026-07-27) — works still TAG per-medium genres at
// creation and display them, so a browse genre filter can return post-launch once real
// content data exists (options recorded in ttt-prod docs/post-launch).
export type HallLibraryFilters = {
  hallWingType: HallWingTypeFilter;
  workProjectType: WorkProjectTypeFilter;
  sortBy: HallLibrarySortOption;
};

// --- _config singleton docs (shapes in ../doc-schemas/content.ts) ---
export type {
  FuturePlanItem,
  FuturePlansDocument,
  RuleGroup,
  RuleSubgroup,
  Rule,
  AgreementCategory,
  RulesAndAgreements,
} from '../doc-schemas/content.js';


