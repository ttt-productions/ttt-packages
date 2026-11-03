import { z } from 'zod';
import {
  epochMsSchema,
  gameIdSchema,
  hardwareLoanContractIdSchema,
  leagueIdSchema,
  sportKeySchema,
  statsValidationReportIdSchema,
  teamIdSchema,
  userIdSchema,
} from '../doc-schemas/atoms.js';
import { awardIdSchema } from '../doc-schemas/catalogs.js';
import { gameLocationIdSchema } from '../doc-schemas/game-location.js';
import { galleryOwnerKindSchema, pictureIdSchema } from '../doc-schemas/gallery.js';
import { waiverTemplateIdSchema } from '../doc-schemas/waiver-template.js';

export const SportLeagueCreatedEventSchema = z.object({
  type: z.literal('sportLeague.created'),
  ids: z.object({ leagueId: leagueIdSchema }),
});

export const SportLeagueUpdatedEventSchema = z.object({
  type: z.literal('sportLeague.updated'),
  ids: z.object({ leagueId: leagueIdSchema }),
});

export const SportLeagueStatusChangedEventSchema = z.object({
  type: z.literal('sportLeague.statusChanged'),
  ids: z.object({ leagueId: leagueIdSchema }),
});

export const SportLeagueModeSwitchedEventSchema = z.object({
  type: z.literal('sportLeague.modeSwitched'),
  ids: z.object({ leagueId: leagueIdSchema }),
});

export const LeagueTeamCreatedEventSchema = z.object({
  type: z.literal('leagueTeam.created'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema }),
});

export const TeamMembershipRoleChangedEventSchema = z.object({
  type: z.literal('teamMembership.roleChanged'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema }),
});

export const TeamMembershipRemovedEventSchema = z.object({
  type: z.literal('teamMembership.removed'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema }),
});

export const GhostPlayerCreatedEventSchema = z.object({
  type: z.literal('ghostPlayer.created'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, ghostUserId: userIdSchema }),
});

export const SignedWaiverCreatedEventSchema = z.object({
  type: z.literal('signedWaiver.created'),
  ids: z.object({ leagueId: leagueIdSchema, userId: userIdSchema }),
});

export const GhostPlayerLinkedEventSchema = z.object({
  type: z.literal('ghostPlayer.linked'),
  ids: z.object({
    leagueId: leagueIdSchema,
    teamId: teamIdSchema,
    ghostUserId: userIdSchema,
    realUserId: userIdSchema,
  }),
});

export const TeamJoinRequestCreatedEventSchema = z.object({
  type: z.literal('teamJoinRequest.created'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema }),
});

export const TeamJoinRequestCancelledEventSchema = z.object({
  type: z.literal('teamJoinRequest.cancelled'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema }),
});

export const TeamJoinRequestAcceptedEventSchema = z.object({
  type: z.literal('teamJoinRequest.accepted'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema }),
});

export const TeamJoinRequestRejectedEventSchema = z.object({
  type: z.literal('teamJoinRequest.rejected'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema }),
});

export const TeamInvitationCreatedEventSchema = z.object({
  type: z.literal('teamInvitation.created'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema }),
});

export const TeamInvitationCancelledEventSchema = z.object({
  type: z.literal('teamInvitation.cancelled'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema }),
});

export const TeamInvitationAcceptedEventSchema = z.object({
  type: z.literal('teamInvitation.accepted'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema }),
});

export const TeamInvitationRejectedEventSchema = z.object({
  type: z.literal('teamInvitation.rejected'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema }),
});

export const LeagueFreeAgentCreatedEventSchema = z.object({
  type: z.literal('leagueFreeAgent.created'),
  ids: z.object({ leagueId: leagueIdSchema, userId: userIdSchema }),
});

export const LeagueFreeAgentDeletedEventSchema = z.object({
  type: z.literal('leagueFreeAgent.deleted'),
  ids: z.object({ leagueId: leagueIdSchema, userId: userIdSchema }),
});

export const LeagueFreeAgentAssignedEventSchema = z.object({
  type: z.literal('leagueFreeAgent.assigned'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema }),
});

export const SportGameFinalizedEventSchema = z.object({
  type: z.literal('sportGame.finalized'),
  ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }),
});

export const SportGameReopenedEventSchema = z.object({
  type: z.literal('sportGame.reopened'),
  ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }),
});

