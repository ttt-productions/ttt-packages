import { z } from 'zod';
import {
  checkInputFormat,
  type DeclaredInputFormat,
  type InputFormatIssue,
} from '@ttt-productions/input-format-core';
import { MAX_STAT_COUNT } from '../constants/sports.js';
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

export const epochMsSchema = z.number().int().nonnegative();

export const countSchema = z.number().int().nonnegative();

export const enteredStatCountSchema = countSchema.max(MAX_STAT_COUNT);

export const revisionSchema = z.number().int().positive();

export const appliedRevisionSchema = z.number().int().nonnegative();

export const TEXT_FIELD_ISSUE_MESSAGES: Readonly<
  Record<InputFormatIssue, (declaration: DeclaredInputFormat) => string>
> = {
  tooShort: ({ min }) => (min <= 1 ? 'Required.' : `At least ${min} characters.`),
  tooLong: ({ max }) => `At most ${max} characters.`,
  invalidCharacters: () => 'Holds a character this field does not allow.',
};

export type TextFieldDeclaration = DeclaredInputFormat;

export type TextFieldResult =
  { readonly ok: true; readonly value: string } | { readonly ok: false; readonly reason: string };

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

export const repairReasonSchema = textFieldSchema(REPAIR_REASON_INPUT_FORMAT);

export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const calendarDateSchema = z
  .string()
  .regex(CALENDAR_DATE_PATTERN, { abort: true })
  .refine((value) => {
    const day = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value);
  }, 'Not a real calendar date.');

export const documentIdSegmentSchema = z
  .string()
  .min(1, { abort: true })
  .refine(isDocumentIdSegment, 'Not a document id.');

export const userIdSchema = documentIdSegmentSchema;
export const leagueIdSchema = documentIdSegmentSchema;
export const teamIdSchema = documentIdSegmentSchema;
export const gameIdSchema = documentIdSegmentSchema;
export const scheduleWeekIdSchema = documentIdSegmentSchema;
export const gameRosterPlayerIdSchema = documentIdSegmentSchema.refine(
  (id) => parseGameRosterPlayerId(id) !== null,
  'Not a game roster entry id.',
);
export const statEventIdSchema = documentIdSegmentSchema;
export const statsOperationIdSchema = documentIdSegmentSchema;
export const statsValidationReportIdSchema = statsOperationIdSchema;
export const hardwareLoanContractIdSchema = documentIdSegmentSchema;
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
