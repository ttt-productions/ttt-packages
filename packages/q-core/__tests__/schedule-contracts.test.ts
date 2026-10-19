// The schedule's contracts: the week and game callables' inputs and results, the minted week id, the
// venue label, the conflict warnings the week form shows, the score mirror a new game is written
// with, and the audit and event vocabulary the schedule cores record. Each test pins a property a
// schedule core or the admin form relies on.

import { describe, it, expect } from 'vitest';
import { MAX_SCHEDULE_WEEK_GAMES, MAX_SCHEDULE_WEEK_TITLE_LENGTH } from '../src/constants/business';
import { SportGameSchema } from '../src/doc-schemas/sport-game';
import { DomainEventSchema } from '../src/domain-events/domain-events';
import { BYE_TEAM_ID, buildScheduleWeekId, buildSportGameId, isByeTeamId } from '../src/ids/minted-ids';
import { buildGameDeletionOperationId } from '../src/ids/stats-operation-ids';
import { isDocumentIdSegment } from '../src/paths/utils';
import {
  AdminCreateScheduleWeekInputSchema,
  AdminCreateScheduleWeekResultSchema,
  AdminCreateSportGameInputSchema,
  AdminDeleteScheduleWeekInputSchema,
  AdminDeleteScheduleWeekResultSchema,
  AdminDeleteSportGameInputSchema,
  AdminDeleteSportGameResultSchema,
  AdminUpdateScheduleWeekInputSchema,
  AdminUpdateScheduleWeekResultSchema,
  AdminUpdateSportGameInputSchema,
  AdminUpdateSportGameResultSchema,
} from '../src/schemas/schedules';
import { gameScoreMirror } from '../src/sports/score-mirror';
import { getSportAdapter } from '../src/sports/registry';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit';
import {
  SCHEDULE_CONFLICT_KIND_KEYS,
  SCHEDULE_WEEK_FIELD_KEYS,
  SHARED_LOCATION_CONFLICT,
  SPORT_GAME_SCHEDULE_FIELD_KEYS,
  TEAM_DOUBLE_BOOKED_CONFLICT,
} from '../src/types/schedules';
import type { ScheduleConflictGame } from '../src/utils/schedules';
import { findScheduleConflicts, formatGameLocationLabel } from '../src/utils/schedules';
import { LEAGUE_TYPE_KEYS } from '../src/types/sports';
import { GAME_STATUS_ON_CREATE } from '../src/types/unions';

const NOW = 1_760_000_000_000;
const HOUR = 60 * 60 * 1000;

const game = { teams: ['team-a', 'team-b'], startTime: NOW, gameLocationId: 'venue-1', subLocation: 'Court 1' };
const createWeekInput = {
  leagueId: 'league-1',
  weekTitle: 'Week 1',
  weekStartDate: NOW,
  weekGameLocationId: 'venue-1',
  games: [game],
};
const updateGameInput = {
  gameId: 'game-1',
  expectedUpdatedAt: NOW,
  weekId: 'week-1',
  teams: ['team-a', 'team-b'],
  startTime: NOW + HOUR,
  gameLocationId: 'venue-1',
};

