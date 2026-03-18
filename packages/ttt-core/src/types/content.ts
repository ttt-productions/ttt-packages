// Content types: Tales, Tunes, Television, Library

import type { ShortUser } from './user.js';

// --- Project Content Types ---

export type FullTale = {
  uid: string;
  title: string;
  description: string;
  createdOn: number;
  coverPhotoSquare?: string;
  coverPhotoPoster?: string;
  coverPhotoCinematic?: string;
  categories?: string[];
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
  categories: string[];
  createdOn: number;
};

export type FullSong = {
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
  categories: string[];
};

export type FullShow = {
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

// --- Library Types ---

export const LIBRARY_TYPE_KEYS = ['entertainment', 'educational', 'newsPolitical'] as const;
export type LibraryItemType = (typeof LIBRARY_TYPE_KEYS)[number];

/** LibraryItemType with 'All' filter option — for UI filtering only, not stored in Firestore */
export type LibraryItemTypeFilter = LibraryItemType | 'All';

export const PROJECT_TYPE_KEYS = ['Tales', 'Tunes', 'Television'] as const;
export type ProjectType = (typeof PROJECT_TYPE_KEYS)[number];

/** ProjectType with 'All' filter option — for UI filtering only, not stored in Firestore */
export type ProjectTypeFilter = ProjectType | 'All';

export type ItemsKey = 'songs' | 'chapters' | 'shows';

// --- Library Publishing Flow ---

export interface SubmittedItem {
  itemId: string;
  order: number;
  reviewStatus: 'pending' | 'approved' | 'needs_revision' | 'rejected';
  adminNotes?: string;
  reviewedAt?: number;
  reviewedBy?: string;
  approvedAt?: number;
  publishedAt?: number;
}

export interface PendingLibraryDoc {
  libraryId: string;
  projectId: string;
  projectType: ProjectType;
  status: 'reviewing' | 'partially_published' | 'fully_published';
  createdOn: number;
  ownedBy: ShortUser;
  submittedItems: {
    songs?: SubmittedItem[];
    chapters?: SubmittedItem[];
    shows?: SubmittedItem[];
  };
  libraryType: LibraryItemType;
  publishedItemCount?: number;
  totalItemCount?: number;
}

export interface PublishedLibraryItem {
  libraryId: string;
  projectId: string;
  projectType: ProjectType;
  status: 'partial' | 'published';
  createdOn: number;
  publishedAt?: number;
  ownedBy: ShortUser;
  libraryType: LibraryItemType;
  publishedItemCount: number;
  totalItemCount: number;
  tales?: {
    title: string;
    description: string;
    coverPhotoUrl: string;
    categories: string[];
  };
  tunes?: {
    title: string;
    description: string;
    coverPhotoUrl: string;
    categories: string[];
  };
  television?: {
    title: string;
    description: string;
    coverPhotoUrl: string;
    categories: string[];
  };
  totalDonations?: number;
  donationCount?: number;
  viewCount?: number;
  followerCount?: number;
}

export interface PublishedSong {
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

export interface PublishedShow {
  uid: string;
  title: string;
  order: number;
  description?: string;
  videoUrl: string;
  photoUrl?: string;
}

export type LibraryPreferences = {
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

export type LibraryUserStatus = {
  followed: boolean;
  bookmarked: boolean;
  inProgress: boolean;
};

export type LibrarySortOption =
  | 'newest'
  | 'oldest'
  | 'most_donated'
  | 'most_viewed';

export type LibraryFilters = {
  category?: string;
  libraryType: LibraryItemTypeFilter;
  projectType: ProjectTypeFilter;
  sortBy: LibrarySortOption;
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

export type RuleGroup = 'generic' | 'projectType' | 'libraryType' | 'universe' | 'merchandising';
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
