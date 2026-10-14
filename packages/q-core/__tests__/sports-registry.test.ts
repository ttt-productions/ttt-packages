import { describe, it, expect, expectTypeOf } from 'vitest';
import { CURLING_ROUND_COUNT } from '../src/constants/sports';
import {
  SPORT_GAME_STATS_SCHEMAS,
  SPORT_LINE_SCHEMAS,
  SportGameSchema,
  UserLifetimeStatsSchema,
} from '../src/doc-schemas';
import {
  SPORT_ADAPTERS,
  SPORT_ADAPTER_LIST,
  UnknownSportError,
  getSportAdapter,
  type AnySportAdapter,
  type SportAdapter,
  type SportLine,
} from '../src/sports';
import {
  BASKETBALL_PLAYER_STAT_KEYS,
  BASKETBALL_STAT_EVENT_TYPE_KEYS,
  BASKETBALL_TEAM_STAT_KEYS,
  CURLING_STAT_EVENT_TYPE_KEYS,
  CURLING_TEAM_STAT_KEYS,
  FOOTBALL_STAT_EVENT_TYPE_KEYS,
  FOOTBALL_TEAM_STAT_KEYS,
  LEAGUE_TYPE_KEYS,
  SPORT_ICON_KEYS,
  SPORT_KEY_BY_LEAGUE_TYPE,
  STAT_COUNTER_KEYS,
} from '../src/types/sports';
import { STAT_STORE_EVENT_TYPE_KEYS } from '../src/types/stats';

const NOW = 1712345678901;

const [BASKETBALL, CURLING, FOOTBALL] = LEAGUE_TYPE_KEYS;

describe('getSportAdapter', () => {
  it('resolves every league type to its own adapter', () => {
    for (const leagueType of LEAGUE_TYPE_KEYS) {
      const adapter = getSportAdapter(leagueType);
      expect(adapter).toBe(SPORT_ADAPTERS[leagueType]);
      expect(adapter.leagueType).toBe(leagueType);
      expect(adapter.sportKey).toBe(SPORT_KEY_BY_LEAGUE_TYPE[leagueType]);
    }
  });

  it.each([
    ['a missing value', undefined],
    ['null', null],
    ['the sport key in place of the league type', 'basketball'],
    ['a wrong case', 'BASKETBALL'],
    ['a sport with no adapter', 'Hockey'],
    ['an empty string', ''],
    ['a number', 42],
    ['an object', { leagueType: 'Basketball' }],
    ['an object with no prototype', Object.create(null)],
  ])('throws UnknownSportError for %s, with no default sport', (_case, value) => {
    expect(() => getSportAdapter(value)).toThrow(UnknownSportError);
    try {
      getSportAdapter(value);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as UnknownSportError).name).toBe('UnknownSportError');
      expect((error as UnknownSportError).leagueType).toBe(value);
    }
  });

  it('names the offending value in its message', () => {
    expect(() => getSportAdapter('basketball')).toThrow('"basketball"');
    expect(() => getSportAdapter(undefined)).toThrow('undefined');
    expect(() => getSportAdapter(null)).toThrow('null');
  });

  it('keeps a known sport typed, and an unknown value typed as any sport', () => {
    expectTypeOf(getSportAdapter(BASKETBALL)).toEqualTypeOf<SportAdapter<'Basketball'>>();
    expectTypeOf(getSportAdapter('Curling' as unknown)).toEqualTypeOf<AnySportAdapter>();
  });
});

describe('the registry', () => {
  it('registers exactly one adapter per league type', () => {
    expect(Object.keys(SPORT_ADAPTERS).sort()).toEqual([...LEAGUE_TYPE_KEYS].sort());
  });

  it('lists every sport in LEAGUE_TYPE_KEYS order', () => {
    expect(SPORT_ADAPTER_LIST.map((adapter) => adapter.leagueType)).toEqual([...LEAGUE_TYPE_KEYS]);
  });

  it('keeps a hall of fame and a historical baseline for basketball only', () => {
    expect(SPORT_ADAPTER_LIST.filter((adapter) => adapter.hallOfFame).map((adapter) => adapter.leagueType)).toEqual([
      BASKETBALL,
    ]);
    expect(
      SPORT_ADAPTER_LIST.filter((adapter) => adapter.historicalBaseline).map((adapter) => adapter.leagueType),
    ).toEqual([BASKETBALL]);
  });
});