describe('the week and game callable inputs', () => {
  it('accept a week with its games, a week edit, a week delete, a game added, edited, and deleted', () => {
    expect(AdminCreateScheduleWeekInputSchema.safeParse(createWeekInput).success).toBe(true);
    expect(
      AdminUpdateScheduleWeekInputSchema.safeParse({
        leagueId: 'league-1',
        weekId: 'week-1',
        weekTitle: 'Week 1',
        weekStartDate: NOW,
      }).success,
    ).toBe(true);
    expect(AdminDeleteScheduleWeekInputSchema.safeParse({ leagueId: 'league-1', weekId: 'week-1' }).success).toBe(true);
    expect(AdminCreateSportGameInputSchema.safeParse({ leagueId: 'league-1', weekId: 'week-1', ...game }).success).toBe(
      true,
    );
    expect(AdminUpdateSportGameInputSchema.safeParse(updateGameInput).success).toBe(true);
    expect(AdminDeleteSportGameInputSchema.safeParse({ gameId: 'game-1' }).success).toBe(true);
  });

  it('refuse an acting identity, a derived label, the sport, and every stat field the server owns', () => {
    for (const field of ['createdBy', 'createdByUserId', 'locationLabel', 'leagueType', 'weekLocation', 'dayKey']) {
      expect(AdminCreateScheduleWeekInputSchema.safeParse({ ...createWeekInput, [field]: 'x' }).success).toBe(false);
    }
    for (const [field, value] of Object.entries({
      stats: { teamStats: {}, playerStats: {} },
      score: {},
      status: 'completed',
      statEventSequence: 0,
      absentRosterPlayerIds: [],
      statsOperationId: 'op-1',
      locationLabel: 'Main Gym',
      teamIds: ['team-a', 'team-b'],
    })) {
      expect(AdminUpdateSportGameInputSchema.safeParse({ ...updateGameInput, [field]: value }).success).toBe(false);
    }
    expect(
      AdminCreateScheduleWeekInputSchema.safeParse({ ...createWeekInput, games: [{ ...game, locationLabel: 'x' }] })
        .success,
    ).toBe(false);
  });

  it('trim the week title and bound it', () => {
    const parsed = AdminCreateScheduleWeekInputSchema.parse({ ...createWeekInput, weekTitle: '  Week 2  ' });
    expect(parsed.weekTitle).toBe('Week 2');
    expect(AdminCreateScheduleWeekInputSchema.safeParse({ ...createWeekInput, weekTitle: '   ' }).success).toBe(false);
    expect(
      AdminCreateScheduleWeekInputSchema.safeParse({
        ...createWeekInput,
        weekTitle: 'x'.repeat(MAX_SCHEDULE_WEEK_TITLE_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('take at least one game and at most the games one save seeds with their rosters', () => {
    expect(AdminCreateScheduleWeekInputSchema.safeParse({ ...createWeekInput, games: [] }).success).toBe(false);
    const games = Array.from({ length: MAX_SCHEDULE_WEEK_GAMES }, () => game);
    expect(AdminCreateScheduleWeekInputSchema.safeParse({ ...createWeekInput, games }).success).toBe(true);
    expect(AdminCreateScheduleWeekInputSchema.safeParse({ ...createWeekInput, games: [...games, game] }).success).toBe(
      false,
    );
  });

  it('give a game two different teams, one of which may be the bye, never two byes', () => {
    const teams = (first: string, second: string) =>
      AdminCreateSportGameInputSchema.safeParse({ leagueId: 'league-1', weekId: 'week-1', ...game, teams: [first, second] })
        .success;
    expect(teams('team-a', BYE_TEAM_ID)).toBe(true);
    expect(teams(BYE_TEAM_ID, 'team-a')).toBe(true);
    expect(teams(BYE_TEAM_ID, BYE_TEAM_ID)).toBe(false);
    expect(teams('team-a', 'team-a')).toBe(false);
    expect(teams('team-a', '')).toBe(false);
  });

  it('name a new game venue by id, and a court only within a venue', () => {
    const { gameLocationId: _venue, ...noVenue } = game;
    expect(
      AdminCreateSportGameInputSchema.safeParse({ leagueId: 'league-1', weekId: 'week-1', ...noVenue }).success,
    ).toBe(false);
    const { gameLocationId: _editVenue, ...editWithoutVenue } = updateGameInput;
    expect(AdminUpdateSportGameInputSchema.safeParse(editWithoutVenue).success).toBe(true);
    expect(AdminUpdateSportGameInputSchema.safeParse({ ...editWithoutVenue, subLocation: 'Court 1' }).success).toBe(
      false,
    );
    expect(AdminUpdateSportGameInputSchema.safeParse({ ...updateGameInput, subLocation: '   ' }).success).toBe(false);
  });

  it('require the game edit to carry the updatedAt it was loaded at', () => {
    const { expectedUpdatedAt: _loaded, ...stale } = updateGameInput;
    expect(AdminUpdateSportGameInputSchema.safeParse(stale).success).toBe(false);
  });

  it('take no operation id for a game delete: the server derives it from the game', () => {
    expect(AdminDeleteSportGameInputSchema.safeParse({ gameId: 'game-1', operationId: 'op-1' }).success).toBe(false);
  });

  it('take only the week fields the admin changed, and at least one', () => {
    const week = { leagueId: 'league-1', weekId: 'week-1' };
    expect(AdminUpdateScheduleWeekInputSchema.safeParse({ ...week, weekTitle: 'Week 1' }).success).toBe(true);
    expect(AdminUpdateScheduleWeekInputSchema.safeParse({ ...week, weekStartDate: NOW }).success).toBe(true);
    expect(AdminUpdateScheduleWeekInputSchema.safeParse({ ...week, weekGameLocationId: 'venue-1' }).success).toBe(true);
    expect(AdminUpdateScheduleWeekInputSchema.safeParse(week).success).toBe(false);
    expect(AdminUpdateScheduleWeekInputSchema.safeParse({ ...week, weekTitle: '   ' }).success).toBe(false);
  });
});

describe('the week and game callable results', () => {
  it('answer with the ids written, the fields changed, and whether a paged delete finished', () => {
    expect(
      AdminCreateScheduleWeekResultSchema.safeParse({ leagueId: 'league-1', weekId: 'week-1', gameIds: ['g1', 'g2'] })
        .success,
    ).toBe(true);
    expect(
      AdminUpdateScheduleWeekResultSchema.safeParse({
        leagueId: 'league-1',
        weekId: 'week-1',
        changedFields: [...SCHEDULE_WEEK_FIELD_KEYS],
        gamesUpdated: 3,
      }).success,
    ).toBe(true);
    expect(
      AdminUpdateSportGameResultSchema.safeParse({
        gameId: 'game-1',
        changedFields: [...SPORT_GAME_SCHEDULE_FIELD_KEYS],
        updatedAt: NOW,
      }).success,
    ).toBe(true);
    expect(
      AdminDeleteScheduleWeekResultSchema.safeParse({
        leagueId: 'league-1',
        weekId: 'week-1',
        deletedGameIds: ['g1'],
        remainingGameIds: ['g2'],
        complete: false,
      }).success,
    ).toBe(true);
    expect(
      AdminDeleteSportGameResultSchema.safeParse({ gameId: 'game-1', operationId: 'op-1', complete: true }).success,
    ).toBe(true);
  });

  it('refuse a changed field the edit does not write', () => {
    expect(
      AdminUpdateSportGameResultSchema.safeParse({ gameId: 'game-1', changedFields: ['stats'], updatedAt: NOW }).success,
    ).toBe(false);
  });
});

describe('minted schedule ids', () => {
  it('mints a week id from the clock and a suffix, never from the week’s date', () => {
    expect(buildScheduleWeekId(NOW, 'abc')).toBe(`week_${NOW}_abc`);
    expect(buildScheduleWeekId(NOW, 'abc')).not.toMatch(/^week-\d{4}-\d{2}-\d{2}$/);
    expect(buildScheduleWeekId(NOW, 'abc')).not.toBe(buildScheduleWeekId(NOW, 'def'));
  });

  it('mints a game id from the clock and a suffix', () => {
    expect(buildSportGameId(NOW, 'abc')).toBe(`${NOW}_abc`);
  });

  it('derives one deletion operation id per game, distinct across games', () => {
    const gameId = buildSportGameId(NOW, 'abc');
    expect(buildGameDeletionOperationId(gameId)).toBe(buildGameDeletionOperationId(gameId));
    expect(buildGameDeletionOperationId(gameId)).not.toBe(buildGameDeletionOperationId(buildSportGameId(NOW, 'abd')));
    expect(buildGameDeletionOperationId(gameId)).not.toBe(gameId);
    expect(isDocumentIdSegment(buildGameDeletionOperationId(gameId))).toBe(true);
  });

  it('recognises the bye slot and no real team id', () => {
    expect(isByeTeamId(BYE_TEAM_ID)).toBe(true);
    expect(isByeTeamId('team-a')).toBe(false);
  });
});

describe('the venue label', () => {
  it('reads as the venue, and the court within it when one was chosen', () => {
    expect(formatGameLocationLabel('Main Gym')).toBe('Main Gym');
    expect(formatGameLocationLabel('Main Gym', 'Court 2')).toBe('Main Gym - Court 2');
  });
});

describe('the conflict warnings', () => {
  const at = (hour: number) => NOW + hour * HOUR;
  const conflictGame = (key: string, overrides: Partial<ScheduleConflictGame> = {}): ScheduleConflictGame => ({
    key,
    startTime: at(0),
    teamIds: [`${key}-home`, `${key}-away`],
    gameLocationId: 'venue-1',
    subLocation: 'Court 1',
    locationLabel: 'Main Gym - Court 1',
    ...overrides,
  });

  it('declares exactly the two conflict kinds', () => {
    expect([...SCHEDULE_CONFLICT_KIND_KEYS].sort()).toEqual([SHARED_LOCATION_CONFLICT, TEAM_DOUBLE_BOOKED_CONFLICT].sort());
  });

  it('warns about two games at one venue court at one start time', () => {
    const conflicts = findScheduleConflicts([conflictGame('draft-1'), conflictGame('draft-2')], []);
    expect(conflicts).toEqual([{ kind: SHARED_LOCATION_CONFLICT, startTime: at(0), gameKeys: ['draft-1', 'draft-2'] }]);
  });

  it('does not warn about two courts of one venue, or one court at two times', () => {
    expect(
      findScheduleConflicts([conflictGame('draft-1'), conflictGame('draft-2', { subLocation: 'Court 2' })], []),
    ).toEqual([]);
    expect(findScheduleConflicts([conflictGame('draft-1'), conflictGame('draft-2', { startTime: at(1) })], [])).toEqual(
      [],
    );
  });

  it('compares games with no venue by their label, ignoring case and surrounding space', () => {
    const conflicts = findScheduleConflicts(
      [
        conflictGame('draft-1', { gameLocationId: undefined, subLocation: undefined, locationLabel: 'Old Gym' }),
        conflictGame('draft-2', { gameLocationId: undefined, subLocation: undefined, locationLabel: ' old gym ' }),
      ],
      [],
    );
    expect(conflicts.map((conflict) => conflict.kind)).toEqual([SHARED_LOCATION_CONFLICT]);
  });

  it('warns about one team booked into two games at one start time, naming the team', () => {
    const conflicts = findScheduleConflicts(
      [conflictGame('draft-1', { teamIds: ['team-a', 'team-b'] }), conflictGame('draft-2', {
        teamIds: ['team-a', 'team-c'],
        subLocation: 'Court 2',
      })],
      [],
    );
    expect(conflicts).toEqual([
      { kind: TEAM_DOUBLE_BOOKED_CONFLICT, startTime: at(0), teamId: 'team-a', gameKeys: ['draft-1', 'draft-2'] },
    ]);
  });

  it('checks the week in progress against the league’s saved games', () => {
    const conflicts = findScheduleConflicts(
      [conflictGame('draft-1', { teamIds: ['team-a', 'team-b'] })],
      [conflictGame('saved-1', { teamIds: ['team-a', 'team-z'], subLocation: 'Court 3' })],
    );
    expect(conflicts).toEqual([
      { kind: TEAM_DOUBLE_BOOKED_CONFLICT, startTime: at(0), teamId: 'team-a', gameKeys: ['draft-1', 'saved-1'] },
    ]);
  });

  it('does not report a conflict among saved games alone', () => {
    expect(findScheduleConflicts([], [conflictGame('saved-1'), conflictGame('saved-2')])).toEqual([]);
    expect(
      findScheduleConflicts([conflictGame('draft-1', { startTime: at(5) })], [conflictGame('saved-1'), conflictGame('saved-2')]),
    ).toEqual([]);
  });

  it('replaces a saved game with its edit, so a game never conflicts with its own old slot', () => {
    expect(findScheduleConflicts([conflictGame('saved-1')], [conflictGame('saved-1')])).toEqual([]);
    expect(findScheduleConflicts([conflictGame('saved-1', { startTime: at(2) })], [conflictGame('saved-1')])).toEqual([]);
  });

  it('ignores a bye, which books no venue and no team', () => {
    expect(
      findScheduleConflicts([conflictGame('draft-1', { teamIds: ['team-a'] }), conflictGame('draft-2', { teamIds: ['team-a'] })], []),
    ).toEqual([]);
  });

  it('lists the warnings in start-time order', () => {
    const conflicts = findScheduleConflicts(
      [
        conflictGame('late-1', { startTime: at(3) }),
        conflictGame('late-2', { startTime: at(3) }),
        conflictGame('early-1', { startTime: at(1) }),
        conflictGame('early-2', { startTime: at(1) }),
      ],
      [],
    );
    expect(conflicts.map((conflict) => conflict.startTime)).toEqual([at(1), at(3)]);
  });
});

describe('a new game as the schedule writes it', () => {
  it('is a valid game in every sport: the empty rollup from its adapter, its score mirrored, no events', () => {
    for (const leagueType of LEAGUE_TYPE_KEYS) {
      const teamIds = ['team-a', 'team-b'];
      const stats = getSportAdapter(leagueType).emptyStats({ teamIds });
      const created = {
        leagueId: 'league-1',
        leagueType,
        weekId: buildScheduleWeekId(NOW, 'abc'),
        weekTitle: 'Week 1',
        weekLocation: 'Main Gym',
        weekStartDate: NOW,
        startTime: NOW,
        dayKey: '2025-10-09',
        locationLabel: 'Main Gym - Court 1',
        gameLocationId: 'venue-1',
        subLocation: 'Court 1',
        status: GAME_STATUS_ON_CREATE,
        teams: [{ teamId: 'team-a' }, { teamId: 'team-b' }],
        teamIds,
        stats,
        score: gameScoreMirror(stats),
        statEventSequence: 0,
        absentRosterPlayerIds: [],
        createdAt: NOW,
        updatedAt: NOW,
      };
      expect(SportGameSchema.safeParse(created).success).toBe(true);
      expect(gameScoreMirror(stats)).toEqual({ 'team-a': 0, 'team-b': 0 });
    }
  });

  it('holds one team line for a bye game, and refuses a rollup or mirror naming a team not in the game', () => {
    const stats = getSportAdapter(LEAGUE_TYPE_KEYS[0]).emptyStats({ teamIds: ['team-a'] });
    const base = {
      leagueId: 'league-1',
      leagueType: LEAGUE_TYPE_KEYS[0],
      weekId: 'week-1',
      weekTitle: 'Week 1',
      weekLocation: 'Main Gym',
      weekStartDate: NOW,
      startTime: NOW,
      dayKey: '2025-10-09',
      locationLabel: 'Main Gym',
      status: GAME_STATUS_ON_CREATE,
      teams: [{ teamId: 'team-a' }, { teamId: BYE_TEAM_ID }],
      teamIds: ['team-a'],
      stats,
      score: gameScoreMirror(stats),
      statEventSequence: 0,
      absentRosterPlayerIds: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(SportGameSchema.safeParse(base).success).toBe(true);
    expect(SportGameSchema.safeParse({ ...base, score: { 'team-a': 0, 'team-b': 0 } }).success).toBe(false);
    const twoTeamStats = getSportAdapter(LEAGUE_TYPE_KEYS[0]).emptyStats({ teamIds: ['team-a', 'team-b'] });
    expect(SportGameSchema.safeParse({ ...base, stats: twoTeamStats }).success).toBe(false);
  });

  it('names its venue with the venue id the schedule inputs take: absent is allowed, empty is refused', () => {
    const teamIds = ['team-a', 'team-b'];
    const stats = getSportAdapter(LEAGUE_TYPE_KEYS[0]).emptyStats({ teamIds });
    const base = {
      leagueId: 'league-1',
      leagueType: LEAGUE_TYPE_KEYS[0],
      weekId: 'week-1',
      weekTitle: 'Week 1',
      weekLocation: 'Main Gym',
      weekStartDate: NOW,
      startTime: NOW,
      dayKey: '2025-10-09',
      locationLabel: 'Main Gym',
      status: GAME_STATUS_ON_CREATE,
      teams: [{ teamId: 'team-a' }, { teamId: 'team-b' }],
      teamIds,
      stats,
      score: gameScoreMirror(stats),
      statEventSequence: 0,
      absentRosterPlayerIds: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(SportGameSchema.safeParse(base).success).toBe(true);
    expect(SportGameSchema.safeParse({ ...base, gameLocationId: 'venue-1' }).success).toBe(true);
    expect(SportGameSchema.safeParse({ ...base, gameLocationId: '' }).success).toBe(false);
    expect(AdminUpdateSportGameInputSchema.safeParse({ ...updateGameInput, gameLocationId: '' }).success).toBe(false);
  });

  it('mirrors each team line’s score, whatever else the line holds', () => {
    expect(
      gameScoreMirror({ teamStats: { 'team-a': { score: 12 }, 'team-b': { score: 9 } } }),
    ).toEqual({ 'team-a': 12, 'team-b': 9 });
  });
});

describe('the schedule vocabulary', () => {
  it('records every schedule action under its own audit event type', () => {
    for (const type of [
      'scheduleWeek.created',
      'scheduleWeek.updated',
      'sportGame.created',
      'sportGame.updated',
      'sportGame.deleted',
    ]) {
      expect(AUDIT_EVENT_TYPE_KEYS as readonly string[]).toContain(type);
    }
  });

  it('names what changed for the client: the league’s schedule, or one game', () => {
    expect(
      DomainEventSchema.safeParse({ type: 'leagueSchedule.changed', ids: { leagueId: 'league-1' } }).success,
    ).toBe(true);
    for (const type of ['sportGame.updated', 'sportGame.deleted']) {
      expect(
        DomainEventSchema.safeParse({ type, ids: { leagueId: 'league-1', gameId: 'game-1' } }).success,
      ).toBe(true);
      expect(DomainEventSchema.safeParse({ type, ids: { leagueId: 'league-1' } }).success).toBe(false);
    }
  });
});
