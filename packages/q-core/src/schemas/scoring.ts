import { z } from 'zod';
import { MAX_STAT_EVENTS_PER_WRITE } from '../constants/sports.js';
import { isSportStatEventId } from '../ids/stat-event-ids.js';
import { GAME_MEMO_INPUT } from '../constants/text-fields.js';
import {
  BasketballAssistableShotEventSchema,
  BasketballBulkEditEventSchema,
  BasketballOnePointEventSchema,
  BasketballPlayerTallyEventSchema,
  BasketballTimeoutEventSchema,
  CurlingBlankEndEventSchema,
  CurlingRoundScoreEventSchema,
  FootballBulkEditEventSchema,
  FootballScoreEventSchema,
  StatCorrectionEventSchema,
  StatVoidEventSchema,
} from '../doc-schemas/game-stats.js';
import {
  RECORDED_STAT_EVENT_OUTCOME_KEYS,
  STAT_EVENT_RECORDER_FIELD_KEYS,
  STAT_EVENT_REFUSAL_KEYS,
  STAT_EVENT_SNAPSHOT_FIELD_KEYS,
} from '../types/stats.js';
import type { StatEventRecorderField, StatEventSnapshotField } from '../types/stats.js';
import {
  countSchema,
  enteredStatCountSchema,
  gameIdSchema,
  gameRosterPlayerIdSchema,
  statEventIdSchema,
  teamIdSchema,
  userIdSchema,
} from '../doc-schemas/atoms.js';
import { textFieldSchema } from './text-field.js';

type ServerDerivedField = StatEventRecorderField | StatEventSnapshotField;
const SERVER_DERIVED_FIELDS: ReadonlySet<string> = new Set([
  ...STAT_EVENT_RECORDER_FIELD_KEYS,
  ...STAT_EVENT_SNAPSHOT_FIELD_KEYS,
]);

function callerShape<Shape extends z.ZodRawShape, Omitted extends keyof Shape = never>(
  shape: Shape,
  omitted: readonly Omitted[] = [],
): Omit<Shape, ServerDerivedField | Omitted> {
  const dropped = new Set<PropertyKey>([...SERVER_DERIVED_FIELDS, ...omitted]);
  return Object.fromEntries(Object.entries(shape).filter(([field]) => !dropped.has(field))) as Omit<
    Shape,
    ServerDerivedField | Omitted
  >;
}

const sportStatEventIdSchema = statEventIdSchema.refine(isSportStatEventId, 'Not a stat event id.');

const sportEventId = { eventId: sportStatEventIdSchema };

export const StatEventSubmissionSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...callerShape(BasketballOnePointEventSchema.shape), ...sportEventId }),
  z.strictObject({ ...callerShape(BasketballAssistableShotEventSchema.shape), ...sportEventId }),
  z.strictObject({ ...callerShape(BasketballPlayerTallyEventSchema.shape), ...sportEventId }),
  z.strictObject({ ...callerShape(BasketballTimeoutEventSchema.shape), ...sportEventId }),
  z.strictObject({
    ...callerShape(BasketballBulkEditEventSchema.shape, ['value', 'previousValue']),
    ...sportEventId,
    target: enteredStatCountSchema,
  }),
  z.strictObject({ ...callerShape(CurlingRoundScoreEventSchema.shape), ...sportEventId }),
  z.strictObject({ ...callerShape(CurlingBlankEndEventSchema.shape), ...sportEventId }),
  z.strictObject({ ...callerShape(FootballScoreEventSchema.shape), ...sportEventId }),
  z.strictObject({
    ...callerShape(FootballBulkEditEventSchema.shape, ['value', 'previousValue']),
    ...sportEventId,
    target: enteredStatCountSchema,
  }),
  z.strictObject({
    ...callerShape(StatVoidEventSchema.shape, ['eventId']),
    targetEventId: sportStatEventIdSchema,
  }),
  z.strictObject(callerShape(StatCorrectionEventSchema.shape)),
]);
export type StatEventSubmission = z.infer<typeof StatEventSubmissionSchema>;

export const CreateGameStatEventInputSchema = z
  .object({
    gameId: gameIdSchema,
    events: z.array(StatEventSubmissionSchema).min(1).max(MAX_STAT_EVENTS_PER_WRITE),
  })
  .strict();
export type CreateGameStatEventInput = z.infer<typeof CreateGameStatEventInputSchema>;

export const RecordedStatEventSchema = z
  .object({
    eventId: statEventIdSchema,
    outcome: z.enum(RECORDED_STAT_EVENT_OUTCOME_KEYS),
    sequence: countSchema,
  })
  .strict();
export type RecordedStatEvent = z.infer<typeof RecordedStatEventSchema>;

export const CreateGameStatEventResultSchema = z
  .object({
    gameId: gameIdSchema,
    events: z.array(RecordedStatEventSchema),
  })
  .strict();
export type CreateGameStatEventResult = z.infer<typeof CreateGameStatEventResultSchema>;

export const StatEventRefusalDetailsSchema = z
  .object({
    refusal: z.enum(STAT_EVENT_REFUSAL_KEYS),
    eventId: statEventIdSchema,
  })
  .strict();
export type StatEventRefusalDetails = z.infer<typeof StatEventRefusalDetailsSchema>;

export const UpdateSportGameAbsentPlayersInputSchema = z
  .object({
    gameId: gameIdSchema,
    gameRosterPlayerId: gameRosterPlayerIdSchema,
    absent: z.boolean(),
  })
  .strict();
export type UpdateSportGameAbsentPlayersInput = z.infer<
  typeof UpdateSportGameAbsentPlayersInputSchema
>;

export const UpdateSportGameAbsentPlayersResultSchema = z
  .object({
    gameId: gameIdSchema,
    gameRosterPlayerId: gameRosterPlayerIdSchema,
    absent: z.boolean(),
    changed: z.boolean(),
  })
  .strict();
export type UpdateSportGameAbsentPlayersResult = z.infer<
  typeof UpdateSportGameAbsentPlayersResultSchema
>;

export const gameMemoSchema = textFieldSchema(GAME_MEMO_INPUT);

export const UpdateSportGameMemoInputSchema = z
  .object({
    gameId: gameIdSchema,
    userId: userIdSchema,
    memo: gameMemoSchema,
  })
  .strict();
export type UpdateSportGameMemoInput = z.infer<typeof UpdateSportGameMemoInputSchema>;

export const UpdateSportGameMemoResultSchema = z
  .object({
    gameId: gameIdSchema,
    userId: userIdSchema,
    memo: z.string(),
    changed: z.boolean(),
  })
  .strict();
export type UpdateSportGameMemoResult = z.infer<typeof UpdateSportGameMemoResultSchema>;

export const UpdateSportGameJumpBallInputSchema = z
  .object({
    gameId: gameIdSchema,
    teamId: teamIdSchema,
  })
  .strict();
export type UpdateSportGameJumpBallInput = z.infer<typeof UpdateSportGameJumpBallInputSchema>;

export const UpdateSportGameJumpBallResultSchema = z
  .object({
    gameId: gameIdSchema,
    teamId: teamIdSchema,
    changed: z.boolean(),
  })
  .strict();
export type UpdateSportGameJumpBallResult = z.infer<typeof UpdateSportGameJumpBallResultSchema>;
