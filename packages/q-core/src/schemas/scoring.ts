import { z } from 'zod';
import { MAX_STAT_EVENTS_PER_WRITE } from '../constants/sports.js';
import { isSportStatEventId } from '../ids/stat-event-ids.js';
import { GAME_MEMO_INPUT_FORMAT } from '../input-formats/input-formats.js';
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
  gameIdSchema,
  gameRosterPlayerIdSchema,
  statEventIdSchema,
  teamIdSchema,
  textFieldSchema,
  userIdSchema,
} from '../doc-schemas/atoms.js';

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

export const sportStatEventIdSchema = statEventIdSchema.refine(
  isSportStatEventId,
  'Not a stat event id.',
);

const sportEventId = { eventId: sportStatEventIdSchema };

export const StatEventSubmissionSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...callerShape(BasketballOnePointEventSchema.shape), ...sportEventId }),
  z.strictObject({ ...callerShape(BasketballAssistableShotEventSchema.shape), ...sportEventId }),
  z.strictObject({ ...callerShape(BasketballPlayerTallyEventSchema.shape), ...sportEventId }),
  z.strictObject({ ...callerShape(BasketballTimeoutEventSchema.shape), ...sportEventId }),
  z.strictObject({
    ...callerShape(BasketballBulkEditEventSchema.shape),
    ...sportEventId,
    previousValue: countSchema,
  }),
  z.strictObject({ ...callerShape(CurlingRoundScoreEventSchema.shape), ...sportEventId }),
  z.strictObject({ ...callerShape(CurlingBlankEndEventSchema.shape), ...sportEventId }),
  z.strictObject({ ...callerShape(FootballScoreEventSchema.shape), ...sportEventId }),
  z.strictObject({ ...callerShape(FootballBulkEditEventSchema.shape), ...sportEventId }),
  z.strictObject({
    ...callerShape(StatVoidEventSchema.shape, ['eventId']),
    targetEventId: sportStatEventIdSchema,
  }),
  z.strictObject(callerShape(StatCorrectionEventSchema.shape)),
]);
export type StatEventSubmission = z.infer<typeof StatEventSubmissionSchema>;

export const RecordGameStatEventsInputSchema = z
  .object({
    gameId: gameIdSchema,
    events: z.array(StatEventSubmissionSchema).min(1).max(MAX_STAT_EVENTS_PER_WRITE),
  })
  .strict();
export type RecordGameStatEventsInput = z.infer<typeof RecordGameStatEventsInputSchema>;

export const RecordedStatEventSchema = z
  .object({
    eventId: statEventIdSchema,
    outcome: z.enum(RECORDED_STAT_EVENT_OUTCOME_KEYS),
    sequence: z.number().int().positive(),
  })
  .strict();
export type RecordedStatEvent = z.infer<typeof RecordedStatEventSchema>;

export const RecordGameStatEventsResultSchema = z
  .object({
    gameId: gameIdSchema,
    events: z.array(RecordedStatEventSchema),
  })
  .strict();
export type RecordGameStatEventsResult = z.infer<typeof RecordGameStatEventsResultSchema>;

export const StatEventRefusalDetailsSchema = z
  .object({
    refusal: z.enum(STAT_EVENT_REFUSAL_KEYS),
    eventId: statEventIdSchema,
  })
  .strict();
export type StatEventRefusalDetails = z.infer<typeof StatEventRefusalDetailsSchema>;

export const UpdateGameAbsentPlayersInputSchema = z
  .object({
    gameId: gameIdSchema,
    gameRosterPlayerId: gameRosterPlayerIdSchema,
    absent: z.boolean(),
  })
  .strict();
export type UpdateGameAbsentPlayersInput = z.infer<typeof UpdateGameAbsentPlayersInputSchema>;

export const UpdateGameAbsentPlayersResultSchema = z
  .object({
    gameId: gameIdSchema,
    gameRosterPlayerId: gameRosterPlayerIdSchema,
    absent: z.boolean(),
    changed: z.boolean(),
  })
  .strict();
export type UpdateGameAbsentPlayersResult = z.infer<typeof UpdateGameAbsentPlayersResultSchema>;

export const gameMemoSchema = textFieldSchema(GAME_MEMO_INPUT_FORMAT);

export const UpdateGameMemoInputSchema = z
  .object({
    gameId: gameIdSchema,
    userId: userIdSchema,
    memo: gameMemoSchema,
  })
  .strict();
export type UpdateGameMemoInput = z.infer<typeof UpdateGameMemoInputSchema>;

export const UpdateGameMemoResultSchema = z
  .object({
    gameId: gameIdSchema,
    userId: userIdSchema,
    memo: z.string(),
    changed: z.boolean(),
  })
  .strict();
export type UpdateGameMemoResult = z.infer<typeof UpdateGameMemoResultSchema>;

export const UpdateGameJumpBallInputSchema = z
  .object({
    gameId: gameIdSchema,
    teamId: teamIdSchema,
  })
  .strict();
export type UpdateGameJumpBallInput = z.infer<typeof UpdateGameJumpBallInputSchema>;

export const UpdateGameJumpBallResultSchema = z
  .object({
    gameId: gameIdSchema,
    teamId: teamIdSchema,
    changed: z.boolean(),
  })
  .strict();
export type UpdateGameJumpBallResult = z.infer<typeof UpdateGameJumpBallResultSchema>;
