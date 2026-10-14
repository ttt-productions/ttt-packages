// The game tier of the stats model: the stat event documents, and the rollup the game document
// carries (SPORT-001, SPORT-101, SPORT-102).
//
// Each stat event is its own document, `sportGames/{gameId}/gameStatEvents/{eventId}`, and the
// event documents are the source of truth: at every commit the game's `stats` equals their replay,
// in `sequence` order, from the sport's empty stats. The store is append-only — an undo appends a
// `STAT_VOID` and a correction a `STAT_CORRECTION`; no event is ever edited.
//
// An event names people by id; names resolve from `publicUsers` at read time (ARCH-103, SPORT-104).
// `displayNameSnapshot` and `assistedByDisplayNameSnapshot` are carried only by copied events, as
// the audit record of the name the stat was entered under — never read as identity.

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

// ---------------------------------------------------------------------------------------------
// Lines — one per team of the game, one per roster entry holding a non-zero player line
// ---------------------------------------------------------------------------------------------

// A line's counters: one field per key of the sport's declared stat-key set (SPORT-007), so a key
// added to the set is a field of every line built from it.
function counterShape<K extends StatCounterKey>(keys: readonly K[]): Record<K, typeof countSchema> {
  return Object.fromEntries(keys.map((key) => [key, countSchema])) as Record<K, typeof countSchema>;
}

export const BasketballTeamStatsSchema = z.strictObject(counterShape(BASKETBALL_TEAM_STAT_KEYS));
export type BasketballTeamStats = z.infer<typeof BasketballTeamStatsSchema>;

// `fantasyPoints` is `basketballFantasyPoints` of the line's own counters, on every basketball
// player line — this game line and the totals lines built from it — stored so every table and
// aggregate reads it rather than deriving it. FP is linear in the counters, so a totals line's FP
// equals the sum of its games' FP.
export const BasketballPlayerStatsSchema = z.strictObject({
  ...counterShape(BASKETBALL_PLAYER_STAT_KEYS),
  fantasyPoints: z.number().nonnegative(),
});
export type BasketballPlayerStats = z.infer<typeof BasketballPlayerStatsSchema>;

// `roundScores[n]` is end n + 1: `null` until the end is recorded, `0` on both teams for a blank end.
// `score` is the sum of the recorded ends.
export const CurlingTeamStatsSchema = z.strictObject({
  ...counterShape(CURLING_TEAM_STAT_KEYS),
  roundScores: z
    .array(z.number().int().min(0).max(MAX_CURLING_ROUND_POINTS).nullable())
    .length(CURLING_ROUND_COUNT),
});
export type CurlingTeamStats = z.infer<typeof CurlingTeamStatsSchema>;

export const FootballTeamStatsSchema = z.strictObject(counterShape(FOOTBALL_TEAM_STAT_KEYS));
export type FootballTeamStats = z.infer<typeof FootballTeamStatsSchema>;

// ---------------------------------------------------------------------------------------------
// The payload — exactly two keys for every sport (SPORT-001)
// ---------------------------------------------------------------------------------------------

// The one declaration of the game `stats` payload. Each sport's is built through it from that
// sport's game lines in `SPORT_LINE_SCHEMAS`, as `SPORT_GAME_STATS_SCHEMAS`. `playerStats` is keyed
// by roster entry, never by person, so a person on both teams of a game holds a line on each side. A
// sport with no player lines passes `z.never()`, so its map stays empty.
export function gameStatsSchema<TeamLine extends z.ZodType, PlayerLine extends z.ZodType>(
  teamLine: TeamLine,
  playerLine: PlayerLine,
) {
  return z.strictObject({
    teamStats: z.record(teamIdSchema, teamLine),
    playerStats: z.record(gameRosterPlayerIdSchema, playerLine),
  });
}

// ---------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------

// Every event: its id, its place in the replay, and when it was entered. The recorder facts are
// derived by the writing core, never taken from the payload (ARCH-106); a copied event has none.
const statEventBase = {
  eventId: statEventIdSchema,
  sequence: z.number().int().positive(),
  recordedAt: epochMsSchema,
  acceptedAt: epochMsSchema.optional(),
  recordedByUserId: userIdSchema.optional(),
  recordedByAuthority: z.enum(STAT_EVENT_AUTHORITY_KEYS).optional(),
  // Only for the two team roles: the team whose authority the event was recorded under.
  recordedByTeamId: teamIdSchema.optional(),
};

// A player-attributed event names the roster entry `{teamId}_{playerUserId}` whose line it changes.
const playerEventFields = {
  teamId: teamIdSchema,
  playerUserId: userIdSchema,
  displayNameSnapshot: z.string().optional(),
};

// Basketball

export const BasketballOnePointEventSchema = z.strictObject({
  ...statEventBase,
  ...playerEventFields,
  type: z.literal(BASKETBALL_ONE_POINT_EVENT_TYPE),
});

