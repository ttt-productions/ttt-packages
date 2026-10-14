// Compound document IDs — one builder and one parser per relationship (ARCH-109).
//
// `firestore.rules` restates these formats, because a rules file cannot import them.
//
// League and team ids are Firestore auto ids and never contain the separator. A user id can: a
// ghost id is `ghost_<timestamp>_<suffix>`. So the user id is always the LAST part, and a parser
// splits only on the leading separators and keeps the remainder whole.

export const COMPOUND_ID_SEPARATOR = '_';

function splitLeading(id: string, leadingParts: number): string[] | null {
  const parts: string[] = [];
  let rest = id;
  for (let i = 0; i < leadingParts; i += 1) {
    const at = rest.indexOf(COMPOUND_ID_SEPARATOR);
    if (at <= 0) return null;
    parts.push(rest.slice(0, at));
    rest = rest.slice(at + COMPOUND_ID_SEPARATOR.length);
  }
  if (rest.length === 0) return null;
  parts.push(rest);
  return parts;
}

// teamMemberships/{leagueId}_{teamId}_{userId}
export interface TeamMembershipIdParts {
  leagueId: string;
  teamId: string;
  userId: string;
}

export function buildTeamMembershipId(leagueId: string, teamId: string, userId: string): string {
  return [leagueId, teamId, userId].join(COMPOUND_ID_SEPARATOR);
}

export function parseTeamMembershipId(id: string): TeamMembershipIdParts | null {
  const parts = splitLeading(id, 2);
  return parts ? { leagueId: parts[0], teamId: parts[1], userId: parts[2] } : null;
}

// leagueFreeAgents/{leagueId}_{userId}
export interface LeagueFreeAgentIdParts {
  leagueId: string;
  userId: string;
}

export function buildLeagueFreeAgentId(leagueId: string, userId: string): string {
  return [leagueId, userId].join(COMPOUND_ID_SEPARATOR);
}

export function parseLeagueFreeAgentId(id: string): LeagueFreeAgentIdParts | null {
  const parts = splitLeading(id, 1);
  return parts ? { leagueId: parts[0], userId: parts[1] } : null;
}

// sportGames/{gameId}/gameRosterPlayers/{teamId}_{userId} — one roster entry per team per person, so
// a person rostered on both teams of a game holds two. The same id keys the entry's line in the
// game's `stats.playerStats` and names it in the game's absence and participation lists.
export interface GameRosterPlayerIdParts {
  teamId: string;
  userId: string;
}

export function buildGameRosterPlayerId(teamId: string, userId: string): string {
  return [teamId, userId].join(COMPOUND_ID_SEPARATOR);
}

export function parseGameRosterPlayerId(id: string): GameRosterPlayerIdParts | null {
  const parts = splitLeading(id, 1);
  return parts ? { teamId: parts[0], userId: parts[1] } : null;
}

// signedWaivers/{leagueId}_{userId}
export interface SignedWaiverIdParts {
  leagueId: string;
  userId: string;
}

export function buildSignedWaiverId(leagueId: string, userId: string): string {
  return [leagueId, userId].join(COMPOUND_ID_SEPARATOR);
}

export function parseSignedWaiverId(id: string): SignedWaiverIdParts | null {
  const parts = splitLeading(id, 1);
  return parts ? { leagueId: parts[0], userId: parts[1] } : null;
}
