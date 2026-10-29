// The one declaration of every cutover action id (RULE-STD-ENG-002). The manifest, the console's callables
// and screen, and every delete gate name an action by the id declared here — never by a string
// literal at the call site, where a typo is a gate that silently never matches.
//
// An id is declared even before its action exists: a destructive core requires its verifications
// by id, so it refuses to run until each one exists and has passed — failing closed, rather than
// resting on a precondition written in prose that nothing enforces.

export const MIGRATION_ACTION_IDS = {
  // Accounts, identity, and global roles.
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

  // Teams, memberships, and game rosters.
  copyLeagueTeams: 'copy.leagueTeams',
  verifyLeagueTeams: 'verify.leagueTeams',
  deleteV1Teams: 'delete.v1Teams',
  copyTeamMemberships: 'copy.teamMemberships',
  deleteV1TeamMembers: 'delete.v1TeamMembers',
  // The ways onto a team. Each copy reads the copied `teamMemberships` to close a pending invitation
  // or request its player already answered by joining, or to leave out a signup joining left behind,
  // so each runs after `copy.teamMemberships`.
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
  // The games open at the cutover, reconciled once against the copied memberships. It removes the
  // stale entries a copied roster holds, so it waits for the memberships and the game stats — which
  // pin an entry holding a recorded stat — to be copied and verified.
  reconcileOpenGameRosters: 'reconcile.openGameRosters',
  verifyGameStats: 'verify.gameStats',
  // Informational: each user whose V1 league total differs from the sum of their rebuilt per-membership
  // rows. It gates nothing; a summary is rebuilt by design.
  verifyLeaguePlayerStats: 'verify.leaguePlayerStats',

  // Games. `copy.sportGames` is the one reader of each V1 game, writing its schedule fields and its
  // stats documents together; the V1 game document goes last, after its roster.
  copySportGames: 'copy.sportGames',
  // A recorded stat line no roster entry or play places: the admin names its team, and the game's
  // copy runs again.
  resolveUnrosteredStatLine: 'resolve.unrosteredStatLine',
  verifySportGames: 'verify.sportGames',
  deleteV1LeagueGames: 'delete.v1LeagueGames',

  // Signed waivers: the records, and their signature files, which stay where V1 put them.
  copySignedWaivers: 'copy.signedWaivers',
  verifySignedWaivers: 'verify.signedWaivers',
  verifySignatureFilesResolvable: 'verify.signatureFilesResolvable',
  revokeV1SignatureDownloadTokens: 'revoke.v1SignatureDownloadTokens',
  deleteV1WaiverSignatures: 'delete.v1WaiverSignatures',

  // Hardware loan contracts: the records, and their signature files, which stay where V1 put them.
  // The two signature-file actions above walk the contracts after the waivers.
  copyHardwareLoanContracts: 'copy.hardwareLoanContracts',
  verifyHardwareLoanContracts: 'verify.hardwareLoanContracts',
  deleteV1HardwareContracts: 'delete.v1HardwareContracts',

  // Leagues.
  copySportLeagues: 'copy.sportLeagues',
  verifySportLeagues: 'verify.sportLeagues',
  deleteV1Leagues: 'delete.v1Leagues',
  // The parked chat documents under a V1 league, which keep the league alive until they go.
  deleteV1LeagueChats: 'delete.v1LeagueChats',

  // The V1 league, landing, venue, and award badge images, fed through the upload pipeline. The
  // verification is required by every V1 delete whose documents the carry reads images from.
  carryV1Pictures: 'carry.v1Pictures',
  verifyV1Pictures: 'verify.v1Pictures',

  // App configuration: `landing/base` splits into the three `_appConfig` documents.
  copyAppConfig: 'copy.appConfig',
  copyLandingPageConfig: 'copy.landingPageConfig',
  copyStatsBeacon: 'copy.statsBeacon',
  verifyAppConfig: 'verify.appConfig',
  verifyLandingPageConfig: 'verify.landingPageConfig',
  verifyStatsBeacon: 'verify.statsBeacon',
  deleteV1LandingBase: 'delete.v1LandingBase',

  // Waiver templates, each carried with its wording as version 1.
  copyWaiverTemplates: 'copy.waiverTemplates',
  verifyWaiverTemplates: 'verify.waiverTemplates',
  deleteV1Waivers: 'delete.v1Waivers',

  // The award catalog: the `landing/admin` awards array becomes one document per award, its badge
  // carried by `carry.v1Pictures`.
  copyAwardDefinitions: 'copy.awardDefinitions',
  verifyAwardDefinitions: 'verify.awardDefinitions',
  deleteV1AwardCatalog: 'delete.v1AwardCatalog',

  // Game locations: the `landing/admin` locations array becomes one document per venue.
  copyGameLocations: 'copy.gameLocations',
  verifyGameLocations: 'verify.gameLocations',
  deleteV1GameLocations: 'delete.v1GameLocations',

  // The admin dashboard counts are counted live, never stored; the V1 collection is deleted.
  deleteV1AdminStats: 'delete.v1AdminStats',

  // The store and team payments are deleted, not copied, once nothing in them is a completed
  // purchase.
  verifyV1CommerceDiscardable: 'verify.v1CommerceDiscardable',
  deleteV1Commerce: 'delete.v1Commerce',

  // The derived statistics, rebuilt from the copied games by the Fix stats actions, then validated.
  // The console records each run the operator makes from the Stats group; it never runs a second
  // calculator of its own.
  rebuildLeagueStats: 'rebuild.leagueStats',
  rebuildLifetimeStats: 'rebuild.lifetimeStats',
  rebuildSportHallOfFame: 'rebuild.sportHallOfFame',
  validateStats: 'validate.stats',
  // The V1 hall of fame is rebuilt, never copied: its delete waits for the rebuilt documents.
  verifySportHallOfFame: 'verify.sportHallOfFame',
  deleteV1HallOfFame: 'delete.v1HallOfFame',
  // V1 validation reports describe V1 aggregates at a past moment; nothing is copied.
  deleteV1ValidationReports: 'delete.v1ValidationReports',

  // The console's own marker: from here on the product owns every destination.
  recordCutoverLive: 'record.cutoverLive',

  // Operator checkpoints — external work the app cannot perform, recorded with its evidence.
  checkpointV1FirestoreExport: 'checkpoint.v1FirestoreExport',
  checkpointPaymentCredentialsRetired: 'checkpoint.paymentCredentialsRetired',
  checkpointServiceAccountKeyRevoked: 'checkpoint.serviceAccountKeyRevoked',
  checkpointUnattachedPicturesReuploaded: 'checkpoint.unattachedPicturesReuploaded',
  // The gate the abandoned-registration sweep reads: it deletes nothing until this is recorded.
  checkpointAbandonedRegistrationSweepEnabled: 'checkpoint.abandonedRegistrationSweepEnabled',
} as const;

export type MigrationActionId = (typeof MIGRATION_ACTION_IDS)[keyof typeof MIGRATION_ACTION_IDS];

/** Every action id, for the wire schemas that name one. */
export const MIGRATION_ACTION_ID_KEYS = Object.values(MIGRATION_ACTION_IDS) as [
  MigrationActionId,
  ...MigrationActionId[],
];
