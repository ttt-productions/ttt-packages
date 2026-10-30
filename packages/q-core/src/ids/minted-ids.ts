export const GHOST_USER_ID_PREFIX = 'ghost_';

export function isGhostUserId(userId: string): boolean {
  return userId.startsWith(GHOST_USER_ID_PREFIX);
}

export function buildGhostUserId(nowMs: number, suffix: string): string {
  return `${GHOST_USER_ID_PREFIX}${nowMs}_${suffix}`;
}

// Its `req_` part never reads as a clock reading, so it cannot collide with a `buildGhostUserId`
// id.
export function buildGhostUserIdForRequest(requestId: string): string {
  return `${GHOST_USER_ID_PREFIX}req_${requestId}`;
}

export function buildSportGameId(nowMs: number, suffix: string): string {
  return `${nowMs}_${suffix}`;
}

// Some stored weeks hold a date-derived `week-{YYYY-MM-DD}` id; a minted id never takes that form,
// and never derives from the date, so two weeks starting on one day stay two weeks.
export function buildScheduleWeekId(nowMs: number, suffix: string): string {
  return `week_${nowMs}_${suffix}`;
}

export const BYE_TEAM_ID = 'bye';

export const BYE_TEAM_LABEL = 'Bye';

export function isByeTeamId(teamId: string): boolean {
  return teamId === BYE_TEAM_ID;
}
