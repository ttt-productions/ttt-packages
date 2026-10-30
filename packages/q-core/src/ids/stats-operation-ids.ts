import { COMPOUND_ID_SEPARATOR } from './compound-ids.js';

const GAME_DELETION_OPERATION_ID_PREFIX = 'gameDeletion';

export function buildGameDeletionOperationId(gameId: string): string {
  return [GAME_DELETION_OPERATION_ID_PREFIX, gameId].join(COMPOUND_ID_SEPARATOR);
}

const GHOST_PLAYER_OPERATION_ID_PREFIX = 'ghostPlayer';

export function buildGhostLinkOperationId(teamId: string, ghostUserId: string): string {
  return [GHOST_PLAYER_OPERATION_ID_PREFIX, teamId, ghostUserId].join(COMPOUND_ID_SEPARATOR);
}