export const SportGameStatEventsRecordedEventSchema = z.object({
  type: z.literal('sportGame.statEventsRecorded'),
  ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }),
});

export const SportGameAbsenceChangedEventSchema = z.object({
  type: z.literal('sportGame.absenceChanged'),
  ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }),
});

export const SportGameMemoUpdatedEventSchema = z.object({
  type: z.literal('sportGame.memoUpdated'),
  ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }),
});

export const SportGameJumpBallChangedEventSchema = z.object({
  type: z.literal('sportGame.jumpBallChanged'),
  ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }),
});

export const ScheduleWeekCreatedEventSchema = z.object({
  type: z.literal('scheduleWeek.created'),
  ids: z.object({ leagueId: leagueIdSchema }),
});

export const ScheduleWeekUpdatedEventSchema = z.object({
  type: z.literal('scheduleWeek.updated'),
  ids: z.object({ leagueId: leagueIdSchema }),
});

export const ScheduleWeekDeletedEventSchema = z.object({
  type: z.literal('scheduleWeek.deleted'),
  ids: z.object({ leagueId: leagueIdSchema }),
});

export const SportGameCreatedEventSchema = z.object({
  type: z.literal('sportGame.created'),
  ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }),
});

export const SportGameUpdatedEventSchema = z.object({
  type: z.literal('sportGame.updated'),
  ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }),
});

export const SportGameDeletedEventSchema = z.object({
  type: z.literal('sportGame.deleted'),
  ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }),
});

export const SportLeagueStatsRecalculatedEventSchema = z.object({
  type: z.literal('sportLeague.statsRecalculated'),
  ids: z.object({ leagueId: leagueIdSchema.optional() }),
});

export const UserProfileStatsRecalculatedEventSchema = z.object({
  type: z.literal('userProfile.statsRecalculated'),
  ids: z.object({ userId: userIdSchema.optional() }),
});

export const SportHallOfFameRecalculatedEventSchema = z.object({
  type: z.literal('sportHallOfFame.recalculated'),
  ids: z.object({ sportKey: sportKeySchema.optional() }),
});

export const SportGameStatsCorrectedEventSchema = z.object({
  type: z.literal('sportGame.statsCorrected'),
  ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }),
});

export const StatsValidationReportCreatedEventSchema = z.object({
  type: z.literal('statsValidationReport.created'),
  ids: z.object({ reportId: z.string().min(1) }),
});

export const StatsValidationReportDeletedEventSchema = z.object({
  type: z.literal('statsValidationReport.deleted'),
  ids: z.object({ reportId: statsValidationReportIdSchema }),
});

export const HistoricalStatUpdatedEventSchema = z.object({
  type: z.literal('historicalStat.updated'),
  ids: z.object({ userId: userIdSchema }),
});

export const UserProfileBannedEventSchema = z.object({
  type: z.literal('userProfile.banned'),
  ids: z.object({ userId: userIdSchema }),
});

export const UserProfileUnbannedEventSchema = z.object({
  type: z.literal('userProfile.unbanned'),
  ids: z.object({ userId: userIdSchema }),
});

export const AwardDefinitionCreatedEventSchema = z.object({
  type: z.literal('awardDefinition.created'),
  ids: z.object({ awardId: awardIdSchema }),
});

export const AwardDefinitionBadgeReplacedEventSchema = z.object({
  type: z.literal('awardDefinition.badgeReplaced'),
  ids: z.object({ awardId: awardIdSchema }),
});

export const AwardDefinitionDeletedEventSchema = z.object({
  type: z.literal('awardDefinition.deleted'),
  ids: z.object({ awardId: awardIdSchema }),
});

export const AwardDefinitionGrantedEventSchema = z.object({
  type: z.literal('awardDefinition.granted'),
  ids: z.object({ awardId: awardIdSchema }),
});

export const AwardDefinitionRevokedEventSchema = z.object({
  type: z.literal('awardDefinition.revoked'),
  ids: z.object({ awardId: awardIdSchema }),
});

export const UserProfileFeaturedAwardsChangedEventSchema = z.object({
  type: z.literal('userProfile.featuredAwardsChanged'),
  ids: z.object({ userId: userIdSchema }),
});

export const HardwareLoanContractCreatedEventSchema = z.object({
  type: z.literal('hardwareLoanContract.created'),
  ids: z.object({ contractId: hardwareLoanContractIdSchema, refereeUserId: userIdSchema }),
});

