import { describe, it, expect } from 'vitest';
import {
  AWARD_GROUP_GRANT_SUBCOLLECTIONS,
  COLLECTIONS,
  SPORT_GAME_SUBCOLLECTIONS,
  SPECIAL_DOCS,
  USER_PROFILE_SUBCOLLECTIONS,
  WAIVER_TEMPLATE_SUBCOLLECTIONS,
} from '../src/paths/collections.js';
import { COLLECTION_GROUPS } from '../src/paths/collection-groups.js';
import { COLLECTION_REFS } from '../src/paths/collection-refs.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';
import { toPath } from '../src/paths/utils.js';

const NAME_MAPS: Array<[string, Record<string, string>]> = [
  ['COLLECTIONS', COLLECTIONS],
  ['USER_PROFILE_SUBCOLLECTIONS', USER_PROFILE_SUBCOLLECTIONS],
  ['SPORT_GAME_SUBCOLLECTIONS', SPORT_GAME_SUBCOLLECTIONS],
  ['WAIVER_TEMPLATE_SUBCOLLECTIONS', WAIVER_TEMPLATE_SUBCOLLECTIONS],
  ['AWARD_GROUP_GRANT_SUBCOLLECTIONS', AWARD_GROUP_GRANT_SUBCOLLECTIONS],
];

describe('compound camelCase collection names', () => {
  // Every collection / subcollection segment says what its documents are — `leagueTeams`, never
  // `teams`. The leading underscore on the three reserved buckets is the deliberate bucket
  // convention and is stripped before the check. A rule guard, not an inventory.
  const COMPOUND_CAMEL_CASE = /^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/;

  for (const [mapName, map] of NAME_MAPS) {
    it(`${mapName} values are all compound camelCase`, () => {
      const offenders = Object.entries(map)
        .filter(([, value]) => !COMPOUND_CAMEL_CASE.test(value.replace(/^_/, '')))
        .map(([key, value]) => `${mapName}.${key} = '${value}'`);
      expect(offenders).toEqual([]);
    });
  }

  it('only the three audience buckets carry a leading underscore (BACKEND-108)', () => {
    const underscored = Object.values(COLLECTIONS).filter((value) => value.startsWith('_'));
    expect(underscored.sort()).toEqual(['_appConfig', '_serverData', '_systemData']);
  });

  it('a key is the SCREAMING_SNAKE spelling of its value', () => {
    const toKey = (value: string) =>
      value.replace(/^_/, '').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
    for (const [mapName, map] of NAME_MAPS) {
      for (const [key, value] of Object.entries(map)) {
        expect(key, `${mapName}.${key}`).toBe(toKey(value));
      }
    }
  });

  it('no name is declared twice across the maps', () => {
    const all = NAME_MAPS.flatMap(([, map]) => Object.values(map));
    expect(new Set(all).size).toBe(all.length);
    const docs = Object.values(SPECIAL_DOCS);
    expect(new Set(docs).size).toBe(docs.length);
  });
});

