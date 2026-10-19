// Collection → schema registry: every Firestore path template bound to the zod schema its
// documents must satisfy. Every document a migration copy action writes is validated against the
// schema bound here.
//
// A key is the literal path template — `{placeholder}` for an id, the literal segment for a fixed
// document id. __tests__/doc-schemas-registry.test.ts fails when a collection constant has neither a
// binding here nor an explicit PENDING_COLLECTIONS entry.

import type { z } from 'zod';
import { StatusReconcileQueueEntrySchema } from './status-reconcile-queue.js';
import {
  ActiveAdminNotificationSchema,
  AdminNotificationHistorySchema,
  NotificationArchiveAllJobSchema,
  NotificationDeliverySchema,
} from './admin-notifications.js';
import { AwardDefinitionSchema } from './catalogs.js';
import { AwardGroupGrantPersonSchema, AwardGroupGrantSchema } from './award-group-grant.js';
import { GameLocationRegistrySchema, GameLocationSchema } from './game-location.js';
import { GalleryPictureSchema } from './gallery.js';
import { PendingMediaSchema } from './pending-media.js';
import { PictureRetirementSchema } from './picture-retirement.js';
import { GameRosterPlayerSchema, SportGameSchema } from './sport-game.js';
import { SportHallOfFameSchema } from './aggregate-stats.js';
import { GameStatHistoryPageSchema } from './game-stat-history.js';
import { GameStatEventSchema } from './game-stats.js';
import { StatsOperationSchema } from './stats-operation.js';
import { LeagueTeamContactSchema, LeagueTeamSchema } from './league-team.js';
import { MembershipRosterSyncSchema } from './membership-roster-sync.js';
import { MigrationActionRunSchema, MigrationConsoleSchema } from './migration-console.js';
import { AuditEventSchema } from './audit-event.js';
import { PublicUserSchema } from './publicUser.js';
import { RegistrationStartSchema } from './registration-start.js';
import { ReservedDisplayNameSchema } from './reserved-display-name.js';
import { SportLeagueSchema } from './sport-league.js';
import { SweepStateSchema } from './sweep-state.js';
import {
  AppConfigSchema,
  LandingPageConfigSchema,
  AdminListSchema,
  StatsBeaconSchema,
  StatsValidationReportSchema,
} from './system.js';
import {
  LeagueFreeAgentSchema,
  TeamJoinRequestSchema,
  TeamInvitationSchema,
  TeamMembershipSchema,
} from './team-membership.js';
import { HistoricalStatsSchema, UserPrivateDataSchema, UserProfileSchema } from './user-profile.js';
import { HardwareLoanContractSchema, SignedWaiverSchema } from './waivers-and-hardware.js';
import {
  WaiverTemplateRegistrySchema,
  WaiverTemplateSchema,
  WaiverTemplateVersionSchema,
} from './waiver-template.js';

