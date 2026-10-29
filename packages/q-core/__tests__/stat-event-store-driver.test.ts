// The store driver's decision half: each event id applies exactly once, a void's id comes from its
// target, a refusal refuses the whole batch, and the rollup a write leaves is always the replay of
// the events the store then holds.

import { describe, it, expect } from 'vitest';
import { MAX_STAT_EVENTS_PER_WRITE } from '../src/constants/sports.js';
import { GameStatEventSchema, type GameStatEvent } from '../src/doc-schemas/game-stats.js';
import { buildGameRosterPlayerId } from '../src/ids/compound-ids.js';
import {
  MAX_SPORT_STAT_EVENT_ID_LENGTH,
  buildStatCorrectionId,
  buildStatEventId,
  buildStatVoidId,
  isSportStatEventId,
} from '../src/ids/stat-event-ids.js';
import {
  RecordGameStatEventsInputSchema,
  StatEventRefusalDetailsSchema,
  StatEventSubmissionSchema,
  type StatEventSubmission,
} from '../src/schemas/scoring.js';
import {
  decideStatEventBatch,
  statEventIdsToRead,
  type StatEventBatch,
  type StatEventBatchDecision,
} from '../src/sports/store-driver.js';
import { getSportAdapter } from '../src/sports/registry.js';
import { replayGameStats } from '../src/sports/replay.js';
import {
  BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS,
  BASKETBALL_BULK_EDIT_EVENT_TYPE,
  BASKETBALL_ONE_POINT_EVENT_TYPE,
  BASKETBALL_REBOUND_EVENT_TYPE,
  LEAGUE_TYPE_KEYS,
} from '../src/types/sports.js';
import {
  STAT_CORRECTION_EVENT_TYPE,
  STAT_EVENT_REFUSAL_KEYS,
  STAT_VOID_EVENT_TYPE,
} from '../src/types/stats.js';

const NOW = 1712345678901;
const [BASKETBALL] = LEAGUE_TYPE_KEYS;
const [TWO_POINTER] = BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS;
const HOME = 'team-home';
const AWAY = 'team-away';
const SHOOTER = 'shooter';
const adapter = getSportAdapter(BASKETBALL);

let minted = 0;
const tap = (type: string, extra: Record<string, unknown> = {}): StatEventSubmission =>
  StatEventSubmissionSchema.parse({
    eventId: buildStatEventId(NOW, `t${(minted += 1)}`),
    recordedAt: NOW,
    type,
    teamId: HOME,
    playerUserId: SHOOTER,
    ...extra,
  });
const undo = (targetEventId: string): StatEventSubmission => ({
  type: STAT_VOID_EVENT_TYPE,
  targetEventId,
  recordedAt: NOW,
});

const GAME = { teamIds: [HOME, AWAY] };

/** A write against a game whose stored rollup is the replay of its stored events, as RULE-QS-SPORT-911 holds. */
function batchOf(
  submissions: StatEventSubmission[],
  stored: GameStatEvent[] = [],
  statEventSequence = stored.length,
): StatEventBatch {
  const byId = new Map(stored.map((event) => [event.eventId, event]));
  return {
    adapter,
    game: { ...GAME, stats: replayGameStats(adapter, GAME, stored), statEventSequence },
    roster: {
      teamIds: GAME.teamIds,
      rosterPlayerIds: new Set([buildGameRosterPlayerId(HOME, SHOOTER)]),
    },
    submissions,
    storedEvent: (eventId) => byId.get(eventId),
  };
}

/** What the driver accepted, as the store would hold it. */
function asStored(decision: StatEventBatchDecision): GameStatEvent[] {
  if (!decision.ok) throw new Error('refused');
  return decision.accepted.map((event) => GameStatEventSchema.parse(event.fields));
}

/**
 * RULE-QS-SPORT-911: the rollup a write leaves is the replay of every event the store then holds — the ones
 * it held, and the ones the write accepted.
 */
function expectRollupIsReplay(
  decision: StatEventBatchDecision,
  stored: GameStatEvent[] = [],
): void {
  if (!decision.ok) throw new Error(`refused: ${decision.code}`);
  expect(decision.stats).toEqual(
    replayGameStats(adapter, GAME, [...stored, ...asStored(decision)]),
  );
}

