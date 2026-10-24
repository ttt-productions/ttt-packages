export const COLLECTIONS = Object.freeze({
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
  MEMBERSHIP_ROSTER_SYNCS: 'membershipRosterSyncs',
  SPORT_GAMES: 'sportGames',
  GAME_LOCATIONS: 'gameLocations',
  WAIVER_TEMPLATES: 'waiverTemplates',
  SIGNED_WAIVERS: 'signedWaivers',
  HARDWARE_LOAN_CONTRACTS: 'hardwareLoanContracts',
  AWARD_DEFINITIONS: 'awardDefinitions',
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
});

export const COLLECTION_GROUPS = Object.freeze({
  GAME_ROSTER_PLAYERS: 'gameRosterPlayers',
  GAME_STAT_EVENTS: 'gameStatEvents',
});

export const USER_PROFILE_SUBCOLLECTIONS = Object.freeze({
  HISTORICAL_STATS: 'historicalStats',
  PRIVATE_DATA: 'privateData',
});

export const SPORT_GAME_SUBCOLLECTIONS = Object.freeze({
  GAME_ROSTER_PLAYERS: 'gameRosterPlayers',
  GAME_STAT_EVENTS: 'gameStatEvents',
  GAME_STAT_HISTORY: 'gameStatHistory',
});

export const WAIVER_TEMPLATE_SUBCOLLECTIONS = Object.freeze({
  WAIVER_TEMPLATE_VERSIONS: 'waiverTemplateVersions',
});

export const SPECIAL_DOCS = Object.freeze({
  APP_CONFIG: 'app',
  LANDING_PAGE: 'landingPage',
  STATS_BEACON: 'statsBeacon',
  ADMIN_LIST: 'adminList',
  MIGRATION_CONSOLE: 'migrationConsole',
});

export const PICTURE_SLOT_OWNERS = Object.freeze({
  gameLocation: Object.freeze({
    ownerDoc: (/** @type {string} */ a0) => ['gameLocations', a0],
    slotField: 'pictureId',
  }),
  awardDefinition: Object.freeze({
    ownerDoc: (/** @type {string} */ a0) => ['awardDefinitions', a0],
    slotField: 'badgePictureId',
  }),
});

export const PICTURE_OWNER_PATHS = Object.freeze({
  sportLeague: Object.freeze({ ownerDoc: (/** @type {string} */ a0) => ['sportLeagues', a0] }),
  leagueTeam: Object.freeze({ ownerDoc: (/** @type {string} */ a0) => ['leagueTeams', a0] }),
  landingPage: Object.freeze({ ownerDoc: () => ['_appConfig', 'landingPage'] }),
  gameLocation: Object.freeze({
    ownerDoc: (/** @type {string} */ a0) => ['gameLocations', a0],
    slotField: 'pictureId',
  }),
  awardDefinition: Object.freeze({
    ownerDoc: (/** @type {string} */ a0) => ['awardDefinitions', a0],
    slotField: 'badgePictureId',
  }),
});

export const GALLERY_OWNER_PATHS = Object.freeze({
  sportLeague: Object.freeze({ ownerDoc: (/** @type {string} */ a0) => ['sportLeagues', a0] }),
  leagueTeam: Object.freeze({ ownerDoc: (/** @type {string} */ a0) => ['leagueTeams', a0] }),
  landingPage: Object.freeze({ ownerDoc: () => ['_appConfig', 'landingPage'] }),
});

