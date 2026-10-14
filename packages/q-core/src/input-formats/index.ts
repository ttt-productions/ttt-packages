// The declared formats of the free-text fields a form takes, each built from the limits the field
// enforces (ARCH-102). ui-core's text inputs and `ConsequenceDialog`'s reason field take only a
// declaration, never a bare bound, and a field's wire schema is built from the same declaration
// through `textFieldSchema`, so the form and the wire run the one check and accept exactly the same
// text. `input-format-core` is server-safe and has no dependencies, so the declarations sit in the
// package root, which both app roots import.

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

/**
 * The reason an admin gives for a repair action, as `repairReasonSchema` reads it: trimmed, then
 * bounded by the repair-reason limits, with any character and line breaks allowed.
 */
export const REPAIR_REASON_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: MIN_REPAIR_REASON_LENGTH,
  max: MAX_REPAIR_REASON_LENGTH,
});

/**
 * The evidence an operator records for a cutover step the console cannot see done — an export's
 * operation name, a revocation's console record: trimmed, then bounded by the repair-reason limits,
 * line breaks allowed.
 */
export const MIGRATION_EVIDENCE_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: MIN_REPAIR_REASON_LENGTH,
  max: MAX_REPAIR_REASON_LENGTH,
});

/**
 * A player's message to the team they ask to join, as `teamJoinRequestMessageSchema` reads it:
 * trimmed, then bounded by the join-request message limits, with any character and line breaks
 * allowed.
 */
export const TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH,
  max: MAX_TEAM_JOIN_REQUEST_MESSAGE_LENGTH,
});

/**
 * The optional note a team sends with an invitation, as `teamInvitationMessageSchema` reads it:
 * trimmed, empty allowed, then bounded by the invitation note limit, line breaks allowed.
 */
export const TEAM_INVITATION_MESSAGE_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 0,
  max: MAX_TEAM_INVITATION_MESSAGE_LENGTH,
});

/**
 * A scorer's note on one person in a live game ("red shirt", "#9"), as `gameMemoSchema` reads it:
 * trimmed, one line, empty allowed — an empty memo clears the note — then bounded by the memo cap.
 */
export const GAME_MEMO_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 0,
  max: MAX_GAME_MEMO_LENGTH,
});

/**
 * A person's display name — an account's, or a ghost player's, as both ghost doors and the admin's
 * ghost captain ask for it — as `displayNameSchema` reads it: trimmed, one line, then bounded by the
 * display-name limits.
 */
export const DISPLAY_NAME_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: MIN_DISPLAY_NAME_LENGTH,
  max: MAX_DISPLAY_NAME_LENGTH,
});

/**
 * A team's name, as `teamNameSchema` reads it at creation and at an admin's rename: trimmed, one
 * line, then bounded by the team-name limits.
 */
export const TEAM_NAME_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: MIN_TEAM_NAME_LENGTH,
  max: MAX_TEAM_NAME_LENGTH,
});

/**
 * The number the league reaches a team on, as `contactPhoneSchema` reads it: trimmed, one line,
 * required, and bounded by the contact-phone cap. It is kept as typed — no format is imposed.
 */
export const CONTACT_PHONE_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_CONTACT_PHONE_LENGTH,
});

/**
 * The account's optional default contact phone on the settings page: the contact-phone format with
 * empty allowed. Empty means remove the saved number — the form sends it as
 * `UpdateAccountSettingsInput.defaultContactPhone: null` — and any other value is held to
 * `CONTACT_PHONE_INPUT_FORMAT`'s trim, one line, and cap.
 */
export const OPTIONAL_CONTACT_PHONE_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 0,
  max: MAX_CONTACT_PHONE_LENGTH,
});

/**
 * An award's name in the catalog, as `awardNameSchema` reads it — at creation, sent with the award's
 * first badge: trimmed, one line, then bounded by the award-name limits.
 */
