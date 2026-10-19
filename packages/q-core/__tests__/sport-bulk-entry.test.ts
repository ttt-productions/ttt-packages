// Each sport's bulk entry is validated twice — by the form and again by the scoring write, which sees
// events, never form values (SPORT-006). The property: every draft `toEvents` builds from a value the
// form accepts is accepted by the store driver, in order, against the state the form read, and the
// rollup it leaves reproduces the form's values; and for each rule, the form refuses one value and
// the store driver refuses the event that value would have become.

import { describe, it, expect } from 'vitest';
import { MAX_CURLING_ROUND_POINTS, MAX_STAT_EVENTS_PER_WRITE, CURLING_ROUND_COUNT } from '../src/constants/sports.js';
import { countSchema } from '../src/doc-schemas/atoms.js';
import { type GameStatEvent } from '../src/doc-schemas/game-stats.js';
import { type GameStats } from '../src/doc-schemas/sport-game.js';
import { buildGameRosterPlayerId } from '../src/ids/compound-ids.js';
import { buildStatEventId } from '../src/ids/stat-event-ids.js';
import { RecordGameStatEventsInputSchema, type StatEventSubmission } from '../src/schemas/scoring.js';
import {
  BULK_ENTRY_COUNT_MESSAGE,
  BULK_ENTRY_TOO_LARGE_MESSAGE,
  bulkEntryCountField,
  type BulkEntryContext,
  type StatEventDraft,
} from '../src/sports/bulk-entry.js';
import { decideStatEventBatch } from '../src/sports/store-driver.js';
import { getSportAdapter } from '../src/sports/registry.js';
import { isStatVoid, type StatEventBody } from '../src/sports/scoring.js';
import { type AnySportAdapter } from '../src/sports/sport-adapter.js';
import {
  BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS,
  BASKETBALL_BULK_EDIT_EVENT_TYPE,
  BASKETBALL_PLAYER_STAT_KEYS,
  CURLING_ROUND_BLANK_EVENT_TYPE,
  CURLING_ROUND_SCORE_EVENT_TYPE,
  FOOTBALL_BULK_EDIT_EVENT_TYPE,
  FOOTBALL_SCORE_EVENT_TYPE_KEYS,
  LEAGUE_TYPE_KEYS,
} from '../src/types/sports.js';
import { STAT_CORRECTION_EVENT_TYPE, STAT_VOID_EVENT_TYPE } from '../src/types/stats.js';

const NOW = 1712345678901;
const [BASKETBALL, CURLING, FOOTBALL] = LEAGUE_TYPE_KEYS;
const [TWO_POINTER, THREE_POINTER] = BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS;
const [SIX] = FOOTBALL_SCORE_EVENT_TYPE_KEYS;
const [POINTS, REBOUNDS, ASSISTS] = BASKETBALL_PLAYER_STAT_KEYS;
const HOME = 'team-home';
const AWAY = 'team-away';
const GAME = { teamIds: [HOME, AWAY] };
const SHOOTER = buildGameRosterPlayerId(HOME, 'shooter');
const PASSER = buildGameRosterPlayerId(HOME, 'passer');
const VISITOR = buildGameRosterPlayerId(AWAY, 'visitor');

const body = (fields: Record<string, unknown>) => ({ recordedAt: NOW, ...fields }) as unknown as StatEventBody;

function contextOf(adapter: AnySportAdapter, events: StatEventBody[], extra: Partial<BulkEntryContext> = {}): BulkEntryContext {
  return {
    game: GAME,
    state: events.reduce<GameStats>((state, event) => adapter.apply(state, event), adapter.emptyStats(GAME)),
    rosterPlayerIds: [SHOOTER, PASSER, VISITOR],
    absentRosterPlayerIds: [],
    liveRoundEvents: [],
    ...extra,
  };
}

/**
 * What the scoring write does with the drafts: the dialog mints each sport event's id and stamps its
 * `recordedAt`, and the store driver decides the batch against the state the form read — each event
 * validated against the running state and applied, a void undoing the live event it names. Returns
 * the rollup, or the first refusal.
 */
