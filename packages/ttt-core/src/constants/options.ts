// UI option lists shared between frontend and backend admin tooling.

import type { HallWingType, WorkProjectType } from '../types/content.js';

// --- WorkProject Guild Standings ---
// WorkProject guild-standing IDs, labels, and assignment policy live in ../permissions/.
// Keep guild-standing picker UIs backed by GUILD_STANDINGS instead of a duplicated option map.

// --- Trade & Craft Options ---

/**
 * Trade professions (20) — role-shaped labels used for guild roles, commission
 * requests, and file-folder permission keys. Display strings are stored/validated
 * directly (they double as the enum values in the callable input schemas that derive
 * from this constant). Kept in curated order; not alphabetized.
 */
export const TRADE_PROFESSION_OPTIONS = [
  // Performance
  'Actor',
  'Voice Actor',
  'Singer',
  'Musician',
  'Dancer & Choreographer',
  // Story
  'Writer',
  'Editor',
  'Director',
  'Producer',
  // Camera & visual
  'Cinematographer',
  'Photographer',
  'Animator',
  'Artist',
  'Graphic Designer',
  'VFX Artist',
  'Costume & Makeup Artist',
  'Set & Prop Designer',
  // Audio
  'Composer',
  'Music Producer',
  'Sound Designer',
] as const;

/**
 * Craft-skill discipline tags (23). Tags are Firestore doc IDs in the
 * `craftSkillsByTag/{tag}` index, so the STORED value is a machine-safe kebab-case ID
 * (`CRAFT_SKILL_TAG_OPTIONS`) — this is what the wire schema validates and what path
 * builders write. Human-readable labels (with spaces / ampersands) are mapped over the
 * IDs via `CRAFT_SKILL_TAG_LABELS`; render pickers/badges through that map. Kept in
 * curated discipline order (Performance → Writing → Visual → Film → Audio); not sorted.
 */
export const CRAFT_SKILL_TAG_OPTIONS = [
  // Performance
  'acting',
  'voice-over',
  'singing',
  'rapping',
  'instrumental-performance',
  'dance-choreography',
  'stand-up-sketch-comedy',
  // Writing
  'writing-storytelling',
  'songwriting',
  'poetry-spoken-word',
  // Visual arts
  'drawing-illustration',
  'painting',
  'animation',
  'graphic-design',
  'photography',
  // Film & video
  'cinematography-camera',
  'video-editing',
  'visual-effects',
  'directing',
  'costume-makeup',
  'set-prop-design',
  // Audio
  'music-production',
  'composing-scoring',
  'sound-design',
] as const;

/** The canonical tag-ID type — every tags field/param derives from this, never `string`. */
export type CraftSkillTagId = (typeof CRAFT_SKILL_TAG_OPTIONS)[number];

/** The canonical trade-profession ID type. */
export type TradeProfessionId = (typeof TRADE_PROFESSION_OPTIONS)[number];

/** TRADE_PROFESSION_OPTIONS as a non-empty tuple for `z.enum(...)` consumers — the ONE
 * cast, here beside the declaration (never re-cast locally in schema files). */
export const TRADE_PROFESSION_VALUES = TRADE_PROFESSION_OPTIONS as unknown as [
  TradeProfessionId,
  ...TradeProfessionId[],
];

/** The same allowlist as a non-empty tuple for `z.enum(...)` consumers — the ONE cast,
 * here beside the declaration (schema files import this, never re-cast locally). */
export const CRAFT_SKILL_TAG_VALUES = CRAFT_SKILL_TAG_OPTIONS as unknown as [
  CraftSkillTagId,
  ...CraftSkillTagId[],
];

