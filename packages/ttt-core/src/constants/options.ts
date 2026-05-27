// UI option lists shared between frontend and backend admin tooling.

import type { LibraryItemType, ProjectType } from '../types/content.js';

// --- WorkProject Roles ---
// WorkProject role IDs, labels, and assignment policy live in ../permissions/.
// Keep role picker UIs backed by PROJECT_ROLES instead of a duplicated option map.

// --- Trade & Craft Options ---

/** Trade options for user profiles, sorted alphabetically. */
export const PROFESSION_OPTIONS = [
  'Actor',
  'Animator',
  'Artist',
  'Cinematographer',
  'Composer',
  'Designer',
  'Developer',
  'Director',
  'Editor',
  'Producer',
  'Sound Designer',
  'Writer',
].sort();

/** Craft tag options for craftSkill uploads, sorted alphabetically. */
export const SKILL_TAG_OPTIONS = [
  'Abstract',
  'Action',
  'Adventure',
  'Animals',
  'Animation',
  'City',
  'Cinematic',
  'Comedy',
  'Drama',
  'Editing',
  'Fashion',
  'Food',
  'Historical',
  'Horror',
  'Instrumental',
  'MusicProduction',
  'Mystery',
  'Nature',
  'Portrait',
  'Romance',
  'SciFi',
  'SoundDesign',
  'Sports',
  'Technology',
  'Thriller',
  'Travel',
  'VocalPerformance',
  'VoiceOver',
].sort();

// --- WorkProject-Specific Categories ---

/** Categories shown for each workProject type. */
export const PROJECT_SPECIFIC_CATEGORIES = {
  Tales: [
    'Adventure',
    'Comedy',
    'Drama',
    'Fantasy',
    'Historical',
    'Horror',
    'Mystery',
    'Romance',
    'Sci-Fi',
    'Thriller',
  ].sort(),
  Tunes: [
    'Blues',
    'Classical',
    'Country',
    'Electronic',
    'Folk',
    'Hip Hop',
    'Jazz',
    'Pop',
    'Reggae',
    'Rock',
  ].sort(),
  Television: [
    'Action',
    'Animation',
    'Comedy',
    'Documentary',
    'Drama',
    'Fantasy',
    'Kids',
    'Reality',
    'Sci-Fi',
    'Thriller',
  ].sort(),
} as const;

// --- HallLibrary / WorkProject Type Display Maps ---

/** HallLibrary type display info. Used in dropdowns and badges. */
export const LIBRARY_TYPES: Record<LibraryItemType, { label: string; description: string }> = {
  entertainment: {
    label: 'Entertainment',
    description: 'Fun and engaging content',
  },
  educational: {
    label: 'Educational',
    description: 'Learning materials and resources',
  },
  newsPolitical: {
    label: 'News/Political',
    description: 'Current events and political content',
  },
};

/** WorkProject type display info. Used in dropdowns and headers. */
export const PROJECT_TYPES: Record<ProjectType, { label: string; description: string }> = {
  Tales: {
    label: 'Tales',
    description: 'Stories and narratives',
  },
  Tunes: {
    label: 'Tunes',
    description: 'Music and audio content',
  },
  Television: {
    label: 'Television',
    description: 'Video and TV content',
  },
};

// --- Sort Options ---

/** Sort options shown on the audition feeds, keyed by feed type. */
export const OPPORTUNITY_SORT_OPTIONS = {
  default: {
    newest: { label: 'Newest First', field: 'createdOn', direction: 'desc' },
    endingSoon: { label: 'Ending Soon', field: 'openTill', direction: 'asc' },
  },
  SystemInput: {
    newest: { label: 'Newest First', field: 'createdOn', direction: 'desc' },
    endingSoon: { label: 'Ending Soon', field: 'openTill', direction: 'asc' },
  },
  SponsoredProjects: {
    newest: { label: 'Newest First', field: 'createdOn', direction: 'desc' },
    endingSoon: { label: 'Ending Soon', field: 'openTill', direction: 'asc' },
    highestPrice: { label: 'Highest Price', field: 'projectAmountUSD', direction: 'desc' },
    lowestPrice: { label: 'Lowest Price', field: 'projectAmountUSD', direction: 'asc' },
  },
  ProjectInput: {
    newest: { label: 'Newest First', field: 'createdOn', direction: 'desc' },
    endingSoon: { label: 'Ending Soon', field: 'openTill', direction: 'asc' },
    highestShares: { label: 'Highest Shares', field: 'sharesOffered', direction: 'desc' },
    lowestShares: { label: 'Lowest Shares', field: 'sharesOffered', direction: 'asc' },
  },
} as const;

/** Sort options shown on the hallLibrary feed. */
export const LIBRARY_SORT_OPTIONS: Record<
  string,
  { label: string; field: string; direction: 'asc' | 'desc' }
> = {
  newest: { label: 'Newest First', field: 'createdOn', direction: 'desc' },
  oldest: { label: 'Oldest First', field: 'createdOn', direction: 'asc' },
  most_donated: { label: 'Most Donated', field: 'totalDonations', direction: 'desc' },
  most_viewed: { label: 'Most Viewed', field: 'viewCount', direction: 'desc' },
};
