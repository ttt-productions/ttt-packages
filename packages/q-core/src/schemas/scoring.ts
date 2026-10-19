// Callable contracts for live scoring: recording stat events, marking a roster entry absent, a
// scorer's memo, and the jump-ball possession arrow. Each action is two entries over one core — the
// member entry for a captain or co-captain of one of the game's two teams, and the admin entry for
// an admin or referee — which share one input and one result.

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

// ---------------------------------------------------------------------------------------------
// Recording stat events
// ---------------------------------------------------------------------------------------------

type ServerDerivedField = StatEventRecorderField | StatEventSnapshotField;
const SERVER_DERIVED_FIELDS: ReadonlySet<string> = new Set([
  ...STAT_EVENT_RECORDER_FIELD_KEYS,
  ...STAT_EVENT_SNAPSHOT_FIELD_KEYS,
]);

/**
 * A stored event's fields as its caller sends them: without the sequence and recorder facts the
 * writing core derives (ARCH-106), and without a name snapshot, which only a copied event carries.
 * Built from the stored event's own declaration, so the wire and the document cannot drift.
 */
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

// A sport event's id as its caller sends it — the id minted at the tap, or, as a void's target, one a
// copied event kept. It becomes a document path, so it is held to the shape a sport event id has.
export const sportStatEventIdSchema = statEventIdSchema.refine(
  isSportStatEventId,
  'Not a stat event id.',
);

const sportEventId = { eventId: sportStatEventIdSchema };

/**
 * One event of a scoring write, as the tap minted it: a sport event with its id and `recordedAt`, or
 * a void naming its target, whose own id the core derives. A bulk edit carries `previousValue`, the
 * value the form showed, so a stale form is refused. A correction parses so the core can answer it
 * with its refusal: only the game-reconcile core appends one.
 */
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

// A queue drain, a bulk-entry submission, or an undo: one ordered batch, applied whole or not at all.
export const RecordGameStatEventsInputSchema = z
  .object({
    gameId: gameIdSchema,
    events: z.array(StatEventSubmissionSchema).min(1).max(MAX_STAT_EVENTS_PER_WRITE),
  })
  .strict();
export type RecordGameStatEventsInput = z.infer<typeof RecordGameStatEventsInputSchema>;

// Each event sent, in order: stored now, or found already stored by an earlier send.
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

// What a refused scoring write names in its error details: why, and the first event it refused. No
// event of the batch was stored, and the scorekeeper's failed list shows the refusal's copy beside
// that event.
export const StatEventRefusalDetailsSchema = z
  .object({
    refusal: z.enum(STAT_EVENT_REFUSAL_KEYS),
    eventId: statEventIdSchema,
  })
  .strict();
export type StatEventRefusalDetails = z.infer<typeof StatEventRefusalDetailsSchema>;

// ---------------------------------------------------------------------------------------------
// Absence — per roster entry, so a person on both teams can be absent on one side only
// ---------------------------------------------------------------------------------------------

export const UpdateGameAbsentPlayersInputSchema = z
  .object({
    gameId: gameIdSchema,
    gameRosterPlayerId: gameRosterPlayerIdSchema,
    absent: z.boolean(),
  })
  .strict();
export type UpdateGameAbsentPlayersInput = z.infer<typeof UpdateGameAbsentPlayersInputSchema>;

// `changed` is false when the entry was already marked that way; nothing was written.
export const UpdateGameAbsentPlayersResultSchema = z
  .object({
    gameId: gameIdSchema,
    gameRosterPlayerId: gameRosterPlayerIdSchema,
    absent: z.boolean(),
    changed: z.boolean(),
  })
  .strict();
export type UpdateGameAbsentPlayersResult = z.infer<typeof UpdateGameAbsentPlayersResultSchema>;

// ---------------------------------------------------------------------------------------------
// The memo — a scorer's note on one person in a live game ("red shirt", "#9")
// ---------------------------------------------------------------------------------------------

// Built from the memo's one declaration, so the memo form and the callable accept exactly the same
// text: trimmed, one line, empty allowed — an empty memo clears the person's note.
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

// ---------------------------------------------------------------------------------------------
// The jump-ball possession arrow — set to a team, so a retried call lands where the first did
// ---------------------------------------------------------------------------------------------

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
