// The DomainEvent union — the vocabulary of "what happened" that both sides of the boundary share.
//
// A callable or trigger names what it changed with one of these; the client alone maps an event to
// the query-key families it makes stale (the invalidation registry is app-local, RULE-STD-FRONTEND-102). The two
// sides share event names, never cache keys.

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

// The league changed mode, and with it the `teamType` of every one of its teams.
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

// A member was added, removed, or changed role on a team — by any path, ghosts included.
export const TeamRosterChangedEventSchema = z
  .object({
    type: z.literal('teamRoster.changed'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

// A waiver was signed for a person in a league — by them, or for a ghost by a witness.
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

// The requester withdrew their join request.
export const TeamJoinRequestCancelledEventSchema = z
  .object({
    type: z.literal('teamJoinRequest.cancelled'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

// The team accepted or rejected a join request. An acceptance also changed the roster.
export const TeamJoinRequestAnsweredEventSchema = z
  .object({
    type: z.literal('teamJoinRequest.answered'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

// The team invited a person. `userId` is the invitee.
export const TeamInvitationSentEventSchema = z
  .object({
    type: z.literal('teamInvitation.sent'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

// The team withdrew an invitation. `userId` is the invitee.
export const TeamInvitationCancelledEventSchema = z
  .object({
    type: z.literal('teamInvitation.cancelled'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

// The invitee accepted or declined an invitation. An acceptance also changed the roster.
export const TeamInvitationAnsweredEventSchema = z
  .object({
    type: z.literal('teamInvitation.answered'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, userId: userIdSchema })
      .strict(),
  })
  .strict();

// A player signed up as a free agent in a league.
export const LeagueFreeAgentSignedUpEventSchema = z
  .object({
    type: z.literal('leagueFreeAgent.signedUp'),
    ids: z.object({ leagueId: leagueIdSchema, userId: userIdSchema }).strict(),
  })
  .strict();

// A player's free-agent signup ended: they withdrew it, or an admin placed them on a team.
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

// A scoring write stored stat events on a live game: its rollup and score moved.
export const SportGameStatEventsRecordedEventSchema = z
  .object({
    type: z.literal('sportGame.statEventsRecorded'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

// A roster entry of a live game was marked absent or present.
export const SportGameAbsenceChangedEventSchema = z
  .object({
    type: z.literal('sportGame.absenceChanged'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

// A scorer's note on one person in a live game changed.
export const SportGameMemoUpdatedEventSchema = z
  .object({
    type: z.literal('sportGame.memoUpdated'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

// The jump-ball possession arrow of a live basketball game moved.
export const SportGameJumpBallChangedEventSchema = z
  .object({
    type: z.literal('sportGame.jumpBallChanged'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

// A league's schedule changed as a whole: a week was created, its shared fields edited, or it was
// deleted, or a game was added to a week. Any of the league's games may have been added, changed, or
// removed.
export const LeagueScheduleChangedEventSchema = z
  .object({
    type: z.literal('leagueSchedule.changed'),
    ids: z.object({ leagueId: leagueIdSchema }).strict(),
  })
  .strict();

// One game's schedule changed — its week, start time, or venue — or its teams were replaced, which
// replaces their roster entries and stat lines too.
export const SportGameUpdatedEventSchema = z
  .object({
    type: z.literal('sportGame.updated'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

// One game was deleted with its events and roster.
export const SportGameDeletedEventSchema = z
  .object({
    type: z.literal('sportGame.deleted'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

// A rebuild ran. Every scope id is optional: a rebuild covers one league, every league, one user,
// every user, or one sport's hall of fame (for one user or the whole sport).
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

// A game's numbers were corrected or restored from its events in Fix stats; for a completed game,
// every destination it feeds moved with them.
export const SportGameStatsCorrectedEventSchema = z
  .object({
    type: z.literal('sportGame.statsCorrected'),
    ids: z.object({ leagueId: leagueIdSchema, gameId: gameIdSchema }).strict(),
  })
  .strict();

// A stats check wrote or advanced its report.
export const StatsValidationReportedEventSchema = z
  .object({
    type: z.literal('statsValidation.reported'),
    ids: z.object({ reportId: z.string().min(1) }).strict(),
  })
  .strict();

// An admin deleted a stats check's report.
export const StatsValidationReportDeletedEventSchema = z
  .object({
    type: z.literal('statsValidation.reportDeleted'),
    ids: z.object({ reportId: statsValidationReportIdSchema }).strict(),
  })
  .strict();

// A person's pre-Q-Sports baseline was written, and their career line and hall-of-fame entry rebuilt.
export const HistoricalStatsUpdatedEventSchema = z
  .object({
    type: z.literal('historicalStats.updated'),
    ids: z.object({ userId: userIdSchema }).strict(),
  })
  .strict();

// An admin banned an account or lifted its ban.
export const UserStatusChangedEventSchema = z
  .object({
    type: z.literal('user.statusChanged'),
    ids: z.object({ userId: userIdSchema }).strict(),
  })
  .strict();

// An award joined the catalog — its first badge was published.
export const AwardDefinitionCreatedEventSchema = z
  .object({
    type: z.literal('awardDefinition.created'),
    ids: z.object({ awardId: awardIdSchema }).strict(),
  })
  .strict();

// An award's document changed: its badge was replaced, or its holder count moved.
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

// An award was granted to or revoked from some accounts, which may have cleared a featured badge.
// The accounts are many, so the event names the award; a client holding any profile's awards
// refreshes them.
export const AwardGrantsChangedEventSchema = z
  .object({
    type: z.literal('awardGrants.changed'),
    ids: z.object({ awardId: awardIdSchema }).strict(),
  })
  .strict();

// An account chose which of its awards to feature beside its name.
export const FeaturedAwardsChangedEventSchema = z
  .object({
    type: z.literal('featuredAwards.changed'),
    ids: z.object({ userId: userIdSchema }).strict(),
  })
  .strict();

// A hardware loan contract was created, signed, returned, or deleted.
export const HardwareLoanContractChangedEventSchema = z
  .object({
    type: z.literal('hardwareLoanContract.changed'),
    ids: z
      .object({ contractId: hardwareLoanContractIdSchema, refereeUserId: userIdSchema })
      .strict(),
  })
  .strict();

// A new account finished registration: its profile and public identity now exist.
export const UserRegisteredEventSchema = z
  .object({ type: z.literal('user.registered'), ids: z.object({ userId: userIdSchema }).strict() })
  .strict();

export const DisplayNameChangedEventSchema = z
  .object({
    type: z.literal('displayName.changed'),
    ids: z.object({ userId: userIdSchema }).strict(),
  })
  .strict();

// The shared stats beacon moved: stats changed somewhere. The beacon holds only its latest change,
// not a log of them, so the event names no scope and a watching client refreshes every
// stats-bearing read.
export const StatsBeaconChangedEventSchema = z
  .object({ type: z.literal('statsBeacon.changed'), ids: z.object({}).strict() })
  .strict();

export const WaiverTemplateCreatedEventSchema = z
  .object({
    type: z.literal('waiverTemplate.created'),
    ids: z.object({ waiverTemplateId: waiverTemplateIdSchema }).strict(),
  })
  .strict();

// A template's wording changed: a new version was published.
export const WaiverTemplateUpdatedEventSchema = z
  .object({
    type: z.literal('waiverTemplate.updated'),
    ids: z.object({ waiverTemplateId: waiverTemplateIdSchema }).strict(),
  })
  .strict();

// A template left the admin's list — deleted, or retired because something still names it.
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

// A venue's document changed — its own fields through the location callables, or its picture
// through the upload pipeline.
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

// A team's document changed: an admin renamed it or changed its type, or the picture core changed its
// gallery summary.
export const LeagueTeamUpdatedEventSchema = z
  .object({
    type: z.literal('leagueTeam.updated'),
    ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }).strict(),
  })
  .strict();

// An admin deleted a team that never played, with its memberships, ghosts, invitations, join
// requests, contact phone, gallery, and unplayed games.
export const LeagueTeamDeletedEventSchema = z
  .object({
    type: z.literal('leagueTeam.deleted'),
    ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }).strict(),
  })
  .strict();

// An admin's deletion of a team stopped short: some of the team's games, ghost players, invitations,
// join requests, or memberships are gone, and the team, with its contact phone, still stands.
export const LeagueTeamDeletionAdvancedEventSchema = z
  .object({
    type: z.literal('leagueTeam.deletionAdvanced'),
    ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }).strict(),
  })
  .strict();

// A ghost player's removal took the ghost's entries off finished games of its team — each one it sat
// out without a stat, so no result or total changed, but the games' finalized records no longer name
// it. The event names no game.
export const GhostPlayerFinishedEntriesRemovedEventSchema = z
  .object({
    type: z.literal('ghostPlayer.finishedEntriesRemoved'),
    ids: z
      .object({ leagueId: leagueIdSchema, teamId: teamIdSchema, ghostUserId: userIdSchema })
      .strict(),
  })
  .strict();

// An admin set a team's contact phone, which only admins read.
export const LeagueTeamContactUpdatedEventSchema = z
  .object({
    type: z.literal('leagueTeamContact.updated'),
    ids: z.object({ leagueId: leagueIdSchema, teamId: teamIdSchema }).strict(),
  })
  .strict();

// The landing page's document changed — its copy, or its gallery summary. There is one landing page,
// so the event names none.
export const LandingPageUpdatedEventSchema = z
  .object({ type: z.literal('landingPage.updated'), ids: z.object({}).strict() })
  .strict();

// A picture joined a gallery. It carries the whole new entry, so a client holding that gallery's
// pages patches the entry in where its position sorts, and no gallery page is ever refetched for it
// (RULE-STD-FRONTEND-103). The owner's summary changed too, and the owner's own update event says so.
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

// A dead-lettered row was replayed back onto its pipeline's queue, so the operator's dead-letter list
// loses it. The list spans every lane, so the event names none.
export const DeadLetterReplayedEventSchema = z
  .object({ type: z.literal('deadLetter.replayed'), ids: z.object({}).strict() })
  .strict();

// The migration console's state moved: an action ran a page, a step was recorded, or the cutover
// was. There is one console, so the event names none.
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