export const PATH_BUILDERS = Object.freeze({
  userProfile: (/** @type {string} */ a0) => ['userProfiles', a0],
  userPrivateData: (/** @type {string} */ a0) => ['userProfiles', a0, 'privateData', a0],
  historicalStat: (/** @type {string} */ a0, /** @type {string} */ a1) => [
    'userProfiles',
    a0,
    'historicalStats',
    a1,
  ],
  historicalStats: (/** @type {string} */ a0) => ['userProfiles', a0, 'historicalStats'],
  publicUser: (/** @type {string} */ a0) => ['publicUsers', a0],
  statusReconcileQueueEntry: (/** @type {string} */ a0) => ['statusReconcileQueue', a0],
  registrationStart: (/** @type {string} */ a0) => ['registrationStarts', a0],
  sweepState: (/** @type {string} */ a0) => ['sweepState', a0],
  reservedDisplayName: (/** @type {string} */ a0) => [
    'reservedDisplayNames',
    `name_${String(a0).toLowerCase()}`,
  ],
  sportLeague: (/** @type {string} */ a0) => ['sportLeagues', a0],
  leagueTeam: (/** @type {string} */ a0) => ['leagueTeams', a0],
  leagueTeamContact: (/** @type {string} */ a0) => ['leagueTeamContacts', a0],
  teamMembership: (
    /** @type {string} */ a0,
    /** @type {string} */ a1,
    /** @type {string} */ a2,
  ) => ['teamMemberships', `${a0}_${a1}_${a2}`],
  membershipRosterSync: (
    /** @type {string} */ a0,
    /** @type {string} */ a1,
    /** @type {string} */ a2,
  ) => ['membershipRosterSyncs', `${a0}_${a1}_${a2}`],
  teamInvitation: (/** @type {string} */ a0) => ['teamInvitations', a0],
  teamJoinRequest: (/** @type {string} */ a0) => ['teamJoinRequests', a0],
  leagueFreeAgent: (/** @type {string} */ a0, /** @type {string} */ a1) => [
    'leagueFreeAgents',
    `${a0}_${a1}`,
  ],
  sportGame: (/** @type {string} */ a0) => ['sportGames', a0],
  gameRosterPlayer: (
    /** @type {string} */ a0,
    /** @type {string} */ a1,
    /** @type {string} */ a2,
  ) => ['sportGames', a0, 'gameRosterPlayers', `${a1}_${a2}`],
  gameRosterPlayers: (/** @type {string} */ a0) => ['sportGames', a0, 'gameRosterPlayers'],
  gameStatEvent: (/** @type {string} */ a0, /** @type {string} */ a1) => [
    'sportGames',
    a0,
    'gameStatEvents',
    a1,
  ],
  gameStatEvents: (/** @type {string} */ a0) => ['sportGames', a0, 'gameStatEvents'],
  gameStatHistoryPage: (/** @type {string} */ a0, /** @type {string} */ a1) => [
    'sportGames',
    a0,
    'gameStatHistory',
    a1,
  ],
  gameStatHistory: (/** @type {string} */ a0) => ['sportGames', a0, 'gameStatHistory'],
  gameLocation: (/** @type {string} */ a0) => ['gameLocations', a0],
  waiverTemplate: (/** @type {string} */ a0) => ['waiverTemplates', a0],
  waiverTemplateVersion: (/** @type {string} */ a0, /** @type {number} */ a1) => {
    if (!Number.isInteger(a1) || a1 < 1) throw new Error('whole numbers only');
    return ['waiverTemplates', a0, 'waiverTemplateVersions', `v${a1}`];
  },
  waiverTemplateVersions: (/** @type {string} */ a0) => [
    'waiverTemplates',
    a0,
    'waiverTemplateVersions',
  ],
  signedWaiver: (/** @type {string} */ a0, /** @type {string} */ a1) => [
    'signedWaivers',
    `${a0}_${a1}`,
  ],
  hardwareLoanContract: (/** @type {string} */ a0) => ['hardwareLoanContracts', a0],
  awardDefinition: (/** @type {string} */ a0) => ['awardDefinitions', a0],
  sportHallOfFame: (/** @type {string} */ a0) => ['sportHallOfFame', a0],
  statsValidationReport: (/** @type {string} */ a0) => ['statsValidationReports', a0],
  statsOperation: (/** @type {string} */ a0) => ['statsOperations', a0],
  migrationActionRun: (/** @type {string} */ a0) => ['migrationActionRuns', a0],
  galleryPicture: (/** @type {string} */ a0) => ['galleryPictures', a0],
  pendingMedia: (/** @type {string} */ a0) => ['pendingMedia', a0],
  pictureRetirement: (/** @type {string} */ a0) => ['pictureRetirements', a0],
  auditEvent: (/** @type {string} */ a0) => ['auditEvents', a0],
  activeAdminNotification: (/** @type {string} */ a0) => ['activeAdminNotifications', a0],
  adminNotificationHistoryEntry: (/** @type {string} */ a0) => ['adminNotificationHistory', a0],
  notificationDelivery: (/** @type {string} */ a0) => ['notificationDeliveries', a0],
  notificationArchiveAllJob: (/** @type {string} */ a0) => ['notificationArchiveAllJobs', a0],
  landingPageConfig: () => ['_appConfig', 'landingPage'],
  appConfig: () => ['_appConfig', 'app'],
  statsBeacon: () => ['_appConfig', 'statsBeacon'],
  adminList: () => ['_systemData', 'adminList'],
  migrationConsole: () => ['_serverData', 'migrationConsole'],
});

export const COLLECTION_REFS = Object.freeze({
  userProfiles: () => ['userProfiles'],
  publicUsers: () => ['publicUsers'],
  statusReconcileQueue: () => ['statusReconcileQueue'],
  registrationStarts: () => ['registrationStarts'],
  reservedDisplayNames: () => ['reservedDisplayNames'],
  sportLeagues: () => ['sportLeagues'],
  leagueTeams: () => ['leagueTeams'],
  leagueTeamContacts: () => ['leagueTeamContacts'],
  teamMemberships: () => ['teamMemberships'],
  teamInvitations: () => ['teamInvitations'],
  teamJoinRequests: () => ['teamJoinRequests'],
  leagueFreeAgents: () => ['leagueFreeAgents'],
  membershipRosterSyncs: () => ['membershipRosterSyncs'],
  sportGames: () => ['sportGames'],
  gameLocations: () => ['gameLocations'],
  waiverTemplates: () => ['waiverTemplates'],
  signedWaivers: () => ['signedWaivers'],
  hardwareLoanContracts: () => ['hardwareLoanContracts'],
  awardDefinitions: () => ['awardDefinitions'],
  statsValidationReports: () => ['statsValidationReports'],
  statsOperations: () => ['statsOperations'],
  migrationActionRuns: () => ['migrationActionRuns'],
  galleryPictures: () => ['galleryPictures'],
  pendingMedia: () => ['pendingMedia'],
  pictureRetirements: () => ['pictureRetirements'],
  auditEvents: () => ['auditEvents'],
  activeAdminNotifications: () => ['activeAdminNotifications'],
  adminNotificationHistory: () => ['adminNotificationHistory'],
  notificationDeliveries: () => ['notificationDeliveries'],
  notificationArchiveAllJobs: () => ['notificationArchiveAllJobs'],
});

export const toPath = (/** @type {readonly string[]} */ segments) => segments.join('/');
