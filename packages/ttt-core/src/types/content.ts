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
} from '../doc-schemas/content.js';

export type { HallLibraryPreferences } from '../doc-schemas/content.js';

export type HallLibraryUserStatus = {
  followed: boolean;
  bookmarked: boolean;
  inProgress: boolean;
};

export type HallLibrarySortOption =
  | 'newest'
  | 'oldest'
  | 'most_pledged'
  | 'most_viewed'
  | 'most_followed';

export type HallLibraryFilters = {
  workGenre?: string;
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


