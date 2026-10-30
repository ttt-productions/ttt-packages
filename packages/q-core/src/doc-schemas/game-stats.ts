import { z } from 'zod';
import { CURLING_ROUND_COUNT, MAX_CURLING_ROUND_POINTS } from '../constants/sports.js';
import { buildGameRosterPlayerId } from '../ids/compound-ids.js';
import { buildStatCorrectionId, buildStatVoidId } from '../ids/stat-event-ids.js';
import {
  BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS,
  BASKETBALL_BULK_EDIT_EVENT_TYPE,
  BASKETBALL_ONE_POINT_EVENT_TYPE,
  BASKETBALL_PLAYER_STAT_KEYS,
  BASKETBALL_PLAYER_TALLY_EVENT_TYPE_KEYS,
  BASKETBALL_TEAM_STAT_KEYS,
  BASKETBALL_TIMEOUT_EVENT_TYPE,
  CURLING_ROUND_BLANK_EVENT_TYPE,
  CURLING_ROUND_SCORE_EVENT_TYPE,
  CURLING_TEAM_STAT_KEYS,
  FOOTBALL_BULK_EDIT_EVENT_TYPE,
  FOOTBALL_SCORE_EVENT_TYPE_KEYS,
  FOOTBALL_TEAM_STAT_KEYS,
} from '../types/sports.js';
import type {
  BasketballStatEventType,
  CurlingStatEventType,
  FootballStatEventType,
  StatCounterKey,
} from '../types/sports.js';
import {
  STAT_CORRECTION_EVENT_TYPE,
  STAT_CORRECTION_SOURCE_KEYS,
  STAT_EVENT_AUTHORITY_KEYS,
  STAT_VOID_EVENT_TYPE,
} from '../types/stats.js';
import { CAPTAIN_TEAM_ROLES } from '../types/unions.js';
import {
  basketballBulkStatKeySchema,
  countSchema,
  epochMsSchema,
  gameRosterPlayerIdSchema,
  repairReasonSchema,
  statCounterKeySchema,
  statEventIdSchema,
  statsOperationIdSchema,
  teamIdSchema,
  userIdSchema,
} from './atoms.js';

function counterShape<K extends StatCounterKey>(keys: readonly K[]): Record<K, typeof countSchema> {
  return Object.fromEntries(keys.map((key) => [key, countSchema])) as Record<K, typeof countSchema>;
}

export const BasketballTeamStatsSchema = z.strictObject(counterShape(BASKETBALL_TEAM_STAT_KEYS));
export type BasketballTeamStats = z.infer<typeof BasketballTeamStatsSchema>;

export const BasketballPlayerStatsSchema = z.strictObject({
  ...counterShape(BASKETBALL_PLAYER_STAT_KEYS),
  fantasyPoints: z.number().nonnegative(),
});
export type BasketballPlayerStats = z.infer<typeof BasketballPlayerStatsSchema>;

export const CurlingTeamStatsSchema = z.strictObject({
  ...counterShape(CURLING_TEAM_STAT_KEYS),
  roundScores: z
    .array(z.number().int().min(0).max(MAX_CURLING_ROUND_POINTS).nullable())
    .length(CURLING_ROUND_COUNT),
});
export type CurlingTeamStats = z.infer<typeof CurlingTeamStatsSchema>;

export const FootballTeamStatsSchema = z.strictObject(counterShape(FOOTBALL_TEAM_STAT_KEYS));
export type FootballTeamStats = z.infer<typeof FootballTeamStatsSchema>;

export function gameStatsSchema<TeamLine extends z.ZodType, PlayerLine extends z.ZodType>(
  teamLine: TeamLine,
  playerLine: PlayerLine,
) {
  return z.strictObject({
    teamStats: z.record(teamIdSchema, teamLine),
    playerStats: z.record(gameRosterPlayerIdSchema, playerLine),
  });
}

const statEventBase = {
  eventId: statEventIdSchema,
  sequence: z.number().int().positive(),
  recordedAt: epochMsSchema,
  acceptedAt: epochMsSchema.optional(),
  recordedByUserId: userIdSchema.optional(),
  recordedByAuthority: z.enum(STAT_EVENT_AUTHORITY_KEYS).optional(),
  recordedByTeamId: teamIdSchema.optional(),
};

const playerEventFields = {
  teamId: teamIdSchema,
  playerUserId: userIdSchema,
  displayNameSnapshot: z.string().optional(),
};

export const BasketballOnePointEventSchema = z.strictObject({
  ...statEventBase,
  ...playerEventFields,
  type: z.literal(BASKETBALL_ONE_POINT_EVENT_TYPE),
});

export const BasketballAssistableShotEventSchema = z
  .strictObject({
    ...statEventBase,
    ...playerEventFields,
    type: z.enum(BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS),
    assistedByUserId: userIdSchema.optional(),
    assistedByDisplayNameSnapshot: z.string().optional(),
  })
  .refine(
    (event) =>
      event.assistedByDisplayNameSnapshot === undefined || event.assistedByUserId !== undefined,
    'An assister snapshot needs the assister.',
  );

export const BasketballPlayerTallyEventSchema = z.strictObject({
  ...statEventBase,
  ...playerEventFields,
  type: z.enum(BASKETBALL_PLAYER_TALLY_EVENT_TYPE_KEYS),
});

export const BasketballTimeoutEventSchema = z.strictObject({
  ...statEventBase,
  teamId: teamIdSchema,
  type: z.literal(BASKETBALL_TIMEOUT_EVENT_TYPE),
});