describe('sport facts', () => {
  it('declares each sport\'s own event types, disjoint across sports and apart from the store events', () => {
    expect(SPORT_ADAPTERS[BASKETBALL].eventTypes).toEqual(BASKETBALL_STAT_EVENT_TYPE_KEYS);
    expect(SPORT_ADAPTERS[CURLING].eventTypes).toEqual(CURLING_STAT_EVENT_TYPE_KEYS);
    expect(SPORT_ADAPTERS[FOOTBALL].eventTypes).toEqual(FOOTBALL_STAT_EVENT_TYPE_KEYS);
    const all: string[] = [
      ...SPORT_ADAPTER_LIST.flatMap((adapter): readonly string[] => adapter.eventTypes),
      ...STAT_STORE_EVENT_TYPE_KEYS,
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  it('declares the counters of each line', () => {
    expect(SPORT_ADAPTERS[BASKETBALL].teamStatKeys).toEqual(BASKETBALL_TEAM_STAT_KEYS);
    expect(SPORT_ADAPTERS[BASKETBALL].playerStatKeys).toEqual(BASKETBALL_PLAYER_STAT_KEYS);
    expect(SPORT_ADAPTERS[CURLING].teamStatKeys).toEqual(CURLING_TEAM_STAT_KEYS);
    expect(SPORT_ADAPTERS[CURLING].playerStatKeys).toEqual([]);
    expect(SPORT_ADAPTERS[FOOTBALL].teamStatKeys).toEqual(FOOTBALL_TEAM_STAT_KEYS);
    expect(SPORT_ADAPTERS[FOOTBALL].playerStatKeys).toEqual([]);
  });

  it('gives every sport its own label and its own icon from the declared icon set', () => {
    const labels = SPORT_ADAPTER_LIST.map((adapter) => adapter.display.label);
    const icons = SPORT_ADAPTER_LIST.map((adapter) => adapter.display.iconKey);
    expect(labels.every((label) => label.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(icons).size).toBe(icons.length);
    for (const icon of icons) expect(SPORT_ICON_KEYS).toContain(icon);
  });

  it('reads its lines through the one declaration of each sport\'s line schemas', () => {
    for (const adapter of SPORT_ADAPTER_LIST) {
      expect(adapter.lineSchemas).toBe(SPORT_LINE_SCHEMAS[adapter.leagueType]);
    }
  });

  it('validates each sport\'s stored game lines and lifetime line through the schemas its adapter reads', () => {
    const gameStats = new Map(
      SportGameSchema.options.map((option) => [option.shape.leagueType.value, option.shape.stats] as const),
    );
    expect([...gameStats.keys()].sort()).toEqual([...LEAGUE_TYPE_KEYS].sort());
    for (const adapter of SPORT_ADAPTER_LIST) {
      const stats = gameStats.get(adapter.leagueType);
      expect(stats).toBe(SPORT_GAME_STATS_SCHEMAS[adapter.leagueType]);
      expect(stats?.shape.teamStats.valueType).toBe(adapter.lineSchemas.gameTeam);
      expect(stats?.shape.playerStats.valueType).toBe(adapter.lineSchemas.gamePlayer);
      expect(UserLifetimeStatsSchema.shape[adapter.sportKey].unwrap()).toBe(adapter.lineSchemas.lifetime);
    }
  });

  it('builds each line\'s counters from the sport\'s declared stat keys, on every player line and the game team line', () => {
    const countersOf = (schema: unknown) =>
      Object.keys((schema as { shape?: Record<string, unknown> }).shape ?? {})
        .filter((field) => (STAT_COUNTER_KEYS as readonly string[]).includes(field))
        .sort();
    for (const adapter of SPORT_ADAPTER_LIST) {
      const { lineSchemas } = adapter;
      expect(countersOf(lineSchemas.gameTeam)).toEqual([...adapter.teamStatKeys].sort());
      for (const kind of ['gamePlayer', 'membershipRow', 'lifetime', 'hallOfFame'] as const) {
        expect(countersOf(lineSchemas[kind])).toEqual([...adapter.playerStatKeys].sort());
      }
    }
  });

  it('declares no line of a kind a sport does not keep', () => {
    expectTypeOf<SportLine<'Curling', 'gamePlayer'>>().toBeNever();
    expectTypeOf<SportLine<'Football', 'hallOfFame'>>().toBeNever();
    for (const leagueType of [CURLING, FOOTBALL]) {
      const { lineSchemas } = SPORT_ADAPTERS[leagueType];
      expect(lineSchemas.gamePlayer.safeParse({}).success).toBe(false);
      expect(lineSchemas.hallOfFame.safeParse({ gamesPlayed: 1 }).success).toBe(false);
    }
  });
});

describe('emptyStats', () => {
  const game = {
    leagueId: 'L',
    weekId: 'week-1',
    weekTitle: 'Week 1',
    weekLocation: 'Main Gym',
    weekStartDate: NOW,
    startTime: NOW,
    dayKey: '2024-04-05',
    locationLabel: 'Main Gym - Court 2',
    status: 'scheduled',
    teams: [{ teamId: 'T1' }, { teamId: 'T2' }],
    teamIds: ['T1', 'T2'],
    score: { T1: 0, T2: 0 },
    statEventSequence: 0,
    absentRosterPlayerIds: [],
    createdAt: NOW,
    updatedAt: NOW,
  };

  it.each([...LEAGUE_TYPE_KEYS])('seeds a %s game with a valid rollup: a team line for each team and no player lines', (leagueType) => {
    const adapter = getSportAdapter(leagueType);
    const stats = adapter.emptyStats(game);
    expect(Object.keys(stats.teamStats).sort()).toEqual(['T1', 'T2']);
    expect(stats.playerStats).toEqual({});
    expect(SportGameSchema.safeParse({ ...game, leagueType, stats }).success).toBe(true);
  });

  it.each([...LEAGUE_TYPE_KEYS])('starts every %s team counter at zero', (leagueType) => {
    const adapter: AnySportAdapter = getSportAdapter(leagueType);
    const { teamStats } = adapter.emptyStats(game);
    for (const line of Object.values(teamStats)) {
      for (const key of adapter.teamStatKeys) expect((line as Record<string, unknown>)[key]).toBe(0);
    }
  });

  it('seeds a bye week with a line for its one real team', () => {
    for (const adapter of SPORT_ADAPTER_LIST) {
      expect(Object.keys(adapter.emptyStats({ teamIds: ['T1'] }).teamStats)).toEqual(['T1']);
    }
  });

  it('leaves every curling end unrecorded rather than blank', () => {
    const { teamStats } = SPORT_ADAPTERS[CURLING].emptyStats(game);
    for (const line of Object.values(teamStats)) {
      expect(line.roundScores).toHaveLength(CURLING_ROUND_COUNT);
      expect(line.roundScores.every((end) => end === null)).toBe(true);
    }
  });

  it('returns new objects on every call, so one rollup never shares a line with another', () => {
    for (const leagueType of LEAGUE_TYPE_KEYS) {
      const adapter: AnySportAdapter = getSportAdapter(leagueType);
      const first = adapter.emptyStats(game);
      const second = adapter.emptyStats(game);
      expect(first).toEqual(second);
      expect(first.teamStats.T1).not.toBe(second.teamStats.T1);
      expect(first.playerStats).not.toBe(second.playerStats);
    }
  });

  it('keeps each sport\'s rollup typed to that sport', () => {
    expectTypeOf(SPORT_ADAPTERS[CURLING].emptyStats(game).teamStats.T1.roundScores).toEqualTypeOf<
      (number | null)[]
    >();
  });
});
