import { z } from 'zod';
import { countSchema } from '../doc-schemas/atoms.js';
import type { GameStats } from '../doc-schemas/sport-game.js';
import type { BulkEntryKind } from '../types/stats.js';
import type { SportStatEventBody, StatVoidBody } from './scoring.js';
import type { GameTeamIds } from './sport-adapter.js';

export interface LiveRoundEvent {
  readonly eventId: string;
  readonly roundNumber: number;
}

export interface BulkEntryContext {
  readonly game: GameTeamIds;
  readonly state: GameStats;
  readonly rosterPlayerIds: readonly string[];
  readonly absentRosterPlayerIds: readonly string[];
  readonly liveRoundEvents: readonly LiveRoundEvent[];
}

export type StatEventDraft = SportStatEventBody | StatVoidBody;

export interface BulkEntryForm<K extends BulkEntryKind, Values> {
  readonly kind: K;
  readonly formSchema: (context: BulkEntryContext) => z.ZodType<Values, Values>;
  readonly formDefaults: (context: BulkEntryContext) => Values;
  readonly toEvents: (values: Values, context: BulkEntryContext) => readonly StatEventDraft[];
}

export interface PlayerLinesValues {
  readonly lines: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export interface TeamScoresValues {
  readonly scores: Readonly<Record<string, number>>;
}

export interface RoundsValues {
  readonly rounds: readonly Readonly<Record<string, number | null>>[];
}

export type PlayerLinesBulkEntry = BulkEntryForm<'playerLines', PlayerLinesValues>;
export type TeamScoresBulkEntry = BulkEntryForm<'teamScores', TeamScoresValues>;
export type RoundsBulkEntry = BulkEntryForm<'rounds', RoundsValues>;

export type BulkEntry = PlayerLinesBulkEntry | TeamScoresBulkEntry | RoundsBulkEntry;

export const BULK_ENTRY_TOO_LARGE_MESSAGE =
  'This entry changes more stats than one save can hold. Save part of it, then enter the rest.';

export const BULK_ENTRY_COUNT_MESSAGE = 'Enter a whole number, zero or more.';

export const bulkEntryCountField = z.custom<number>(
  (value) => countSchema.safeParse(value).success,
  BULK_ENTRY_COUNT_MESSAGE,
);
