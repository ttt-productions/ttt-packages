// Document types. Every shape is defined as a zod schema in ../doc-schemas and its type inferred
// there; this file re-exports the TYPES so they reach the root barrel while the runtime schemas stay
// behind the `./doc-schemas` subpath.

export type { FirestoreTimestampLike } from '../doc-schemas/firestore-primitives.js';
export type { GrantedAward, HistoricalStats, UserProfile } from '../doc-schemas/user-profile.js';
export type { PublicUser } from '../doc-schemas/publicUser.js';
export type { SportLeague } from '../doc-schemas/sport-league.js';
export type { LeagueTeam, LeagueTeamContact } from '../doc-schemas/league-team.js';
export type {
  MembershipRosterSync,
  MembershipRosterSyncCursor,
} from '../doc-schemas/membership-roster-sync.js';
export type {
  LeagueFreeAgent,
  TeamJoinRequest,
  TeamInvitation,
  TeamMembership,
} from '../doc-schemas/team-membership.js';
export type {
  BasketballPlayerStats,
  BasketballStatEvent,
  BasketballTeamStats,
  CurlingBlankEndEvent,
  CurlingRoundScoreEvent,
  CurlingStatEvent,
  CurlingTeamStats,
  FootballStatEvent,
  FootballTeamStats,
  GameStatEvent,
  GameStatEventType,
  StatCorrectionEvent,
  StatVoidEvent,
} from '../doc-schemas/game-stats.js';
export type {
  BasketballGame,
  BasketballGameStats,
  CurlingGame,
  CurlingGameStats,
  FootballGame,
  FootballGameStats,
  GameRosterPlayer,
  GameStats,
  GameTeam,
  SportGame,
} from '../doc-schemas/sport-game.js';
export type {
  GameStatHistoryContinuationPage,
  GameStatHistoryFirstPage,
  GameStatHistoryPage,
} from '../doc-schemas/game-stat-history.js';
export type {
  BasketballPlayerTotals,
  BasketballTeamSeasonStats,
  GamesPlayedStats,
  PlayerSeasonStats,
  SportHallOfFame,
  TeamSeasonBaseStats,
  TeamSeasonStats,
  UserLifetimeStats,
} from '../doc-schemas/aggregate-stats.js';
export type {
  StatsDestinationChange,
  StatsOperation,
  StatsOperationCounts,
} from '../doc-schemas/stats-operation.js';
export type {
  HardwareLoanContract,
  HardwareItem,
  SignedWaiver,
} from '../doc-schemas/waivers-and-hardware.js';
export type { WaiverTemplate, WaiverTemplateVersion } from '../doc-schemas/waiver-template.js';
export type { GameLocation } from '../doc-schemas/game-location.js';
export type { AwardDefinition } from '../doc-schemas/catalogs.js';
export type {
  StatusReconcileQueueAccountStatusEntry,
  StatusReconcileQueueEntry,
  StatusReconcileQueueRoleClaimsEntry,
} from '../doc-schemas/status-reconcile-queue.js';
export type { AdminStats } from '../schemas/admin-stats.js';
export type { GalleryPicture, GallerySummary } from '../doc-schemas/gallery.js';
export type {
  PendingMedia,
  PendingMediaCompleted,
  PendingMediaErrorCategory,
  PendingMediaFailed,
  PendingMediaPending,
  PendingMediaProcessing,
  PendingMediaResult,
  PendingMediaTarget,
  PictureOwnerRef,
  StorageObjectRef,
} from '../doc-schemas/pending-media.js';
export type { PictureRetirement, PictureRetirementTarget } from '../doc-schemas/picture-retirement.js';
export type {
  AppConfig,
  LandingPageConfig,
  AdminList,
  StatsBeacon,
  StatsDiscrepancy,
  StatsValidationReport,
  StatsValidationScope,
  StatsValidationSummary,
} from '../doc-schemas/system.js';
export type {
  ActiveAdminNotification,
  AdminNotificationHistory,
  AdminNotificationMetadataByType,
  LeagueFreeAgentSignedUpNotificationMetadata,
  LeagueTeamCreatedNotificationMetadata,
  NotificationArchiveAllJob,
  NotificationDelivery,
  NotificationDeliveryPayload,
} from '../doc-schemas/admin-notifications.js';