describe('path builders', () => {
  it('build segment tuples that toPath joins, with compound ids assembled inside the builder', () => {
    expect(toPath(PATH_BUILDERS.userProfile('u1'))).toBe('userProfiles/u1');
    expect(toPath(PATH_BUILDERS.teamMembership('L', 'T', 'u1'))).toBe('teamMemberships/L_T_u1');
    // A membership's roster obligation is keyed by the membership's own id — no second format.
    expect(toPath(PATH_BUILDERS.membershipRosterSync('L', 'T', 'ghost_1_x'))).toBe(
      'membershipRosterSyncs/L_T_ghost_1_x',
    );
    expect(toPath(PATH_BUILDERS.leagueTeamContact('T'))).toBe('leagueTeamContacts/T');
    expect(toPath(PATH_BUILDERS.leagueFreeAgent('L', 'u1'))).toBe('leagueFreeAgents/L_u1');
    expect(toPath(PATH_BUILDERS.signedWaiver('L', 'u1'))).toBe('signedWaivers/L_u1');
    expect(toPath(PATH_BUILDERS.gameRosterPlayer('g1', 'T', 'u1'))).toBe('sportGames/g1/gameRosterPlayers/T_u1');
    expect(toPath(PATH_BUILDERS.gameStatEvent('g1', 'e1'))).toBe('sportGames/g1/gameStatEvents/e1');
    expect(toPath(PATH_BUILDERS.gameStatHistoryPage('g1', 'page_0000'))).toBe(
      'sportGames/g1/gameStatHistory/page_0000',
    );
    expect(toPath(PATH_BUILDERS.statsOperation('op1'))).toBe('statsOperations/op1');
    expect(toPath(PATH_BUILDERS.historicalStat('u1', 'basketball'))).toBe(
      'userProfiles/u1/historicalStats/basketball',
    );
    expect(toPath(PATH_BUILDERS.sportHallOfFame('curling'))).toBe('sportHallOfFame/curling');
  });

  it('place each fixed-ID document in the bucket its readers need', () => {
    expect(toPath(PATH_BUILDERS.landingPageConfig())).toBe('_appConfig/landingPage');
    expect(toPath(PATH_BUILDERS.appConfig())).toBe('_appConfig/app');
    expect(toPath(PATH_BUILDERS.statsBeacon())).toBe('_appConfig/statsBeacon');
    expect(toPath(PATH_BUILDERS.adminList())).toBe('_systemData/adminList');
    // Admin-only documents are server-only: an admin reads them through a callable, never through a
    // client grant (BACKEND-108).
    expect(toPath(PATH_BUILDERS.migrationConsole())).toBe('_serverData/migrationConsole');
  });

  it('address a waiver template version by the version number, through its one id builder', () => {
    expect(toPath(PATH_BUILDERS.waiverTemplateVersion('w1', 3))).toBe(
      'waiverTemplates/w1/waiverTemplateVersions/v3',
    );
  });

  it('a plural builder is its singular minus the document id', () => {
    expect(PATH_BUILDERS.gameRosterPlayers('g1')).toEqual(PATH_BUILDERS.gameRosterPlayer('g1', 'T', 'x').slice(0, 3));
    expect(PATH_BUILDERS.gameStatEvents('g1')).toEqual(PATH_BUILDERS.gameStatEvent('g1', 'x').slice(0, 3));
    expect(PATH_BUILDERS.gameStatHistory('g1')).toEqual(PATH_BUILDERS.gameStatHistoryPage('g1', 'x').slice(0, 3));
    expect(PATH_BUILDERS.historicalStats('u1')).toEqual(PATH_BUILDERS.historicalStat('u1', 'curling').slice(0, 3));
    expect(PATH_BUILDERS.waiverTemplateVersions('w1')).toEqual(
      PATH_BUILDERS.waiverTemplateVersion('w1', 1).slice(0, 3),
    );
    expect(PATH_BUILDERS.awardGroupGrantPeople('g1')).toEqual(PATH_BUILDERS.awardGroupGrantPerson('g1', 'u1').slice(0, 3));
  });
});

describe('collection refs and groups', () => {
  it('every COLLECTION_REFS entry returns exactly one declared top-level collection', () => {
    const declared = new Set<string>(Object.values(COLLECTIONS));
    for (const [name, build] of Object.entries(COLLECTION_REFS)) {
      const segments = build();
      expect(segments, name).toHaveLength(1);
      expect(declared.has(segments[0]), name).toBe(true);
      expect(segments[0], name).toBe(name);
    }
  });

  it('collection groups derive from the subcollection constants', () => {
    expect(COLLECTION_GROUPS.GAME_ROSTER_PLAYERS).toBe(SPORT_GAME_SUBCOLLECTIONS.GAME_ROSTER_PLAYERS);
    expect(COLLECTION_GROUPS.GAME_STAT_EVENTS).toBe(SPORT_GAME_SUBCOLLECTIONS.GAME_STAT_EVENTS);
    expect(COLLECTION_GROUPS.AWARD_GROUP_GRANT_PEOPLE).toBe(AWARD_GROUP_GRANT_SUBCOLLECTIONS.AWARD_GROUP_GRANT_PEOPLE);
  });
});