export const HardwareLoanContractSignedEventSchema = z.object({
  type: z.literal('hardwareLoanContract.signed'),
  ids: z.object({ contractId: hardwareLoanContractIdSchema, refereeUserId: userIdSchema }),
});

export const HardwareLoanContractReturnedEventSchema = z.object({
  type: z.literal('hardwareLoanContract.returned'),
  ids: z.object({ contractId: hardwareLoanContractIdSchema, refereeUserId: userIdSchema }),
});

export const HardwareLoanContractDeletedEventSchema = z.object({
  type: z.literal('hardwareLoanContract.deleted'),
  ids: z.object({ contractId: hardwareLoanContractIdSchema, refereeUserId: userIdSchema }),
});

export const UserProfileRegisteredEventSchema = z.object({
  type: z.literal('userProfile.registered'),
  ids: z.object({ userId: userIdSchema }),
});

export const UserProfileDisplayNameChangedEventSchema = z.object({
  type: z.literal('userProfile.displayNameChanged'),
  ids: z.object({ userId: userIdSchema }),
});

export const StatsBeaconChangedEventSchema = z.object({
  type: z.literal('statsBeacon.changed'),
  ids: z.object({}),
});

export const WaiverTemplateCreatedEventSchema = z.object({
  type: z.literal('waiverTemplate.created'),
  ids: z.object({ waiverTemplateId: waiverTemplateIdSchema }),
});

export const WaiverTemplateVersionPublishedEventSchema = z.object({
  type: z.literal('waiverTemplate.versionPublished'),
  ids: z.object({ waiverTemplateId: waiverTemplateIdSchema }),
});

export const WaiverTemplateRetiredEventSchema = z.object({
  type: z.literal('waiverTemplate.retired'),
  ids: z.object({ waiverTemplateId: waiverTemplateIdSchema }),
});

export const WaiverTemplateDeletedEventSchema = z.object({
  type: z.literal('waiverTemplate.deleted'),
  ids: z.object({ waiverTemplateId: waiverTemplateIdSchema }),
});

export const GameLocationCreatedEventSchema = z.object({
  type: z.literal('gameLocation.created'),
  ids: z.object({ gameLocationId: gameLocationIdSchema }),
});

export const GameLocationUpdatedEventSchema = z.object({
  type: z.literal('gameLocation.updated'),
  ids: z.object({ gameLocationId: gameLocationIdSchema }),
});

export const GameLocationDeletedEventSchema = z.object({
  type: z.literal('gameLocation.deleted'),
  ids: z.object({ gameLocationId: gameLocationIdSchema }),
});

export const LeagueTeamUpdatedEventSchema = z.object({
  type: z.literal('leagueTeam.updated'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }),
});

export const LeagueTeamCaptainChangedEventSchema = z.object({
  type: z.literal('leagueTeam.captainChanged'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }),
});

export const LeagueTeamDeletedEventSchema = z.object({
  type: z.literal('leagueTeam.deleted'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }),
});

export const GhostPlayerRemovedEventSchema = z.object({
  type: z.literal('ghostPlayer.removed'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema, ghostUserId: userIdSchema }),
});

export const LeagueTeamContactUpdatedEventSchema = z.object({
  type: z.literal('leagueTeamContact.updated'),
  ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }),
});

export const LandingPageUpdatedEventSchema = z.object({
  type: z.literal('landingPage.updated'),
  ids: z.object({}),
});

export const GalleryPictureAddedEventSchema = z.object({
  type: z.literal('galleryPicture.added'),
  ids: z.object({
    ownerKind: galleryOwnerKindSchema,
    ownerId: z.string().min(1),
    pictureId: pictureIdSchema,
  }),
  position: z.string().min(1),
  createdAt: epochMsSchema,
});

export const DeadLetterReplayedEventSchema = z.object({
  type: z.literal('deadLetter.replayed'),
  ids: z.object({}),
});

export const MigrationActionRunPageRunEventSchema = z.object({
  type: z.literal('migrationActionRun.pageRun'),
  ids: z.object({}),
});

export const MigrationActionRunControlRecordedEventSchema = z.object({
  type: z.literal('migrationActionRun.controlRecorded'),
  ids: z.object({}),
});

export const MigrationActionRunCheckpointRecordedEventSchema = z.object({
  type: z.literal('migrationActionRun.checkpointRecorded'),
  ids: z.object({}),
});