describe('decideStatEventBatch — each event id applies exactly once (RULE-QS-SPORT-912)', () => {
  it('sequences each new event after the stored ones and folds it through the adapter', () => {
    const first = tap(BASKETBALL_ONE_POINT_EVENT_TYPE);
    const decision = decideStatEventBatch(batchOf([first], [], 4));

    expect(decision).toMatchObject({
      ok: true,
      statEventSequence: 5,
      results: [
        { eventId: (first as { eventId: string }).eventId, outcome: 'recorded', sequence: 5 },
      ],
    });
    if (decision.ok) expect(decision.stats.teamStats[HOME]).toMatchObject({ score: 1 });
    expectRollupIsReplay(decision);
  });

  it('acknowledges a stored event re-sent with the same content, applying nothing', () => {
    const shot = tap(TWO_POINTER);
    const stored = asStored(decideStatEventBatch(batchOf([shot])));
    const batch = batchOf([shot], stored);

    const replay = decideStatEventBatch(batch);

    expect(replay).toMatchObject({ ok: true, accepted: [], statEventSequence: 1 });
    if (replay.ok) {
      expect(replay.results).toEqual([
        { eventId: stored[0]?.eventId, outcome: 'alreadyRecorded', sequence: 1 },
      ]);
      expect(replay.stats).toEqual(batch.game.stats);
      expect(replay.stats.teamStats[HOME]).toMatchObject({ score: 2 });
    }
    expectRollupIsReplay(replay, stored);
  });

  it('applies an id repeated inside one batch once, acknowledging the repeat', () => {
    const shot = tap(TWO_POINTER);

    const decision = decideStatEventBatch(batchOf([shot, shot]));

    expect(decision).toMatchObject({ ok: true, statEventSequence: 1 });
    if (decision.ok) {
      expect(decision.results.map((result) => result.outcome)).toEqual([
        'recorded',
        'alreadyRecorded',
      ]);
      expect(decision.accepted).toHaveLength(1);
      expect(decision.stats.teamStats[HOME]).toMatchObject({ score: 2 });
    }
    expectRollupIsReplay(decision);
  });

  it('refuses an id held by different content, naming it, and refuses the whole batch', () => {
    const shot = tap(TWO_POINTER);
    const stored = asStored(decideStatEventBatch(batchOf([shot])));
    const conflicting = { ...shot, type: BASKETBALL_REBOUND_EVENT_TYPE } as StatEventSubmission;

    expect(
      decideStatEventBatch(batchOf([tap(BASKETBALL_ONE_POINT_EVENT_TYPE), conflicting], stored)),
    ).toEqual({
      ok: false,
      code: 'eventIdConflict',
      eventId: (shot as { eventId: string }).eventId,
    });
  });

  it("derives a void's id from its target, so a second undo of one event is acknowledged, never applied twice", () => {
    const shot = tap(TWO_POINTER);
    const first = decideStatEventBatch(
      batchOf([shot, undo((shot as { eventId: string }).eventId)]),
    );
    expect(first).toMatchObject({ ok: true, statEventSequence: 2 });
    if (first.ok) {
      expect(first.results[1]).toEqual({
        eventId: buildStatVoidId((shot as { eventId: string }).eventId),
        outcome: 'recorded',
        sequence: 2,
      });
      expect(first.stats.teamStats[HOME]).toMatchObject({ score: 0 });
    }
    expectRollupIsReplay(first);

    const stored = asStored(first);
    const again = decideStatEventBatch(
      batchOf([undo((shot as { eventId: string }).eventId)], stored),
    );
    expect(again).toMatchObject({
      ok: true,
      accepted: [],
      results: [{ outcome: 'alreadyRecorded', sequence: 2 }],
    });
    expectRollupIsReplay(again, stored);
  });

  it('refuses a void whose target is missing, a void, or a correction', () => {
    const shot = tap(TWO_POINTER);
    const stored = asStored(
      decideStatEventBatch(batchOf([shot, undo((shot as { eventId: string }).eventId)])),
    );
    const correction = GameStatEventSchema.parse({
      eventId: buildStatCorrectionId('op-1', HOME, 'score'),
      sequence: 3,
      recordedAt: NOW,
      type: STAT_CORRECTION_EVENT_TYPE,
      teamId: HOME,
      stat: 'score',
      value: 1,
      correctionSource: 'admin',
      operationId: 'op-1',
      reason: 'a missed basket',
    });

    for (const target of [
      'never-stored',
      buildStatVoidId((shot as { eventId: string }).eventId),
      correction.eventId,
    ]) {
      expect(decideStatEventBatch(batchOf([undo(target)], [...stored, correction]))).toMatchObject({
        ok: false,
        code: 'voidTargetNotSportEvent',
      });
    }
  });

  it('refuses a correction sent to a scoring entry, and never reads the id it names', () => {
    const correction = StatEventSubmissionSchema.parse({
      eventId: buildStatCorrectionId('op-1', HOME, 'score'),
      recordedAt: NOW,
      type: STAT_CORRECTION_EVENT_TYPE,
      teamId: HOME,
      stat: 'score',
      value: 1,
      correctionSource: 'admin',
      operationId: 'op-1',
      reason: 'a missed basket',
    });

    expect(decideStatEventBatch(batchOf([correction]))).toMatchObject({
      ok: false,
      code: 'correctionNotAccepted',
    });
    expect(statEventIdsToRead([correction])).toEqual([]);
  });

  it("reads each submission's own id and each void's target before deciding", () => {
    const shot = tap(TWO_POINTER);
    const shotId = (shot as { eventId: string }).eventId;
    expect(statEventIdsToRead([shot, undo(shotId)])).toEqual([shotId, buildStatVoidId(shotId)]);
  });

  it('refuses a void that would leave a stat below zero because a later edit already lowered it', () => {
    const rebound = tap(BASKETBALL_REBOUND_EVENT_TYPE);
    const lowered = tap(BASKETBALL_BULK_EDIT_EVENT_TYPE, {
      stat: 'rebounds',
      value: -1,
      previousValue: 1,
    });
    const first = decideStatEventBatch(batchOf([rebound, lowered]));
    expectRollupIsReplay(first);

    expect(
      decideStatEventBatch(
        batchOf([undo((rebound as { eventId: string }).eventId)], asStored(first)),
      ),
    ).toMatchObject({
      ok: false,
      code: 'undoBelowZero',
    });
  });

  it("seeds a missing team line from the empty stats, so a team's first stat is never refused as not in the game", () => {
    const decision = decideStatEventBatch({
      ...batchOf([tap(BASKETBALL_ONE_POINT_EVENT_TYPE)]),
      game: {
        teamIds: [HOME, AWAY],
        stats: { teamStats: {}, playerStats: {} },
        statEventSequence: 0,
      },
    });
    expect(decision).toMatchObject({ ok: true });
    if (decision.ok)
      expect(Object.keys(decision.stats.teamStats).sort()).toEqual([AWAY, HOME].sort());
    expectRollupIsReplay(decision);
  });
});

