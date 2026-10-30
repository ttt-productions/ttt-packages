import { LEAGUE_TYPE_KEYS } from '../types/sports.js';
import type { LeagueType } from '../types/sports.js';
import { BASKETBALL_ADAPTER } from './basketball.js';
import { CURLING_ADAPTER } from './curling.js';
import { FOOTBALL_ADAPTER } from './football.js';
import type { AnySportAdapter, SportAdapterRegistry } from './sport-adapter.js';

export const SPORT_ADAPTERS: SportAdapterRegistry = {
  Basketball: BASKETBALL_ADAPTER,
  Curling: CURLING_ADAPTER,
  Football: FOOTBALL_ADAPTER,
};

export const SPORT_ADAPTER_LIST: readonly AnySportAdapter[] = LEAGUE_TYPE_KEYS.map(
  (leagueType) => SPORT_ADAPTERS[leagueType],
);

export class UnknownSportError extends Error {
  readonly leagueType: unknown;

  constructor(leagueType: unknown) {
    super(`No sport adapter is registered for leagueType ${describeValue(leagueType)}.`);
    this.name = 'UnknownSportError';
    this.leagueType = leagueType;
  }
}

function describeValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    return String(value);
  } catch {
    return typeof value;
  }
}

function isLeagueType(value: unknown): value is LeagueType {
  return typeof value === 'string' && (LEAGUE_TYPE_KEYS as readonly string[]).includes(value);
}

export function getSportAdapter<L extends LeagueType>(leagueType: L): SportAdapterRegistry[L];
export function getSportAdapter(leagueType: unknown): AnySportAdapter;
export function getSportAdapter(leagueType: unknown): AnySportAdapter {
  if (!isLeagueType(leagueType)) throw new UnknownSportError(leagueType);
  return SPORT_ADAPTERS[leagueType];
}
