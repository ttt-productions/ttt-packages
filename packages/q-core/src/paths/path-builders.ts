// Document path builders — segment tuples, the one path family.
//
// Frontend: doc(db, ...PATH_BUILDERS.userProfile(userId))
// Backend:  db.doc(toPath(PATH_BUILDERS.userProfile(userId)))
//
// A singular name builds a document path; its plural builds the parent collection path where the
// parent is a subcollection (top-level collections are in COLLECTION_REFS). A compound document ID
// is assembled here through its one builder in ../ids — never at a call site.

import {
  AWARD_GROUP_GRANT_SUBCOLLECTIONS,
  COLLECTIONS,
  SPORT_GAME_SUBCOLLECTIONS,
  SPECIAL_DOCS,
  USER_PROFILE_SUBCOLLECTIONS,
  WAIVER_TEMPLATE_SUBCOLLECTIONS,
} from './collections.js';
import type { SweepStateName } from '../constants/scheduled-jobs.js';
import {
  buildGameRosterPlayerId,
  buildLeagueFreeAgentId,
  buildTeamMembershipId,
  buildSignedWaiverId,
} from '../ids/compound-ids.js';
import { buildWaiverTemplateVersionId } from '../ids/waiver-template-ids.js';
import type { SportKey } from '../types/sports.js';
import { toReservedDisplayNameKey } from '../utils/display-name.js';

