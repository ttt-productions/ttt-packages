import type { GameStatEvent } from '../doc-schemas/game-stats.js';
import type { GameStats } from '../doc-schemas/sport-game.js';
import { buildStatVoidId } from '../ids/stat-event-ids.js';
import type { StatEventSubmission } from '../schemas/scoring.js';
import { STAT_EVENT_RECORDER_FIELD_KEYS, STAT_EVENT_SNAPSHOT_FIELD_KEYS } from '../types/stats.js';
import type { RecordedStatEventOutcome, StatEventRefusalCode } from '../types/stats.js';
import { foldStatEvent, withGameTeamLines } from './replay.js';
import {
  isSportStatEventIn,
  isStatCorrection,
  isStatVoid,
  type StatEventBody,
  type StatEventRoster,
} from './scoring.js';
import type { AnySportAdapter, GameTeamIds } from './sport-adapter.js';

export function statEventSubmissionId(submission: StatEventSubmission): string {
  return isStatVoid(submission) ? buildStatVoidId(submission.targetEventId) : submission.eventId;
}

export function statEventIdsToRead(submissions: readonly StatEventSubmission[]): string[] {
  const ids = new Set<string>();
  for (const submission of submissions) {
    if (isStatCorrection(submission)) continue;
    ids.add(statEventSubmissionId(submission));
    if (isStatVoid(submission)) ids.add(submission.targetEventId);
  }
  return [...ids];
}

export interface AcceptedStatEvent {
  readonly eventId: string;
  readonly sequence: number;
  readonly fields: Readonly<Record<string, unknown>>;
}

export interface RecordedStatEventResult {
  readonly eventId: string;
  readonly outcome: RecordedStatEventOutcome;
  readonly sequence: number;
}

export type StatEventBatchDecision =
  | {
      readonly ok: true;
      readonly stats: GameStats;
      readonly statEventSequence: number;
      readonly results: readonly RecordedStatEventResult[];
      readonly accepted: readonly AcceptedStatEvent[];
    }
  | {
      readonly ok: false;
      readonly code: StatEventRefusalCode;
      readonly eventId: string;
    };

export interface StatEventBatch {
  readonly adapter: AnySportAdapter;
  readonly game: GameTeamIds & { readonly stats: GameStats; readonly statEventSequence: number };
  readonly roster: StatEventRoster;
  readonly submissions: readonly StatEventSubmission[];
  readonly storedEvent: (eventId: string) => GameStatEvent | undefined;
}

const DERIVED_FIELDS: ReadonlySet<string> = new Set([
  ...STAT_EVENT_RECORDER_FIELD_KEYS,
  ...STAT_EVENT_SNAPSHOT_FIELD_KEYS,
]);

function callerFields(event: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(event).filter(
      ([field, value]) => !DERIVED_FIELDS.has(field) && value !== undefined,
    ),
  );
}

function sameFields(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  const leftFields = callerFields(left);
  const rightFields = callerFields(right);
  const keys = Object.keys(leftFields);
  return (
    keys.length === Object.keys(rightFields).length &&
    keys.every((key) => Object.is(leftFields[key], rightFields[key]))
  );
}

function isSameEvent(
  submission: StatEventSubmission,
  held: Readonly<Record<string, unknown>>,
): boolean {
  if (isStatVoid(submission))
    return isStatVoid(held as StatEventBody) && held.targetEventId === submission.targetEventId;
  return sameFields(submission as Readonly<Record<string, unknown>>, held);
}

function holdsNegativeValue(stats: GameStats): boolean {
  const lines = [...Object.values(stats.teamStats), ...Object.values(stats.playerStats)] as Record<
    string,
    unknown
  >[];
  return lines.some((line) =>
    Object.values(line).some((value) =>
      Array.isArray(value)
        ? value.some((slot) => typeof slot === 'number' && slot < 0)
        : typeof value === 'number' && value < 0,
    ),
  );
}

function acceptedFields(
  submission: StatEventSubmission,
  eventId: string,
  sequence: number,
): Record<string, unknown> {
  return { ...callerFields(submission as Readonly<Record<string, unknown>>), eventId, sequence };
}

export function decideStatEventBatch(batch: StatEventBatch): StatEventBatchDecision {
  const { adapter, game, roster, submissions, storedEvent } = batch;
  let stats = withGameTeamLines(adapter, game.stats, game);
  let sequence = game.statEventSequence;
  const results: RecordedStatEventResult[] = [];
  const accepted: AcceptedStatEvent[] = [];
  const placed = new Map<
    string,
    { readonly event: Readonly<Record<string, unknown>>; readonly sequence: number }
  >();

  for (const submission of submissions) {
    const eventId = statEventSubmissionId(submission);
    const refuse = (code: StatEventRefusalCode): StatEventBatchDecision => ({
      ok: false,
      code,
      eventId,
    });

    if (isStatCorrection(submission)) return refuse('correctionNotAccepted');

    const held =
      placed.get(eventId) ??
      (() => {
        const stored = storedEvent(eventId);
        return stored === undefined
          ? undefined
          : { event: stored as Readonly<Record<string, unknown>>, sequence: stored.sequence };
      })();
    if (held !== undefined) {
      if (!isSameEvent(submission, held.event)) return refuse('eventIdConflict');
      placed.set(eventId, held);
      results.push({ eventId, outcome: 'alreadyRecorded', sequence: held.sequence });
      continue;
    }

    if (isStatVoid(submission)) {
      const target =
        placed.get(submission.targetEventId)?.event ?? storedEvent(submission.targetEventId);
      if (!isSportStatEventIn(adapter.eventTypes, target as StatEventBody | undefined)) {
        return refuse('voidTargetNotSportEvent');
      }
      const next = foldStatEvent(adapter, stats, submission, () => target as StatEventBody);
      if (holdsNegativeValue(next)) return refuse('undoBelowZero');
      stats = next;
    } else {
      const verdict = adapter.validate(stats, submission, roster);
      if (!verdict.ok) return refuse(verdict.code);
      stats = foldStatEvent(adapter, stats, submission, () => undefined);
    }

    sequence += 1;
    const fields = acceptedFields(submission, eventId, sequence);
    accepted.push({ eventId, sequence, fields });
    placed.set(eventId, { event: fields, sequence });
    results.push({ eventId, outcome: 'recorded', sequence });
  }

  return { ok: true, stats, statEventSequence: sequence, results, accepted };
}