/** Human display labels for each craft-skill tag ID. Keyed by the machine-safe ID. */
export const CRAFT_SKILL_TAG_LABELS: Record<(typeof CRAFT_SKILL_TAG_OPTIONS)[number], string> = {
  'acting': 'Acting',
  'voice-over': 'Voice Over',
  'singing': 'Singing',
  'rapping': 'Rapping',
  'instrumental-performance': 'Instrumental Performance',
  'dance-choreography': 'Dance & Choreography',
  'stand-up-sketch-comedy': 'Stand-Up & Sketch Comedy',
  'writing-storytelling': 'Writing & Storytelling',
  'songwriting': 'Songwriting',
  'poetry-spoken-word': 'Poetry & Spoken Word',
  'drawing-illustration': 'Drawing & Illustration',
  'painting': 'Painting',
  'animation': 'Animation',
  'graphic-design': 'Graphic Design',
  'photography': 'Photography',
  'cinematography-camera': 'Cinematography & Camera',
  'video-editing': 'Video Editing',
  'visual-effects': 'Visual Effects',
  'directing': 'Directing',
  'costume-makeup': 'Costume & Makeup',
  'set-prop-design': 'Set & Prop Design',
  'music-production': 'Music Production',
  'composing-scoring': 'Composing & Scoring',
  'sound-design': 'Sound Design',
};

// --- WorkProject-Specific Genres ---

/**
 * Genres shown for each workProject type. Curated final lists (kept in the doc's order,
 * not alphabetized). "Spooky" (not "Horror") is deliberate for V1: the name carries the
 * all-ages ceiling; "Horror" is the natural mature sibling if mature content ever ships.
 */
export const WORK_PROJECT_SPECIFIC_GENRES = {
  Tales: [
    'Adventure',
    'Comedy',
    'Drama',
    'Fantasy',
    'Fairy Tale & Fable',
    'Historical',
    'Mystery',
    'Romance',
    'Sci-Fi',
    'Slice of Life',
    'Spooky',
    'Thriller',
  ],
  Tunes: [
    'Audiobook & Spoken Word',
    'Blues',
    'Classical',
    'Country',
    'Electronic',
    'Folk',
    'Hip Hop & Rap',
    'Jazz',
    'Metal',
    'Podcast',
    'Pop',
    'R&B & Soul',
    'Reggae',
    'Rock',
    'Soundtrack & Score',
  ],
  Television: [
    'Action',
    'Animation',
    'Comedy',
    'Documentary',
    'Drama',
    'Fantasy',
    'Kids & Family',
    'Music Video',
    'Mystery',
    'Reality',
    'Sci-Fi',
    'Sketch & Variety',
    'Spooky',
    'Talk Show',
    'Thriller',
  ],
} as const;

// --- HallLibrary / WorkProject Type Display Maps ---

/** HallLibrary type display info. Used in dropdowns and badges. */
export const HALL_WING_TYPES: Record<HallWingType, { label: string; description: string }> = {
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
export const WORK_PROJECT_TYPES: Record<WorkProjectType, { label: string; description: string }> = {
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
export const AUDITION_SORT_OPTIONS = {
  default: {
    newest: { label: 'Newest First', field: 'createdOn', direction: 'desc' },
    endingSoon: { label: 'Ending Soon', field: 'openTill', direction: 'asc' },
  },
  platformAudition: {
    newest: { label: 'Newest First', field: 'createdOn', direction: 'desc' },
    endingSoon: { label: 'Ending Soon', field: 'openTill', direction: 'asc' },
  },
  sponsoredAudition: {
    newest: { label: 'Newest First', field: 'createdOn', direction: 'desc' },
    endingSoon: { label: 'Ending Soon', field: 'openTill', direction: 'asc' },
    highestPrice: { label: 'Highest Price', field: 'sponsoredAuditionAmountUSD', direction: 'desc' },
    lowestPrice: { label: 'Lowest Price', field: 'sponsoredAuditionAmountUSD', direction: 'asc' },
  },
  workAudition: {
    newest: { label: 'Newest First', field: 'createdOn', direction: 'desc' },
    endingSoon: { label: 'Ending Soon', field: 'openTill', direction: 'asc' },
    highestStakeShares: { label: 'Highest Stakes', field: 'stakeSharesOffered', direction: 'desc' },
    lowestStakeShares: { label: 'Lowest Stakes', field: 'stakeSharesOffered', direction: 'asc' },
  },
} as const;

/** Sort options shown on the hallLibrary feed. */
export const HALL_LIBRARY_SORT_OPTIONS: Record<
  string,
  { label: string; field: string; direction: 'asc' | 'desc' }
> = {
  newest: { label: 'Newest First', field: 'createdOn', direction: 'desc' },
  oldest: { label: 'Oldest First', field: 'createdOn', direction: 'asc' },
  most_followed: { label: 'Most Followed', field: 'followerCount', direction: 'desc' },
};



