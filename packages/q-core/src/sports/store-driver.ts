// The store driver's decision half: what one scoring write does with the batch of events it was
// sent, given what the game already holds. It owns ids, the sequence, void resolution, and the fold;
// everything sport-shaped is the adapter's (SPORT-003). The writing core reads the game, the stored
// events the batch names, and the roster entries it names, hands them here, and writes what comes
// back — one transaction, all or nothing.
//
// An event id is the idempotency key (SPORT-102): an id already stored, or earlier in the batch, is
// acknowledged when its content matches and never applied again, so re-sending a batch whose first
// send timed out after committing changes nothing. A void's id is derived from its target, so a
// second undo of one event is the same document and is acknowledged too.

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

/** The document id a submission is stored at. */
export function statEventSubmissionId(submission: StatEventSubmission): string {
  return isStatVoid(submission) ? buildStatVoidId(submission.targetEventId) : submission.eventId;
}

/**
 * The ids a batch reads before it decides anything: every submission's own id, and every void's
 * target — the driver needs the stored document at each, or knows none is stored. A correction's is
 * never read: the driver refuses one before it looks at the store.
 */
export function statEventIdsToRead(submissions: readonly StatEventSubmission[]): string[] {
  const ids = new Set<string>();
  for (const submission of submissions) {
    if (isStatCorrection(submission)) continue;
    ids.add(statEventSubmissionId(submission));
    if (isStatVoid(submission)) ids.add(submission.targetEventId);
  }
  return [...ids];
}

/** An event the batch stores now: its id, its place in the replay, and every field its caller sent. */
export interface AcceptedStatEvent {
  readonly eventId: string;
  readonly sequence: number;
  /** The document's fields but the recorder facts, which the writing core stamps (ARCH-106). */
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
      /** The rollup after the batch — unchanged when every event was already recorded. */
      readonly stats: GameStats;
      readonly statEventSequence: number;
      /** Each submission's result, in the order sent. */
      readonly results: readonly RecordedStatEventResult[];
      /** The events to create, in sequence order; empty when every event was already recorded. */
      readonly accepted: readonly AcceptedStatEvent[];
    }
  | {
      readonly ok: false;
      readonly code: StatEventRefusalCode;
      /** The first submission refused; nothing of the batch is written. */
      readonly eventId: string;
    };

export interface StatEventBatch {
  readonly adapter: AnySportAdapter;
  readonly game: GameTeamIds & { readonly stats: GameStats; readonly statEventSequence: number };
  /** The game's teams and the roster entries the batch names that exist. */
  readonly roster: StatEventRoster;
  readonly submissions: readonly StatEventSubmission[];
  /** The stored event at an id `statEventIdsToRead` named, or `undefined` where none is stored. */
  readonly storedEvent: (eventId: string) => GameStatEvent | undefined;
}

// The fields of a stored event the writing core derives, which a caller's re-send never carries.
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

/**
 * Whether a submission is the event already held at its id. A void is the same void when it names
 * the same target; a sport event only when every field its caller supplies is the same.
 */
function isSameEvent(
  submission: StatEventSubmission,
  held: Readonly<Record<string, unknown>>,
): boolean {
  if (isStatVoid(submission))
    return isStatVoid(held as StatEventBody) && held.targetEventId === submission.targetEventId;
  return sameFields(submission as Readonly<Record<string, unknown>>, held);
}

/** Whether any counter, or any recorded round, of any line is below zero. */
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

/** The stored fields of a new event: the void's derived id, or the caller's own id and fields. */
function acceptedFields(
  submission: StatEventSubmission,
  eventId: string,
  sequence: number,
): Record<string, unknown> {
  return { ...callerFields(submission as Readonly<Record<string, unknown>>), eventId, sequence };
}

/**
 * Decide one scoring write. Every submission in order, against a running rollup that starts from
 * the stored one with a team line for each of the game's teams:
 *
 * - a correction → refused; only the game-reconcile core appends one;
 * - an id already stored, or earlier in the batch → acknowledged when it is the same event, and
 *   refused (`eventIdConflict`) when it is not;
 * - a new sport event → the adapter validates it and applies it, and it takes the next sequence;
 * - a new void → its target, stored or earlier in the batch, must be one of the sport's events; the
 *   adapter undoes it, and it takes the next sequence. A void that would leave a stat below zero —
 *   the target's field moved down by a later edit — is refused (`undoBelowZero`).
 *
 * The first refusal refuses the whole batch.
 */
export function decideStatEventBatch(batch: StatEventBatch): StatEventBatchDecision {
  const { adapter, game, roster, submissions, storedEvent } = batch;
  let stats = withGameTeamLines(adapter, game.stats, game);
  let sequence = game.statEventSequence;
  const results: RecordedStatEventResult[] = [];
  const accepted: AcceptedStatEvent[] = [];
  // Every event the batch has placed so far — stored or new — by id, with the sequence it holds.
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
