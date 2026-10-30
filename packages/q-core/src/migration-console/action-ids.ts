export const MIGRATION_ACTION_IDS = {
  copyUserProfiles: 'copy.userProfiles',
  copyHistoricalStats: 'copy.historicalStats',
  deriveReservedDisplayNames: 'derive.reservedDisplayNames',
  migratePublicUsers: 'migrate.publicUsers',
  copyAdminList: 'copy.adminList',
  verifyUserProfiles: 'verify.userProfiles',
  verifyHistoricalStats: 'verify.historicalStats',
  verifyReservedDisplayNames: 'verify.reservedDisplayNames',
  verifyPublicUsers: 'verify.publicUsers',
  verifyAdminList: 'verify.adminList',
  cleanupOrphanGhostPublicUsers: 'cleanup.orphanGhostPublicUsers',
  deleteV1Users: 'delete.v1Users',
  deleteV1AdminRoles: 'delete.v1AdminRoles',

  // Required by the ghost cleanup, whose probes read `teamMemberships` and `gameRosterPlayers`:
  // until those copies are verified complete, every ghost reads as unreferenced.
  verifyTeamMemberships: 'verify.teamMemberships',
  verifyGameRosterPlayers: 'verify.gameRosterPlayers',

  copyLeagueTeams: 'copy.leagueTeams',
  verifyLeagueTeams: 'verify.leagueTeams',
  deleteV1Teams: 'delete.v1Teams',
  copyTeamMemberships: 'copy.teamMemberships',
  deleteV1TeamMembers: 'delete.v1TeamMembers',
  copyTeamInvitations: 'copy.teamInvitations',
  verifyTeamInvitations: 'verify.teamInvitations',
  deleteV1TeamInvites: 'delete.v1TeamInvites',
  copyTeamJoinRequests: 'copy.teamJoinRequests',
  verifyTeamJoinRequests: 'verify.teamJoinRequests',
  deleteV1JoinRequests: 'delete.v1JoinRequests',
  copyLeagueFreeAgents: 'copy.leagueFreeAgents',
  verifyLeagueFreeAgents: 'verify.leagueFreeAgents',
  deleteV1FreeAgentSignups: 'delete.v1FreeAgentSignups',
  copyGameRosterPlayers: 'copy.gameRosterPlayers',
  deleteV1GameRosters: 'delete.v1GameRosters',
  // It removes the stale entries a copied roster holds, so it waits for the memberships and the
  // game stats — which pin an entry holding a recorded stat — to be copied and verified.
  reconcileOpenGameRosters: 'reconcile.openGameRosters',
  verifyGameStats: 'verify.gameStats',
  verifyLeaguePlayerStats: 'verify.leaguePlayerStats',

  copySportGames: 'copy.sportGames',
  resolveUnrosteredStatLine: 'resolve.unrosteredStatLine',
  verifySportGames: 'verify.sportGames',
  deleteV1LeagueGames: 'delete.v1LeagueGames',

  copySignedWaivers: 'copy.signedWaivers',
  verifySignedWaivers: 'verify.signedWaivers',
  verifySignatureFilesResolvable: 'verify.signatureFilesResolvable',
  revokeV1SignatureDownloadTokens: 'revoke.v1SignatureDownloadTokens',
  deleteV1WaiverSignatures: 'delete.v1WaiverSignatures',

  copyHardwareLoanContracts: 'copy.hardwareLoanContracts',
  verifyHardwareLoanContracts: 'verify.hardwareLoanContracts',
  deleteV1HardwareContracts: 'delete.v1HardwareContracts',

  copySportLeagues: 'copy.sportLeagues',
  verifySportLeagues: 'verify.sportLeagues',
  deleteV1Leagues: 'delete.v1Leagues',
  deleteV1LeagueChats: 'delete.v1LeagueChats',

  carryV1Pictures: 'carry.v1Pictures',
  verifyV1Pictures: 'verify.v1Pictures',

  copyAppConfig: 'copy.appConfig',
  copyLandingPageConfig: 'copy.landingPageConfig',
  copyStatsBeacon: 'copy.statsBeacon',
  verifyAppConfig: 'verify.appConfig',
  verifyLandingPageConfig: 'verify.landingPageConfig',
  verifyStatsBeacon: 'verify.statsBeacon',
  deleteV1LandingBase: 'delete.v1LandingBase',

  copyWaiverTemplates: 'copy.waiverTemplates',
  verifyWaiverTemplates: 'verify.waiverTemplates',
  deleteV1Waivers: 'delete.v1Waivers',

  copyAwardDefinitions: 'copy.awardDefinitions',
  verifyAwardDefinitions: 'verify.awardDefinitions',
  deleteV1AwardCatalog: 'delete.v1AwardCatalog',

  copyGameLocations: 'copy.gameLocations',
  verifyGameLocations: 'verify.gameLocations',
  deleteV1GameLocations: 'delete.v1GameLocations',

  deleteV1AdminStats: 'delete.v1AdminStats',

  verifyV1CommerceDiscardable: 'verify.v1CommerceDiscardable',
  deleteV1Commerce: 'delete.v1Commerce',

  rebuildLeagueStats: 'rebuild.leagueStats',
  rebuildLifetimeStats: 'rebuild.lifetimeStats',
  rebuildSportHallOfFame: 'rebuild.sportHallOfFame',
  validateStats: 'validate.stats',
  verifySportHallOfFame: 'verify.sportHallOfFame',
  deleteV1HallOfFame: 'delete.v1HallOfFame',
  deleteV1ValidationReports: 'delete.v1ValidationReports',

  recordCutoverLive: 'record.cutoverLive',

  checkpointV1FirestoreExport: 'checkpoint.v1FirestoreExport',
  checkpointPaymentCredentialsRetired: 'checkpoint.paymentCredentialsRetired',
  checkpointServiceAccountKeyRevoked: 'checkpoint.serviceAccountKeyRevoked',
  checkpointUnattachedPicturesReuploaded: 'checkpoint.unattachedPicturesReuploaded',
  checkpointAbandonedRegistrationSweepEnabled: 'checkpoint.abandonedRegistrationSweepEnabled',
} as const;

export type MigrationActionId = (typeof MIGRATION_ACTION_IDS)[keyof typeof MIGRATION_ACTION_IDS];

export const MIGRATION_ACTION_ID_KEYS = Object.values(MIGRATION_ACTION_IDS) as [
  MigrationActionId,
  ...MigrationActionId[],
];