export const COLLECTION_SCHEMAS = {
  'userProfiles/{userId}': UserProfileSchema,
  'userProfiles/{userId}/privateData/{privateDataId}': UserPrivateDataSchema,
  'userProfiles/{userId}/historicalStats/{sportKey}': HistoricalStatsSchema,
  'publicUsers/{userId}': PublicUserSchema,
  'reservedDisplayNames/{reservedDisplayNameKey}': ReservedDisplayNameSchema,
  'statusReconcileQueue/{userId}': StatusReconcileQueueEntrySchema,
  'registrationStarts/{userId}': RegistrationStartSchema,

  'sportLeagues/{leagueId}': SportLeagueSchema,
  'leagueTeams/{teamId}': LeagueTeamSchema,
  'leagueTeamContacts/{teamId}': LeagueTeamContactSchema,
  'teamMemberships/{teamMembershipId}': TeamMembershipSchema,
  'membershipRosterSyncs/{teamMembershipId}': MembershipRosterSyncSchema,
  'teamInvitations/{inviteId}': TeamInvitationSchema,
  'teamJoinRequests/{requestId}': TeamJoinRequestSchema,
  'leagueFreeAgents/{leagueFreeAgentId}': LeagueFreeAgentSchema,

  'sportGames/{gameId}': SportGameSchema,
  'sportGames/{gameId}/gameRosterPlayers/{gameRosterPlayerId}': GameRosterPlayerSchema,
  'sportGames/{gameId}/gameStatEvents/{eventId}': GameStatEventSchema,
  'sportGames/{gameId}/gameStatHistory/{pageId}': GameStatHistoryPageSchema,
  'gameLocations/{gameLocationId}': GameLocationSchema,

  'waiverTemplates/{waiverTemplateId}': WaiverTemplateSchema,
  'waiverTemplates/{waiverTemplateId}/waiverTemplateVersions/{versionId}':
    WaiverTemplateVersionSchema,
  'signedWaivers/{signedWaiverId}': SignedWaiverSchema,
  'hardwareLoanContracts/{contractId}': HardwareLoanContractSchema,

  'awardDefinitions/{awardId}': AwardDefinitionSchema,
  'awardGroupGrants/{grantId}': AwardGroupGrantSchema,
  'awardGroupGrants/{grantId}/awardGroupGrantPeople/{userId}': AwardGroupGrantPersonSchema,
  'sportHallOfFame/{sportKey}': SportHallOfFameSchema,
  'statsValidationReports/{reportId}': StatsValidationReportSchema,
  'statsOperations/{operationId}': StatsOperationSchema,

  'galleryPictures/{pictureId}': GalleryPictureSchema,
  'pendingMedia/{pendingMediaId}': PendingMediaSchema,
  'pictureRetirements/{retirementId}': PictureRetirementSchema,

  'auditEvents/{auditEventId}': AuditEventSchema,

  'activeAdminNotifications/{notificationId}': ActiveAdminNotificationSchema,
  'adminNotificationHistory/{historyId}': AdminNotificationHistorySchema,
  'notificationDeliveries/{deliveryId}': NotificationDeliverySchema,
  'notificationArchiveAllJobs/{jobId}': NotificationArchiveAllJobSchema,

  '_appConfig/landingPage': LandingPageConfigSchema,
  '_appConfig/app': AppConfigSchema,
  '_appConfig/statsBeacon': StatsBeaconSchema,
  '_systemData/adminList': AdminListSchema,
  '_serverData/migrationConsole': MigrationConsoleSchema,
  '_serverData/gameLocationRegistry': GameLocationRegistrySchema,
  '_serverData/waiverTemplateRegistry': WaiverTemplateRegistrySchema,
  'migrationActionRuns/{actionId}': MigrationActionRunSchema,
  'sweepState/{sweepName}': SweepStateSchema,
} as const satisfies Record<string, z.ZodTypeAny>;

export type RegisteredCollectionPath = keyof typeof COLLECTION_SCHEMAS;

// The body field that equals the document id, where a schema declares one. A drift check injects
// `doc.id` under this key before validating, so a doc-id field is never a false mismatch.
export const COLLECTION_DOC_ID_FIELDS = {
  'publicUsers/{userId}': 'uid',
  'registrationStarts/{userId}': 'userId',
  'sportGames/{gameId}/gameStatEvents/{eventId}': 'eventId',
  'statsValidationReports/{reportId}': 'reportId',
  'auditEvents/{auditEventId}': 'id',
  'pendingMedia/{pendingMediaId}': 'id',
  'adminNotificationHistory/{historyId}': 'archiveOccurrenceId',
  'notificationDeliveries/{deliveryId}': 'deliveryId',
  'notificationArchiveAllJobs/{jobId}': 'jobId',
  'awardGroupGrants/{grantId}': 'grantId',
  'awardGroupGrants/{grantId}/awardGroupGrantPeople/{userId}': 'userId',
  'migrationActionRuns/{actionId}': 'actionId',
} as const satisfies Partial<Record<RegisteredCollectionPath, string>>;

// Collections declared in ../paths with no bound schema yet, each with the reason.
export const PENDING_COLLECTIONS: readonly string[] = [];
