// Collection reference builders — for collection-level operations.
//
// Frontend: collection(db, ...COLLECTION_REFS.userProfiles())
// Backend:  db.collection(toPath(COLLECTION_REFS.userProfiles()))

import { COLLECTIONS } from './collections.js';

export const COLLECTION_REFS = {
  userProfiles: (): [string] => [COLLECTIONS.USER_PROFILES],
  publicUsers: (): [string] => [COLLECTIONS.PUBLIC_USERS],
  statusReconcileQueue: (): [string] => [COLLECTIONS.STATUS_RECONCILE_QUEUE],
  registrationStarts: (): [string] => [COLLECTIONS.REGISTRATION_STARTS],
  reservedDisplayNames: (): [string] => [COLLECTIONS.RESERVED_DISPLAY_NAMES],
  sportLeagues: (): [string] => [COLLECTIONS.SPORT_LEAGUES],
  leagueTeams: (): [string] => [COLLECTIONS.LEAGUE_TEAMS],
  leagueTeamContacts: (): [string] => [COLLECTIONS.LEAGUE_TEAM_CONTACTS],
  teamMemberships: (): [string] => [COLLECTIONS.TEAM_MEMBERSHIPS],
  teamInvitations: (): [string] => [COLLECTIONS.TEAM_INVITATIONS],
  teamJoinRequests: (): [string] => [COLLECTIONS.TEAM_JOIN_REQUESTS],
  leagueFreeAgents: (): [string] => [COLLECTIONS.LEAGUE_FREE_AGENTS],
  membershipRosterSyncs: (): [string] => [COLLECTIONS.MEMBERSHIP_ROSTER_SYNCS],
  sportGames: (): [string] => [COLLECTIONS.SPORT_GAMES],
  gameLocations: (): [string] => [COLLECTIONS.GAME_LOCATIONS],
  waiverTemplates: (): [string] => [COLLECTIONS.WAIVER_TEMPLATES],
  signedWaivers: (): [string] => [COLLECTIONS.SIGNED_WAIVERS],
  hardwareLoanContracts: (): [string] => [COLLECTIONS.HARDWARE_LOAN_CONTRACTS],
  awardDefinitions: (): [string] => [COLLECTIONS.AWARD_DEFINITIONS],
  statsValidationReports: (): [string] => [COLLECTIONS.STATS_VALIDATION_REPORTS],
  statsOperations: (): [string] => [COLLECTIONS.STATS_OPERATIONS],
  migrationActionRuns: (): [string] => [COLLECTIONS.MIGRATION_ACTION_RUNS],
  galleryPictures: (): [string] => [COLLECTIONS.GALLERY_PICTURES],
  pendingMedia: (): [string] => [COLLECTIONS.PENDING_MEDIA],
  pictureRetirements: (): [string] => [COLLECTIONS.PICTURE_RETIREMENTS],
  auditEvents: (): [string] => [COLLECTIONS.AUDIT_EVENTS],
  activeAdminNotifications: (): [string] => [COLLECTIONS.ACTIVE_ADMIN_NOTIFICATIONS],
  adminNotificationHistory: (): [string] => [COLLECTIONS.ADMIN_NOTIFICATION_HISTORY],
  notificationDeliveries: (): [string] => [COLLECTIONS.NOTIFICATION_DELIVERIES],
  notificationArchiveAllJobs: (): [string] => [COLLECTIONS.NOTIFICATION_ARCHIVE_ALL_JOBS],
} as const;
