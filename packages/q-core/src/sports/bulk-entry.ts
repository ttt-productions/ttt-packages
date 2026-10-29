// A sport's bulk entry: the form the shared bulk-entry dialog renders for the sport's kind, and the
// events a submission becomes. The form's rules are built from the sport's constants, and every one
// of them is also an event rule the adapter's `validate` enforces, because the callable sees events,
// never form values, and captains use it (RULE-QS-SPORT-906).

import { z } from 'zod';
import { countSchema } from '../doc-schemas/atoms.js';
import type { GameStats } from '../doc-schemas/sport-game.js';
import type { BulkEntryKind } from '../types/stats.js';
import type { SportStatEventBody, StatVoidBody } from './scoring.js';
import type { GameTeamIds } from './sport-adapter.js';

/** A recorded round's live event — one no void voids — so an edit of that round can void it. */
export interface LiveRoundEvent {
  readonly eventId: string;
  readonly roundNumber: number;
}

/** What the form edits: the game, the scorer's current state, and the game's roster. */
export interface BulkEntryContext {
  readonly game: GameTeamIds;
  /** The scorer's optimistic rollup, the queue's pending events applied. */
  readonly state: GameStats;
  /** Every roster entry of the game, grouped by team in the order the form lists them. */
  readonly rosterPlayerIds: readonly string[];
  readonly absentRosterPlayerIds: readonly string[];
  /** For a sport played in rounds, the game's unvoided round events; empty for any other sport. */
  readonly liveRoundEvents: readonly LiveRoundEvent[];
}

/**
 * One event of a submission, in batch order: a sport event's type and payload, or the target of a
 * void. At submit — the tap — the dialog mints each sport event's id and stamps its `recordedAt`, and
 * the queue sends the drafts as one unit it never splits across calls.
 */
export type StatEventDraft = SportStatEventBody | StatVoidBody;

export interface BulkEntryForm<K extends BulkEntryKind, Values> {
  readonly kind: K;
  /** The form's resolver: its rules for this game and state. */
  readonly formSchema: (context: BulkEntryContext) => z.ZodType<Values>;
  readonly formDefaults: (context: BulkEntryContext) => Values;
  /** The drafts a submission becomes; empty when nothing changed. */
  readonly toEvents: (values: Values, context: BulkEntryContext) => readonly StatEventDraft[];
}

/** Each roster entry's player counters, by roster entry id. */
export interface PlayerLinesValues {
  readonly lines: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

/** Each team's final score, by team id. */
export interface TeamScoresValues {
  readonly scores: Readonly<Record<string, number>>;
}

/** Each round, first to last: every team's points by team id, `null` where the round is not recorded. */
export interface RoundsValues {
  readonly rounds: readonly Readonly<Record<string, number | null>>[];
}

export type PlayerLinesBulkEntry = BulkEntryForm<'playerLines', PlayerLinesValues>;
export type TeamScoresBulkEntry = BulkEntryForm<'teamScores', TeamScoresValues>;
export type RoundsBulkEntry = BulkEntryForm<'rounds', RoundsValues>;

/** The dialog picks its form body by `kind`, from an exhaustive map over the kind union. */
export type BulkEntry = PlayerLinesBulkEntry | TeamScoresBulkEntry | RoundsBulkEntry;

/** The form's refusal when a submission would pass the per-write event cap. */
export const BULK_ENTRY_TOO_LARGE_MESSAGE =
  'This entry changes more stats than one save can hold. Save part of it, then enter the rest.';

/** The form's refusal of a value that is not a whole number of zero or more. */
export const BULK_ENTRY_COUNT_MESSAGE = 'Enter a whole number, zero or more.';

/**
 * Every bulk-entry cell that holds a count: the count atom's check, answered with the one message the
 * form shows for any failure of it — which the atom's own issues cannot carry.
 */
export const bulkEntryCountField = z.custom<number>(
  (value) => countSchema.safeParse(value).success,
  BULK_ENTRY_COUNT_MESSAGE,
);
