// The scoring half of the sport adapter contract: the pure members the store driver, the replay, the
// client's optimistic queue, and the aggregate cores call (SPORT-003). None issues a Firestore
// operation or an increment, reads a clock, or mints an id.
//
// Every member is typed over every sport's shapes, so any registered adapter is called the same way.
// The registry chose the adapter by the game's `leagueType`, which is what makes the rollup it is
// handed that sport's (SPORT-002); an event of another sport is refused by `validate` and thrown on
// by `apply` and `undo`, never guessed at.

import type { GameStatEvent } from '../doc-schemas/game-stats.js';
import type { GameStats } from '../doc-schemas/sport-game.js';
import type { StatCounterKey } from '../types/sports.js';
import { STAT_CORRECTION_EVENT_TYPE, STAT_VOID_EVENT_TYPE } from '../types/stats.js';
import type {
  FinalizationNotReadyReason,
  StatEventRecorderField,
  StatEventRefusalCode,
  StatEventSnapshotField,
  StatLineKind,
} from '../types/stats.js';
import type { FinalizedGame, GameContribution } from './contribution.js';
import type { GameTeamIds } from './sport-adapter.js';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * What an event says happened — its type and its payload. Its id, its `recordedAt`, and what the
 * writing core stamps on it are not part of it, so a stored event, a queued one, and a drafted one
 * are all bodies.
 */
export type StatEventBody = DistributiveOmit<
  GameStatEvent,
  'eventId' | 'recordedAt' | StatEventRecorderField | StatEventSnapshotField
>;
export type StatVoidBody = Extract<StatEventBody, { type: typeof STAT_VOID_EVENT_TYPE }>;
export type StatCorrectionBody = Extract<StatEventBody, { type: typeof STAT_CORRECTION_EVENT_TYPE }>;
/** One of a sport's own events, as opposed to the store-level void and correction. */
export type SportStatEventBody = Exclude<StatEventBody, StatVoidBody | StatCorrectionBody>;

export function isStatVoid(event: StatEventBody): event is StatVoidBody {
  return event.type === STAT_VOID_EVENT_TYPE;
}

export function isStatCorrection(event: StatEventBody): event is StatCorrectionBody {
  return event.type === STAT_CORRECTION_EVENT_TYPE;
}

/** Whether `event` is one of the sport events `eventTypes` declares — never a void or a correction. */
export function isSportStatEventIn(
  eventTypes: readonly string[],
  event: StatEventBody | undefined,
): event is SportStatEventBody {
  return event !== undefined && eventTypes.includes(event.type);
}

/** One team's line in a game's rollup, whichever sport it counts. */
export type GameTeamLine = GameStats['teamStats'][string];
/** One roster entry's line in a game's rollup, whichever sport it counts. */
export type GamePlayerLine = GameStats['playerStats'][string];

/** A stat line of any kind as `deriveLine` reads and returns it: its counters, derived fields, and ends. */
export type StatLineValues = { readonly [field: string]: number | readonly (number | null)[] };

/** The game an event is validated against: its teams, and the roster entries the batch names. */
export interface StatEventRoster {
  /** A team of the game is one of these — never inferred from which team lines a rollup holds. */
  readonly teamIds: readonly string[];
  /** The roster entries the driver read for the batch — never the whole roster. */
  readonly rosterPlayerIds: ReadonlySet<string>;
}

export type StatEventVerdict = { readonly ok: true } | { readonly ok: false; readonly code: StatEventRefusalCode };

export const STAT_EVENT_ACCEPTED: StatEventVerdict = { ok: true };

export function refuseStatEvent(code: StatEventRefusalCode): StatEventVerdict {
  return { ok: false, code };
}

export type FinalizationReadiness =
  | { readonly ready: true }
  | { readonly ready: false; readonly reason: FinalizationNotReadyReason };

export const FINALIZATION_READY: FinalizationReadiness = { ready: true };

/** The fields a `STAT_CORRECTION` may change, on a team line and on a player line. */
export interface CorrectableFields {
  readonly team: readonly StatCounterKey[];
  readonly player: readonly StatCounterKey[];
}

export interface SportScoring {
  /**
   * Whether a new event may be recorded against `state`: its type is the sport's, its team is one
   * of the game's, every person it names is a roster entry of that team, and its values are a real
   * result. Only the store driver calls it, and only for a new event — a replay never re-validates
   * what was already accepted.
   */
  readonly validate: (state: GameStats, event: StatEventBody, roster: StatEventRoster) => StatEventVerdict;
  /**
   * `state` with one sport event or one `STAT_CORRECTION` applied. A missing line is created from
   * the sport's empty line (SPORT-105); a player line whose counters all return to zero is dropped;
   * a team line never is. Throws on a void, another sport's event, or a correction to a field not in
   * `correctableFields`.
   */
  readonly apply: (state: GameStats, event: StatEventBody) => GameStats;
  /** The exact inverse of `apply(target)` for one of the sport's own events (SPORT-103). */
  readonly undo: (state: GameStats, target: StatEventBody) => GameStats;
  /** `line` with every derived field of its kind; the only caller of any derivation formula. */
  readonly deriveLine: (kind: StatLineKind, line: StatLineValues) => StatLineValues;
  readonly correctableFields: CorrectableFields;
  /** The next round to record for a sport played in rounds, `null` once all are or for any other sport. */
  readonly nextRound: (state: GameStats) => number | null;
  /** Whether the game may be finalized (SPORT-202). */
  readonly finalizationReadiness: (state: GameStats, game: GameTeamIds) => FinalizationReadiness;
  /**
   * The games-played decision finalize stores: the roster entries credited no game played, from
   * each entry's own line and absence, in roster order (SPORT-204).
   */
  readonly participation: (
    state: GameStats,
    rosterPlayerIds: readonly string[],
    absentRosterPlayerIds: readonly string[],
  ) => string[];
  /** What a completed game adds to every derived destination (SPORT-207). */
  readonly contribution: (game: FinalizedGame) => GameContribution;
}

/** Whether every counter of a line is zero — a player line the rollup then leaves out. */
export function isAllZeroLine(line: StatLineValues, counterKeys: readonly string[]): boolean {
  return counterKeys.every((key) => line[key] === 0 || line[key] === undefined);
}
