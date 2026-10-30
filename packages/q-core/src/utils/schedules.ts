import { SHARED_LOCATION_CONFLICT, TEAM_DOUBLE_BOOKED_CONFLICT } from '../types/schedules.js';

export function formatGameLocationLabel(venueName: string, subLocation?: string): string {
  return subLocation ? `${venueName} - ${subLocation}` : venueName;
}

export interface ScheduleConflictGame {
  readonly key: string;
  readonly startTime: number;
  readonly teamIds: readonly string[];
  readonly gameLocationId?: string;
  readonly subLocation?: string;
  readonly locationLabel: string;
}

export type ScheduleConflict =
  | {
      readonly kind: typeof SHARED_LOCATION_CONFLICT;
      readonly startTime: number;
      readonly gameKeys: string[];
    }
  | {
      readonly kind: typeof TEAM_DOUBLE_BOOKED_CONFLICT;
      readonly startTime: number;
      readonly teamId: string;
      readonly gameKeys: string[];
    };

function locationKey(game: ScheduleConflictGame): string {
  if (game.gameLocationId !== undefined)
    return `venue:${game.gameLocationId}:${game.subLocation ?? ''}`;
  return `label:${game.locationLabel.trim().toLowerCase()}`;
}

interface ConflictGroup {
  readonly startTime: number;
  readonly teamId: string | null;
  readonly games: ScheduleConflictGame[];
}

function addToGroup(
  groups: Map<string, ConflictGroup>,
  key: string,
  game: ScheduleConflictGame,
  teamId: string | null,
): void {
  const group = groups.get(key);
  if (group) group.games.push(game);
  else groups.set(key, { startTime: game.startTime, teamId, games: [game] });
}

export function findScheduleConflicts(
  candidates: readonly ScheduleConflictGame[],
  existing: readonly ScheduleConflictGame[],
): ScheduleConflict[] {
  const candidateKeys = new Set(candidates.map((game) => game.key));
  const games = [...existing.filter((game) => !candidateKeys.has(game.key)), ...candidates].filter(
    (game) => game.teamIds.length >= 2,
  );

  const byLocation = new Map<string, ConflictGroup>();
  const byTeam = new Map<string, ConflictGroup>();
  for (const game of games) {
    addToGroup(byLocation, `${game.startTime}|${locationKey(game)}`, game, null);
    for (const teamId of new Set(game.teamIds))
      addToGroup(byTeam, `${game.startTime}|${teamId}`, game, teamId);
  }

  const conflicts: ScheduleConflict[] = [];
  const reported = (group: ConflictGroup) =>
    group.games.length > 1 && group.games.some((game) => candidateKeys.has(game.key));
  const keysOf = (group: ConflictGroup) => group.games.map((game) => game.key).sort();

  for (const group of byLocation.values()) {
    if (!reported(group)) continue;
    conflicts.push({
      kind: SHARED_LOCATION_CONFLICT,
      startTime: group.startTime,
      gameKeys: keysOf(group),
    });
  }
  for (const group of byTeam.values()) {
    if (!reported(group) || group.teamId === null) continue;
    conflicts.push({
      kind: TEAM_DOUBLE_BOOKED_CONFLICT,
      startTime: group.startTime,
      teamId: group.teamId,
      gameKeys: keysOf(group),
    });
  }

  const teamOf = (conflict: ScheduleConflict) =>
    conflict.kind === TEAM_DOUBLE_BOOKED_CONFLICT ? conflict.teamId : '';
  return conflicts.sort(
    (a, b) =>
      a.startTime - b.startTime ||
      a.kind.localeCompare(b.kind) ||
      teamOf(a).localeCompare(teamOf(b)) ||
      a.gameKeys.join(',').localeCompare(b.gameKeys.join(',')),
  );
}
