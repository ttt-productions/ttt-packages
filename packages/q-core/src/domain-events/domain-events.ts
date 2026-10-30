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

export const LeagueCreatedEventSchema = z
  .object({
    type: z.literal('league.created'),
    ids: z.object({ leagueId: leagueIdSchema }).strict(),
  })
  .strict();

export const LeagueUpdatedEventSchema = z
  .object({
    type: z.literal('league.updated'),
    ids: z.object({ leagueId: leagueIdSchema }).strict(),
  })
  .strict();

export const LeagueModeSwitchedEventSchema = z
  .object({
    type: z.literal('league.modeSwitched'),
    ids: z.object({ leagueId: leagueIdSchema }).strict(),
  })
  .strict();

export const LeagueTeamCreatedEventSchema = z
  .object({
    type: z.literal('leagueTeam.created'),
    ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }).strict(),
  })
  .strict();

export const TeamRosterChangedEventSchema = z
  .object({
    type: z.literal('teamRoster.changed'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

export const SignedWaiverCreatedEventSchema = z
  .object({
    type: z.literal('signedWaiver.created'),
    ids: z.object({ leagueId: leagueIdSchema, userId: userIdSchema }).strict(),
  })
  .strict();

export const GhostPlayerLinkedEventSchema = z
  .object({
    type: z.literal('ghostPlayer.linked'),
    ids: z
      .object({
        leagueId: leagueIdSchema,
        teamId: teamIdSchema,
        ghostUserId: userIdSchema,
        realUserId: userIdSchema,
      })
      .strict(),
  })
  .strict();

export const TeamJoinRequestSubmittedEventSchema = z
  .object({
    type: z.literal('teamJoinRequest.submitted'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

export const TeamJoinRequestCancelledEventSchema = z
  .object({
    type: z.literal('teamJoinRequest.cancelled'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

export const TeamJoinRequestAnsweredEventSchema = z
  .object({
    type: z.literal('teamJoinRequest.answered'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

export const TeamInvitationSentEventSchema = z
  .object({
    type: z.literal('teamInvitation.sent'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

export const TeamInvitationCancelledEventSchema = z
  .object({
    type: z.literal('teamInvitation.cancelled'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

export const TeamInvitationAnsweredEventSchema = z
  .object({
    type: z.literal('teamInvitation.answered'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

export const LeagueFreeAgentSignedUpEventSchema = z
  .object({
    type: z.literal('leagueFreeAgent.signedUp'),
    ids: z.object({ leagueId: leagueIdSchema, userId: userIdSchema }).strict(),
  })
  .strict();

export const LeagueFreeAgentRemovedEventSchema = z
  .object({
    type: z.literal('leagueFreeAgent.removed'),
    ids: z.object({ leagueId: leagueIdSchema, userId: userIdSchema }).strict(),
  })
  .strict();

export const SportGameFinalizedEventSchema = z
  .object({
    type: z.literal('sportGame.finalized'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

export const SportGameReopenedEventSchema = z
  .object({
    type: z.literal('sportGame.reopened'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

export const SportGameStatEventsRecordedEventSchema = z
  .object({
    type: z.literal('sportGame.statEventsRecorded'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

export const SportGameAbsenceChangedEventSchema = z
  .object({
    type: z.literal('sportGame.absenceChanged'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

export const SportGameMemoUpdatedEventSchema = z
  .object({
    type: z.literal('sportGame.memoUpdated'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

export const SportGameJumpBallChangedEventSchema = z
  .object({
    type: z.literal('sportGame.jumpBallChanged'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

export const LeagueScheduleChangedEventSchema = z
  .object({
    type: z.literal('leagueSchedule.changed'),
    ids: z.object({ leagueId: leagueIdSchema }).strict(),
  })
  .strict();

export const SportGameUpdatedEventSchema = z
  .object({
    type: z.literal('sportGame.updated'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

export const SportGameDeletedEventSchema = z
  .object({
    type: z.literal('sportGame.deleted'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

export const StatsRecalculatedEventSchema = z
  .object({
    type: z.literal('stats.recalculated'),
    ids: z
      .object({
        userId: userIdSchema.optional(),
        leagueId: leagueIdSchema.optional(),
        sportKey: sportKeySchema.optional(),
      })
      .strict(),
  })
  .strict();

export const SportGameStatsCorrectedEventSchema = z
  .object({
    type: z.literal('sportGame.statsCorrected'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

export const StatsValidationReportedEventSchema = z
  .object({
    type: z.literal('statsValidation.reported'),
    ids: z.object({ reportId: z.string().min(1) }).strict(),
  })
  .strict();

export const StatsValidationReportDeletedEventSchema = z
  .object({
    type: z.literal('statsValidation.reportDeleted'),
    ids: z.object({ reportId: statsValidationReportIdSchema }).strict(),
  })
  .strict();

export const HistoricalStatsUpdatedEventSchema = z
  .object({
    type: z.literal('historicalStats.updated'),
    ids: z.object({ userId: userIdSchema }).strict(),
  })
  .strict();

export const UserStatusChangedEventSchema = z
  .object({
    type: z.literal('user.statusChanged'),
    ids: z.object({ userId: userIdSchema }).strict(),
  })
  .strict();

export const AwardDefinitionCreatedEventSchema = z
  .object({
    type: z.literal('awardDefinition.created'),
    ids: z.object({ awardId: awardIdSchema }).strict(),
  })
  .strict();

export const AwardDefinitionUpdatedEventSchema = z
  .object({
    type: z.literal('awardDefinition.updated'),
    ids: z.object({ awardId: awardIdSchema }).strict(),
  })
  .strict();

export const AwardDefinitionDeletedEventSchema = z
  .object({
    type: z.literal('awardDefinition.deleted'),
    ids: z.object({ awardId: awardIdSchema }).strict(),
  })
  .strict();

export const AwardGrantsChangedEventSchema = z
  .object({
    type: z.literal('awardGrants.changed'),
    ids: z.object({ awardId: awardIdSchema }).strict(),
  })
  .strict();

export const FeaturedAwardsChangedEventSchema = z
  .object({
    type: z.literal('featuredAwards.changed'),
    ids: z.object({ userId: userIdSchema }).strict(),
  })
  .strict();

export const HardwareLoanContractChangedEventSchema = z
  .object({
    type: z.literal('hardwareLoanContract.changed'),
    ids: z
      .object({ contractId: hardwareLoanContractIdSchema, refereeUserId: userIdSchema })
      .strict(),
  })
  .strict();

export const UserRegisteredEventSchema = z
  .object({ type: z.literal('user.registered'), ids: z.object({ userId: userIdSchema }).strict() })
  .strict();

export const DisplayNameChangedEventSchema = z
  .object({
    type: z.literal('displayName.changed'),
    ids: z.object({ userId: userIdSchema }).strict(),
  })
  .strict();

export const StatsBeaconChangedEventSchema = z
  .object({ type: z.literal('statsBeacon.changed'), ids: z.object({}).strict() })
  .strict();

export const WaiverTemplateCreatedEventSchema = z
  .object({
    type: z.literal('waiverTemplate.created'),
    ids: z.object({ waiverTemplateId: waiverTemplateIdSchema }).strict(),
  })
  .strict();

export const WaiverTemplateUpdatedEventSchema = z
  .object({
    type: z.literal('waiverTemplate.updated'),
    ids: z.object({ waiverTemplateId: waiverTemplateIdSchema }).strict(),
  })
  .strict();

export const WaiverTemplateDeletedEventSchema = z
  .object({
    type: z.literal('waiverTemplate.deleted'),
    ids: z.object({ waiverTemplateId: waiverTemplateIdSchema }).strict(),
  })
  .strict();

export const GameLocationCreatedEventSchema = z
  .object({
    type: z.literal('gameLocation.created'),
    ids: z.object({ gameLocationId: gameLocationIdSchema }).strict(),
  })
  .strict();

export const GameLocationUpdatedEventSchema = z
  .object({
    type: z.literal('gameLocation.updated'),
    ids: z.object({ gameLocationId: gameLocationIdSchema }).strict(),
  })
  .strict();

export const GameLocationDeletedEventSchema = z
  .object({
    type: z.literal('gameLocation.deleted'),
    ids: z.object({ gameLocationId: gameLocationIdSchema }).strict(),
  })
  .strict();

export const LeagueTeamUpdatedEventSchema = z
  .object({
    type: z.literal('leagueTeam.updated'),
    ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }).strict(),
  })
  .strict();

export const LeagueTeamDeletedEventSchema = z
  .object({
    type: z.literal('leagueTeam.deleted'),
    ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }).strict(),
  })
  .strict();

export const LeagueTeamDeletionAdvancedEventSchema = z
  .object({
    type: z.literal('leagueTeam.deletionAdvanced'),
    ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }).strict(),
  })
  .strict();

export const GhostPlayerFinishedEntriesRemovedEventSchema = z
  .object({
    type: z.literal('ghostPlayer.finishedEntriesRemoved'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, ghostUserId: userIdSchema })
      .strict(),
  })
  .strict();

export const LeagueTeamContactUpdatedEventSchema = z
  .object({
    type: z.literal('leagueTeamContact.updated'),
    ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }).strict(),
  })
  .strict();

export const LandingPageUpdatedEventSchema = z
  .object({ type: z.literal('landingPage.updated'), ids: z.object({}).strict() })
  .strict();

export const GalleryPictureAddedEventSchema = z
  .object({
    type: z.literal('galleryPicture.added'),
    ids: z
      .object({
        ownerKind: galleryOwnerKindSchema,
        ownerId: z.string().min(1),
        pictureId: pictureIdSchema,
      })
      .strict(),
    position: z.string().min(1),
    createdAt: epochMsSchema,
  })
  .strict();

export const DeadLetterReplayedEventSchema = z
  .object({ type: z.literal('deadLetter.replayed'), ids: z.object({}).strict() })
  .strict();

export const MigrationConsoleChangedEventSchema = z
  .object({ type: z.literal('migrationConsole.changed'), ids: z.object({}).strict() })
  .strict();

export const DomainEventSchema = z.discriminatedUnion('type', [
  LeagueCreatedEventSchema,
  LeagueUpdatedEventSchema,
  LeagueModeSwitchedEventSchema,
  LeagueTeamCreatedEventSchema,
  TeamRosterChangedEventSchema,
  SignedWaiverCreatedEventSchema,
  GhostPlayerLinkedEventSchema,
  TeamJoinRequestSubmittedEventSchema,
  TeamJoinRequestCancelledEventSchema,
  TeamJoinRequestAnsweredEventSchema,
  TeamInvitationSentEventSchema,
  TeamInvitationCancelledEventSchema,
  TeamInvitationAnsweredEventSchema,
  LeagueFreeAgentSignedUpEventSchema,
  LeagueFreeAgentRemovedEventSchema,
  SportGameFinalizedEventSchema,
  SportGameReopenedEventSchema,
  SportGameStatEventsRecordedEventSchema,
  SportGameAbsenceChangedEventSchema,
  SportGameMemoUpdatedEventSchema,
  SportGameJumpBallChangedEventSchema,
  LeagueScheduleChangedEventSchema,
  SportGameUpdatedEventSchema,
  SportGameDeletedEventSchema,
  StatsRecalculatedEventSchema,
  SportGameStatsCorrectedEventSchema,
  StatsValidationReportedEventSchema,
  StatsValidationReportDeletedEventSchema,
  HistoricalStatsUpdatedEventSchema,
  UserStatusChangedEventSchema,
  AwardDefinitionCreatedEventSchema,
  AwardDefinitionUpdatedEventSchema,
  AwardDefinitionDeletedEventSchema,
  AwardGrantsChangedEventSchema,
  FeaturedAwardsChangedEventSchema,
  HardwareLoanContractChangedEventSchema,
  UserRegisteredEventSchema,
  DisplayNameChangedEventSchema,
  StatsBeaconChangedEventSchema,
  WaiverTemplateCreatedEventSchema,
  WaiverTemplateUpdatedEventSchema,
  WaiverTemplateDeletedEventSchema,
  GameLocationCreatedEventSchema,
  GameLocationUpdatedEventSchema,
  GameLocationDeletedEventSchema,
  LeagueTeamUpdatedEventSchema,
  LeagueTeamDeletedEventSchema,
  LeagueTeamDeletionAdvancedEventSchema,
  GhostPlayerFinishedEntriesRemovedEventSchema,
  LeagueTeamContactUpdatedEventSchema,
  LandingPageUpdatedEventSchema,
  GalleryPictureAddedEventSchema,
  DeadLetterReplayedEventSchema,
  MigrationConsoleChangedEventSchema,
]);
export type DomainEvent = z.infer<typeof DomainEventSchema>;
export type DomainEventType = DomainEvent['type'];