function submit(
  adapter: AnySportAdapter,
  context: BulkEntryContext,
  drafts: readonly StatEventDraft[],
  liveEvents: ReadonlyMap<string, StatEventBody> = new Map(),
): { state: GameStats } | { refused: string } {
  const stored = new Map(
    [...liveEvents].map(([eventId, event], index) => [
      eventId,
      { ...event, eventId, recordedAt: NOW, sequence: index + 1 } as unknown as GameStatEvent,
    ]),
  );
  const submissions = drafts.map((draft, index) => {
    const event = body(draft as unknown as Record<string, unknown>);
    return (isStatVoid(event) ? event : { ...event, eventId: buildStatEventId(NOW, `draft${index}`) }) as unknown as StatEventSubmission;
  });
  const decision = decideStatEventBatch({
    adapter,
    game: { ...GAME, stats: context.state, statEventSequence: stored.size },
    roster: { teamIds: GAME.teamIds, rosterPlayerIds: new Set(context.rosterPlayerIds) },
    submissions,
    storedEvent: (eventId) => stored.get(eventId),
  });
  return decision.ok ? { state: decision.stats } : { refused: decision.code };
}

describe('the bulk-entry count field', () => {
  it("is the count atom's check, answered with the form's one message", () => {
    for (const value of [0, 1, 12]) expect(bulkEntryCountField.safeParse(value).success).toBe(countSchema.safeParse(value).success);
    for (const value of [-1, 1.5, '3', null]) {
      const parsed = bulkEntryCountField.safeParse(value);
      expect(parsed.success).toBe(false);
      expect(countSchema.safeParse(value).success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues.map((issue) => issue.message)).toEqual([BULK_ENTRY_COUNT_MESSAGE]);
    }
  });
});

