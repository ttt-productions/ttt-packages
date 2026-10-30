import type { AdminNotificationMetadataByType } from '../doc-schemas/admin-notifications.js';
import type { LeagueTeam } from '../doc-schemas/league-team.js';
import type { LeagueFreeAgent } from '../doc-schemas/team-membership.js';
import { buildLeagueFreeAgentSignedUpEventId } from '../ids/notification-ids.js';
import type { AdminNotificationType } from '../types/notifications.js';
import { ADMIN_NOTIFICATION_DEFINITIONS } from './admin-notification-config.js';

export interface AdminNotificationOccurrence<
  T extends AdminNotificationType = AdminNotificationType,
> {
  type: T;
  eventId: string;
  aggregationKey: string;
  actorUserId: string;
  metadata: AdminNotificationMetadataByType[T];
  occurredAt: number;
}

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