export const BasketballBulkEditEventSchema = z.strictObject({
  ...statEventBase,
  ...playerEventFields,
  type: z.literal(BASKETBALL_BULK_EDIT_EVENT_TYPE),
  stat: basketballBulkStatKeySchema,
  value: z.number().int(),
  previousValue: countSchema.optional(),
});

const curlingRoundNumberSchema = z.number().int().min(1).max(CURLING_ROUND_COUNT);

export const CurlingRoundScoreEventSchema = z.strictObject({
  ...statEventBase,
  type: z.literal(CURLING_ROUND_SCORE_EVENT_TYPE),
  teamId: teamIdSchema,
  roundNumber: curlingRoundNumberSchema,
  points: z.number().int().min(1).max(MAX_CURLING_ROUND_POINTS),
});

export const CurlingBlankEndEventSchema = z.strictObject({
  ...statEventBase,
  type: z.literal(CURLING_ROUND_BLANK_EVENT_TYPE),
  roundNumber: curlingRoundNumberSchema,
});

export const FootballScoreEventSchema = z.strictObject({
  ...statEventBase,
  type: z.enum(FOOTBALL_SCORE_EVENT_TYPE_KEYS),
  teamId: teamIdSchema,
});

export const FootballBulkEditEventSchema = z.strictObject({
  ...statEventBase,
  type: z.literal(FOOTBALL_BULK_EDIT_EVENT_TYPE),
  teamId: teamIdSchema,
  value: z.number().int(),
  previousValue: countSchema,
});

export const StatVoidEventSchema = z
  .strictObject({
    ...statEventBase,
    type: z.literal(STAT_VOID_EVENT_TYPE),
    targetEventId: statEventIdSchema,
  })
  .refine((event) => event.eventId === buildStatVoidId(event.targetEventId), {
    message: 'A void is stored at the id its target derives.',
    path: ['eventId'],
  });

export const StatCorrectionEventSchema = z
  .strictObject({
    ...statEventBase,
    type: z.literal(STAT_CORRECTION_EVENT_TYPE),
    teamId: teamIdSchema,
    playerUserId: userIdSchema.optional(),
    stat: statCounterKeySchema,
    value: z.number().int(),
    correctionSource: z.enum(STAT_CORRECTION_SOURCE_KEYS),
    operationId: statsOperationIdSchema,
    reason: repairReasonSchema,
    rekeyedFromGhostUserId: userIdSchema.optional(),
  })
  .refine(
    (event) =>
      event.eventId ===
      buildStatCorrectionId(
        event.operationId,
        event.playerUserId === undefined
          ? event.teamId
          : buildGameRosterPlayerId(
              event.teamId,
              event.rekeyedFromGhostUserId ?? event.playerUserId,
            ),
        event.stat,
      ),
    {
      message: 'A correction is stored at the id its operation, line, and field derive.',
      path: ['eventId'],
    },
  );

function recorderFactsAgree(event: {
  acceptedAt?: number;
  recordedByUserId?: string;
  recordedByAuthority?: (typeof STAT_EVENT_AUTHORITY_KEYS)[number];
  recordedByTeamId?: string;
}): boolean {
  const facts = [event.acceptedAt, event.recordedByUserId, event.recordedByAuthority];
  const present = facts.filter((fact) => fact !== undefined).length;
  if (present !== 0 && present !== facts.length) return false;
  const teamAuthority = (CAPTAIN_TEAM_ROLES as readonly string[]).includes(
    event.recordedByAuthority ?? '',
  );
  return teamAuthority === (event.recordedByTeamId !== undefined);
}

function snapshotsOnlyOnCopiedEvents(event: {
  acceptedAt?: number;
  recordedByUserId?: string;
  recordedByAuthority?: string;
  recordedByTeamId?: string;
  displayNameSnapshot?: string;
  assistedByDisplayNameSnapshot?: string;
}): boolean {
  const snapshot =
    event.displayNameSnapshot !== undefined || event.assistedByDisplayNameSnapshot !== undefined;
  const recorded = [
    event.acceptedAt,
    event.recordedByUserId,
    event.recordedByAuthority,
    event.recordedByTeamId,
  ].some((fact) => fact !== undefined);
  return !(snapshot && recorded);
}

export const GameStatEventSchema = z
  .discriminatedUnion('type', [
    BasketballOnePointEventSchema,
    BasketballAssistableShotEventSchema,
    BasketballPlayerTallyEventSchema,
    BasketballTimeoutEventSchema,
    BasketballBulkEditEventSchema,
    CurlingRoundScoreEventSchema,
    CurlingBlankEndEventSchema,
    FootballScoreEventSchema,
    FootballBulkEditEventSchema,
    StatVoidEventSchema,
    StatCorrectionEventSchema,
  ])
  .refine(
    recorderFactsAgree,
    'Recorder facts are all present, or all absent, with a team only for a team role.',
  )
  .refine(
    snapshotsOnlyOnCopiedEvents,
    'A name snapshot belongs to a copied event, which carries no recorder facts.',
  );
export type GameStatEvent = z.infer<typeof GameStatEventSchema>;
export type GameStatEventType = GameStatEvent['type'];

export type BasketballStatEvent = Extract<GameStatEvent, { type: BasketballStatEventType }>;
export type CurlingRoundScoreEvent = z.infer<typeof CurlingRoundScoreEventSchema>;
export type CurlingBlankEndEvent = z.infer<typeof CurlingBlankEndEventSchema>;
export type CurlingStatEvent = Extract<GameStatEvent, { type: CurlingStatEventType }>;
export type FootballStatEvent = Extract<GameStatEvent, { type: FootballStatEventType }>;
export type StatVoidEvent = z.infer<typeof StatVoidEventSchema>;
export type StatCorrectionEvent = z.infer<typeof StatCorrectionEventSchema>;