describe('basketball bulk entry — one row per roster entry', () => {
  const adapter = getSportAdapter(BASKETBALL);
  const recorded = [
    body({ type: TWO_POINTER, teamId: HOME, playerUserId: 'shooter' }),
    body({ type: THREE_POINTER, teamId: HOME, playerUserId: 'shooter', assistedByUserId: 'passer' }),
  ];

  it('turns the changed fields into edits that pass the write in order and reproduce the form', () => {
    const context = contextOf(adapter, recorded);
    const values = adapter.bulkEntry.formDefaults(context) as { lines: Record<string, Record<string, number>> };
    expect(values.lines[SHOOTER]).toEqual({ points: 5, rebounds: 0, assists: 0 });
    expect(values.lines[VISITOR]).toEqual({ points: 0, rebounds: 0, assists: 0 });

    const entered = {
      lines: {
        ...values.lines,
        [SHOOTER]: { points: 2, rebounds: 4, assists: 0 },
        [PASSER]: { points: 0, rebounds: 0, assists: 0 },
        [VISITOR]: { points: 7, rebounds: 0, assists: 2 },
      },
    };
    expect(adapter.bulkEntry.formSchema(context).safeParse(entered).success).toBe(true);

    const drafts = adapter.bulkEntry.toEvents(entered as never, context);
    expect(drafts.every((draft) => draft.type === BASKETBALL_BULK_EDIT_EVENT_TYPE)).toBe(true);
    const result = submit(adapter, context, drafts);
    if (!('state' in result)) throw new Error(`refused: ${result.refused}`);
    for (const [entryId, line] of Object.entries(entered.lines)) {
      const stored = result.state.playerStats[entryId] as Record<string, number> | undefined;
      for (const key of BASKETBALL_PLAYER_STAT_KEYS) expect(stored?.[key] ?? 0, `${entryId}.${key}`).toBe(line[key]);
    }
    expect(result.state.teamStats[HOME]?.score).toBe(2);
    expect(result.state.teamStats[AWAY]?.score).toBe(7);
  });

  it('builds nothing from an unchanged form', () => {
    const context = contextOf(adapter, recorded);
    expect(adapter.bulkEntry.toEvents(adapter.bulkEntry.formDefaults(context) as never, context)).toEqual([]);
  });

  it("refuses a negative or fractional count in the form, and the edit it would have become in the write", () => {
    const context = contextOf(adapter, recorded);
    const values = adapter.bulkEntry.formDefaults(context) as { lines: Record<string, Record<string, number>> };
    for (const bad of [-1, 1.5]) {
      const entered = { lines: { ...values.lines, [PASSER]: { points: 0, rebounds: 0, assists: bad } } };
      expect(adapter.bulkEntry.formSchema(context).safeParse(entered).success).toBe(false);
      const edit = { type: BASKETBALL_BULK_EDIT_EVENT_TYPE, teamId: HOME, playerUserId: 'passer', stat: ASSISTS, value: bad - 1, previousValue: 1 };
      expect(submit(adapter, context, [edit as never])).toEqual({ refused: 'bulkValueInvalid' });
    }
  });

  it('refuses a row for a roster entry the game does not hold, in the form and in the write', () => {
    const context = contextOf(adapter, recorded);
    const values = adapter.bulkEntry.formDefaults(context) as { lines: Record<string, Record<string, number>> };
    const stranger = buildGameRosterPlayerId(AWAY, 'stranger');
    expect(
      adapter.bulkEntry.formSchema(context).safeParse({ lines: { ...values.lines, [stranger]: { points: 1, rebounds: 0, assists: 0 } } }).success,
    ).toBe(false);
    const edit = { type: BASKETBALL_BULK_EDIT_EVENT_TYPE, teamId: AWAY, playerUserId: 'stranger', stat: POINTS, value: 1, previousValue: 0 };
    expect(submit(adapter, context, [edit as never])).toEqual({ refused: 'playerNotRostered' });
  });

  it("refuses points that would leave a team's score below zero — its floor after a score correction — in the form and in the write", () => {
    const corrected = [
      ...recorded,
      body({ type: STAT_CORRECTION_EVENT_TYPE, teamId: HOME, stat: 'score', value: -4, correctionSource: 'admin', operationId: 'op', reason: 'double entry' }),
    ];
    const context = contextOf(adapter, corrected);
    expect(context.state.teamStats[HOME]?.score).toBe(1);
    const values = adapter.bulkEntry.formDefaults(context) as { lines: Record<string, Record<string, number>> };
    const entered = { lines: { ...values.lines, [SHOOTER]: { points: 0, rebounds: 0, assists: 0 } } };

    expect(adapter.bulkEntry.formSchema(context).safeParse(entered).success).toBe(false);
    expect(submit(adapter, context, adapter.bulkEntry.toEvents(entered as never, context))).toEqual({ refused: 'bulkValueInvalid' });
  });

  it('refuses in the form a submission past the per-write event cap, which the write input refuses too', () => {
    const many = Array.from({ length: MAX_STAT_EVENTS_PER_WRITE }, (_, index) => buildGameRosterPlayerId(HOME, `player${index}`));
    const context = { ...contextOf(adapter, []), rosterPlayerIds: many };
    const entered = { lines: Object.fromEntries(many.map((entryId) => [entryId, { points: 1, rebounds: 1, assists: 0 }])) };

    const parsed = adapter.bulkEntry.formSchema(context).safeParse(entered);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues.map((issue) => issue.message)).toContain(BULK_ENTRY_TOO_LARGE_MESSAGE);
    const drafts = adapter.bulkEntry.toEvents(entered as never, context);
    expect(drafts.length).toBeGreaterThan(MAX_STAT_EVENTS_PER_WRITE);
    expect(
      RecordGameStatEventsInputSchema.safeParse({
        gameId: 'g1',
        events: drafts.map((draft, index) => ({ ...draft, eventId: `${NOW}_${index}`, recordedAt: NOW })),
      }).success,
    ).toBe(false);
  });

  it('carries on each edit the value the form showed, so the write can refuse a form another write has since moved', () => {
    const context = contextOf(adapter, recorded);
    const values = adapter.bulkEntry.formDefaults(context) as { lines: Record<string, Record<string, number>> };
    const drafts = adapter.bulkEntry.toEvents({ lines: { ...values.lines, [PASSER]: { points: 0, rebounds: 2, assists: 1 } } } as never, context);
    expect(drafts).toEqual([
      { type: BASKETBALL_BULK_EDIT_EVENT_TYPE, teamId: HOME, playerUserId: 'passer', stat: REBOUNDS, value: 2, previousValue: 0 },
    ]);

    const moved = { ...context, state: adapter.apply(context.state, body({ type: TWO_POINTER, teamId: HOME, playerUserId: 'shooter' })) };
    expect(submit(adapter, moved, drafts)).toHaveProperty('state');
    const reboundedSince = {
      ...context,
      state: adapter.apply(context.state, body({ ...drafts[0], value: 1, previousValue: 0 } as Record<string, unknown>)),
    };
    expect(submit(adapter, reboundedSince, drafts)).toEqual({ refused: 'bulkStale' });
  });
});

