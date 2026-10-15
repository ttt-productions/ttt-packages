// Firestore collection, subcollection, and fixed-document name constants for Q-Sports.
//
// Every collection value is compound camelCase — it says what the documents are, never a single
// bare word (guarded by __tests__/collections.test.ts). The three underscore buckets hold fixed-ID
// system documents and are placed by who reads them; every one of them is callable-only for writes
// (BACKEND-108). An admin-only document is server-only, read by an admin through a callable:
//   _appConfig   public read
//   _systemData  signed-in read
//   _serverData  no client access

export const COLLECTIONS = {
  // People
  USER_PROFILES: 'userProfiles',
  PUBLIC_USERS: 'publicUsers',
  // One document per taken display name, keyed by its normalized form — the uniqueness lock.
  RESERVED_DISPLAY_NAMES: 'reservedDisplayNames',
  // One entry per account owed a post-commit Firebase Auth effect, id = the userId: a status
  // change's sign-in half, or a failed role-claim write. Backend-only.
  STATUS_RECONCILE_QUEUE: 'statusReconcileQueue',
  // One document per login whose registration started, id = the userId: the orphan-login cleanup's
  // work list. Backend-only.
  REGISTRATION_STARTS: 'registrationStarts',
  // One document per scheduled pass that keeps a rolling cursor, id = its `SWEEP_STATE_NAMES` name.
  // Backend-only.
  SWEEP_STATE: 'sweepState',

  // Leagues, teams, membership
  SPORT_LEAGUES: 'sportLeagues',
  LEAGUE_TEAMS: 'leagueTeams',
  // One admin-only document per team, id = the team id: how the league reaches the team. The team
  // itself is publicly readable, so no contact detail lives on it (BACKEND-105); a league's contacts
  // are one query on `leagueId`.
  LEAGUE_TEAM_CONTACTS: 'leagueTeamContacts',
  TEAM_MEMBERSHIPS: 'teamMemberships',
  TEAM_INVITATIONS: 'teamInvitations',
  TEAM_JOIN_REQUESTS: 'teamJoinRequests',
  LEAGUE_FREE_AGENTS: 'leagueFreeAgents',
  // One document per team membership, id = the membership's id: the durable obligation to bring
  // that membership's open game rosters in line with it. Backend-only.
  MEMBERSHIP_ROSTER_SYNCS: 'membershipRosterSyncs',

  // Games
  SPORT_GAMES: 'sportGames',
  GAME_LOCATIONS: 'gameLocations',

  // Waivers and hardware
  WAIVER_TEMPLATES: 'waiverTemplates',
  SIGNED_WAIVERS: 'signedWaivers',
  HARDWARE_LOAN_CONTRACTS: 'hardwareLoanContracts',

  // Awards and derived stats
  AWARD_DEFINITIONS: 'awardDefinitions',
  // One decision on one award for one group — a team, or a whole league — granted or taken back a
  // page of people at a time, id `buildAwardGroupGrantId`. Backend-only.
  AWARD_GROUP_GRANTS: 'awardGroupGrants',
  SPORT_HALL_OF_FAME: 'sportHallOfFame',
  STATS_VALIDATION_REPORTS: 'statsValidationReports',
  // One logical run of a stats action: its status, its resume position, and the hold it places on
  // a game. Admin read; written only by the stats cores.
  STATS_OPERATIONS: 'statsOperations',

  // One document per cutover action, id = the action id: where its latest real run stands, its
  // last preview, and what it reported. Admin read; written only by the migration console.
  MIGRATION_ACTION_RUNS: 'migrationActionRuns',

  // One document per picture in a league, team, or landing page gallery. Public read; written only
  // by the picture core.
  GALLERY_PICTURES: 'galleryPictures',
  // One accepted picture upload, id = its staging id = the picture id. Read by its uploader and
  // admins; written only by the accept core (the upload callable and the picture carry), the
  // processing trigger, and the maintenance sweep's stale-upload pass; never deleted.
  PENDING_MEDIA: 'pendingMedia',
  // The durable obligation to delete a picture's files, or a deleted owner's whole gallery. No
  // client access; carried out by the media maintenance sweep.
  PICTURE_RETIREMENTS: 'pictureRetirements',

  // Append-only record of sensitive actions. No client access; written only by Cloud Functions.
  AUDIT_EVENTS: 'auditEvents',

  // Admin notifications, all written only by Cloud Functions. The shared cards every admin reads and
  // their archived history are admin read; the delivery ledger the owning callables write each
  // occurrence into, and each admin's archive-all job, have no client access.
  ACTIVE_ADMIN_NOTIFICATIONS: 'activeAdminNotifications',
  ADMIN_NOTIFICATION_HISTORY: 'adminNotificationHistory',
  NOTIFICATION_DELIVERIES: 'notificationDeliveries',
  NOTIFICATION_ARCHIVE_ALL_JOBS: 'notificationArchiveAllJobs',

  // Fixed-ID system document buckets
  APP_CONFIG: '_appConfig',
  SYSTEM_DATA: '_systemData',
  SERVER_DATA: '_serverData',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Subcollections of `userProfiles/{userId}`. */
export const USER_PROFILE_SUBCOLLECTIONS = {
  // One document per sport key: pre-Q-Sports career totals folded into lifetime recalculation.
  HISTORICAL_STATS: 'historicalStats',
  // One owner-only document, id = the userId: email and contact details. The profile itself is
  // publicly readable, so nothing personal lives on it (BACKEND-105).
  PRIVATE_DATA: 'privateData',
} as const;

/** Subcollections of `sportGames/{gameId}`. */
export const SPORT_GAME_SUBCOLLECTIONS = {
  // Who participated in the game: one entry per team per person, id `buildGameRosterPlayerId`.
  GAME_ROSTER_PLAYERS: 'gameRosterPlayers',
  // One stat event per document, keyed by the event id minted at the tap.
  GAME_STAT_EVENTS: 'gameStatEvents',
  // A completed game's finalized record, in pages, id `buildStatHistoryPageId`.
  GAME_STAT_HISTORY: 'gameStatHistory',
} as const;

/** Subcollections of `waiverTemplates/{waiverTemplateId}`. */
export const WAIVER_TEMPLATE_SUBCOLLECTIONS = {
  // One immutable document per published wording, id `buildWaiverTemplateVersionId(version)`.
  WAIVER_TEMPLATE_VERSIONS: 'waiverTemplateVersions',
} as const;

/** Subcollections of `awardGroupGrants/{grantId}`. */
export const AWARD_GROUP_GRANT_SUBCOLLECTIONS = {
  // One document per person the grant reached, id = the userId, recorded before their profile changed.
  AWARD_GROUP_GRANT_PEOPLE: 'awardGroupGrantPeople',
} as const;

/** Static document IDs for fixed-ID documents. */
export const SPECIAL_DOCS = {
  // _appConfig — public read
  // The app-wide operational levers: version gate, maintenance mode, registration switch, banner.
  APP_CONFIG: 'app',
  LANDING_PAGE: 'landingPage',
  // Public because signed-out spectators follow it for live updates.
  STATS_BEACON: 'statsBeacon',

  // _systemData — signed-in read
  // The admin and referee rosters — source of truth for the `admin` / `referee` custom claims.
  ADMIN_LIST: 'adminList',

  // _serverData — no client access
  // The migration console: the cutover marker and the lock that keeps two actions from running at
  // once.
  MIGRATION_CONSOLE: 'migrationConsole',
} as const;