export const MigrationConsoleCutoverRecordedEventSchema = z.object({
  type: z.literal('migrationConsole.cutoverRecorded'),
  ids: z.object({}),
});

export const GameRosterPlayerStatLineResolvedEventSchema = z.object({
  type: z.literal('gameRosterPlayer.statLineResolved'),
  ids: z.object({}),
});

export const DomainEventSchema = z.discriminatedUnion('type', [
  SportLeagueCreatedEventSchema,
  SportLeagueUpdatedEventSchema,
  SportLeagueStatusChangedEventSchema,
  SportLeagueModeSwitchedEventSchema,
  LeagueTeamCreatedEventSchema,
  TeamMembershipRoleChangedEventSchema,
  TeamMembershipRemovedEventSchema,
  GhostPlayerCreatedEventSchema,
  SignedWaiverCreatedEventSchema,
  GhostPlayerLinkedEventSchema,
  TeamJoinRequestCreatedEventSchema,
  TeamJoinRequestCancelledEventSchema,
  TeamJoinRequestAcceptedEventSchema,
  TeamJoinRequestRejectedEventSchema,
  TeamInvitationCreatedEventSchema,
  TeamInvitationCancelledEventSchema,
  TeamInvitationAcceptedEventSchema,
  TeamInvitationRejectedEventSchema,
  LeagueFreeAgentCreatedEventSchema,
  LeagueFreeAgentDeletedEventSchema,
  LeagueFreeAgentAssignedEventSchema,
  SportGameFinalizedEventSchema,
  SportGameReopenedEventSchema,
  SportGameStatEventsRecordedEventSchema,
  SportGameAbsenceChangedEventSchema,
  SportGameMemoUpdatedEventSchema,
  SportGameJumpBallChangedEventSchema,
  ScheduleWeekCreatedEventSchema,
  ScheduleWeekUpdatedEventSchema,
  ScheduleWeekDeletedEventSchema,
  SportGameCreatedEventSchema,
  SportGameUpdatedEventSchema,
  SportGameDeletedEventSchema,
  SportLeagueStatsRecalculatedEventSchema,
  UserProfileStatsRecalculatedEventSchema,
  SportHallOfFameRecalculatedEventSchema,
  SportGameStatsCorrectedEventSchema,
  StatsValidationReportCreatedEventSchema,
  StatsValidationReportDeletedEventSchema,
  HistoricalStatUpdatedEventSchema,
  UserProfileBannedEventSchema,
  UserProfileUnbannedEventSchema,
  AwardDefinitionCreatedEventSchema,
  AwardDefinitionBadgeReplacedEventSchema,
  AwardDefinitionDeletedEventSchema,
  AwardDefinitionGrantedEventSchema,
  AwardDefinitionRevokedEventSchema,
  UserProfileFeaturedAwardsChangedEventSchema,
  HardwareLoanContractCreatedEventSchema,
  HardwareLoanContractSignedEventSchema,
  HardwareLoanContractReturnedEventSchema,
  HardwareLoanContractDeletedEventSchema,
  UserProfileRegisteredEventSchema,
  UserProfileDisplayNameChangedEventSchema,
  StatsBeaconChangedEventSchema,
  WaiverTemplateCreatedEventSchema,
  WaiverTemplateVersionPublishedEventSchema,
  WaiverTemplateRetiredEventSchema,
  WaiverTemplateDeletedEventSchema,
  GameLocationCreatedEventSchema,
  GameLocationUpdatedEventSchema,
  GameLocationDeletedEventSchema,
  LeagueTeamUpdatedEventSchema,
  LeagueTeamCaptainChangedEventSchema,
  LeagueTeamDeletedEventSchema,
  GhostPlayerRemovedEventSchema,
  LeagueTeamContactUpdatedEventSchema,
  LandingPageUpdatedEventSchema,
  GalleryPictureAddedEventSchema,
  DeadLetterReplayedEventSchema,
  MigrationActionRunPageRunEventSchema,
  MigrationActionRunControlRecordedEventSchema,
  MigrationActionRunCheckpointRecordedEventSchema,
  MigrationConsoleCutoverRecordedEventSchema,
  GameRosterPlayerStatLineResolvedEventSchema,
]);
export type DomainEvent = z.infer<typeof DomainEventSchema>;
export type DomainEventType = DomainEvent['type'];
