import { MAX_WORK_PROJECT_TITLE_LENGTH } from './business-work-project.js';
import { ACTIVE_LIMITS } from './app-mode.js';
import { HALL_LIBRARY_TARGET_FIELDS } from '../media/hall-library-target-fields.js';
import type { WorkProjectType } from '../types/content.js';
import { HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE } from './hall-content-routing.js';

export const MAX_SQUARE_STREETZ_DESCRIPTION_LENGTH = 150;

export const MAX_COMMISSION_LISTINGS = ACTIVE_LIMITS.workProject.maxCommissionListings;

export const MAX_SAVED_PROPOSAL_ARTISANS = 5;

export const MAX_COMMISSION_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;

export const MAX_COMMISSION_DESCRIPTION_LENGTH = 400;

export const MODERATION_CLEAR_PLACEHOLDER =
  'Removed by moderation — awaiting an update by the steward.';

export const MODERATION_DEFAULT_REMOVAL_REASON = 'Removed by moderation.';
export const MODERATION_DEFAULT_RETITLE_REASON = 'Title/description removed by moderation.';

export const MODERATION_CLEARABLE_TEXT_FIELDS = {
  workProject: ['workingTitle', 'workingDescription'],
  workRealm: ['workingTitle', 'workingDescription'],
  tale: ['title', 'description'],
  tune: ['title', 'description'],
  television: ['title', 'description'],
  chapter: ['title', 'content'],
  tuneTrack: ['title', 'description'],
  televisionEpisode: ['title', 'description'],
} as const satisfies Record<string, readonly string[]>;

export type ModerationClearableSurface = keyof typeof MODERATION_CLEARABLE_TEXT_FIELDS;

export type ClearableTextFieldName =
  (typeof MODERATION_CLEARABLE_TEXT_FIELDS)[ModerationClearableSurface][number];

export type ModerationClearTextFieldPatch = {
  [Field in ClearableTextFieldName]?: string;
};

export const HALL_CLEARABLE_TEXT_FIELD_NAMES = [
  MODERATION_CLEARABLE_TEXT_FIELDS.tale[0],
  MODERATION_CLEARABLE_TEXT_FIELDS.tale[1],
  MODERATION_CLEARABLE_TEXT_FIELDS.chapter[1],
] as const;

export const HALL_CONTENT_TEXT_FIELDS = {
  tale: MODERATION_CLEARABLE_TEXT_FIELDS.tale,
  tune: MODERATION_CLEARABLE_TEXT_FIELDS.tune,
  television: MODERATION_CLEARABLE_TEXT_FIELDS.television,
  chapter: MODERATION_CLEARABLE_TEXT_FIELDS.chapter,
  tuneTrack: MODERATION_CLEARABLE_TEXT_FIELDS.tuneTrack,
  televisionEpisode: MODERATION_CLEARABLE_TEXT_FIELDS.televisionEpisode,
  workRealm: MODERATION_CLEARABLE_TEXT_FIELDS.workRealm,
} as const satisfies Record<string, readonly string[]>;

export interface HallContentSurfaceRouting {
  detailSurface: ModerationClearableSurface;
  detailFields: readonly ClearableTextFieldName[];
  subItemSurface: ModerationClearableSurface;
  subItemFields: readonly ClearableTextFieldName[];
}

export const HALL_CONTENT_SURFACES_BY_WORK_TYPE = {
  Tales: {
    detailSurface: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tales.detailSurface,
    detailFields: MODERATION_CLEARABLE_TEXT_FIELDS.tale,
    subItemSurface: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tales.subItemSurface,
    subItemFields: MODERATION_CLEARABLE_TEXT_FIELDS.chapter,
  },
  Tunes: {
    detailSurface: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.detailSurface,
    detailFields: MODERATION_CLEARABLE_TEXT_FIELDS.tune,
    subItemSurface: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Tunes.subItemSurface,
    subItemFields: MODERATION_CLEARABLE_TEXT_FIELDS.tuneTrack,
  },
  Television: {
    detailSurface: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Television.detailSurface,
    detailFields: MODERATION_CLEARABLE_TEXT_FIELDS.television,
    subItemSurface: HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE.Television.subItemSurface,
    subItemFields: MODERATION_CLEARABLE_TEXT_FIELDS.televisionEpisode,
  },
} as const satisfies Record<WorkProjectType, HallContentSurfaceRouting>;

