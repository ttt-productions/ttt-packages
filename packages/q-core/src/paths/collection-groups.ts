// Collection group names — derived from the subcollection constants, never re-typed.
//
// Frontend: collectionGroup(db, COLLECTION_GROUPS.GAME_ROSTER_PLAYERS)
// Backend:  db.collectionGroup(COLLECTION_GROUPS.GAME_ROSTER_PLAYERS)

import { AWARD_GROUP_GRANT_SUBCOLLECTIONS, SPORT_GAME_SUBCOLLECTIONS } from './collections.js';

export const COLLECTION_GROUPS = {
  // Every grant's record of one person: a revoke asks whether another group's grant still holds them.
  AWARD_GROUP_GRANT_PEOPLE: AWARD_GROUP_GRANT_SUBCOLLECTIONS.AWARD_GROUP_GRANT_PEOPLE,
  GAME_ROSTER_PLAYERS: SPORT_GAME_SUBCOLLECTIONS.GAME_ROSTER_PLAYERS,
  GAME_STAT_EVENTS: SPORT_GAME_SUBCOLLECTIONS.GAME_STAT_EVENTS,
} as const;
