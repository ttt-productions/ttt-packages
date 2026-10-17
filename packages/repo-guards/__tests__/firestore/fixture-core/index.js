// GENERATED fixture core — an illustrative application's core package, reproducing only what the
// write guard observes: its path-constant maps, path builders, collection references, and owner
// maps. Test data for this package's own tests; nothing here is a definition any app imports.

export const COLLECTIONS = Object.freeze({
  "USER_PROFILES": "userProfiles",
  "PUBLIC_USERS": "publicUsers",
  "RESERVED_DISPLAY_NAMES": "reservedDisplayNames",
  "STATUS_RECONCILE_QUEUE": "statusReconcileQueue",
  "REGISTRATION_STARTS": "registrationStarts",
  "SWEEP_STATE": "sweepState",
  "SPORT_LEAGUES": "sportLeagues",
  "LEAGUE_TEAMS": "leagueTeams",
  "LEAGUE_TEAM_CONTACTS": "leagueTeamContacts",
  "TEAM_MEMBERSHIPS": "teamMemberships",
  "TEAM_INVITATIONS": "teamInvitations",
  "TEAM_JOIN_REQUESTS": "teamJoinRequests",
  "LEAGUE_FREE_AGENTS": "leagueFreeAgents",
  "MEMBERSHIP_ROSTER_SYNCS": "membershipRosterSyncs",
  "SPORT_GAMES": "sportGames",
  "GAME_LOCATIONS": "gameLocations",
  "WAIVER_TEMPLATES": "waiverTemplates",
  "SIGNED_WAIVERS": "signedWaivers",
  "HARDWARE_LOAN_CONTRACTS": "hardwareLoanContracts",
  "AWARD_DEFINITIONS": "awardDefinitions",
  "SPORT_HALL_OF_FAME": "sportHallOfFame",
  "STATS_VALIDATION_REPORTS": "statsValidationReports",
  "STATS_OPERATIONS": "statsOperations",
  "MIGRATION_ACTION_RUNS": "migrationActionRuns",
  "GALLERY_PICTURES": "galleryPictures",
  "PENDING_MEDIA": "pendingMedia",
  "PICTURE_RETIREMENTS": "pictureRetirements",
  "AUDIT_EVENTS": "auditEvents",
  "ACTIVE_ADMIN_NOTIFICATIONS": "activeAdminNotifications",
  "ADMIN_NOTIFICATION_HISTORY": "adminNotificationHistory",
  "NOTIFICATION_DELIVERIES": "notificationDeliveries",
  "NOTIFICATION_ARCHIVE_ALL_JOBS": "notificationArchiveAllJobs",
  "APP_CONFIG": "_appConfig",
  "SYSTEM_DATA": "_systemData",
  "SERVER_DATA": "_serverData"
});

export const COLLECTION_GROUPS = Object.freeze({
  "GAME_ROSTER_PLAYERS": "gameRosterPlayers",
  "GAME_STAT_EVENTS": "gameStatEvents"
});

export const USER_PROFILE_SUBCOLLECTIONS = Object.freeze({
  "HISTORICAL_STATS": "historicalStats",
  "PRIVATE_DATA": "privateData"
});

export const SPORT_GAME_SUBCOLLECTIONS = Object.freeze({
  "GAME_ROSTER_PLAYERS": "gameRosterPlayers",
  "GAME_STAT_EVENTS": "gameStatEvents",
  "GAME_STAT_HISTORY": "gameStatHistory"
});

export const WAIVER_TEMPLATE_SUBCOLLECTIONS = Object.freeze({
  "WAIVER_TEMPLATE_VERSIONS": "waiverTemplateVersions"
});

export const SPECIAL_DOCS = Object.freeze({
  "APP_CONFIG": "app",
  "LANDING_PAGE": "landingPage",
  "STATS_BEACON": "statsBeacon",
  "ADMIN_LIST": "adminList",
  "MIGRATION_CONSOLE": "migrationConsole"
});

export const PICTURE_SLOT_OWNERS = Object.freeze({ "gameLocation": Object.freeze({ "ownerDoc": (a0) => ["gameLocations", a0], "slotField": "pictureId" }), "awardDefinition": Object.freeze({ "ownerDoc": (a0) => ["awardDefinitions", a0], "slotField": "badgePictureId" }) });

export const PICTURE_OWNER_PATHS = Object.freeze({ "sportLeague": Object.freeze({ "ownerDoc": (a0) => ["sportLeagues", a0] }), "leagueTeam": Object.freeze({ "ownerDoc": (a0) => ["leagueTeams", a0] }), "landingPage": Object.freeze({ "ownerDoc": () => ["_appConfig", "landingPage"] }), "gameLocation": Object.freeze({ "ownerDoc": (a0) => ["gameLocations", a0], "slotField": "pictureId" }), "awardDefinition": Object.freeze({ "ownerDoc": (a0) => ["awardDefinitions", a0], "slotField": "badgePictureId" }) });

export const GALLERY_OWNER_PATHS = Object.freeze({ "sportLeague": Object.freeze({ "ownerDoc": (a0) => ["sportLeagues", a0] }), "leagueTeam": Object.freeze({ "ownerDoc": (a0) => ["leagueTeams", a0] }), "landingPage": Object.freeze({ "ownerDoc": () => ["_appConfig", "landingPage"] }) });