export const WORK_SHELL_TEXT_FIELD_TO_HALL_ITEM_FIELD = {
  [MODERATION_CLEARABLE_TEXT_FIELDS.workProject[0]]: MODERATION_CLEARABLE_TEXT_FIELDS.tale[0],
  [MODERATION_CLEARABLE_TEXT_FIELDS.workProject[1]]: MODERATION_CLEARABLE_TEXT_FIELDS.tale[1],
} as const satisfies Record<
  (typeof MODERATION_CLEARABLE_TEXT_FIELDS.workProject)[number],
  (typeof MODERATION_CLEARABLE_TEXT_FIELDS.tale)[number]
>;

export const HALL_DETAIL_TEXT_FIELD_TO_WORK_SHELL_FIELD = {
  [MODERATION_CLEARABLE_TEXT_FIELDS.tale[0]]: MODERATION_CLEARABLE_TEXT_FIELDS.workProject[0],
  [MODERATION_CLEARABLE_TEXT_FIELDS.tale[1]]: MODERATION_CLEARABLE_TEXT_FIELDS.workProject[1],
} as const satisfies Record<
  (typeof MODERATION_CLEARABLE_TEXT_FIELDS.tale)[number],
  (typeof MODERATION_CLEARABLE_TEXT_FIELDS.workProject)[number]
>;

export const HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE = {
  Tales: [
    MODERATION_CLEARABLE_TEXT_FIELDS.chapter[0],
    HALL_LIBRARY_TARGET_FIELDS['chapter-photo'],
    MODERATION_CLEARABLE_TEXT_FIELDS.chapter[1],
  ],
  Tunes: [
    MODERATION_CLEARABLE_TEXT_FIELDS.tuneTrack[0],
    HALL_LIBRARY_TARGET_FIELDS['tune-track-photo'],
    HALL_LIBRARY_TARGET_FIELDS['tune-track-audio'],
  ],
  Television: [
    MODERATION_CLEARABLE_TEXT_FIELDS.televisionEpisode[0],
    HALL_LIBRARY_TARGET_FIELDS['television-episode-photo'],
    HALL_LIBRARY_TARGET_FIELDS['television-episode-video'],
  ],
} as const satisfies Record<WorkProjectType, readonly string[]>;

export type HallSubItemRequiredField =
  (typeof HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE)[WorkProjectType][number];

export const HALL_SUB_ITEM_REQUIREMENT_LABELS = {
  title: 'a title',
  content: 'chapter text',
  photoAssetId: 'a picture',
  audioAssetId: 'an audio file',
  videoAssetId: 'a video file',
} as const satisfies Record<HallSubItemRequiredField, string>;

export const MAX_HALL_CHANGE_REQUEST_REASON_LENGTH = 2000;

export const REAL_PEOPLE_DISCLAIMER_HEADER =
  'A Notice from the Management: the faces may be familiar, but the players are pure ' +
  'invention — parody and satire, in the grand old tradition of the stage.';

export const REAL_PEOPLE_DISCLAIMER_MESSAGE =
  'All characters, statements, and events in this work, even those based on real people, ' +
  'are entirely fictional and are presented as parody, satire, or commentary. Any voices, ' +
  'likenesses, or portrayals of real people are impersonated or fictionalized, and nothing ' +
  'in this work should be understood as a statement of fact about, or as speech by, any ' +
  'real person. This work is not created by, affiliated with, sponsored by, or endorsed by ' +
  'any real person portrayed or referenced in it.';

export const HALL_LIBRARY_PREFS_CAPS = {
  hiddenWorkIds: 200,
  inkedWorkIds: 200,
  inProgress: 50,
  recentlyViewed: 20,
} as const satisfies Record<string, number>;

export const MAX_AUDITION_TITLE_LENGTH = 150;

export const MIN_CURATED_AUDITION_OPTIONS = 2;
export const MAX_CURATED_AUDITION_OPTIONS = 8;

export const MAX_AUDITION_DESCRIPTION_LENGTH = 1000;

export const MAX_SPONSORED_AUDITION_AMOUNT_USD = 500_000;

export const GUILDMATE_AUDITION_ENTRY_REJECTION =
  'You are already a guildmate of this Work — its audition is for recruiting new collaborators.';

export const MAX_POST_LENGTH = 500;

export const MAX_MENTIONS = 3;

export const MAX_MENTION_PLACEHOLDER_LENGTH = 32;

export const MAX_MENTION_DISPLAY_LENGTH = 30;

export const MAX_GUILD_INVITE_MESSAGE_LENGTH = 500;

export const MAX_PLEDGE_PAYMENT_MESSAGE_LENGTH = 500;
