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

export type StatEventBody = DistributiveOmit<
  GameStatEvent,
  'eventId' | 'recordedAt' | StatEventRecorderField | StatEventSnapshotField
>;
export type StatVoidBody = Extract<StatEventBody, { type: typeof STAT_VOID_EVENT_TYPE }>;
export type StatCorrectionBody = Extract<
  StatEventBody,
  { type: typeof STAT_CORRECTION_EVENT_TYPE }
>;
export type SportStatEventBody = Exclude<StatEventBody, StatVoidBody | StatCorrectionBody>;

export function isStatVoid(event: StatEventBody): event is StatVoidBody {
  return event.type === STAT_VOID_EVENT_TYPE;
}

export function isStatCorrection(event: StatEventBody): event is StatCorrectionBody {
  return event.type === STAT_CORRECTION_EVENT_TYPE;
}

export function isSportStatEventIn(
  eventTypes: readonly string[],
  event: StatEventBody | undefined,
): event is SportStatEventBody {
  return event !== undefined && eventTypes.includes(event.type);
}

export type GameTeamLine = GameStats['teamStats'][string];
export type GamePlayerLine = GameStats['playerStats'][string];

export type StatLineValues = { readonly [field: string]: number | readonly (number | null)[] };

export interface StatEventRoster {
  readonly teamIds: readonly string[];
  readonly rosterPlayerIds: ReadonlySet<string>;
}

export type StatEventVerdict =
  { readonly ok: true } | { readonly ok: false; readonly code: StatEventRefusalCode };

export const STAT_EVENT_ACCEPTED: StatEventVerdict = { ok: true };

export function refuseStatEvent(code: StatEventRefusalCode): StatEventVerdict {
  return { ok: false, code };
}

export type FinalizationReadiness =
  { readonly ready: true } | { readonly ready: false; readonly reason: FinalizationNotReadyReason };

export const FINALIZATION_READY: FinalizationReadiness = { ready: true };

export interface CorrectableFields {
  readonly team: readonly StatCounterKey[];
  readonly player: readonly StatCounterKey[];
}

export interface SportScoring {
  readonly validate: (
    state: GameStats,
    event: StatEventBody,
    roster: StatEventRoster,
  ) => StatEventVerdict;
  readonly apply: (state: GameStats, event: StatEventBody) => GameStats;
  readonly undo: (state: GameStats, target: StatEventBody) => GameStats;
  readonly deriveLine: (kind: StatLineKind, line: StatLineValues) => StatLineValues;
  readonly correctableFields: CorrectableFields;
  readonly nextRound: (state: GameStats) => number | null;
  readonly finalizationReadiness: (state: GameStats, game: GameTeamIds) => FinalizationReadiness;
  readonly participation: (
    state: GameStats,
    rosterPlayerIds: readonly string[],
    absentRosterPlayerIds: readonly string[],
  ) => string[];
  readonly contribution: (game: FinalizedGame) => GameContribution;
}

export function isAllZeroLine(line: StatLineValues, counterKeys: readonly string[]): boolean {
  return counterKeys.every((key) => line[key] === 0 || line[key] === undefined);
}
