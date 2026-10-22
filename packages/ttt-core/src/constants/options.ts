import type { HallWingType, WorkProjectType } from '../types/content.js';
import type { AuditionType } from '../doc-schemas/commissions.js';

// The display strings are the stored enum values.
export const TRADE_PROFESSION_OPTIONS = [
  'Actor',
  'Voice Actor',
  'Singer',
  'Musician',
  'Dancer & Choreographer',
  'Writer',
  'Editor',
  'Director',
  'Producer',
  'Cinematographer',
  'Photographer',
  'Animator',
  'Artist',
  'Graphic Designer',
  'VFX Artist',
  'Costume & Makeup Artist',
  'Set & Prop Designer',
  'Composer',
  'Music Producer',
  'Sound Designer',
] as const;

// Tags are `craftSkillsByTag/{tag}` document ids, so the stored value is kebab-case; labels map
// over them.
export const CRAFT_SKILL_TAG_OPTIONS = [
  'acting',
  'voice-over',
  'singing',
  'rapping',
  'instrumental-performance',
  'dance-choreography',
  'stand-up-sketch-comedy',
  'writing-storytelling',
  'songwriting',
  'poetry-spoken-word',
  'drawing-illustration',
  'painting',
  'animation',
  'graphic-design',
  'photography',
  'cinematography-camera',
  'video-editing',
  'visual-effects',
  'directing',
  'costume-makeup',
  'set-prop-design',
  'music-production',
  'composing-scoring',
  'sound-design',
] as const;

export type CraftSkillTagId = (typeof CRAFT_SKILL_TAG_OPTIONS)[number];

export type TradeProfessionId = (typeof TRADE_PROFESSION_OPTIONS)[number];

export const TRADE_PROFESSION_VALUES = TRADE_PROFESSION_OPTIONS as unknown as [
  TradeProfessionId,
  ...TradeProfessionId[],
];

export const CRAFT_SKILL_TAG_VALUES = CRAFT_SKILL_TAG_OPTIONS as unknown as [
  CraftSkillTagId,
  ...CraftSkillTagId[],
];

export const CRAFT_SKILL_TAG_LABELS: Record<(typeof CRAFT_SKILL_TAG_OPTIONS)[number], string> = {
  acting: 'Acting',
  'voice-over': 'Voice Over',
  singing: 'Singing',
  rapping: 'Rapping',
  'instrumental-performance': 'Instrumental Performance',
  'dance-choreography': 'Dance & Choreography',
  'stand-up-sketch-comedy': 'Stand-Up & Sketch Comedy',
  'writing-storytelling': 'Writing & Storytelling',
  songwriting: 'Songwriting',
  'poetry-spoken-word': 'Poetry & Spoken Word',
  'drawing-illustration': 'Drawing & Illustration',
  painting: 'Painting',
  animation: 'Animation',
  'graphic-design': 'Graphic Design',
  photography: 'Photography',
  'cinematography-camera': 'Cinematography & Camera',
  'video-editing': 'Video Editing',
  'visual-effects': 'Visual Effects',
  directing: 'Directing',
  'costume-makeup': 'Costume & Makeup',
  'set-prop-design': 'Set & Prop Design',
  'music-production': 'Music Production',
  'composing-scoring': 'Composing & Scoring',
  'sound-design': 'Sound Design',
};

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

export const AUDITION_TYPES: Record<AuditionType, { label: string; description: string }> = {
  platformAudition: {
    label: 'Platform',
    description: 'Run by TTT admins to gather community feedback.',
  },
  sponsoredAudition: {
    label: 'Sponsored',
    description: 'Backed by funding — votes decide where the money goes.',
  },
  workAudition: {
    label: 'Work',
    description: "Created by a Work's Guildmates seeking feedback.",
  },
};

export const AUDITION_TYPE_FILTER_ALL = 'All';

export type AuditionTypeFilter = AuditionType | typeof AUDITION_TYPE_FILTER_ALL;

const AUDITION_SORT_OPTIONS_BASE = {
  newest: { label: 'Newest First', field: 'createdOn', direction: 'desc' },
  endingSoon: { label: 'Ending Soon', field: 'auditionCloseAt', direction: 'asc' },
} as const;

export const AUDITION_SORT_OPTIONS = {
  default: { ...AUDITION_SORT_OPTIONS_BASE },
  platformAudition: { ...AUDITION_SORT_OPTIONS_BASE },
  sponsoredAudition: {
    ...AUDITION_SORT_OPTIONS_BASE,
    highestPrice: {
      label: 'Highest Price',
      field: 'sponsoredAuditionAmountUSD',
      direction: 'desc',
    },
    lowestPrice: { label: 'Lowest Price', field: 'sponsoredAuditionAmountUSD', direction: 'asc' },
  },
  workAudition: {
    ...AUDITION_SORT_OPTIONS_BASE,
    highestStakeShares: { label: 'Highest Stakes', field: 'stakeSharesOffered', direction: 'desc' },
    lowestStakeShares: { label: 'Lowest Stakes', field: 'stakeSharesOffered', direction: 'asc' },
  },
} as const;

export type AuditionSortKey = {
  [F in keyof typeof AUDITION_SORT_OPTIONS]: keyof (typeof AUDITION_SORT_OPTIONS)[F];
}[keyof typeof AUDITION_SORT_OPTIONS];

export const DEFAULT_AUDITION_SORT: AuditionSortKey = 'newest';

export const HALL_LIBRARY_SORT_OPTIONS: Record<
  string,
  { label: string; field: string; direction: 'asc' | 'desc' }
> = {
  newest: { label: 'Newest First', field: 'createdOn', direction: 'desc' },
  oldest: { label: 'Oldest First', field: 'createdOn', direction: 'asc' },
  most_followed: { label: 'Most Followed', field: 'followerCount', direction: 'desc' },
};
