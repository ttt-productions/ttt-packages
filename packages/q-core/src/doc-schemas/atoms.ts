// Field atoms shared by the document schemas and the callable schemas. Every enum derives from its
// one canonical key array in ../types — never re-declared.

import { z } from 'zod';
import { checkInputFormat, type DeclaredInputFormat, type InputFormatIssue } from '@ttt-productions/input-format-core';
import { REPAIR_REASON_INPUT_FORMAT } from '../input-formats/input-formats.js';
import { parseGameRosterPlayerId } from '../ids/compound-ids.js';
import { isStagingId } from '../ids/picture-ids.js';
import { isDocumentIdSegment } from '../paths/utils.js';
import {
  BASKETBALL_BULK_STAT_KEYS,
  LEAGUE_TYPE_KEYS,
  SPORT_KEYS,
  STAT_COUNTER_KEYS,
} from '../types/sports.js';
import {
  GAME_STATUS_KEYS,
  HARDWARE_LOAN_CONTRACT_STATUS_KEYS,
  MEMBERSHIP_ROSTER_SYNC_STATUS_KEYS,
  TEAM_JOIN_REQUEST_STATUS_KEYS,
  LEAGUE_MODE_KEYS,
  LEAGUE_STATUS_KEYS,
  STATS_BEACON_ACTION_KEYS,
  STATS_DISCREPANCY_KIND_KEYS,
  TEAM_ICON_KEYS,
  TEAM_INVITATION_STATUS_KEYS,
  TEAM_JOIN_METHOD_KEYS,
  TEAM_MEMBERSHIP_STATUS_KEYS,
  TEAM_ROLE_KEYS,
  SYSTEM_ROLE_KEYS,
  TEAM_TYPE_KEYS,
  USER_STATUS_KEYS,
  WAIVER_WITNESS_AUTHORITY_KEYS,
} from '../types/unions.js';

// Every persisted moment is an epoch-millisecond number (ARCH-105).
export const epochMsSchema = z.number().int().nonnegative();

// A tally: a stat line's counter, a games-played count, a run's page counts.
export const countSchema = z.number().int().nonnegative();

// A change revision: advanced by one with every change to what it versions, so the first writes 1.
export const revisionSchema = z.number().int().positive();

// The revision a reconciler last finished: 0 before its first finish, never past the revision.
export const appliedRevisionSchema = z.number().int().nonnegative();

/**
 * Why `checkInputFormat` refused a text, as a field's wire schema words it, with the declaration's
 * bounds: a required field left blank is "Required.", a short one names its minimum, a long one its
 * maximum.
 */
export const TEXT_FIELD_ISSUE_MESSAGES: Readonly<
  Record<InputFormatIssue, (declaration: DeclaredInputFormat) => string>
> = {
  tooShort: ({ min }) => (min <= 1 ? 'Required.' : `At least ${min} characters.`),
  tooLong: ({ max }) => `At most ${max} characters.`,
  invalidCharacters: () => 'Holds a character this field does not allow.',
};

/**
 * A text field's wire schema, built from the field's one declaration: it runs input-format-core's
 * check — trim, then min, max, and the format's characters — and parses to the text the check keeps.
 * The form's input reads the same declaration, so the two accept exactly the same text (ARCH-102). A
 * refusal carries the issue and the declaration's bounds, so a form can say which bound was missed.
 */
/** A text field's declaration, as a form and its wire schema both read it. */
export type TextFieldDeclaration = DeclaredInputFormat;

export type TextFieldResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Checks `text` against its field's declaration: the value the field keeps, or the sentence that
 * refuses it — the same words `textFieldSchema` gives the wire.
 */
export function checkTextField(declaration: TextFieldDeclaration, text: string): TextFieldResult {
  const result = checkInputFormat(text, declaration);
  if (result.ok) return { ok: true, value: result.value };
  return { ok: false, reason: TEXT_FIELD_ISSUE_MESSAGES[result.issue](declaration) };
}

export function textFieldSchema(declaration: DeclaredInputFormat) {
  return z.string().transform((text, ctx) => {
    const result = checkInputFormat(text, declaration);
    if (result.ok) return result.value;
    ctx.addIssue({
      code: 'custom',
      message: TEXT_FIELD_ISSUE_MESSAGES[result.issue](declaration),
      input: text,
      params: { issue: result.issue, min: declaration.min, max: declaration.max },
    });
    return z.NEVER;
  });
}

// Required on every repair action and recorded with the state it replaced (BACKEND-212): the
// callable's input, and the correction event and stats operation that store it.
export const repairReasonSchema = textFieldSchema(REPAIR_REASON_INPUT_FORMAT);

