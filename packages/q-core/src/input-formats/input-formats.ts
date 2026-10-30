import { defineInputFormat } from '@ttt-productions/input-format-core';
import {
  MAX_ANNOUNCEMENT_MESSAGE_LENGTH,
  MAX_APP_VERSION_LENGTH,
  MAX_AWARD_NAME_LENGTH,
  MAX_CONTACT_PHONE_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_GAME_LOCATION_MEMO_LENGTH,
  MAX_GAME_LOCATION_NAME_LENGTH,
  MAX_GAME_LOCATION_STREET_ADDRESS_LENGTH,
  MAX_GAME_LOCATION_SUB_LOCATION_LENGTH,
  MAX_GAME_MEMO_LENGTH,
  MAX_LANDING_ABOUT_TEXT_LENGTH,
  MAX_LANDING_HERO_TITLE_LENGTH,
  MAX_LEAGUE_DESCRIPTION_LENGTH,
  MAX_LEAGUE_TITLE_LENGTH,
  MAX_MAINTENANCE_MESSAGE_LENGTH,
  MAX_REPAIR_REASON_LENGTH,
  MAX_SCHEDULE_WEEK_TITLE_LENGTH,
  MAX_TEAM_INVITATION_MESSAGE_LENGTH,
  MAX_TEAM_JOIN_REQUEST_MESSAGE_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  MAX_WAIVER_TEMPLATE_TEXT_LENGTH,
  MAX_WAIVER_TEMPLATE_TITLE_LENGTH,
  MIN_AWARD_NAME_LENGTH,
  MIN_DISPLAY_NAME_LENGTH,
  MIN_LEAGUE_DESCRIPTION_LENGTH,
  MIN_LEAGUE_TITLE_LENGTH,
  MIN_REPAIR_REASON_LENGTH,
  MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH,
  MIN_TEAM_NAME_LENGTH,
} from '../constants/business.js';

export const REPAIR_REASON_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: MIN_REPAIR_REASON_LENGTH,
  max: MAX_REPAIR_REASON_LENGTH,
});

export const MIGRATION_EVIDENCE_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: MIN_REPAIR_REASON_LENGTH,
  max: MAX_REPAIR_REASON_LENGTH,
});

export const TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH,
  max: MAX_TEAM_JOIN_REQUEST_MESSAGE_LENGTH,
});

export const TEAM_INVITATION_MESSAGE_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 0,
  max: MAX_TEAM_INVITATION_MESSAGE_LENGTH,
});

export const GAME_MEMO_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 0,
  max: MAX_GAME_MEMO_LENGTH,
});

export const DISPLAY_NAME_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: MIN_DISPLAY_NAME_LENGTH,
  max: MAX_DISPLAY_NAME_LENGTH,
});

export const TEAM_NAME_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: MIN_TEAM_NAME_LENGTH,
  max: MAX_TEAM_NAME_LENGTH,
});

export const CONTACT_PHONE_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_CONTACT_PHONE_LENGTH,
});

export const OPTIONAL_CONTACT_PHONE_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 0,
  max: MAX_CONTACT_PHONE_LENGTH,
});

export const AWARD_NAME_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: MIN_AWARD_NAME_LENGTH,
  max: MAX_AWARD_NAME_LENGTH,
});

export const LEAGUE_TITLE_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: MIN_LEAGUE_TITLE_LENGTH,
  max: MAX_LEAGUE_TITLE_LENGTH,
});

export const LEAGUE_DESCRIPTION_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: MIN_LEAGUE_DESCRIPTION_LENGTH,
  max: MAX_LEAGUE_DESCRIPTION_LENGTH,
});

export const GAME_LOCATION_NAME_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_GAME_LOCATION_NAME_LENGTH,
});

export const GAME_LOCATION_STREET_ADDRESS_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_GAME_LOCATION_STREET_ADDRESS_LENGTH,
});

export const GAME_LOCATION_SUB_LOCATION_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_GAME_LOCATION_SUB_LOCATION_LENGTH,
});

export const GAME_LOCATION_MEMO_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 0,
  max: MAX_GAME_LOCATION_MEMO_LENGTH,
});

export const SCHEDULE_WEEK_TITLE_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_SCHEDULE_WEEK_TITLE_LENGTH,
});

export const WAIVER_TEMPLATE_TITLE_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_WAIVER_TEMPLATE_TITLE_LENGTH,
  keepAsTyped: true,
});

export const WAIVER_TEMPLATE_TEXT_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 1,
  max: MAX_WAIVER_TEMPLATE_TEXT_LENGTH,
  keepAsTyped: true,
});

export const LANDING_HERO_TITLE_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 0,
  max: MAX_LANDING_HERO_TITLE_LENGTH,
});

export const LANDING_ABOUT_TEXT_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 0,
  max: MAX_LANDING_ABOUT_TEXT_LENGTH,
});

export const MAINTENANCE_MESSAGE_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 0,
  max: MAX_MAINTENANCE_MESSAGE_LENGTH,
});

export const ANNOUNCEMENT_MESSAGE_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 0,
  max: MAX_ANNOUNCEMENT_MESSAGE_LENGTH,
});

export const APP_VERSION_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 1,
  max: MAX_APP_VERSION_LENGTH,
});