// An assisted shot names its assister on the same event, which credits both players.
export const BasketballAssistableShotEventSchema = z
  .strictObject({
    ...statEventBase,
    ...playerEventFields,
    type: z.enum(BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS),
    assistedByUserId: userIdSchema.optional(),
    assistedByDisplayNameSnapshot: z.string().optional(),
  })
  .refine(
    (event) => event.assistedByDisplayNameSnapshot === undefined || event.assistedByUserId !== undefined,
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

// A scorer's edit: `value` is the signed change to `stat`, entered against `previousValue`, the
// value the form showed. A copied bulk edit has no `previousValue`; nothing validates one again.
export const BasketballBulkEditEventSchema = z.strictObject({
  ...statEventBase,
  ...playerEventFields,
  type: z.literal(BASKETBALL_BULK_EDIT_EVENT_TYPE),
  stat: basketballBulkStatKeySchema,
  value: z.number().int(),
  previousValue: countSchema.optional(),
});

// Curling — an event names the end it records; it names no player.

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

// Football — team-attributed only.

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

// The store-level events, members of every sport's union.

// Undoes exactly the event it targets. Its id is derived from the target, so a target has at most
// one void and a second undo of the same event is the same document.
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

// Adds `value` to one correctable field of one line — the player line `{teamId}_{playerUserId}`
// when it names a player, the team line of `teamId` when it does not. It never cascades: a player
// correction does not move the team's score.
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
    // The ghost a link re-keyed this correction's player line from. The id was derived from the
    // ghost's line when the correction was written, and a document id never changes.
    rekeyedFromGhostUserId: userIdSchema.optional(),
  })
  .refine(
    (event) =>
      event.eventId ===
      buildStatCorrectionId(
        event.operationId,
        event.playerUserId === undefined
          ? event.teamId
          : buildGameRosterPlayerId(event.teamId, event.rekeyedFromGhostUserId ?? event.playerUserId),
        event.stat,
      ),
    { message: 'A correction is stored at the id its operation, line, and field derive.', path: ['eventId'] },
  );

// Recorder facts are all present or all absent, and a team is named exactly when the authority is a
// team role.
function recorderFactsAgree(event: {
  acceptedAt?: number;
  recordedByUserId?: string;
  recordedByAuthority?: (typeof STAT_EVENT_AUTHORITY_KEYS)[number];
  recordedByTeamId?: string;
}): boolean {
  const facts = [event.acceptedAt, event.recordedByUserId, event.recordedByAuthority];
  const present = facts.filter((fact) => fact !== undefined).length;
  if (present !== 0 && present !== facts.length) return false;
  const teamAuthority = (CAPTAIN_TEAM_ROLES as readonly string[]).includes(event.recordedByAuthority ?? '');
  return teamAuthority === (event.recordedByTeamId !== undefined);
}

// A name snapshot is the audit record a copied event keeps of the name its stat was entered under.
// Only the writing core stamps recorder facts, and it writes ids only, so an event carrying both a
// snapshot and a recorder fact is refused (ARCH-103, SPORT-104).
function snapshotsOnlyOnCopiedEvents(event: {
  acceptedAt?: number;
  recordedByUserId?: string;
  recordedByAuthority?: string;
  recordedByTeamId?: string;
  displayNameSnapshot?: string;
  assistedByDisplayNameSnapshot?: string;
}): boolean {
  const snapshot = event.displayNameSnapshot !== undefined || event.assistedByDisplayNameSnapshot !== undefined;
  const recorded = [event.acceptedAt, event.recordedByUserId, event.recordedByAuthority, event.recordedByTeamId].some(
    (fact) => fact !== undefined,
  );
  return !(snapshot && recorded);
}

// Event types are disjoint across sports, so `type` alone discriminates the whole union.
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
  .refine(recorderFactsAgree, 'Recorder facts are all present, or all absent, with a team only for a team role.')
  .refine(snapshotsOnlyOnCopiedEvents, 'A name snapshot belongs to a copied event, which carries no recorder facts.');
export type GameStatEvent = z.infer<typeof GameStatEventSchema>;
export type GameStatEventType = GameStatEvent['type'];

export type BasketballStatEvent = Extract<GameStatEvent, { type: BasketballStatEventType }>;
export type CurlingRoundScoreEvent = z.infer<typeof CurlingRoundScoreEventSchema>;
export type CurlingBlankEndEvent = z.infer<typeof CurlingBlankEndEventSchema>;
export type CurlingStatEvent = Extract<GameStatEvent, { type: CurlingStatEventType }>;
export type FootballStatEvent = Extract<GameStatEvent, { type: FootballStatEventType }>;
export type StatVoidEvent = z.infer<typeof StatVoidEventSchema>;
export type StatCorrectionEvent = z.infer<typeof StatCorrectionEventSchema>;