/** The shape of a calendar date, `YYYY-MM-DD`; a form names the issue it raises by this pattern. */
export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// A calendar date with no time or zone: `YYYY-MM-DD`, naming a day that exists — the pattern alone
// admits `2026-02-31`. League start/end dates and a game's dayKey. Two of them compare correctly as
// strings. A value that fails the pattern stops there: an empty or misshapen value is not a date at
// all, so it carries the one pattern issue (a form's "Choose a date."), never a second about the day.
export const calendarDateSchema = z
  .string()
  .regex(CALENDAR_DATE_PATTERN, { abort: true })
  .refine((value) => {
    const day = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value);
  }, 'Not a real calendar date.');

// Every id a document path is built from is exactly one path segment (ARCH-106): a client-sent id
// holding a `/` or empty would address another document, a subcollection, or the collection itself.
// Each entity's atom builds on this one; there is no generic idSchema for a field to use instead. An
// empty id stops at its one length issue — a form's "Required." for a choice left unmade — never a
// second about the segment.
export const documentIdSegmentSchema = z
  .string()
  .min(1, { abort: true })
  .refine(isDocumentIdSegment, 'Not a document id.');

export const userIdSchema = documentIdSegmentSchema;
export const leagueIdSchema = documentIdSegmentSchema;
export const teamIdSchema = documentIdSegmentSchema;
export const gameIdSchema = documentIdSegmentSchema;
// A week of a league's schedule. A week has no document: its games carry the id and the week's
// shared fields, and the league's weeks are rebuilt by grouping its games on it.
export const scheduleWeekIdSchema = documentIdSegmentSchema;
// A game roster entry, `{teamId}_{userId}`: its roster document id, the key of its line in the
// game's `stats.playerStats`, and its member of the game's absence and participation lists.
export const gameRosterPlayerIdSchema = documentIdSegmentSchema.refine(
  (id) => parseGameRosterPlayerId(id) !== null,
  'Not a game roster entry id.',
);
// Equal to the stat event's document id.
export const statEventIdSchema = documentIdSegmentSchema;
export const statsOperationIdSchema = documentIdSegmentSchema;
// A stats check's report is keyed by the check's operation id.
export const statsValidationReportIdSchema = statsOperationIdSchema;
// A hardware loan contract's id, minted by the creating callable.
export const hardwareLoanContractIdSchema = documentIdSegmentSchema;
// The id a client mints for one upload, the last segment of its staging path: a lowercase UUID. A
// picture's id is its upload's staging id, so `pictureIdSchema` is this atom.
export const stagingIdSchema = z.string().refine(isStagingId, 'Not a staging id.');

export const leagueTypeSchema = z.enum(LEAGUE_TYPE_KEYS);
export const sportKeySchema = z.enum(SPORT_KEYS);
export const leagueStatusSchema = z.enum(LEAGUE_STATUS_KEYS);
export const leagueModeSchema = z.enum(LEAGUE_MODE_KEYS);
export const teamTypeSchema = z.enum(TEAM_TYPE_KEYS);
export const teamIconSchema = z.enum(TEAM_ICON_KEYS);
export const teamRoleSchema = z.enum(TEAM_ROLE_KEYS);
export const systemRoleSchema = z.enum(SYSTEM_ROLE_KEYS);
export const userStatusSchema = z.enum(USER_STATUS_KEYS);
export const teamMembershipStatusSchema = z.enum(TEAM_MEMBERSHIP_STATUS_KEYS);
export const teamJoinMethodSchema = z.enum(TEAM_JOIN_METHOD_KEYS);
export const gameStatusSchema = z.enum(GAME_STATUS_KEYS);
export const teamInvitationStatusSchema = z.enum(TEAM_INVITATION_STATUS_KEYS);
export const teamJoinRequestStatusSchema = z.enum(TEAM_JOIN_REQUEST_STATUS_KEYS);
export const hardwareLoanContractStatusSchema = z.enum(HARDWARE_LOAN_CONTRACT_STATUS_KEYS);
export const membershipRosterSyncStatusSchema = z.enum(MEMBERSHIP_ROSTER_SYNC_STATUS_KEYS);
export const waiverWitnessAuthoritySchema = z.enum(WAIVER_WITNESS_AUTHORITY_KEYS);
export const statsBeaconActionSchema = z.enum(STATS_BEACON_ACTION_KEYS);
export const statsDiscrepancyKindSchema = z.enum(STATS_DISCREPANCY_KIND_KEYS);
export const basketballBulkStatKeySchema = z.enum(BASKETBALL_BULK_STAT_KEYS);
export const statCounterKeySchema = z.enum(STAT_COUNTER_KEYS);
