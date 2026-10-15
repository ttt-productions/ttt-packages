// Minted identifiers and identity sentinels.
//
// Builders take the clock reading and the random suffix as arguments so they stay pure: the caller
// supplies `Date.now()` and its own randomness.

// A placeholder player carries a `ghost_`-prefixed id and has a publicUsers document (BACKEND-120).
export const GHOST_USER_ID_PREFIX = 'ghost_';

export function isGhostUserId(userId: string): boolean {
  return userId.startsWith(GHOST_USER_ID_PREFIX);
}

export function buildGhostUserId(nowMs: number, suffix: string): string {
  return `${GHOST_USER_ID_PREFIX}${nowMs}_${suffix}`;
}

// The ghost a ghost-add request creates: derived from the request id the client mints once per add
// and re-sends on every retry, so a retry names the same ghost instead of creating a second one. Its
// `req_` part never reads as a clock reading, so it cannot collide with a `buildGhostUserId` id.
export function buildGhostUserIdForRequest(requestId: string): string {
  return `${GHOST_USER_ID_PREFIX}req_${requestId}`;
}

// A new game's id, `{timestamp}_{suffix}`. A copied game keeps the id it was stored under.
export function buildSportGameId(nowMs: number, suffix: string): string {
  return `${nowMs}_${suffix}`;
}

// A new week's `weekId`, minted by the server when the week is saved. Some stored weeks hold a
// date-derived `week-{YYYY-MM-DD}` id; a minted id never takes that form, and never derives from the
// date, so two weeks starting on one day stay two weeks.
export function buildScheduleWeekId(nowMs: number, suffix: string): string {
  return `week_${nowMs}_${suffix}`;
}

// The team slot of a bye week. Never a real leagueTeams id.
export const BYE_TEAM_ID = 'bye';

// How the bye slot reads wherever a game or a week names it — a matchup, a schedule, a refusal.
export const BYE_TEAM_LABEL = 'Bye';

export function isByeTeamId(teamId: string): boolean {
  return teamId === BYE_TEAM_ID;
}