export const PATH_BUILDERS = Object.freeze({
  userProfile: (a0) => ["userProfiles", a0],
  userPrivateData: (a0) => ["userProfiles", a0, "privateData", a0],
  historicalStat: (a0, a1) => ["userProfiles", a0, "historicalStats", a1],
  historicalStats: (a0) => ["userProfiles", a0, "historicalStats"],
  publicUser: (a0) => ["publicUsers", a0],
  statusReconcileQueueEntry: (a0) => ["statusReconcileQueue", a0],
  registrationStart: (a0) => ["registrationStarts", a0],
  sweepState: (a0) => ["sweepState", a0],
  reservedDisplayName: (a0) => ["reservedDisplayNames", `name_${String(a0).toLowerCase()}`],
  sportLeague: (a0) => ["sportLeagues", a0],
  leagueTeam: (a0) => ["leagueTeams", a0],
  leagueTeamContact: (a0) => ["leagueTeamContacts", a0],
  teamMembership: (a0, a1, a2) => ["teamMemberships", `${a0}_${a1}_${a2}`],
  membershipRosterSync: (a0, a1, a2) => ["membershipRosterSyncs", `${a0}_${a1}_${a2}`],
  teamInvitation: (a0) => ["teamInvitations", a0],
  teamJoinRequest: (a0) => ["teamJoinRequests", a0],
  leagueFreeAgent: (a0, a1) => ["leagueFreeAgents", `${a0}_${a1}`],
  sportGame: (a0) => ["sportGames", a0],
  gameRosterPlayer: (a0, a1, a2) => ["sportGames", a0, "gameRosterPlayers", `${a1}_${a2}`],
  gameRosterPlayers: (a0) => ["sportGames", a0, "gameRosterPlayers"],
  gameStatEvent: (a0, a1) => ["sportGames", a0, "gameStatEvents", a1],
  gameStatEvents: (a0) => ["sportGames", a0, "gameStatEvents"],
  gameStatHistoryPage: (a0, a1) => ["sportGames", a0, "gameStatHistory", a1],
  gameStatHistory: (a0) => ["sportGames", a0, "gameStatHistory"],
  gameLocation: (a0) => ["gameLocations", a0],
  waiverTemplate: (a0) => ["waiverTemplates", a0],
  waiverTemplateVersion: (a0, a1) => { if (!Number.isInteger(a1) || a1 < 1) throw new Error('whole numbers only'); return ["waiverTemplates", a0, "waiverTemplateVersions", `v${a1}`]; },
  waiverTemplateVersions: (a0) => ["waiverTemplates", a0, "waiverTemplateVersions"],
  signedWaiver: (a0, a1) => ["signedWaivers", `${a0}_${a1}`],
  hardwareLoanContract: (a0) => ["hardwareLoanContracts", a0],
  awardDefinition: (a0) => ["awardDefinitions", a0],
  sportHallOfFame: (a0) => ["sportHallOfFame", a0],
  statsValidationReport: (a0) => ["statsValidationReports", a0],
  statsOperation: (a0) => ["statsOperations", a0],
  migrationActionRun: (a0) => ["migrationActionRuns", a0],
  galleryPicture: (a0) => ["galleryPictures", a0],
  pendingMedia: (a0) => ["pendingMedia", a0],
  pictureRetirement: (a0) => ["pictureRetirements", a0],
  auditEvent: (a0) => ["auditEvents", a0],
  activeAdminNotification: (a0) => ["activeAdminNotifications", a0],
  adminNotificationHistoryEntry: (a0) => ["adminNotificationHistory", a0],
  notificationDelivery: (a0) => ["notificationDeliveries", a0],
  notificationArchiveAllJob: (a0) => ["notificationArchiveAllJobs", a0],
  landingPageConfig: () => ["_appConfig", "landingPage"],
  appConfig: () => ["_appConfig", "app"],
  statsBeacon: () => ["_appConfig", "statsBeacon"],
  adminList: () => ["_systemData", "adminList"],
  migrationConsole: () => ["_serverData", "migrationConsole"],
});

export const COLLECTION_REFS = Object.freeze({
  userProfiles: () => ["userProfiles"],
  publicUsers: () => ["publicUsers"],
  statusReconcileQueue: () => ["statusReconcileQueue"],
  registrationStarts: () => ["registrationStarts"],
  reservedDisplayNames: () => ["reservedDisplayNames"],
  sportLeagues: () => ["sportLeagues"],
  leagueTeams: () => ["leagueTeams"],
  leagueTeamContacts: () => ["leagueTeamContacts"],
  teamMemberships: () => ["teamMemberships"],
  teamInvitations: () => ["teamInvitations"],
  teamJoinRequests: () => ["teamJoinRequests"],
  leagueFreeAgents: () => ["leagueFreeAgents"],
  membershipRosterSyncs: () => ["membershipRosterSyncs"],
  sportGames: () => ["sportGames"],
  gameLocations: () => ["gameLocations"],
  waiverTemplates: () => ["waiverTemplates"],
  signedWaivers: () => ["signedWaivers"],
  hardwareLoanContracts: () => ["hardwareLoanContracts"],
  awardDefinitions: () => ["awardDefinitions"],
  statsValidationReports: () => ["statsValidationReports"],
  statsOperations: () => ["statsOperations"],
  migrationActionRuns: () => ["migrationActionRuns"],
  galleryPictures: () => ["galleryPictures"],
  pendingMedia: () => ["pendingMedia"],
  pictureRetirements: () => ["pictureRetirements"],
  auditEvents: () => ["auditEvents"],
  activeAdminNotifications: () => ["activeAdminNotifications"],
  adminNotificationHistory: () => ["adminNotificationHistory"],
  notificationDeliveries: () => ["notificationDeliveries"],
  notificationArchiveAllJobs: () => ["notificationArchiveAllJobs"],
});

/** Segments to a slash path. */
export const toPath = (segments) => segments.join('/');