export const AWARD_NAME_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: MIN_AWARD_NAME_LENGTH,
  max: MAX_AWARD_NAME_LENGTH,
});

/**
 * A league's title, as `leagueTitleSchema` reads it at creation and at the settings edit: trimmed,
 * one line, then bounded by the league-title limits.
 */
export const LEAGUE_TITLE_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: MIN_LEAGUE_TITLE_LENGTH,
  max: MAX_LEAGUE_TITLE_LENGTH,
});

/**
 * A league's description, as `leagueDescriptionSchema` reads it at creation and at the settings
 * edit: trimmed, then bounded by the league-description limits, line breaks allowed.
 */
export const LEAGUE_DESCRIPTION_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: MIN_LEAGUE_DESCRIPTION_LENGTH,
  max: MAX_LEAGUE_DESCRIPTION_LENGTH,
});

/** A venue's name, as `gameLocationNameSchema` reads it: trimmed, one line, required, within its cap. */
export const GAME_LOCATION_NAME_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_GAME_LOCATION_NAME_LENGTH,
});

/**
 * A venue's street address, as `gameLocationStreetAddressSchema` reads it: trimmed, one line,
 * required, within its cap.
 */
export const GAME_LOCATION_STREET_ADDRESS_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_GAME_LOCATION_STREET_ADDRESS_LENGTH,
});

/**
 * One court, sheet, or room of a venue, as `gameLocationSubLocationSchema` reads it: trimmed, one
 * line, required, within its cap.
 */
export const GAME_LOCATION_SUB_LOCATION_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_GAME_LOCATION_SUB_LOCATION_LENGTH,
});

/**
 * A venue's memo, as `gameLocationMemoSchema` reads it: trimmed, line breaks allowed, empty allowed —
 * an empty memo means the venue has none — within its cap.
 */
export const GAME_LOCATION_MEMO_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 0,
  max: MAX_GAME_LOCATION_MEMO_LENGTH,
});

/** A schedule week's name, as `scheduleWeekTitleSchema` reads it: trimmed, one line, required. */
export const SCHEDULE_WEEK_TITLE_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_SCHEDULE_WEEK_TITLE_LENGTH,
});

/**
 * A waiver template's title, as `waiverTemplateTitleSchema` reads it. A waiver is a legal artifact a
 * player signs, so its words are kept exactly as typed; it still cannot be blank.
 */
export const WAIVER_TEMPLATE_TITLE_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_WAIVER_TEMPLATE_TITLE_LENGTH,
  keepAsTyped: true,
});

/**
 * A waiver template's wording, as `waiverTemplateTextSchema` reads it: the legal text a player signs,
 * kept exactly as typed, line breaks allowed, never blank.
 */
export const WAIVER_TEMPLATE_TEXT_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 1,
  max: MAX_WAIVER_TEMPLATE_TEXT_LENGTH,
  keepAsTyped: true,
});

/** The landing page's hero title: trimmed, one line, required. */
export const LANDING_HERO_TITLE_INPUT_FORMAT = defineInputFormat({
  format: 'singleLine',
  min: 1,
  max: MAX_LANDING_HERO_TITLE_LENGTH,
});

/** The landing page's about text: trimmed, line breaks allowed, empty allowed. */
export const LANDING_ABOUT_TEXT_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 0,
  max: MAX_LANDING_ABOUT_TEXT_LENGTH,
});

/** The message shown while the app is in maintenance; empty shows none. */
export const MAINTENANCE_MESSAGE_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 0,
  max: MAX_MAINTENANCE_MESSAGE_LENGTH,
});

/** The site announcement banner; empty clears it. */
export const ANNOUNCEMENT_MESSAGE_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 0,
  max: MAX_ANNOUNCEMENT_MESSAGE_LENGTH,
});

/** The published app version the version gate compares against; never blank. */
export const APP_VERSION_INPUT_FORMAT = defineInputFormat({
  format: 'none',
  min: 1,
  max: MAX_APP_VERSION_LENGTH,
});
