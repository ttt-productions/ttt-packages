export const COLLECTIONS = {
  USER_PROFILES: 'userProfiles',
  PUBLIC_USERS: 'publicUsers',
  RESERVED_DISPLAY_NAMES: 'reservedDisplayNames',
  STATUS_RECONCILE_QUEUE: 'statusReconcileQueue',
  REGISTRATION_STARTS: 'registrationStarts',
  SWEEP_STATE: 'sweepState',

  SPORT_LEAGUES: 'sportLeagues',
  LEAGUE_TEAMS: 'leagueTeams',
  LEAGUE_TEAM_CONTACTS: 'leagueTeamContacts',
  TEAM_MEMBERSHIPS: 'teamMemberships',
  TEAM_INVITATIONS: 'teamInvitations',
  TEAM_JOIN_REQUESTS: 'teamJoinRequests',
  LEAGUE_FREE_AGENTS: 'leagueFreeAgents',

  SPORT_GAMES: 'sportGames',
  GAME_LOCATIONS: 'gameLocations',

  WAIVER_TEMPLATES: 'waiverTemplates',
  SIGNED_WAIVERS: 'signedWaivers',
  HARDWARE_LOAN_CONTRACTS: 'hardwareLoanContracts',
  SIGNATURE_COPY_INTENTS: 'signatureCopyIntents',

  AWARD_DEFINITIONS: 'awardDefinitions',
  AWARD_GROUP_GRANTS: 'awardGroupGrants',
  SPORT_HALL_OF_FAME: 'sportHallOfFame',
  STATS_VALIDATION_REPORTS: 'statsValidationReports',
  STATS_OPERATIONS: 'statsOperations',

  MIGRATION_ACTION_RUNS: 'migrationActionRuns',

  GALLERY_PICTURES: 'galleryPictures',
  PENDING_MEDIA: 'pendingMedia',
  PICTURE_RETIREMENTS: 'pictureRetirements',

  AUDIT_EVENTS: 'auditEvents',

  ACTIVE_ADMIN_NOTIFICATIONS: 'activeAdminNotifications',
  ADMIN_NOTIFICATION_HISTORY: 'adminNotificationHistory',
  NOTIFICATION_DELIVERIES: 'notificationDeliveries',
  NOTIFICATION_ARCHIVE_ALL_JOBS: 'notificationArchiveAllJobs',

  APP_CONFIG: '_appConfig',
  SYSTEM_DATA: '_systemData',
  SERVER_DATA: '_serverData',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const USER_PROFILE_SUBCOLLECTIONS = {
  HISTORICAL_STATS: 'historicalStats',
  PRIVATE_DATA: 'privateData',
} as const;

export const SPORT_GAME_SUBCOLLECTIONS = {
  GAME_ROSTER_PLAYERS: 'gameRosterPlayers',
  GAME_STAT_EVENTS: 'gameStatEvents',
  GAME_STAT_HISTORY: 'gameStatHistory',
} as const;

export const WAIVER_TEMPLATE_SUBCOLLECTIONS = {
  WAIVER_TEMPLATE_VERSIONS: 'waiverTemplateVersions',
} as const;

export const AWARD_GROUP_GRANT_SUBCOLLECTIONS = {
  AWARD_GROUP_GRANT_PEOPLE: 'awardGroupGrantPeople',
} as const;

export const SPECIAL_DOCS = {
  APP_CONFIG: 'app',
  LANDING_PAGE: 'landingPage',
  STATS_BEACON: 'statsBeacon',

  ADMIN_LIST: 'adminList',

  MIGRATION_CONSOLE: 'migrationConsole',
  GAME_LOCATION_REGISTRY: 'gameLocationRegistry',
  WAIVER_TEMPLATE_REGISTRY: 'waiverTemplateRegistry',

  GAME_STAT_HISTORY_RECORD: 'record',
} as const;

// The nouns a name may use for a thing with no collection of its own (RULE-STD-ARCH-104), each
// with the collections it lives in or reads. Every other name's thing is a collection, singular.
export const DECLARED_NOUNS = {
  ghostPlayer: [
    COLLECTIONS.PUBLIC_USERS,
    COLLECTIONS.TEAM_MEMBERSHIPS,
    SPORT_GAME_SUBCOLLECTIONS.GAME_ROSTER_PLAYERS,
  ],
  scheduleWeek: [COLLECTIONS.SPORT_LEAGUES],
  displayName: [COLLECTIONS.RESERVED_DISPLAY_NAMES, COLLECTIONS.USER_PROFILES],
  deadLetter: [COLLECTIONS.NOTIFICATION_DELIVERIES],
  adminNotification: [
    COLLECTIONS.ACTIVE_ADMIN_NOTIFICATIONS,
    COLLECTIONS.ADMIN_NOTIFICATION_HISTORY,
  ],
  siteCounts: [
    COLLECTIONS.USER_PROFILES,
    COLLECTIONS.LEAGUE_TEAMS,
    COLLECTIONS.SPORT_LEAGUES,
    COLLECTIONS.SPORT_GAMES,
    COLLECTIONS.LEAGUE_FREE_AGENTS,
  ],
  appConfig: [COLLECTIONS.APP_CONFIG],
  landingPage: [COLLECTIONS.APP_CONFIG],
  statsBeacon: [COLLECTIONS.APP_CONFIG],
  adminList: [COLLECTIONS.SYSTEM_DATA],
  migrationConsole: [COLLECTIONS.SERVER_DATA],
} as const satisfies Record<string, readonly string[]>;

export type DeclaredNoun = keyof typeof DECLARED_NOUNS;