export const PATH_BUILDERS = {
  // People
  userProfile: (userId: string): [string, string] => [COLLECTIONS.USER_PROFILES, userId],
  userPrivateData: (userId: string): [string, string, string, string] => [
    COLLECTIONS.USER_PROFILES,
    userId,
    USER_PROFILE_SUBCOLLECTIONS.PRIVATE_DATA,
    userId,
  ],
  historicalStat: (userId: string, sportKey: SportKey): [string, string, string, string] => [
    COLLECTIONS.USER_PROFILES,
    userId,
    USER_PROFILE_SUBCOLLECTIONS.HISTORICAL_STATS,
    sportKey,
  ],
  historicalStats: (userId: string): [string, string, string] => [
    COLLECTIONS.USER_PROFILES,
    userId,
    USER_PROFILE_SUBCOLLECTIONS.HISTORICAL_STATS,
  ],
  publicUser: (userId: string): [string, string] => [COLLECTIONS.PUBLIC_USERS, userId],
  statusReconcileQueueEntry: (userId: string): [string, string] => [COLLECTIONS.STATUS_RECONCILE_QUEUE, userId],
  registrationStart: (userId: string): [string, string] => [COLLECTIONS.REGISTRATION_STARTS, userId],
  sweepState: (name: SweepStateName): [string, string] => [COLLECTIONS.SWEEP_STATE, name],
  reservedDisplayName: (displayName: string): [string, string] => [
    COLLECTIONS.RESERVED_DISPLAY_NAMES,
    toReservedDisplayNameKey(displayName),
  ],

  // Leagues, teams, membership
  sportLeague: (leagueId: string): [string, string] => [COLLECTIONS.SPORT_LEAGUES, leagueId],
  leagueTeam: (teamId: string): [string, string] => [COLLECTIONS.LEAGUE_TEAMS, teamId],
  leagueTeamContact: (teamId: string): [string, string] => [COLLECTIONS.LEAGUE_TEAM_CONTACTS, teamId],
  teamMembership: (leagueId: string, teamId: string, userId: string): [string, string] => [
    COLLECTIONS.TEAM_MEMBERSHIPS,
    buildTeamMembershipId(leagueId, teamId, userId),
  ],
  membershipRosterSync: (leagueId: string, teamId: string, userId: string): [string, string] => [
    COLLECTIONS.MEMBERSHIP_ROSTER_SYNCS,
    buildTeamMembershipId(leagueId, teamId, userId),
  ],
  teamInvitation: (inviteId: string): [string, string] => [COLLECTIONS.TEAM_INVITATIONS, inviteId],
  teamJoinRequest: (requestId: string): [string, string] => [COLLECTIONS.TEAM_JOIN_REQUESTS, requestId],
  leagueFreeAgent: (leagueId: string, userId: string): [string, string] => [
    COLLECTIONS.LEAGUE_FREE_AGENTS,
    buildLeagueFreeAgentId(leagueId, userId),
  ],

  // Games
  sportGame: (gameId: string): [string, string] => [COLLECTIONS.SPORT_GAMES, gameId],
  gameRosterPlayer: (gameId: string, teamId: string, userId: string): [string, string, string, string] => [
    COLLECTIONS.SPORT_GAMES,
    gameId,
    SPORT_GAME_SUBCOLLECTIONS.GAME_ROSTER_PLAYERS,
    buildGameRosterPlayerId(teamId, userId),
  ],
  gameRosterPlayers: (gameId: string): [string, string, string] => [
    COLLECTIONS.SPORT_GAMES,
    gameId,
    SPORT_GAME_SUBCOLLECTIONS.GAME_ROSTER_PLAYERS,
  ],
  gameStatEvent: (gameId: string, eventId: string): [string, string, string, string] => [
    COLLECTIONS.SPORT_GAMES,
    gameId,
    SPORT_GAME_SUBCOLLECTIONS.GAME_STAT_EVENTS,
    eventId,
  ],
  gameStatEvents: (gameId: string): [string, string, string] => [
    COLLECTIONS.SPORT_GAMES,
    gameId,
    SPORT_GAME_SUBCOLLECTIONS.GAME_STAT_EVENTS,
  ],
  gameStatHistoryPage: (gameId: string, pageId: string): [string, string, string, string] => [
    COLLECTIONS.SPORT_GAMES,
    gameId,
    SPORT_GAME_SUBCOLLECTIONS.GAME_STAT_HISTORY,
    pageId,
  ],
  gameStatHistory: (gameId: string): [string, string, string] => [
    COLLECTIONS.SPORT_GAMES,
    gameId,
    SPORT_GAME_SUBCOLLECTIONS.GAME_STAT_HISTORY,
  ],
  gameLocation: (gameLocationId: string): [string, string] => [COLLECTIONS.GAME_LOCATIONS, gameLocationId],

  // Waivers and hardware
  waiverTemplate: (waiverTemplateId: string): [string, string] => [
    COLLECTIONS.WAIVER_TEMPLATES,
    waiverTemplateId,
  ],
  waiverTemplateVersion: (waiverTemplateId: string, version: number): [string, string, string, string] => [
    COLLECTIONS.WAIVER_TEMPLATES,
    waiverTemplateId,
    WAIVER_TEMPLATE_SUBCOLLECTIONS.WAIVER_TEMPLATE_VERSIONS,
    buildWaiverTemplateVersionId(version),
  ],
  waiverTemplateVersions: (waiverTemplateId: string): [string, string, string] => [
    COLLECTIONS.WAIVER_TEMPLATES,
    waiverTemplateId,
    WAIVER_TEMPLATE_SUBCOLLECTIONS.WAIVER_TEMPLATE_VERSIONS,
  ],
  signedWaiver: (leagueId: string, userId: string): [string, string] => [
    COLLECTIONS.SIGNED_WAIVERS,
    buildSignedWaiverId(leagueId, userId),
  ],
  hardwareLoanContract: (contractId: string): [string, string] => [
    COLLECTIONS.HARDWARE_LOAN_CONTRACTS,
    contractId,
  ],

  // Awards and derived stats
  awardDefinition: (awardId: string): [string, string] => [COLLECTIONS.AWARD_DEFINITIONS, awardId],
  awardGroupGrant: (grantId: string): [string, string] => [COLLECTIONS.AWARD_GROUP_GRANTS, grantId],
  awardGroupGrantPerson: (grantId: string, userId: string): [string, string, string, string] => [
    COLLECTIONS.AWARD_GROUP_GRANTS,
    grantId,
    AWARD_GROUP_GRANT_SUBCOLLECTIONS.AWARD_GROUP_GRANT_PEOPLE,
    userId,
  ],
  awardGroupGrantPeople: (grantId: string): [string, string, string] => [
    COLLECTIONS.AWARD_GROUP_GRANTS,
    grantId,
    AWARD_GROUP_GRANT_SUBCOLLECTIONS.AWARD_GROUP_GRANT_PEOPLE,
  ],
  sportHallOfFame: (sportKey: SportKey): [string, string] => [COLLECTIONS.SPORT_HALL_OF_FAME, sportKey],
  statsValidationReport: (reportId: string): [string, string] => [
    COLLECTIONS.STATS_VALIDATION_REPORTS,
    reportId,
  ],
  statsOperation: (operationId: string): [string, string] => [COLLECTIONS.STATS_OPERATIONS, operationId],
  migrationActionRun: (actionId: string): [string, string] => [COLLECTIONS.MIGRATION_ACTION_RUNS, actionId],

  galleryPicture: (pictureId: string): [string, string] => [COLLECTIONS.GALLERY_PICTURES, pictureId],
  pendingMedia: (pendingMediaId: string): [string, string] => [COLLECTIONS.PENDING_MEDIA, pendingMediaId],
  // A picture's retirement is keyed by the picture id; a whole gallery's by `buildGalleryRetirementId`.
  pictureRetirement: (retirementId: string): [string, string] => [
    COLLECTIONS.PICTURE_RETIREMENTS,
    retirementId,
  ],

  auditEvent: (auditEventId: string): [string, string] => [COLLECTIONS.AUDIT_EVENTS, auditEventId],

  // Admin notifications. A card's id is notification-core's; the others come from ../ids.
  activeAdminNotification: (notificationId: string): [string, string] => [
    COLLECTIONS.ACTIVE_ADMIN_NOTIFICATIONS,
    notificationId,
  ],
  adminNotificationHistoryEntry: (historyId: string): [string, string] => [
    COLLECTIONS.ADMIN_NOTIFICATION_HISTORY,
    historyId,
  ],
  notificationDelivery: (deliveryId: string): [string, string] => [COLLECTIONS.NOTIFICATION_DELIVERIES, deliveryId],
  notificationArchiveAllJob: (jobId: string): [string, string] => [COLLECTIONS.NOTIFICATION_ARCHIVE_ALL_JOBS, jobId],

  // Fixed-ID system documents
  landingPageConfig: (): [string, string] => [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.LANDING_PAGE],
  appConfig: (): [string, string] => [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.APP_CONFIG],
  statsBeacon: (): [string, string] => [COLLECTIONS.APP_CONFIG, SPECIAL_DOCS.STATS_BEACON],
  adminList: (): [string, string] => [COLLECTIONS.SYSTEM_DATA, SPECIAL_DOCS.ADMIN_LIST],
  migrationConsole: (): [string, string] => [COLLECTIONS.SERVER_DATA, SPECIAL_DOCS.MIGRATION_CONSOLE],
  gameLocationRegistry: (): [string, string] => [COLLECTIONS.SERVER_DATA, SPECIAL_DOCS.GAME_LOCATION_REGISTRY],
  waiverTemplateRegistry: (): [string, string] => [COLLECTIONS.SERVER_DATA, SPECIAL_DOCS.WAIVER_TEMPLATE_REGISTRY],
} as const;
