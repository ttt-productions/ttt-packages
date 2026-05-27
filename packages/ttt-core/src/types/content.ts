// Content types: Tales, Tunes, Television, HallLibrary

// --- WorkProject Content Types ---

export type FullTale = {
  uid: string;
  title: string;
  description: string;
  createdOn: number;
  coverPhotoSquare?: string;
  coverPhotoPoster?: string;
  coverPhotoCinematic?: string;
  workGenres?: string[];
};

export type FullChapter = {
  uid: string;
  title: string;
  content: string;
  description: string;
  order: number;
  photoUrl?: string;
  status: 'unpublished' | 'pending_approval' | 'published';
  createdOn: number;
};

export type FullTune = {
  uid: string;
  title: string;
  description: string;
  coverPhotoSquare?: string;
  coverPhotoPoster?: string;
  coverPhotoCinematic?: string;
  workGenres: string[];
  createdOn: number;
};

export type FullTuneTrack = {
  uid: string;
  title: string;
  description?: string;
  fileUrl?: string;
  mediaType?: string;
  order: number;
  photoUrl?: string;
  status: 'unpublished' | 'pending_approval' | 'published';
  createdOn: number;
};

export type FullTelevision = {
  uid: string;
  title: string;
  description: string;
  createdOn: number;
  coverPhotoSquare?: string;
  coverPhotoPoster?: string;
  coverPhotoCinematic?: string;
  workGenres: string[];
};

export type FullTelevisionEpisode = {
  uid: string;
  title: string;
  description?: string;
  videoUrl: string;
  mediaType?: string;
  order: number;
  photoUrl?: string;
  status: 'unpublished' | 'pending_approval' | 'published';
  createdOn: number;
};

// --- HallLibrary Types ---

export const HALL_WING_TYPE_KEYS = ['entertainment', 'educational', 'newsPolitical'] as const;
export type HallWingType = (typeof HALL_WING_TYPE_KEYS)[number];

/** HallWingType with 'All' filter option — for UI filtering only, not stored in Firestore */
export type HallWingTypeFilter = HallWingType | 'All';

export const WORK_PROJECT_TYPE_KEYS = ['Tales', 'Tunes', 'Television'] as const;
export type WorkProjectType = (typeof WORK_PROJECT_TYPE_KEYS)[number];

/** WorkProjectType with 'All' filter option — for UI filtering only, not stored in Firestore */
export type WorkProjectTypeFilter = WorkProjectType | 'All';

export type ItemsKey = 'tuneTracks' | 'chapters' | 'televisionEpisodes';

// --- HallLibrary Publishing Flow ---

export interface ThresholdItem {
  thresholdItemId: string;
  hallItemId: string;
  workProjectId: string;
  workProjectType: WorkProjectType;
  itemId: string;
  itemsKey: ItemsKey;
  order: number;
  hallWingType: HallWingType;
  submittedAt: number;
  reviewStatus: 'pending' | 'needs_revision' | 'approved';
  adminNotes?: string;
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface PublishedHallItem {
  hallItemId: string;
  workProjectId: string;
  workProjectType: WorkProjectType;
  status: 'published' | 'paused' | 'banned';
  createdOn: number;
  publishedAt?: number;
  hallWingType: HallWingType;

  // WorkProject-level summary (written flat on first publish of this hallLibrary).
  // Optional on the type because the parent doc may exist in a pre-publish
  // state before the first item is approved — these fields populate at first
  // publish.
  title?: string;
  description?: string;
  coverPhotoSquare?: string;
  coverPhotoPoster?: string;
  coverPhotoCinematic?: string;
  workGenres?: string[];

  // Stats
  totalPledgePayments?: number;
  pledgePaymentCount?: number;
  viewCount?: number;
  followerCount?: number;
}

export interface PublishedTuneTrack {
  uid: string;
  title: string;
  order: number;
  description?: string;
  fileUrl: string;
  photoUrl?: string;
}

export interface PublishedChapter {
  uid: string;
  title: string;
  order: number;
  description?: string;
  content: string;
  photoUrl?: string;
}

export interface PublishedTelevisionEpisode {
  uid: string;
  title: string;
  order: number;
  description?: string;
  videoUrl: string;
  photoUrl?: string;
}

export type HallLibraryPreferences = {
  userId: string;
  hiddenItems: string[];
  followedItems: string[];
  bookmarkedItems: string[];
  inProgressItems: string[];
  recentlyViewed: Array<{
    itemId: string;
    viewedAt: number;
  }>;
  lastUpdated: number;
};

export type HallLibraryUserStatus = {
  followed: boolean;
  bookmarked: boolean;
  inProgress: boolean;
};

export type HallLibrarySortOption =
  | 'newest'
  | 'oldest'
  | 'most_pledged'
  | 'most_viewed';

export type HallLibraryFilters = {
  workGenre?: string;
  hallWingType: HallWingTypeFilter;
  workProjectType: WorkProjectTypeFilter;
  sortBy: HallLibrarySortOption;
};

// --- Future Plans ---

export type FuturePlanItem = {
  id: string;
  title: string;
  description: string;
  order: number;
  videoUrl?: string;
  mediaType?: 'video' | 'image' | 'audio' | 'other';
};

export type FuturePlansDocument = {
  lastUpdated: number;
  plans: FuturePlanItem[];
};

// --- Rules and Agreements ---

export type RuleGroup = 'generic' | 'workProjectType' | 'hallWingType' | 'workRealm' | 'merchandising';
export type RuleSubgroup = 'Tales' | 'Tunes' | 'Television' | 'entertainment' | 'educational' | 'newsPolitical';

export type Rule = {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
  group?: RuleGroup;
  subgroup?: RuleSubgroup;
  order: number;
};

export type AgreementCategory = {
  points: string[];
  videoUrl?: string;
};

export type RulesAndAgreements = {
  rules: Rule[];
  agreements: {
    tales?: AgreementCategory;
    tunes?: AgreementCategory;
    television?: AgreementCategory;
  };
};