describe('curling bulk entry — one row per round', () => {
  const adapter = getSportAdapter(CURLING);
  const round1 = body({ type: CURLING_ROUND_SCORE_EVENT_TYPE, teamId: HOME, roundNumber: 1, points: 2 });
  const round2 = body({ type: CURLING_ROUND_BLANK_EVENT_TYPE, roundNumber: 2 });
  const live = new Map([
    ['e1', round1],
    ['e2', round2],
  ]);
  const context = contextOf(adapter, [round1, round2], {
    liveRoundEvents: [
      { eventId: 'e1', roundNumber: 1 },
      { eventId: 'e2', roundNumber: 2 },
    ],
  });
  type Rounds = { rounds: Record<string, number | null>[] };
  const defaults = () => adapter.bulkEntry.formDefaults(context) as Rounds;
  const withRounds = (changes: Record<number, Record<string, number | null>>): Rounds => ({
    rounds: defaults().rounds.map((row, index) => changes[index + 1] ?? row),
  });

  it('prefills every round from the recorded ends, an unrecorded end empty', () => {
    const { rounds } = defaults();
    expect(rounds).toHaveLength(CURLING_ROUND_COUNT);
    expect(rounds[0]).toEqual({ [HOME]: 2, [AWAY]: 0 });
    expect(rounds[1]).toEqual({ [HOME]: 0, [AWAY]: 0 });
    expect(rounds[2]).toEqual({ [HOME]: null, [AWAY]: null });
  });

  it('voids each changed end first, then records the new ends in order, and the write reproduces the form', () => {
    const entered = withRounds({ 1: { [HOME]: 0, [AWAY]: 3 }, 3: { [HOME]: 1, [AWAY]: null }, 4: { [HOME]: 0, [AWAY]: 0 } });
    expect(adapter.bulkEntry.formSchema(context).safeParse(entered).success).toBe(true);

    const drafts = adapter.bulkEntry.toEvents(entered as never, context);
    expect(drafts.map((draft) => draft.type)).toEqual([
      STAT_VOID_EVENT_TYPE,
      CURLING_ROUND_SCORE_EVENT_TYPE,
      CURLING_ROUND_SCORE_EVENT_TYPE,
      CURLING_ROUND_BLANK_EVENT_TYPE,
    ]);
    expect(drafts[0]).toEqual({ type: STAT_VOID_EVENT_TYPE, targetEventId: 'e1' });

    const result = submit(adapter, context, drafts, live);
    if (!('state' in result)) throw new Error(`refused: ${result.refused}`);
    const slots = (teamId: string) => (result.state.teamStats[teamId] as { roundScores: (number | null)[] }).roundScores.slice(0, 5);
    expect(slots(HOME)).toEqual([0, 0, 1, 0, null]);
    expect(slots(AWAY)).toEqual([3, 0, 0, 0, null]);
  });

  it('refuses two scoring teams in one end in the form, and a second event for a recorded end in the write', () => {
    expect(adapter.bulkEntry.formSchema(context).safeParse(withRounds({ 3: { [HOME]: 1, [AWAY]: 2 } })).success).toBe(false);
    expect(submit(adapter, context, [{ type: CURLING_ROUND_SCORE_EVENT_TYPE, teamId: AWAY, roundNumber: 2, points: 2 } as never])).toEqual({
      refused: 'roundNotNext',
    });
  });

  it('refuses a skipped end in the form and in the write', () => {
    expect(adapter.bulkEntry.formSchema(context).safeParse(withRounds({ 4: { [HOME]: 1, [AWAY]: 0 } })).success).toBe(false);
    expect(submit(adapter, context, [{ type: CURLING_ROUND_SCORE_EVENT_TYPE, teamId: HOME, roundNumber: 4, points: 1 } as never])).toEqual({
      refused: 'roundNotNext',
    });
  });

  it('refuses an end outside 0 to the most one end is worth, in the form and at the write input', () => {
    for (const bad of [-1, MAX_CURLING_ROUND_POINTS + 1, 1.5]) {
      expect(adapter.bulkEntry.formSchema(context).safeParse(withRounds({ 3: { [HOME]: bad, [AWAY]: 0 } })).success).toBe(false);
      expect(
        RecordGameStatEventsInputSchema.safeParse({
          gameId: 'g1',
          events: [{ eventId: `${NOW}_x`, recordedAt: NOW, type: CURLING_ROUND_SCORE_EVENT_TYPE, teamId: HOME, roundNumber: 3, points: bad }],
        }).success,
      ).toBe(false);
    }
  });

  it('leaves the no-gap rule to the form: the write accepts a void of a middle end, which becomes the next to record', () => {
    expect(adapter.bulkEntry.formSchema(context).safeParse(withRounds({ 1: { [HOME]: null, [AWAY]: null } })).success).toBe(false);

    const result = submit(adapter, context, [{ type: STAT_VOID_EVENT_TYPE, targetEventId: 'e1' } as never], live);
    if (!('state' in result)) throw new Error(`refused: ${result.refused}`);
    expect(adapter.nextRound(result.state)).toBe(1);
  });

  it('allows clearing trailing ends', () => {
    const cleared = withRounds({ 2: { [HOME]: null, [AWAY]: null } });
    expect(adapter.bulkEntry.formSchema(context).safeParse(cleared).success).toBe(true);
    const result = submit(adapter, context, adapter.bulkEntry.toEvents(cleared as never, context), live);
    expect(result).toHaveProperty('state');
    if ('state' in result) expect(adapter.nextRound(result.state)).toBe(2);
  });
});

