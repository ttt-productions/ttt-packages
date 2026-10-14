// One builder per notification type, taking the committed action's own record. The occurrence it
// returns is what the owning callable writes to the delivery ledger in the action's transaction
// (BACKEND-306): its id is derived from the action, never minted, so a retried write is the same
// occurrence; and its aggregation key is declared apart from that id, so a later action of the
// same kind is never mistaken for a retry of an earlier one.

import type { AdminNotificationMetadataByType } from '../doc-schemas/admin-notifications.js';
import type { LeagueTeam } from '../doc-schemas/league-team.js';
import type { LeagueFreeAgent } from '../doc-schemas/team-membership.js';
import { buildLeagueFreeAgentSignedUpEventId } from '../ids/notification-ids.js';
import type { AdminNotificationType } from '../types/notifications.js';
import { ADMIN_NOTIFICATION_DEFINITIONS } from './admin-notification-config.js';

export interface AdminNotificationOccurrence<T extends AdminNotificationType = AdminNotificationType> {
  type: T;
  eventId: string;
  aggregationKey: string;
  /** The account whose action this records. */
  actorUserId: string;
  metadata: AdminNotificationMetadataByType[T];
  occurredAt: number;
}

/** A team joined a league. A team is created once, so the team's id identifies its creation. */
export function leagueTeamCreatedNotification(
  teamId: string,
  team: Pick<LeagueTeam, 'leagueId' | 'createdByUserId' | 'createdAt'>,
): AdminNotificationOccurrence<'leagueTeamCreated'> {
  const metadata = { leagueId: team.leagueId, teamId };
  return {
    type: 'leagueTeamCreated',
    eventId: teamId,
    aggregationKey: ADMIN_NOTIFICATION_DEFINITIONS.leagueTeamCreated.aggregationKey(metadata),
    actorUserId: team.createdByUserId,
    metadata,
    occurredAt: team.createdAt,
  };
}

/** A player signed up as a free agent in a league. */
export function leagueFreeAgentSignedUpNotification(
  signup: LeagueFreeAgent,
): AdminNotificationOccurrence<'leagueFreeAgentSignedUp'> {
  const metadata = { leagueId: signup.leagueId, userId: signup.userId };
  return {
    type: 'leagueFreeAgentSignedUp',
    eventId: buildLeagueFreeAgentSignedUpEventId(signup.leagueId, signup.userId, signup.createdAt),
    aggregationKey: ADMIN_NOTIFICATION_DEFINITIONS.leagueFreeAgentSignedUp.aggregationKey(metadata),
    actorUserId: signup.userId,
    metadata,
    occurredAt: signup.createdAt,
  };
}