describe('the scoring write input', () => {
  const event = () => ({
    eventId: buildStatEventId(NOW, `in${(minted += 1)}`),
    recordedAt: NOW,
    type: BASKETBALL_REBOUND_EVENT_TYPE,
    teamId: HOME,
    playerUserId: SHOOTER,
  });

  it('carries 1 to the most events one write may hold, and refuses one more', () => {
    const accepted = Array.from({ length: MAX_STAT_EVENTS_PER_WRITE }, event);
    expect(
      RecordGameStatEventsInputSchema.safeParse({ gameId: 'g1', events: accepted }).success,
    ).toBe(true);
    expect(
      RecordGameStatEventsInputSchema.safeParse({ gameId: 'g1', events: [...accepted, event()] })
        .success,
    ).toBe(false);
    expect(RecordGameStatEventsInputSchema.safeParse({ gameId: 'g1', events: [] }).success).toBe(
      false,
    );
  });

  it('refuses the facts the writing core derives, and a name snapshot', () => {
    for (const smuggled of [
      { sequence: 1 },
      { recordedByUserId: 'someone' },
      { recordedByAuthority: 'admin' },
      { acceptedAt: NOW },
      { displayNameSnapshot: 'Old Name' },
    ]) {
      expect(
        RecordGameStatEventsInputSchema.safeParse({
          gameId: 'g1',
          events: [{ ...event(), ...smuggled }],
        }).success,
      ).toBe(false);
    }
  });

  it('requires the value the form showed on a bulk edit', () => {
    const edit = { ...event(), type: BASKETBALL_BULK_EDIT_EVENT_TYPE, stat: 'points', value: 2 };
    expect(
      RecordGameStatEventsInputSchema.safeParse({ gameId: 'g1', events: [edit] }).success,
    ).toBe(false);
    expect(
      RecordGameStatEventsInputSchema.safeParse({
        gameId: 'g1',
        events: [{ ...edit, previousValue: 0 }],
      }).success,
    ).toBe(true);
  });

  it('takes only a sport event id from its caller — one that names a single event document', () => {
    expect(isSportStatEventId(buildStatEventId(NOW, 'abc123'))).toBe(true);
    expect(isSportStatEventId('1690000000000-uid-2PT')).toBe(true);
    for (const id of [
      buildStatVoidId('1_a'),
      buildStatCorrectionId('op', HOME, 'score'),
      '1_a/nested/doc',
      `1${'x'.repeat(MAX_SPORT_STAT_EVENT_ID_LENGTH)}`,
    ]) {
      expect(isSportStatEventId(id), id).toBe(false);
      expect(
        RecordGameStatEventsInputSchema.safeParse({
          gameId: 'g1',
          events: [{ ...event(), eventId: id }],
        }).success,
      ).toBe(false);
      expect(
        RecordGameStatEventsInputSchema.safeParse({
          gameId: 'g1',
          events: [{ type: STAT_VOID_EVENT_TYPE, targetEventId: id, recordedAt: NOW }],
        }).success,
      ).toBe(false);
    }
  });

  it('names every refusal in the details a refused write carries', () => {
    for (const refusal of STAT_EVENT_REFUSAL_KEYS) {
      expect(StatEventRefusalDetailsSchema.safeParse({ refusal, eventId: '1_a' }).success).toBe(
        true,
      );
    }
  });
});