describe('football bulk entry — each team\'s final score', () => {
  const adapter = getSportAdapter(FOOTBALL);
  const context = contextOf(adapter, [body({ type: SIX, teamId: HOME })]);

  it('turns each changed score into one edit against the score it showed, and the write reproduces the form', () => {
    const values = adapter.bulkEntry.formDefaults(context) as { scores: Record<string, number> };
    expect(values.scores).toEqual({ [HOME]: 6, [AWAY]: 0 });
    const entered = { scores: { [HOME]: 20, [AWAY]: 3 } };
    expect(adapter.bulkEntry.formSchema(context).safeParse(entered).success).toBe(true);

    const drafts = adapter.bulkEntry.toEvents(entered as never, context);
    expect(drafts).toEqual([
      { type: FOOTBALL_BULK_EDIT_EVENT_TYPE, teamId: HOME, value: 14, previousValue: 6 },
      { type: FOOTBALL_BULK_EDIT_EVENT_TYPE, teamId: AWAY, value: 3, previousValue: 0 },
    ]);
    const result = submit(adapter, context, drafts);
    if (!('state' in result)) throw new Error(`refused: ${result.refused}`);
    expect(result.state.teamStats[HOME]?.score).toBe(20);
    expect(result.state.teamStats[AWAY]?.score).toBe(3);
  });

  it('refuses a negative or fractional score in the form, and the edit it would have become in the write', () => {
    for (const bad of [-1, 2.5]) {
      expect(adapter.bulkEntry.formSchema(context).safeParse({ scores: { [HOME]: bad, [AWAY]: 0 } }).success).toBe(false);
      expect(
        submit(adapter, context, [{ type: FOOTBALL_BULK_EDIT_EVENT_TYPE, teamId: HOME, value: bad - 6, previousValue: 6 } as never]),
      ).toEqual({ refused: 'bulkValueInvalid' });
    }
  });

  it('refuses a score for a team not in the game, in the form and in the write', () => {
    expect(adapter.bulkEntry.formSchema(context).safeParse({ scores: { [HOME]: 6, 'team-elsewhere': 3 } }).success).toBe(false);
    expect(
      submit(adapter, context, [{ type: FOOTBALL_BULK_EDIT_EVENT_TYPE, teamId: 'team-elsewhere', value: 3, previousValue: 0 } as never]),
    ).toEqual({ refused: 'teamNotInGame' });
  });
});
