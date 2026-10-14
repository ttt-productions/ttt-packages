// `statsOperations` ids the server derives from what the operation acts on, so a retried call finds
// the operation it started instead of starting a second one, and no client names the document.

import { COMPOUND_ID_SEPARATOR } from './compound-ids.js';

const GAME_DELETION_OPERATION_ID_PREFIX = 'gameDeletion';

// A game is deleted at most once, so its id names the one deletion it can have; a client-minted id
// would let a caller address another action's operation document (BACKEND-102).
export function buildGameDeletionOperationId(gameId: string): string {
  return [GAME_DELETION_OPERATION_ID_PREFIX, gameId].join(COMPOUND_ID_SEPARATOR);
}

const GHOST_PLAYER_OPERATION_ID_PREFIX = 'ghostPlayer';

// A ghost has exactly one operation for both of its ways out — a link to a real account, or its
// removal — so two links of one ghost, or a link and a removal, find the same document and refuse
// each other instead of interleaving. The team is part of it because a link acts on one team.
export function buildGhostLinkOperationId(teamId: string, ghostUserId: string): string {
  return [GHOST_PLAYER_OPERATION_ID_PREFIX, teamId, ghostUserId].join(COMPOUND_ID_SEPARATOR);
}
