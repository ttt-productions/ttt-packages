import { z } from 'zod';

export const PendingMediaCompletedSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    fileOrigin: z.enum([
      'league-picture',
      'team-picture',
      'landing-picture',
      'location-picture',
      'award-badge',
      'waiver-signature',
      'hardware-signature',
    ]),
    originalFileName: z.string(),
    originalContentType: z.string().optional(),
    originalSize: z.number().optional(),
    pendingStoragePath: z.string(),
    targetInfo: z.unknown().optional(),
    textContent: z.string().optional(),
    clientContext: z
      .object({ surface: z.string(), targetIds: z.array(z.string()).optional() })
      .strict(),
    clientMediaClaim: z
      .object({
        kind: z.enum(['image', 'video', 'audio', 'file']),
        source: z.enum(['file-picker', 'camera-capture', 'media-recorder']),
      })
      .strict()
      .optional(),
    publicationState: z
      .enum(['notStarted', 'activating', 'publishing', 'live', 'publicationFailed'])
      .optional(),
    moderationOverride: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    processingStartedAt: z.number().optional(),
    processingAttemptCount: z.number().optional(),
    processingLeaseExpiresAt: z.number().optional(),
    terminalAt: z.number(),
    status: z.literal('completed'),
    completedAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().optional(),
    uploadTraySeenAt: z.number().optional(),
    uploadTraySeenBy: z.string().optional(),
    result: z
      .object({
        events: z.array(
          z.discriminatedUnion('type', [
            z
              .object({
                type: z.literal('league.created'),
                ids: z.object({ leagueId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('league.updated'),
                ids: z.object({ leagueId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('league.modeSwitched'),
                ids: z.object({ leagueId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueTeam.created'),
                ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamRoster.changed'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('signedWaiver.created'),
                ids: z.object({ leagueId: z.string(), userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('ghostPlayer.linked'),
                ids: z
                  .object({
                    leagueId: z.string(),
                    teamId: z.string(),
                    ghostUserId: z.string(),
                    realUserId: z.string(),
                  })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamJoinRequest.submitted'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamJoinRequest.cancelled'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamJoinRequest.answered'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamInvitation.sent'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamInvitation.cancelled'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamInvitation.answered'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueFreeAgent.signedUp'),
                ids: z.object({ leagueId: z.string(), userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueFreeAgent.removed'),
                ids: z.object({ leagueId: z.string(), userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.finalized'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.reopened'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.statEventsRecorded'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.absenceChanged'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.memoUpdated'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.jumpBallChanged'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueSchedule.changed'),
                ids: z.object({ leagueId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.updated'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.deleted'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('stats.recalculated'),
                ids: z
                  .object({
                    userId: z.string().optional(),
                    leagueId: z.string().optional(),
                    sportKey: z.enum(['basketball', 'curling', 'football']).optional(),
                  })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.statsCorrected'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('statsValidation.reported'),
                ids: z.object({ reportId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('statsValidation.reportDeleted'),
                ids: z.object({ reportId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('historicalStats.updated'),
                ids: z.object({ userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('user.statusChanged'),
                ids: z.object({ userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('awardDefinition.created'),
                ids: z.object({ awardId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('awardDefinition.updated'),
                ids: z.object({ awardId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('awardDefinition.deleted'),
                ids: z.object({ awardId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('awardGrants.changed'),
                ids: z.object({ awardId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('featuredAwards.changed'),
                ids: z.object({ userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('hardwareLoanContract.changed'),
                ids: z.object({ contractId: z.string(), refereeUserId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('adminList.changed'),
                ids: z.object({ userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('user.registered'),
                ids: z.object({ userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('displayName.changed'),
                ids: z.object({ userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({ type: z.literal('statsBeacon.changed'), ids: z.object({}).strict() })
              .strict(),
            z
              .object({
                type: z.literal('waiverTemplate.created'),
                ids: z.object({ waiverTemplateId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('waiverTemplate.updated'),
                ids: z.object({ waiverTemplateId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('waiverTemplate.deleted'),
                ids: z.object({ waiverTemplateId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('gameLocation.created'),
                ids: z.object({ gameLocationId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('gameLocation.updated'),
                ids: z.object({ gameLocationId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('gameLocation.deleted'),
                ids: z.object({ gameLocationId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueTeam.updated'),
                ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueTeam.deleted'),
                ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueTeam.deletionAdvanced'),
                ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('ghostPlayer.finishedEntriesRemoved'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), ghostUserId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueTeamContact.updated'),
                ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({ type: z.literal('landingPage.updated'), ids: z.object({}).strict() })
              .strict(),
            z
              .object({
                type: z.literal('galleryPicture.added'),
                ids: z
                  .object({
                    ownerKind: z.enum(['sportLeague', 'leagueTeam', 'landingPage']),
                    ownerId: z.string(),
                    pictureId: z.string(),
                  })
                  .strict(),
                position: z.string(),
                createdAt: z.number(),
              })
              .strict(),
            z
              .object({ type: z.literal('deadLetter.replayed'), ids: z.object({}).strict() })
              .strict(),
            z
              .object({ type: z.literal('migrationConsole.changed'), ids: z.object({}).strict() })
              .strict(),
          ]),
        ),
        affected: z
          .array(
            z
              .object({
                collection: z.string(),
                docId: z.string(),
                operation: z.enum(['create', 'update']),
              })
              .strict(),
          )
          .optional(),
      })
      .strict(),
  })
  .strict();

export const PendingMediaFailedSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    fileOrigin: z.enum([
      'league-picture',
      'team-picture',
      'landing-picture',
      'location-picture',
      'award-badge',
      'waiver-signature',
      'hardware-signature',
    ]),
    originalFileName: z.string(),
    originalContentType: z.string().optional(),
    originalSize: z.number().optional(),
    pendingStoragePath: z.string(),
    targetInfo: z.unknown().optional(),
    textContent: z.string().optional(),
    clientContext: z
      .object({ surface: z.string(), targetIds: z.array(z.string()).optional() })
      .strict(),
    clientMediaClaim: z
      .object({
        kind: z.enum(['image', 'video', 'audio', 'file']),
        source: z.enum(['file-picker', 'camera-capture', 'media-recorder']),
      })
      .strict()
      .optional(),
    publicationState: z
      .enum(['notStarted', 'activating', 'publishing', 'live', 'publicationFailed'])
      .optional(),
    moderationOverride: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    processingStartedAt: z.number().optional(),
    processingAttemptCount: z.number().optional(),
    processingLeaseExpiresAt: z.number().optional(),
    terminalAt: z.number(),
    status: z.literal('failed'),
    failedAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().optional(),
    uploadTraySeenAt: z.number().optional(),
    uploadTraySeenBy: z.string().optional(),
    errorCategory: z.enum([
      'system',
      'rate_limit',
      'validation',
      'kind_mismatch',
      'storage',
      'moderation',
    ]),
    errorMessage: z.string(),
  })
  .strict();

export const PendingMediaRejectedSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    fileOrigin: z.enum([
      'league-picture',
      'team-picture',
      'landing-picture',
      'location-picture',
      'award-badge',
      'waiver-signature',
      'hardware-signature',
    ]),
    originalFileName: z.string(),
    originalContentType: z.string().optional(),
    originalSize: z.number().optional(),
    pendingStoragePath: z.string(),
    targetInfo: z.unknown().optional(),
    textContent: z.string().optional(),
    clientContext: z
      .object({ surface: z.string(), targetIds: z.array(z.string()).optional() })
      .strict(),
    clientMediaClaim: z
      .object({
        kind: z.enum(['image', 'video', 'audio', 'file']),
        source: z.enum(['file-picker', 'camera-capture', 'media-recorder']),
      })
      .strict()
      .optional(),
    publicationState: z
      .enum(['notStarted', 'activating', 'publishing', 'live', 'publicationFailed'])
      .optional(),
    moderationOverride: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    processingStartedAt: z.number().optional(),
    processingAttemptCount: z.number().optional(),
    processingLeaseExpiresAt: z.number().optional(),
    terminalAt: z.number(),
    status: z.literal('rejected'),
    rejectedAt: z.number(),
    uploadTrayClearedAt: z.number().optional(),
    uploadTrayClearedBy: z.string().optional(),
    uploadTraySeenAt: z.number().optional(),
    uploadTraySeenBy: z.string().optional(),
    rejectionType: z.enum(['text', 'media']),
    errorMessage: z.string(),
    violationId: z.string().optional(),
    result: z
      .object({
        events: z.array(
          z.discriminatedUnion('type', [
            z
              .object({
                type: z.literal('league.created'),
                ids: z.object({ leagueId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('league.updated'),
                ids: z.object({ leagueId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('league.modeSwitched'),
                ids: z.object({ leagueId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueTeam.created'),
                ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamRoster.changed'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('signedWaiver.created'),
                ids: z.object({ leagueId: z.string(), userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('ghostPlayer.linked'),
                ids: z
                  .object({
                    leagueId: z.string(),
                    teamId: z.string(),
                    ghostUserId: z.string(),
                    realUserId: z.string(),
                  })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamJoinRequest.submitted'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamJoinRequest.cancelled'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamJoinRequest.answered'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamInvitation.sent'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamInvitation.cancelled'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('teamInvitation.answered'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueFreeAgent.signedUp'),
                ids: z.object({ leagueId: z.string(), userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueFreeAgent.removed'),
                ids: z.object({ leagueId: z.string(), userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.finalized'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.reopened'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.statEventsRecorded'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.absenceChanged'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.memoUpdated'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.jumpBallChanged'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueSchedule.changed'),
                ids: z.object({ leagueId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.updated'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.deleted'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('stats.recalculated'),
                ids: z
                  .object({
                    userId: z.string().optional(),
                    leagueId: z.string().optional(),
                    sportKey: z.enum(['basketball', 'curling', 'football']).optional(),
                  })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('sportGame.statsCorrected'),
                ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('statsValidation.reported'),
                ids: z.object({ reportId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('statsValidation.reportDeleted'),
                ids: z.object({ reportId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('historicalStats.updated'),
                ids: z.object({ userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('user.statusChanged'),
                ids: z.object({ userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('awardDefinition.created'),
                ids: z.object({ awardId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('awardDefinition.updated'),
                ids: z.object({ awardId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('awardDefinition.deleted'),
                ids: z.object({ awardId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('awardGrants.changed'),
                ids: z.object({ awardId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('featuredAwards.changed'),
                ids: z.object({ userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('hardwareLoanContract.changed'),
                ids: z.object({ contractId: z.string(), refereeUserId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('adminList.changed'),
                ids: z.object({ userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('user.registered'),
                ids: z.object({ userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('displayName.changed'),
                ids: z.object({ userId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({ type: z.literal('statsBeacon.changed'), ids: z.object({}).strict() })
              .strict(),
            z
              .object({
                type: z.literal('waiverTemplate.created'),
                ids: z.object({ waiverTemplateId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('waiverTemplate.updated'),
                ids: z.object({ waiverTemplateId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('waiverTemplate.deleted'),
                ids: z.object({ waiverTemplateId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('gameLocation.created'),
                ids: z.object({ gameLocationId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('gameLocation.updated'),
                ids: z.object({ gameLocationId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('gameLocation.deleted'),
                ids: z.object({ gameLocationId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueTeam.updated'),
                ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueTeam.deleted'),
                ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueTeam.deletionAdvanced'),
                ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('ghostPlayer.finishedEntriesRemoved'),
                ids: z
                  .object({ leagueId: z.string(), teamId: z.string(), ghostUserId: z.string() })
                  .strict(),
              })
              .strict(),
            z
              .object({
                type: z.literal('leagueTeamContact.updated'),
                ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
              })
              .strict(),
            z
              .object({ type: z.literal('landingPage.updated'), ids: z.object({}).strict() })
              .strict(),
            z
              .object({
                type: z.literal('galleryPicture.added'),
                ids: z
                  .object({
                    ownerKind: z.enum(['sportLeague', 'leagueTeam', 'landingPage']),
                    ownerId: z.string(),
                    pictureId: z.string(),
                  })
                  .strict(),
                position: z.string(),
                createdAt: z.number(),
              })
              .strict(),
            z
              .object({ type: z.literal('deadLetter.replayed'), ids: z.object({}).strict() })
              .strict(),
            z
              .object({ type: z.literal('migrationConsole.changed'), ids: z.object({}).strict() })
              .strict(),
          ]),
        ),
        affected: z
          .array(
            z
              .object({
                collection: z.string(),
                docId: z.string(),
                operation: z.enum(['create', 'update']),
              })
              .strict(),
          )
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const PublicUserSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  displayName_lowercase: z.string(),
  isGhost: z.boolean(),
  disabled: z.boolean(),
  selectedBadges: z.object({ primary: z.string().optional(), secondary: z.string().optional() }),
  updatedAt: z.number(),
});

export const GameRosterPlayerSchema = z.object({
  userId: z.string(),
  teamId: z.string(),
  isGhost: z.boolean(),
  syncedAt: z.number(),
});

export const LandingPageConfigSchema = z.object({
  heroTitle: z.string(),
  aboutCompany: z.string(),
  pictures: z
    .object({ count: z.number(), featuredPictureId: z.string().optional(), updatedAt: z.number() })
    .optional(),
  updatedAt: z.number(),
});

export const LeagueFreeAgentSchema = z.object({
  leagueId: z.string(),
  userId: z.string(),
  createdAt: z.number(),
});

export const PendingMediaSchema = z.discriminatedUnion('status', [
  z
    .object({
      id: z.string(),
      userId: z.string(),
      fileOrigin: z.enum([
        'league-picture',
        'team-picture',
        'landing-picture',
        'location-picture',
        'award-badge',
        'waiver-signature',
        'hardware-signature',
      ]),
      originalFileName: z.string(),
      originalContentType: z.string().optional(),
      originalSize: z.number().optional(),
      pendingStoragePath: z.string(),
      targetInfo: z.unknown().optional(),
      textContent: z.string().optional(),
      clientContext: z
        .object({ surface: z.string(), targetIds: z.array(z.string()).optional() })
        .strict(),
      clientMediaClaim: z
        .object({
          kind: z.enum(['image', 'video', 'audio', 'file']),
          source: z.enum(['file-picker', 'camera-capture', 'media-recorder']),
        })
        .strict()
        .optional(),
      publicationState: z
        .enum(['notStarted', 'activating', 'publishing', 'live', 'publicationFailed'])
        .optional(),
      moderationOverride: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
      processingStartedAt: z.number().optional(),
      processingAttemptCount: z.number().optional(),
      processingLeaseExpiresAt: z.number().optional(),
      terminalAt: z.number().optional(),
      status: z.literal('pending'),
    })
    .strict(),
  z
    .object({
      id: z.string(),
      userId: z.string(),
      fileOrigin: z.enum([
        'league-picture',
        'team-picture',
        'landing-picture',
        'location-picture',
        'award-badge',
        'waiver-signature',
        'hardware-signature',
      ]),
      originalFileName: z.string(),
      originalContentType: z.string().optional(),
      originalSize: z.number().optional(),
      pendingStoragePath: z.string(),
      targetInfo: z.unknown().optional(),
      textContent: z.string().optional(),
      clientContext: z
        .object({ surface: z.string(), targetIds: z.array(z.string()).optional() })
        .strict(),
      clientMediaClaim: z
        .object({
          kind: z.enum(['image', 'video', 'audio', 'file']),
          source: z.enum(['file-picker', 'camera-capture', 'media-recorder']),
        })
        .strict()
        .optional(),
      publicationState: z
        .enum(['notStarted', 'activating', 'publishing', 'live', 'publicationFailed'])
        .optional(),
      moderationOverride: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
      processingStartedAt: z.number().optional(),
      processingAttemptCount: z.number().optional(),
      processingLeaseExpiresAt: z.number().optional(),
      terminalAt: z.number().optional(),
      status: z.literal('processing'),
    })
    .strict(),
  z
    .object({
      id: z.string(),
      userId: z.string(),
      fileOrigin: z.enum([
        'league-picture',
        'team-picture',
        'landing-picture',
        'location-picture',
        'award-badge',
        'waiver-signature',
        'hardware-signature',
      ]),
      originalFileName: z.string(),
      originalContentType: z.string().optional(),
      originalSize: z.number().optional(),
      pendingStoragePath: z.string(),
      targetInfo: z.unknown().optional(),
      textContent: z.string().optional(),
      clientContext: z
        .object({ surface: z.string(), targetIds: z.array(z.string()).optional() })
        .strict(),
      clientMediaClaim: z
        .object({
          kind: z.enum(['image', 'video', 'audio', 'file']),
          source: z.enum(['file-picker', 'camera-capture', 'media-recorder']),
        })
        .strict()
        .optional(),
      publicationState: z
        .enum(['notStarted', 'activating', 'publishing', 'live', 'publicationFailed'])
        .optional(),
      moderationOverride: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
      processingStartedAt: z.number().optional(),
      processingAttemptCount: z.number().optional(),
      processingLeaseExpiresAt: z.number().optional(),
      terminalAt: z.number(),
      status: z.literal('completed'),
      completedAt: z.number(),
      uploadTrayClearedAt: z.number().optional(),
      uploadTrayClearedBy: z.string().optional(),
      uploadTraySeenAt: z.number().optional(),
      uploadTraySeenBy: z.string().optional(),
      result: z
        .object({
          events: z.array(
            z.discriminatedUnion('type', [
              z
                .object({
                  type: z.literal('league.created'),
                  ids: z.object({ leagueId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('league.updated'),
                  ids: z.object({ leagueId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('league.modeSwitched'),
                  ids: z.object({ leagueId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueTeam.created'),
                  ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamRoster.changed'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('signedWaiver.created'),
                  ids: z.object({ leagueId: z.string(), userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('ghostPlayer.linked'),
                  ids: z
                    .object({
                      leagueId: z.string(),
                      teamId: z.string(),
                      ghostUserId: z.string(),
                      realUserId: z.string(),
                    })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamJoinRequest.submitted'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamJoinRequest.cancelled'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamJoinRequest.answered'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamInvitation.sent'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamInvitation.cancelled'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamInvitation.answered'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueFreeAgent.signedUp'),
                  ids: z.object({ leagueId: z.string(), userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueFreeAgent.removed'),
                  ids: z.object({ leagueId: z.string(), userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.finalized'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.reopened'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.statEventsRecorded'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.absenceChanged'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.memoUpdated'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.jumpBallChanged'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueSchedule.changed'),
                  ids: z.object({ leagueId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.updated'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.deleted'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('stats.recalculated'),
                  ids: z
                    .object({
                      userId: z.string().optional(),
                      leagueId: z.string().optional(),
                      sportKey: z.enum(['basketball', 'curling', 'football']).optional(),
                    })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.statsCorrected'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('statsValidation.reported'),
                  ids: z.object({ reportId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('statsValidation.reportDeleted'),
                  ids: z.object({ reportId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('historicalStats.updated'),
                  ids: z.object({ userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('user.statusChanged'),
                  ids: z.object({ userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('awardDefinition.created'),
                  ids: z.object({ awardId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('awardDefinition.updated'),
                  ids: z.object({ awardId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('awardDefinition.deleted'),
                  ids: z.object({ awardId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('awardGrants.changed'),
                  ids: z.object({ awardId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('featuredAwards.changed'),
                  ids: z.object({ userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('hardwareLoanContract.changed'),
                  ids: z.object({ contractId: z.string(), refereeUserId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('adminList.changed'),
                  ids: z.object({ userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('user.registered'),
                  ids: z.object({ userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('displayName.changed'),
                  ids: z.object({ userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({ type: z.literal('statsBeacon.changed'), ids: z.object({}).strict() })
                .strict(),
              z
                .object({
                  type: z.literal('waiverTemplate.created'),
                  ids: z.object({ waiverTemplateId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('waiverTemplate.updated'),
                  ids: z.object({ waiverTemplateId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('waiverTemplate.deleted'),
                  ids: z.object({ waiverTemplateId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('gameLocation.created'),
                  ids: z.object({ gameLocationId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('gameLocation.updated'),
                  ids: z.object({ gameLocationId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('gameLocation.deleted'),
                  ids: z.object({ gameLocationId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueTeam.updated'),
                  ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueTeam.deleted'),
                  ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueTeam.deletionAdvanced'),
                  ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('ghostPlayer.finishedEntriesRemoved'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), ghostUserId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueTeamContact.updated'),
                  ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({ type: z.literal('landingPage.updated'), ids: z.object({}).strict() })
                .strict(),
              z
                .object({
                  type: z.literal('galleryPicture.added'),
                  ids: z
                    .object({
                      ownerKind: z.enum(['sportLeague', 'leagueTeam', 'landingPage']),
                      ownerId: z.string(),
                      pictureId: z.string(),
                    })
                    .strict(),
                  position: z.string(),
                  createdAt: z.number(),
                })
                .strict(),
              z
                .object({ type: z.literal('deadLetter.replayed'), ids: z.object({}).strict() })
                .strict(),
              z
                .object({ type: z.literal('migrationConsole.changed'), ids: z.object({}).strict() })
                .strict(),
            ]),
          ),
          affected: z
            .array(
              z
                .object({
                  collection: z.string(),
                  docId: z.string(),
                  operation: z.enum(['create', 'update']),
                })
                .strict(),
            )
            .optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      id: z.string(),
      userId: z.string(),
      fileOrigin: z.enum([
        'league-picture',
        'team-picture',
        'landing-picture',
        'location-picture',
        'award-badge',
        'waiver-signature',
        'hardware-signature',
      ]),
      originalFileName: z.string(),
      originalContentType: z.string().optional(),
      originalSize: z.number().optional(),
      pendingStoragePath: z.string(),
      targetInfo: z.unknown().optional(),
      textContent: z.string().optional(),
      clientContext: z
        .object({ surface: z.string(), targetIds: z.array(z.string()).optional() })
        .strict(),
      clientMediaClaim: z
        .object({
          kind: z.enum(['image', 'video', 'audio', 'file']),
          source: z.enum(['file-picker', 'camera-capture', 'media-recorder']),
        })
        .strict()
        .optional(),
      publicationState: z
        .enum(['notStarted', 'activating', 'publishing', 'live', 'publicationFailed'])
        .optional(),
      moderationOverride: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
      processingStartedAt: z.number().optional(),
      processingAttemptCount: z.number().optional(),
      processingLeaseExpiresAt: z.number().optional(),
      terminalAt: z.number(),
      status: z.literal('failed'),
      failedAt: z.number(),
      uploadTrayClearedAt: z.number().optional(),
      uploadTrayClearedBy: z.string().optional(),
      uploadTraySeenAt: z.number().optional(),
      uploadTraySeenBy: z.string().optional(),
      errorCategory: z.enum([
        'system',
        'rate_limit',
        'validation',
        'kind_mismatch',
        'storage',
        'moderation',
      ]),
      errorMessage: z.string(),
    })
    .strict(),
  z
    .object({
      id: z.string(),
      userId: z.string(),
      fileOrigin: z.enum([
        'league-picture',
        'team-picture',
        'landing-picture',
        'location-picture',
        'award-badge',
        'waiver-signature',
        'hardware-signature',
      ]),
      originalFileName: z.string(),
      originalContentType: z.string().optional(),
      originalSize: z.number().optional(),
      pendingStoragePath: z.string(),
      targetInfo: z.unknown().optional(),
      textContent: z.string().optional(),
      clientContext: z
        .object({ surface: z.string(), targetIds: z.array(z.string()).optional() })
        .strict(),
      clientMediaClaim: z
        .object({
          kind: z.enum(['image', 'video', 'audio', 'file']),
          source: z.enum(['file-picker', 'camera-capture', 'media-recorder']),
        })
        .strict()
        .optional(),
      publicationState: z
        .enum(['notStarted', 'activating', 'publishing', 'live', 'publicationFailed'])
        .optional(),
      moderationOverride: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
      processingStartedAt: z.number().optional(),
      processingAttemptCount: z.number().optional(),
      processingLeaseExpiresAt: z.number().optional(),
      terminalAt: z.number(),
      status: z.literal('rejected'),
      rejectedAt: z.number(),
      uploadTrayClearedAt: z.number().optional(),
      uploadTrayClearedBy: z.string().optional(),
      uploadTraySeenAt: z.number().optional(),
      uploadTraySeenBy: z.string().optional(),
      rejectionType: z.enum(['text', 'media']),
      errorMessage: z.string(),
      violationId: z.string().optional(),
      result: z
        .object({
          events: z.array(
            z.discriminatedUnion('type', [
              z
                .object({
                  type: z.literal('league.created'),
                  ids: z.object({ leagueId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('league.updated'),
                  ids: z.object({ leagueId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('league.modeSwitched'),
                  ids: z.object({ leagueId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueTeam.created'),
                  ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamRoster.changed'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('signedWaiver.created'),
                  ids: z.object({ leagueId: z.string(), userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('ghostPlayer.linked'),
                  ids: z
                    .object({
                      leagueId: z.string(),
                      teamId: z.string(),
                      ghostUserId: z.string(),
                      realUserId: z.string(),
                    })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamJoinRequest.submitted'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamJoinRequest.cancelled'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamJoinRequest.answered'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamInvitation.sent'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamInvitation.cancelled'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('teamInvitation.answered'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), userId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueFreeAgent.signedUp'),
                  ids: z.object({ leagueId: z.string(), userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueFreeAgent.removed'),
                  ids: z.object({ leagueId: z.string(), userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.finalized'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.reopened'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.statEventsRecorded'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.absenceChanged'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.memoUpdated'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.jumpBallChanged'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueSchedule.changed'),
                  ids: z.object({ leagueId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.updated'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.deleted'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('stats.recalculated'),
                  ids: z
                    .object({
                      userId: z.string().optional(),
                      leagueId: z.string().optional(),
                      sportKey: z.enum(['basketball', 'curling', 'football']).optional(),
                    })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('sportGame.statsCorrected'),
                  ids: z.object({ leagueId: z.string(), gameId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('statsValidation.reported'),
                  ids: z.object({ reportId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('statsValidation.reportDeleted'),
                  ids: z.object({ reportId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('historicalStats.updated'),
                  ids: z.object({ userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('user.statusChanged'),
                  ids: z.object({ userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('awardDefinition.created'),
                  ids: z.object({ awardId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('awardDefinition.updated'),
                  ids: z.object({ awardId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('awardDefinition.deleted'),
                  ids: z.object({ awardId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('awardGrants.changed'),
                  ids: z.object({ awardId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('featuredAwards.changed'),
                  ids: z.object({ userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('hardwareLoanContract.changed'),
                  ids: z.object({ contractId: z.string(), refereeUserId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('adminList.changed'),
                  ids: z.object({ userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('user.registered'),
                  ids: z.object({ userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('displayName.changed'),
                  ids: z.object({ userId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({ type: z.literal('statsBeacon.changed'), ids: z.object({}).strict() })
                .strict(),
              z
                .object({
                  type: z.literal('waiverTemplate.created'),
                  ids: z.object({ waiverTemplateId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('waiverTemplate.updated'),
                  ids: z.object({ waiverTemplateId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('waiverTemplate.deleted'),
                  ids: z.object({ waiverTemplateId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('gameLocation.created'),
                  ids: z.object({ gameLocationId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('gameLocation.updated'),
                  ids: z.object({ gameLocationId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('gameLocation.deleted'),
                  ids: z.object({ gameLocationId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueTeam.updated'),
                  ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueTeam.deleted'),
                  ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueTeam.deletionAdvanced'),
                  ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('ghostPlayer.finishedEntriesRemoved'),
                  ids: z
                    .object({ leagueId: z.string(), teamId: z.string(), ghostUserId: z.string() })
                    .strict(),
                })
                .strict(),
              z
                .object({
                  type: z.literal('leagueTeamContact.updated'),
                  ids: z.object({ leagueId: z.string(), teamId: z.string() }).strict(),
                })
                .strict(),
              z
                .object({ type: z.literal('landingPage.updated'), ids: z.object({}).strict() })
                .strict(),
              z
                .object({
                  type: z.literal('galleryPicture.added'),
                  ids: z
                    .object({
                      ownerKind: z.enum(['sportLeague', 'leagueTeam', 'landingPage']),
                      ownerId: z.string(),
                      pictureId: z.string(),
                    })
                    .strict(),
                  position: z.string(),
                  createdAt: z.number(),
                })
                .strict(),
              z
                .object({ type: z.literal('deadLetter.replayed'), ids: z.object({}).strict() })
                .strict(),
              z
                .object({ type: z.literal('migrationConsole.changed'), ids: z.object({}).strict() })
                .strict(),
            ]),
          ),
          affected: z
            .array(
              z
                .object({
                  collection: z.string(),
                  docId: z.string(),
                  operation: z.enum(['create', 'update']),
                })
                .strict(),
            )
            .optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
]);

export const SportGameSchema = z.discriminatedUnion('leagueType', [
  z.object({
    leagueId: z.string(),
    weekId: z.string(),
    weekTitle: z.string(),
    weekLocation: z.string(),
    weekStartDate: z.number(),
    startTime: z.number(),
    dayKey: z.string(),
    locationLabel: z.string(),
    gameLocationId: z.string().optional(),
    subLocation: z.string().optional(),
    status: z.enum(['scheduled', 'inprogress', 'completed']),
    teams: z.tuple([z.object({ teamId: z.string() }), z.object({ teamId: z.string() })]),
    teamIds: z.array(z.string()),
    score: z.record(z.string(), z.number()),
    statEventSequence: z.number(),
    memos: z.record(z.string(), z.string()).optional(),
    absentRosterPlayerIds: z.array(z.string()),
    nonScoringRosterPlayerIds: z.array(z.string()).optional(),
    statsOperationId: z.string().optional(),
    finalizedAt: z.number().optional(),
    reopenedAt: z.number().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    leagueType: z.literal('Basketball'),
    stats: z
      .object({
        teamStats: z.record(
          z.string(),
          z.object({ score: z.number(), timeouts: z.number() }).strict(),
        ),
        playerStats: z.record(
          z.string(),
          z
            .object({
              points: z.number(),
              rebounds: z.number(),
              assists: z.number(),
              fantasyPoints: z.number(),
            })
            .strict(),
        ),
      })
      .strict(),
    jumpBallTeamId: z.string().optional(),
  }),
  z.object({
    leagueId: z.string(),
    weekId: z.string(),
    weekTitle: z.string(),
    weekLocation: z.string(),
    weekStartDate: z.number(),
    startTime: z.number(),
    dayKey: z.string(),
    locationLabel: z.string(),
    gameLocationId: z.string().optional(),
    subLocation: z.string().optional(),
    status: z.enum(['scheduled', 'inprogress', 'completed']),
    teams: z.tuple([z.object({ teamId: z.string() }), z.object({ teamId: z.string() })]),
    teamIds: z.array(z.string()),
    score: z.record(z.string(), z.number()),
    statEventSequence: z.number(),
    memos: z.record(z.string(), z.string()).optional(),
    absentRosterPlayerIds: z.array(z.string()),
    nonScoringRosterPlayerIds: z.array(z.string()).optional(),
    statsOperationId: z.string().optional(),
    finalizedAt: z.number().optional(),
    reopenedAt: z.number().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    leagueType: z.literal('Curling'),
    stats: z
      .object({
        teamStats: z.record(
          z.string(),
          z.object({ score: z.number(), roundScores: z.array(z.number().nullable()) }).strict(),
        ),
        playerStats: z.record(z.string(), z.never()),
      })
      .strict(),
  }),
  z.object({
    leagueId: z.string(),
    weekId: z.string(),
    weekTitle: z.string(),
    weekLocation: z.string(),
    weekStartDate: z.number(),
    startTime: z.number(),
    dayKey: z.string(),
    locationLabel: z.string(),
    gameLocationId: z.string().optional(),
    subLocation: z.string().optional(),
    status: z.enum(['scheduled', 'inprogress', 'completed']),
    teams: z.tuple([z.object({ teamId: z.string() }), z.object({ teamId: z.string() })]),
    teamIds: z.array(z.string()),
    score: z.record(z.string(), z.number()),
    statEventSequence: z.number(),
    memos: z.record(z.string(), z.string()).optional(),
    absentRosterPlayerIds: z.array(z.string()),
    nonScoringRosterPlayerIds: z.array(z.string()).optional(),
    statsOperationId: z.string().optional(),
    finalizedAt: z.number().optional(),
    reopenedAt: z.number().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    leagueType: z.literal('Football'),
    stats: z
      .object({
        teamStats: z.record(z.string(), z.object({ score: z.number() }).strict()),
        playerStats: z.record(z.string(), z.never()),
      })
      .strict(),
  }),
]);

export const AppConfigSchema = z.object({
  appVersion: z.string(),
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().optional(),
  registrationEnabled: z.boolean(),
  announcementMessage: z.string().optional(),
});

export const UserProfileSchema = z.object({
  displayName: z.string(),
  displayName_lowercase: z.string(),
  userStatus: z.enum(['active', 'banned']),
  lifetimeStats: z
    .object({
      basketball: z
        .object({
          points: z.number(),
          rebounds: z.number(),
          assists: z.number(),
          fantasyPoints: z.number(),
          gamesPlayed: z.number(),
        })
        .strict()
        .optional(),
      curling: z.object({ gamesPlayed: z.number() }).strict().optional(),
      football: z.object({ gamesPlayed: z.number() }).strict().optional(),
    })
    .strict()
    .optional(),
  grantedAwards: z.array(z.object({ awardId: z.string(), grantedAt: z.number() })).optional(),
  primaryAwardId: z.string().optional(),
  secondaryAwardId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const UserPrivateDataSchema = z.object({
  email: z.string(),
  registrationStartedAt: z.number().optional(),
  defaultContactPhone: z
    .string()
    .transform((value) => value)
    .optional(),
  theme: z.enum(['light', 'dark', 'high-contrast']).optional(),
  reducedMotion: z.boolean().optional(),
  updatedAt: z.number(),
});

export const RulesPageSchema = z.object({
  rulesText: z.string(),
  version: z.number(),
  lastUpdated: z.number(),
});

export const COLLECTION_SCHEMAS = Object.freeze({
  'userProfiles/{userId}': UserProfileSchema,
  'userProfiles/{userId}/privateData/{privateDataId}': UserPrivateDataSchema,
  'userProfiles/{userId}/historicalStats/{sportKey}': z
    .object({
      points: z.number(),
      rebounds: z.number(),
      assists: z.number(),
      gamesPlayed: z.number(),
    })
    .strict(),
  'publicUsers/{userId}': PublicUserSchema,
  'reservedDisplayNames/{reservedDisplayNameKey}': z.object({
    userId: z.string(),
    displayName: z.string(),
    reservedAt: z.number(),
  }),
  'statusReconcileQueue/{userId}': z.discriminatedUnion('authEffect', [
    z
      .object({
        enqueuedAt: z.number(),
        lastAttemptAt: z.number().optional(),
        attemptCount: z.number(),
        authEffect: z.literal('accountStatus'),
        reason: z.literal('statusChangePending'),
        targetStatus: z.enum(['active', 'banned']),
        writeId: z.string(),
      })
      .strict(),
    z
      .object({
        enqueuedAt: z.number(),
        lastAttemptAt: z.number().optional(),
        attemptCount: z.number(),
        authEffect: z.literal('roleClaims'),
        reason: z.literal('postCommitAuthEffectFailed'),
      })
      .strict(),
  ]),
  'registrationStarts/{userId}': z
    .object({ userId: z.string(), startedAt: z.number(), expireAt: z.custom() })
    .strict(),
  'sportLeagues/{leagueId}': z.object({
    leagueTitle: z.string(),
    description: z.string(),
    leagueType: z.enum(['Basketball', 'Curling', 'Football']),
    leagueMode: z.enum(['Regular', 'Competitive/Recreational']),
    leagueStartDate: z.string(),
    leagueEndDate: z.string(),
    status: z.enum(['pending', 'upcoming', 'active', 'closed']),
    playoffCutoff: z.number(),
    playoffCutoffComp: z.number(),
    playoffCutoffRec: z.number(),
    requiresWaiver: z.boolean(),
    waiverTemplateId: z.string().optional(),
    pictures: z
      .object({
        count: z.number(),
        featuredPictureId: z.string().optional(),
        updatedAt: z.number(),
      })
      .optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
  'leagueTeams/{teamId}': z.object({
    name: z.string(),
    icon: z.enum([
      'Shield',
      'Swords',
      'Skull',
      'Ghost',
      'Cat',
      'Dog',
      'Bird',
      'Fish',
      'Rabbit',
      'Snail',
      'Turtle',
      'Cherry',
      'Apple',
      'Grape',
      'Rocket',
      'Plane',
      'Ship',
      'Train',
      'Car',
      'Bike',
      'Bolt',
      'Star',
      'Sun',
      'Moon',
      'Cloud',
      'Crown',
      'Diamond',
      'Gem',
      'Anchor',
      'TreePine',
      'Trees',
      'TreeDeciduous',
      'TreePalm',
      'Snowflake',
      'MountainSnow',
      'Gift',
      'PartyPopper',
      'CandyCane',
      'Candy',
      'Lollipop',
      'Cake',
      'Egg',
      'Clover',
      'Heart',
      'Flower',
      'Flower2',
      'Rose',
      'Leaf',
      'Sprout',
      'Wheat',
      'Sunrise',
      'Rainbow',
      'Bell',
      'Trophy',
      'Medal',
      'Award',
      'Ribbon',
      'Flag',
      'Target',
      'Crosshair',
      'Goal',
      'Dumbbell',
      'Footprints',
      'Zap',
      'Flame',
      'FlameKindling',
      'Bomb',
      'Atom',
      'Orbit',
      'Sparkles',
      'WandSparkles',
      'Mountain',
      'Tornado',
      'Wind',
      'Droplet',
      'CloudLightning',
      'MoonStar',
      'Sword',
      'Axe',
      'Hammer',
      'Pickaxe',
      'ShieldHalf',
      'Castle',
      'Squirrel',
      'Rat',
      'Panda',
      'Shrimp',
      'Worm',
      'Bug',
      'Shell',
      'PawPrint',
      'Feather',
      'Bone',
      'Origami',
      'Citrus',
      'Banana',
      'Carrot',
      'Pizza',
      'Cookie',
      'Donut',
      'Coffee',
      'Dices',
      'Puzzle',
      'Gamepad2',
      'Spade',
      'Club',
      'Music',
      'Guitar',
      'Hexagon',
      'Triangle',
      'Sailboat',
      'Tractor',
      'Truck',
    ]),
    leagueId: z.string(),
    teamType: z.enum(['Competitive', 'Recreational']).optional(),
    createdByUserId: z.string(),
    seasonStats: z
      .union([
        z
          .object({
            gamesPlayed: z.number(),
            wins: z.number(),
            losses: z.number(),
            ties: z.number(),
            pointsFor: z.number(),
            pointsAgainst: z.number(),
            rebounds: z.number(),
            assists: z.number(),
          })
          .strict(),
        z
          .object({
            gamesPlayed: z.number(),
            wins: z.number(),
            losses: z.number(),
            ties: z.number(),
            pointsFor: z.number(),
            pointsAgainst: z.number(),
          })
          .strict(),
        z
          .object({
            gamesPlayed: z.number(),
            wins: z.number(),
            losses: z.number(),
            ties: z.number(),
            pointsFor: z.number(),
            pointsAgainst: z.number(),
          })
          .strict(),
      ])
      .optional(),
    playerSeasonStats: z
      .record(
        z.string(),
        z.union([
          z
            .object({
              points: z.number(),
              rebounds: z.number(),
              assists: z.number(),
              fantasyPoints: z.number(),
              gamesPlayed: z.number(),
            })
            .strict(),
          z.object({ gamesPlayed: z.number() }).strict(),
          z.object({ gamesPlayed: z.number() }).strict(),
        ]),
      )
      .optional(),
    pictures: z
      .object({
        count: z.number(),
        featuredPictureId: z.string().optional(),
        updatedAt: z.number(),
      })
      .optional(),
    membershipRevision: z.number().optional(),
    joinRevision: z.number().optional(),
    scheduleRevision: z.number().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
  'leagueTeamContacts/{teamId}': z.object({
    leagueId: z.string(),
    contactPhone: z.string().transform((value) => value),
    updatedAt: z.number(),
  }),
  'teamMemberships/{teamMembershipId}': z.object({
    leagueId: z.string(),
    teamId: z.string(),
    userId: z.string(),
    role: z.enum(['captain', 'coCaptain', 'player']),
    status: z.enum(['active']),
    isGhost: z.boolean(),
    joinedVia: z
      .enum(['teamCreation', 'invite', 'joinRequest', 'freeAgent', 'ghostAdd'])
      .optional(),
    teamInvitationId: z.string().optional(),
    linkedFromGhostUserId: z.string().optional(),
    joinedAt: z.number(),
    updatedAt: z.number(),
  }),
  'membershipRosterSyncs/{teamMembershipId}': z.object({
    leagueId: z.string(),
    teamId: z.string(),
    userId: z.string(),
    rosterRevision: z.number(),
    reconciledRosterRevision: z.number(),
    syncStatus: z.enum(['pending', 'reconciled', 'failed']),
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    cursor: z.object({ rosterRevision: z.number(), afterGameId: z.string() }).strict().optional(),
    failedAt: z.number().optional(),
    lastFailureMessage: z.string().optional(),
    updatedAt: z.number(),
  }),
  'teamInvitations/{inviteId}': z.object({
    leagueId: z.string(),
    teamId: z.string(),
    invitedUserId: z.string(),
    invitedByUserId: z.string(),
    message: z.string(),
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
    createdAt: z.number(),
    respondedAt: z.number().optional(),
  }),
  'teamJoinRequests/{requestId}': z.object({
    leagueId: z.string(),
    teamId: z.string(),
    userId: z.string(),
    message: z.string(),
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
    createdAt: z.number(),
  }),
  'leagueFreeAgents/{leagueFreeAgentId}': LeagueFreeAgentSchema,
  'sportGames/{gameId}': SportGameSchema,
  'sportGames/{gameId}/gameRosterPlayers/{gameRosterPlayerId}': GameRosterPlayerSchema,
  'sportGames/{gameId}/gameStatEvents/{eventId}': z.discriminatedUnion('type', [
    z
      .object({
        eventId: z.string(),
        sequence: z.number(),
        recordedAt: z.number(),
        acceptedAt: z.number().optional(),
        recordedByUserId: z.string().optional(),
        recordedByAuthority: z.enum(['admin', 'referee', 'captain', 'coCaptain']).optional(),
        recordedByTeamId: z.string().optional(),
        teamId: z.string(),
        playerUserId: z.string(),
        displayNameSnapshot: z.string().optional(),
        type: z.literal('1PT'),
      })
      .strict(),
    z
      .object({
        eventId: z.string(),
        sequence: z.number(),
        recordedAt: z.number(),
        acceptedAt: z.number().optional(),
        recordedByUserId: z.string().optional(),
        recordedByAuthority: z.enum(['admin', 'referee', 'captain', 'coCaptain']).optional(),
        recordedByTeamId: z.string().optional(),
        teamId: z.string(),
        playerUserId: z.string(),
        displayNameSnapshot: z.string().optional(),
        type: z.enum(['2PT', '3PT']),
        assistedByUserId: z.string().optional(),
        assistedByDisplayNameSnapshot: z.string().optional(),
      })
      .strict(),
    z
      .object({
        eventId: z.string(),
        sequence: z.number(),
        recordedAt: z.number(),
        acceptedAt: z.number().optional(),
        recordedByUserId: z.string().optional(),
        recordedByAuthority: z.enum(['admin', 'referee', 'captain', 'coCaptain']).optional(),
        recordedByTeamId: z.string().optional(),
        teamId: z.string(),
        playerUserId: z.string(),
        displayNameSnapshot: z.string().optional(),
        type: z.enum(['REBOUND', 'ASSIST']),
      })
      .strict(),
    z
      .object({
        eventId: z.string(),
        sequence: z.number(),
        recordedAt: z.number(),
        acceptedAt: z.number().optional(),
        recordedByUserId: z.string().optional(),
        recordedByAuthority: z.enum(['admin', 'referee', 'captain', 'coCaptain']).optional(),
        recordedByTeamId: z.string().optional(),
        teamId: z.string(),
        type: z.literal('TIMEOUT'),
      })
      .strict(),
    z
      .object({
        eventId: z.string(),
        sequence: z.number(),
        recordedAt: z.number(),
        acceptedAt: z.number().optional(),
        recordedByUserId: z.string().optional(),
        recordedByAuthority: z.enum(['admin', 'referee', 'captain', 'coCaptain']).optional(),
        recordedByTeamId: z.string().optional(),
        teamId: z.string(),
        playerUserId: z.string(),
        displayNameSnapshot: z.string().optional(),
        type: z.literal('BULK_EDIT'),
        stat: z.enum(['points', 'rebounds', 'assists']),
        value: z.number(),
        previousValue: z.number().optional(),
      })
      .strict(),
    z
      .object({
        eventId: z.string(),
        sequence: z.number(),
        recordedAt: z.number(),
        acceptedAt: z.number().optional(),
        recordedByUserId: z.string().optional(),
        recordedByAuthority: z.enum(['admin', 'referee', 'captain', 'coCaptain']).optional(),
        recordedByTeamId: z.string().optional(),
        type: z.literal('CURLING_ROUND_SCORE'),
        teamId: z.string(),
        roundNumber: z.number(),
        points: z.number(),
      })
      .strict(),
    z
      .object({
        eventId: z.string(),
        sequence: z.number(),
        recordedAt: z.number(),
        acceptedAt: z.number().optional(),
        recordedByUserId: z.string().optional(),
        recordedByAuthority: z.enum(['admin', 'referee', 'captain', 'coCaptain']).optional(),
        recordedByTeamId: z.string().optional(),
        type: z.literal('CURLING_ROUND_BLANK'),
        roundNumber: z.number(),
      })
      .strict(),
    z
      .object({
        eventId: z.string(),
        sequence: z.number(),
        recordedAt: z.number(),
        acceptedAt: z.number().optional(),
        recordedByUserId: z.string().optional(),
        recordedByAuthority: z.enum(['admin', 'referee', 'captain', 'coCaptain']).optional(),
        recordedByTeamId: z.string().optional(),
        type: z.enum(['FOOTBALL_6PT', 'FOOTBALL_2PT', 'FOOTBALL_1PT']),
        teamId: z.string(),
      })
      .strict(),
    z
      .object({
        eventId: z.string(),
        sequence: z.number(),
        recordedAt: z.number(),
        acceptedAt: z.number().optional(),
        recordedByUserId: z.string().optional(),
        recordedByAuthority: z.enum(['admin', 'referee', 'captain', 'coCaptain']).optional(),
        recordedByTeamId: z.string().optional(),
        type: z.literal('FOOTBALL_BULK_EDIT'),
        teamId: z.string(),
        value: z.number(),
        previousValue: z.number(),
      })
      .strict(),
    z
      .object({
        eventId: z.string(),
        sequence: z.number(),
        recordedAt: z.number(),
        acceptedAt: z.number().optional(),
        recordedByUserId: z.string().optional(),
        recordedByAuthority: z.enum(['admin', 'referee', 'captain', 'coCaptain']).optional(),
        recordedByTeamId: z.string().optional(),
        type: z.literal('STAT_VOID'),
        targetEventId: z.string(),
      })
      .strict(),
    z
      .object({
        eventId: z.string(),
        sequence: z.number(),
        recordedAt: z.number(),
        acceptedAt: z.number().optional(),
        recordedByUserId: z.string().optional(),
        recordedByAuthority: z.enum(['admin', 'referee', 'captain', 'coCaptain']).optional(),
        recordedByTeamId: z.string().optional(),
        type: z.literal('STAT_CORRECTION'),
        teamId: z.string(),
        playerUserId: z.string().optional(),
        stat: z.enum(['score', 'timeouts', 'points', 'rebounds', 'assists']),
        value: z.number(),
        correctionSource: z.enum(['admin', 'migration']),
        operationId: z.string(),
        reason: z.string().transform((value) => value),
        rekeyedFromGhostUserId: z.string().optional(),
      })
      .strict(),
  ]),
  'sportGames/{gameId}/gameStatHistory/{pageId}': z.union([
    z
      .object({
        events: z.array(
          z.discriminatedUnion('type', [
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                teamId: z.string(),
                playerUserId: z.string(),
                displayNameSnapshot: z.string().optional(),
                type: z.literal('1PT'),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                teamId: z.string(),
                playerUserId: z.string(),
                displayNameSnapshot: z.string().optional(),
                type: z.enum(['2PT', '3PT']),
                assistedByUserId: z.string().optional(),
                assistedByDisplayNameSnapshot: z.string().optional(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                teamId: z.string(),
                playerUserId: z.string(),
                displayNameSnapshot: z.string().optional(),
                type: z.enum(['REBOUND', 'ASSIST']),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                teamId: z.string(),
                type: z.literal('TIMEOUT'),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                teamId: z.string(),
                playerUserId: z.string(),
                displayNameSnapshot: z.string().optional(),
                type: z.literal('BULK_EDIT'),
                stat: z.enum(['points', 'rebounds', 'assists']),
                value: z.number(),
                previousValue: z.number().optional(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                type: z.literal('CURLING_ROUND_SCORE'),
                teamId: z.string(),
                roundNumber: z.number(),
                points: z.number(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                type: z.literal('CURLING_ROUND_BLANK'),
                roundNumber: z.number(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                type: z.enum(['FOOTBALL_6PT', 'FOOTBALL_2PT', 'FOOTBALL_1PT']),
                teamId: z.string(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                type: z.literal('FOOTBALL_BULK_EDIT'),
                teamId: z.string(),
                value: z.number(),
                previousValue: z.number(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                type: z.literal('STAT_VOID'),
                targetEventId: z.string(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                type: z.literal('STAT_CORRECTION'),
                teamId: z.string(),
                playerUserId: z.string().optional(),
                stat: z.enum(['score', 'timeouts', 'points', 'rebounds', 'assists']),
                value: z.number(),
                correctionSource: z.enum(['admin', 'migration']),
                operationId: z.string(),
                reason: z.string().transform((value) => value),
                rekeyedFromGhostUserId: z.string().optional(),
              })
              .strict(),
          ]),
        ),
        pageCount: z.number(),
        leagueType: z.enum(['Basketball', 'Curling', 'Football']),
        teamIds: z.array(z.string()),
        rosterPlayerIds: z.array(z.string()),
        absentRosterPlayerIds: z.array(z.string()),
        nonScoringRosterPlayerIds: z.array(z.string()),
      })
      .strict(),
    z
      .object({
        events: z.array(
          z.discriminatedUnion('type', [
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                teamId: z.string(),
                playerUserId: z.string(),
                displayNameSnapshot: z.string().optional(),
                type: z.literal('1PT'),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                teamId: z.string(),
                playerUserId: z.string(),
                displayNameSnapshot: z.string().optional(),
                type: z.enum(['2PT', '3PT']),
                assistedByUserId: z.string().optional(),
                assistedByDisplayNameSnapshot: z.string().optional(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                teamId: z.string(),
                playerUserId: z.string(),
                displayNameSnapshot: z.string().optional(),
                type: z.enum(['REBOUND', 'ASSIST']),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                teamId: z.string(),
                type: z.literal('TIMEOUT'),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                teamId: z.string(),
                playerUserId: z.string(),
                displayNameSnapshot: z.string().optional(),
                type: z.literal('BULK_EDIT'),
                stat: z.enum(['points', 'rebounds', 'assists']),
                value: z.number(),
                previousValue: z.number().optional(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                type: z.literal('CURLING_ROUND_SCORE'),
                teamId: z.string(),
                roundNumber: z.number(),
                points: z.number(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                type: z.literal('CURLING_ROUND_BLANK'),
                roundNumber: z.number(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                type: z.enum(['FOOTBALL_6PT', 'FOOTBALL_2PT', 'FOOTBALL_1PT']),
                teamId: z.string(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                type: z.literal('FOOTBALL_BULK_EDIT'),
                teamId: z.string(),
                value: z.number(),
                previousValue: z.number(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                type: z.literal('STAT_VOID'),
                targetEventId: z.string(),
              })
              .strict(),
            z
              .object({
                eventId: z.string(),
                sequence: z.number(),
                recordedAt: z.number(),
                acceptedAt: z.number().optional(),
                recordedByUserId: z.string().optional(),
                recordedByAuthority: z
                  .enum(['admin', 'referee', 'captain', 'coCaptain'])
                  .optional(),
                recordedByTeamId: z.string().optional(),
                type: z.literal('STAT_CORRECTION'),
                teamId: z.string(),
                playerUserId: z.string().optional(),
                stat: z.enum(['score', 'timeouts', 'points', 'rebounds', 'assists']),
                value: z.number(),
                correctionSource: z.enum(['admin', 'migration']),
                operationId: z.string(),
                reason: z.string().transform((value) => value),
                rekeyedFromGhostUserId: z.string().optional(),
              })
              .strict(),
          ]),
        ),
      })
      .strict(),
  ]),
  'gameLocations/{gameLocationId}': z.object({
    name: z.string(),
    streetAddress: z.string(),
    subLocations: z.array(z.string()),
    memo: z.string().optional(),
    pictureId: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
  'waiverTemplates/{waiverTemplateId}': z.object({
    title: z.string(),
    waiverText: z.string(),
    version: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    retiredAt: z.number().optional(),
    lastChosenAt: z.number().optional(),
  }),
  'waiverTemplates/{waiverTemplateId}/waiverTemplateVersions/{versionId}': z.object({
    version: z.number(),
    title: z.string(),
    waiverText: z.string(),
    publishedByUserId: z.string().optional(),
    publishedAt: z.number(),
  }),
  'signedWaivers/{signedWaiverId}': z.object({
    leagueId: z.string(),
    userId: z.string(),
    waiverTemplateId: z.string(),
    waiverTemplateVersion: z.number().optional(),
    waiverTitleSnapshot: z.string(),
    waiverTextSnapshot: z.string(),
    signatureFile: z.object({ bucket: z.string(), path: z.string() }).strict(),
    signedAt: z.number(),
    teamId: z.string().optional(),
    witnessUserId: z.string().optional(),
    witnessAuthority: z.enum(['captain', 'coCaptain', 'admin', 'referee']).optional(),
    subjectDisplayNameSnapshot: z.string().optional(),
  }),
  'hardwareLoanContracts/{contractId}': z
    .object({
      refereeUserId: z.string(),
      createdByUserId: z.string(),
      hardware: z.array(z.object({ id: z.string(), name: z.string() }).strict()),
      status: z.enum(['pending', 'loaned', 'returned']),
      signatureFile: z.object({ bucket: z.string(), path: z.string() }).strict().optional(),
      createdAt: z.number(),
      loanedAt: z.number().optional(),
      returnedAt: z.number().optional(),
    })
    .strict(),
  'awardDefinitions/{awardId}': z
    .object({
      name: z.string().transform((value) => value),
      badgePictureId: z.string().optional(),
      holderCount: z.number(),
      createdAt: z.number(),
      updatedAt: z.number(),
    })
    .strict(),
  'sportHallOfFame/{sportKey}': z.object({
    playerStats: z.record(
      z.string(),
      z.union([
        z
          .object({
            points: z.number(),
            rebounds: z.number(),
            assists: z.number(),
            fantasyPoints: z.number(),
            gamesPlayed: z.number(),
          })
          .strict(),
        z.never(),
        z.never(),
      ]),
    ),
    updatedAt: z.number(),
  }),
  'statsValidationReports/{reportId}': z
    .object({
      reportId: z.string(),
      operationId: z.string(),
      ranAt: z.number(),
      ranByUserId: z.string(),
      scope: z.object({ gameId: z.string().optional(), leagueId: z.string().optional() }).strict(),
      complete: z.boolean(),
      discrepancies: z.array(
        z
          .object({
            kind: z.enum([
              'invalidEvent',
              'eventSequenceMismatch',
              'rollupMismatch',
              'scoreMirrorMismatch',
              'unrosteredStatLine',
              'fantasyPointsStale',
              'finalRecordMissing',
              'finalRecordMismatch',
              'participationSnapshotMismatch',
              'gameHeld',
              'aggregateMismatch',
              'aggregateEntryStale',
              'aggregateEntryMissing',
              'hallOfFameLifetimeMismatch',
            ]),
            gameId: z.string().optional(),
            path: z.string(),
            key: z.string().optional(),
            field: z.string().optional(),
            expected: z
              .union([
                z.number(),
                z.string(),
                z.array(z.number().nullable()),
                z.record(z.string(), z.number()),
                z.null(),
              ])
              .optional(),
            actual: z
              .union([
                z.number(),
                z.string(),
                z.array(z.number().nullable()),
                z.record(z.string(), z.number()),
                z.null(),
              ])
              .optional(),
          })
          .strict(),
      ),
      discrepancyCounts: z.record(
        z.enum([
          'invalidEvent',
          'eventSequenceMismatch',
          'rollupMismatch',
          'scoreMirrorMismatch',
          'unrosteredStatLine',
          'fantasyPointsStale',
          'finalRecordMissing',
          'finalRecordMismatch',
          'participationSnapshotMismatch',
          'gameHeld',
          'aggregateMismatch',
          'aggregateEntryStale',
          'aggregateEntryMissing',
          'hallOfFameLifetimeMismatch',
        ]),
        z.number(),
      ),
      summary: z
        .object({
          totalGamesChecked: z.number(),
          totalUsersChecked: z.number(),
          totalTeamsChecked: z.number(),
          totalLeaguesChecked: z.number(),
          discrepanciesFound: z.number(),
        })
        .strict(),
    })
    .strict(),
  'statsOperations/{operationId}': z.discriminatedUnion('kind', [
    z
      .object({
        startedByUserId: z.string(),
        startedAt: z.number(),
        updatedAt: z.number(),
        status: z.enum(['running', 'complete', 'stopped']),
        resumeAfter: z.string().optional(),
        counts: z.object({ read: z.number(), changed: z.number(), skipped: z.number() }).strict(),
        reason: z.string().transform((value) => value),
        stoppedOnGameIds: z.array(z.string()),
        kind: z.literal('leagueStatsRebuild'),
        scope: z.object({ leagueId: z.string().optional() }).strict(),
      })
      .strict(),
    z
      .object({
        startedByUserId: z.string(),
        startedAt: z.number(),
        updatedAt: z.number(),
        status: z.enum(['running', 'complete', 'stopped']),
        resumeAfter: z.string().optional(),
        counts: z.object({ read: z.number(), changed: z.number(), skipped: z.number() }).strict(),
        reason: z.string().transform((value) => value),
        stoppedOnGameIds: z.array(z.string()),
        kind: z.literal('lifetimeStatsRebuild'),
        scope: z.object({ userId: z.string().optional() }).strict(),
      })
      .strict(),
    z
      .object({
        startedByUserId: z.string(),
        startedAt: z.number(),
        updatedAt: z.number(),
        status: z.enum(['running', 'complete', 'stopped']),
        resumeAfter: z.string().optional(),
        counts: z.object({ read: z.number(), changed: z.number(), skipped: z.number() }).strict(),
        reason: z.string().transform((value) => value),
        stoppedOnGameIds: z.array(z.string()),
        kind: z.literal('hallOfFameRebuild'),
        scope: z
          .object({
            sportKey: z.enum(['basketball', 'curling', 'football']),
            userId: z.string().optional(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        startedByUserId: z.string(),
        startedAt: z.number(),
        updatedAt: z.number(),
        status: z.enum(['running', 'complete', 'stopped']),
        resumeAfter: z.string().optional(),
        counts: z.object({ read: z.number(), changed: z.number(), skipped: z.number() }).strict(),
        kind: z.literal('statsValidation'),
        scope: z
          .object({ gameId: z.string().optional(), leagueId: z.string().optional() })
          .strict(),
        phase: z.enum(['games', 'destinations']),
      })
      .strict(),
    z
      .object({
        startedByUserId: z.string(),
        startedAt: z.number(),
        updatedAt: z.number(),
        status: z.enum(['running', 'complete', 'stopped']),
        resumeAfter: z.string().optional(),
        counts: z.object({ read: z.number(), changed: z.number(), skipped: z.number() }).strict(),
        kind: z.literal('gameStatsCorrection'),
        scope: z.object({ gameId: z.string() }).strict(),
        reason: z.string().transform((value) => value),
      })
      .strict(),
    z
      .object({
        startedByUserId: z.string(),
        startedAt: z.number(),
        updatedAt: z.number(),
        status: z.enum(['running', 'complete', 'stopped']),
        resumeAfter: z.string().optional(),
        counts: z.object({ read: z.number(), changed: z.number(), skipped: z.number() }).strict(),
        kind: z.literal('gameStatsRecalculation'),
        scope: z.object({ gameId: z.string() }).strict(),
        reason: z.string().transform((value) => value),
      })
      .strict(),
    z
      .object({
        startedByUserId: z.string(),
        startedAt: z.number(),
        updatedAt: z.number(),
        status: z.enum(['running', 'complete', 'stopped']),
        resumeAfter: z.string().optional(),
        counts: z.object({ read: z.number(), changed: z.number(), skipped: z.number() }).strict(),
        kind: z.literal('historicalStatsUpdate'),
        scope: z
          .object({ userId: z.string(), sportKey: z.enum(['basketball', 'curling', 'football']) })
          .strict(),
        reason: z.string().transform((value) => value),
      })
      .strict(),
    z
      .object({
        startedByUserId: z.string(),
        startedAt: z.number(),
        updatedAt: z.number(),
        status: z.enum(['running', 'complete', 'stopped']),
        resumeAfter: z.string().optional(),
        counts: z.object({ read: z.number(), changed: z.number(), skipped: z.number() }).strict(),
        kind: z.literal('ghostPlayerStats'),
        scope: z.discriminatedUnion('action', [
          z
            .object({
              action: z.literal('link'),
              teamId: z.string(),
              ghostUserId: z.string(),
              userId: z.string(),
            })
            .strict(),
          z
            .object({ action: z.literal('removal'), teamId: z.string(), ghostUserId: z.string() })
            .strict(),
        ]),
        reason: z
          .string()
          .transform((value) => value)
          .optional(),
        removedFinishedGameEntries: z
          .array(
            z
              .object({ gameId: z.string(), wasAbsent: z.boolean(), wasNonScoring: z.boolean() })
              .strict(),
          )
          .optional(),
        linkedGames: z
          .array(
            z.object({ gameId: z.string(), completed: z.boolean(), merged: z.boolean() }).strict(),
          )
          .optional(),
        destinationChanges: z
          .array(
            z
              .object({
                ref: z.string(),
                field: z.string(),
                before: z.record(z.string(), z.number()).nullable(),
                after: z.record(z.string(), z.number()).nullable(),
              })
              .strict(),
          )
          .optional(),
        membershipOutcome: z.enum(['handedOver', 'created', 'merged', 'kept']).optional(),
      })
      .strict(),
    z
      .object({
        startedByUserId: z.string(),
        startedAt: z.number(),
        updatedAt: z.number(),
        status: z.enum(['running', 'complete', 'stopped']),
        resumeAfter: z.string().optional(),
        counts: z.object({ read: z.number(), changed: z.number(), skipped: z.number() }).strict(),
        kind: z.literal('gameDeletion'),
        scope: z.object({ gameId: z.string() }).strict(),
      })
      .strict(),
  ]),
  'galleryPictures/{pictureId}': z.object({
    ownerKind: z.enum(['sportLeague', 'leagueTeam', 'landingPage']),
    ownerId: z.string(),
    position: z.string(),
    createdAt: z.number(),
  }),
  'pendingMedia/{pendingMediaId}': PendingMediaSchema,
  'pictureRetirements/{retirementId}': z.object({
    target: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('picture'), pictureId: z.string() }).strict(),
      z
        .object({
          kind: z.literal('gallery'),
          ownerKind: z.enum(['sportLeague', 'leagueTeam', 'landingPage']),
          ownerId: z.string(),
        })
        .strict(),
    ]),
    requestedAt: z.number(),
    reason: z.enum(['removed', 'replaced', 'superseded', 'uploadFailed', 'ownerDeleted']),
  }),
  'auditEvents/{auditEventId}': z.object({
    id: z.string(),
    type: z.enum([
      'user.accountRegistered',
      'user.displayNameChanged',
      'user.abandonedRegistrationDeleted',
      'user.accountBanned',
      'user.accountUnbanned',
      'admin.systemRoleGranted',
      'admin.systemRoleRevoked',
      'admin.systemRoleClaimSynced',
      'appConfig.updated',
      'landingPage.updated',
      'league.created',
      'league.updated',
      'league.statusChanged',
      'league.modeSwitched',
      'waiverTemplate.created',
      'waiverTemplate.versionPublished',
      'waiverTemplate.retired',
      'waiverTemplate.deleted',
      'gameLocation.created',
      'gameLocation.updated',
      'gameLocation.deleted',
      'picture.added',
      'picture.replaced',
      'picture.moved',
      'picture.featuredChanged',
      'picture.removed',
      'award.created',
      'award.badgeReplaced',
      'award.deleted',
      'award.granted',
      'award.revoked',
      'hardwareLoanContract.created',
      'hardwareLoanContract.signed',
      'hardwareLoanContract.returned',
      'hardwareLoanContract.deleted',
      'leagueTeam.created',
      'ghostPlayer.created',
      'teamRoster.syncRetried',
      'teamMembership.roleChanged',
      'leagueTeam.captainChanged',
      'leagueTeam.updated',
      'leagueTeamContact.updated',
      'teamMembership.removed',
      'ghostPlayer.removed',
      'ghostPlayer.linked',
      'ghostPlayer.closedLeagueLinked',
      'leagueTeam.deleted',
      'ghostPlayer.removalStopped',
      'teamInvitation.created',
      'teamInvitation.cancelled',
      'teamInvitation.accepted',
      'teamInvitation.rejected',
      'teamJoinRequest.created',
      'teamJoinRequest.cancelled',
      'teamJoinRequest.accepted',
      'teamJoinRequest.rejected',
      'leagueFreeAgent.created',
      'leagueFreeAgent.deleted',
      'leagueFreeAgent.assigned',
      'signedWaiver.created',
      'scheduleWeek.created',
      'scheduleWeek.updated',
      'sportGame.created',
      'sportGame.updated',
      'sportGame.deleted',
      'sportGame.statEventsRejected',
      'sportGame.absenceChanged',
      'sportGame.memoUpdated',
      'sportGame.jumpBallChanged',
      'sportGame.finalized',
      'sportGame.reopened',
      'sportGame.statsCorrected',
      'sportGame.statsRecalculated',
      'stats.aggregateRecalculated',
      'stats.historicalStatsUpdated',
      'stats.validationRun',
      'stats.validationReportDeleted',
      'stats.unrosteredStatLineResolved',
      'adminNotification.archived',
      'adminNotification.archiveAllRequested',
      'system.manualIntervention',
      'migrationAction.pageRun',
      'migrationAction.controlRecorded',
      'migrationAction.checkpointRecorded',
      'migrationConsole.cutoverRecorded',
    ]),
    schemaVersion: z.number(),
    actor: z
      .discriminatedUnion('actorMode', [
        z
          .object({
            uid: z.string().nullable(),
            isAdmin: z.boolean(),
            actorMode: z.enum(['user', 'teamManager', 'system']),
          })
          .strict(),
        z
          .object({
            uid: z.string().nullable(),
            isAdmin: z.boolean(),
            actorMode: z.enum(['adminReview', 'adminOverride']),
            systemRole: z.enum(['admin', 'referee']),
          })
          .strict(),
      ])
      .nullable(),
    target: z.object({ uid: z.string().nullable(), ref: z.string().nullable() }).nullable(),
    timestamp: z.number(),
    ip: z.string().nullable(),
    userAgent: z.string().nullable(),
    region: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),
    result: z.enum(['success', 'failure']),
    failureReason: z.string().nullable(),
    correlationId: z.string().nullable(),
  }),
  'activeAdminNotifications/{notificationId}': z.object({
    type: z.enum(['leagueTeamCreated', 'leagueFreeAgentSignedUp']),
    dedupKey: z.string(),
    category: z.literal('admin'),
    targetUserId: z.null(),
    title: z.string(),
    message: z.string(),
    count: z.number(),
    latestActorIds: z.array(z.string()),
    targetPath: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()),
    seenAt: z.number(),
    activityGeneration: z.string().optional(),
    seenAtGeneration: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
  'adminNotificationHistory/{historyId}': z.object({
    archiveOccurrenceId: z.string(),
    requestId: z.string(),
    payloadHash: z.string(),
    activeId: z.string(),
    observedActivityGeneration: z.string(),
    category: z.literal('admin'),
    audienceScope: z.literal('shared'),
    archivedSnapshot: z.object({
      type: z.enum(['leagueTeamCreated', 'leagueFreeAgentSignedUp']),
      dedupKey: z.string(),
      category: z.literal('admin'),
      targetUserId: z.null(),
      title: z.string(),
      message: z.string(),
      count: z.number(),
      latestActorIds: z.array(z.string()),
      targetPath: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()),
      seenAt: z.number(),
      activityGeneration: z.string().optional(),
      seenAtGeneration: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
    }),
    archivedAt: z.number(),
    expireAt: z.custom(),
    handledBy: z.string(),
  }),
  'notificationDeliveries/{deliveryId}': z.object({
    deliveryId: z.string(),
    state: z.enum(['queued', 'materialized', 'skipped', 'deadLetter']),
    notificationType: z.enum(['leagueTeamCreated', 'leagueFreeAgentSignedUp']),
    eventId: z.string(),
    recipientUid: z.null(),
    aggregationKey: z.string(),
    strategy: z.literal('increment'),
    payload: z.object({
      actorId: z.string().nullable(),
      metadata: z.record(z.string(), z.unknown()),
      occurrenceAt: z.number(),
    }),
    payloadVersion: z.literal(1),
    materializationClass: z.enum(['directQueued', 'realtimeFallback', 'retry']),
    createdAt: z.number(),
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    lastError: z.string().nullable(),
    materializedAt: z.number().nullable(),
    deadLetteredAt: z.number().nullable(),
    skipReason: z.enum(['recipientIneligible']).optional(),
    skippedAt: z.number().optional(),
    expireAt: z.custom().nullable().optional(),
  }),
  'notificationArchiveAllJobs/{jobId}': z.object({
    jobId: z.string(),
    userId: z.string(),
    category: z.literal('admin'),
    state: z.enum(['in-progress', 'complete', 'incomplete', 'failed']),
    revision: z.number(),
    archived: z.number(),
    error: z.string().nullable(),
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    deadLettered: z.boolean(),
    createdAt: z.number(),
    updatedAt: z.number(),
    completedAt: z.number().nullable(),
    deadLetteredAt: z.number().nullable(),
    expireAt: z.custom().optional(),
  }),
  '_appConfig/landingPage': LandingPageConfigSchema,
  '_appConfig/app': AppConfigSchema,
  '_appConfig/rulesPage': RulesPageSchema,
  '_appConfig/statsBeacon': z.object({
    updatedAt: z.number(),
    action: z.enum(['finalize', 'reopen', 'recalculate', 'correct', 'historical-update', 'link']),
    leagueId: z.string().optional(),
    gameId: z.string().optional(),
    teamIds: z.array(z.string()).optional(),
  }),
  '_systemData/adminList': z.object({ admins: z.array(z.string()), referees: z.array(z.string()) }),
  '_serverData/migrationConsole': z
    .object({
      destinationState: z.enum(['preCutover', 'live']),
      cutoverRecordedAt: z.number().optional(),
      cutoverRecordedByUserId: z.string().optional(),
      lock: z
        .object({
          actionId: z.enum([
            'copy.userProfiles',
            'copy.historicalStats',
            'derive.reservedDisplayNames',
            'migrate.publicUsers',
            'copy.adminList',
            'verify.userProfiles',
            'verify.historicalStats',
            'verify.reservedDisplayNames',
            'verify.publicUsers',
            'verify.adminList',
            'cleanup.orphanGhostPublicUsers',
            'delete.v1Users',
            'delete.v1AdminRoles',
            'verify.teamMemberships',
            'verify.gameRosterPlayers',
            'copy.leagueTeams',
            'verify.leagueTeams',
            'delete.v1Teams',
            'copy.teamMemberships',
            'delete.v1TeamMembers',
            'copy.teamInvitations',
            'verify.teamInvitations',
            'delete.v1TeamInvites',
            'copy.teamJoinRequests',
            'verify.teamJoinRequests',
            'delete.v1JoinRequests',
            'copy.leagueFreeAgents',
            'verify.leagueFreeAgents',
            'delete.v1FreeAgentSignups',
            'copy.gameRosterPlayers',
            'delete.v1GameRosters',
            'reconcile.openGameRosters',
            'verify.gameStats',
            'verify.leaguePlayerStats',
            'copy.sportGames',
            'resolve.unrosteredStatLine',
            'verify.sportGames',
            'delete.v1LeagueGames',
            'copy.signedWaivers',
            'verify.signedWaivers',
            'verify.signatureFilesResolvable',
            'revoke.v1SignatureDownloadTokens',
            'delete.v1WaiverSignatures',
            'copy.hardwareLoanContracts',
            'verify.hardwareLoanContracts',
            'delete.v1HardwareContracts',
            'copy.sportLeagues',
            'verify.sportLeagues',
            'delete.v1Leagues',
            'delete.v1LeagueChats',
            'carry.v1Pictures',
            'verify.v1Pictures',
            'copy.appConfig',
            'copy.landingPageConfig',
            'copy.statsBeacon',
            'verify.appConfig',
            'verify.landingPageConfig',
            'verify.statsBeacon',
            'delete.v1LandingBase',
            'copy.waiverTemplates',
            'verify.waiverTemplates',
            'delete.v1Waivers',
            'copy.awardDefinitions',
            'verify.awardDefinitions',
            'delete.v1AwardCatalog',
            'copy.gameLocations',
            'verify.gameLocations',
            'delete.v1GameLocations',
            'delete.v1AdminStats',
            'verify.v1CommerceDiscardable',
            'delete.v1Commerce',
            'rebuild.leagueStats',
            'rebuild.lifetimeStats',
            'rebuild.sportHallOfFame',
            'validate.stats',
            'verify.sportHallOfFame',
            'delete.v1HallOfFame',
            'delete.v1ValidationReports',
            'record.cutoverLive',
            'checkpoint.v1FirestoreExport',
            'checkpoint.paymentCredentialsRetired',
            'checkpoint.serviceAccountKeyRevoked',
            'checkpoint.unattachedPicturesReuploaded',
            'checkpoint.abandonedRegistrationSweepEnabled',
          ]),
          operationId: z.string(),
          heldByUserId: z.string(),
          expiresAt: z.number(),
        })
        .strict()
        .nullable(),
      updatedAt: z.number(),
    })
    .strict(),
  'migrationActionRuns/{actionId}': z
    .object({
      actionId: z.enum([
        'copy.userProfiles',
        'copy.historicalStats',
        'derive.reservedDisplayNames',
        'migrate.publicUsers',
        'copy.adminList',
        'verify.userProfiles',
        'verify.historicalStats',
        'verify.reservedDisplayNames',
        'verify.publicUsers',
        'verify.adminList',
        'cleanup.orphanGhostPublicUsers',
        'delete.v1Users',
        'delete.v1AdminRoles',
        'verify.teamMemberships',
        'verify.gameRosterPlayers',
        'copy.leagueTeams',
        'verify.leagueTeams',
        'delete.v1Teams',
        'copy.teamMemberships',
        'delete.v1TeamMembers',
        'copy.teamInvitations',
        'verify.teamInvitations',
        'delete.v1TeamInvites',
        'copy.teamJoinRequests',
        'verify.teamJoinRequests',
        'delete.v1JoinRequests',
        'copy.leagueFreeAgents',
        'verify.leagueFreeAgents',
        'delete.v1FreeAgentSignups',
        'copy.gameRosterPlayers',
        'delete.v1GameRosters',
        'reconcile.openGameRosters',
        'verify.gameStats',
        'verify.leaguePlayerStats',
        'copy.sportGames',
        'resolve.unrosteredStatLine',
        'verify.sportGames',
        'delete.v1LeagueGames',
        'copy.signedWaivers',
        'verify.signedWaivers',
        'verify.signatureFilesResolvable',
        'revoke.v1SignatureDownloadTokens',
        'delete.v1WaiverSignatures',
        'copy.hardwareLoanContracts',
        'verify.hardwareLoanContracts',
        'delete.v1HardwareContracts',
        'copy.sportLeagues',
        'verify.sportLeagues',
        'delete.v1Leagues',
        'delete.v1LeagueChats',
        'carry.v1Pictures',
        'verify.v1Pictures',
        'copy.appConfig',
        'copy.landingPageConfig',
        'copy.statsBeacon',
        'verify.appConfig',
        'verify.landingPageConfig',
        'verify.statsBeacon',
        'delete.v1LandingBase',
        'copy.waiverTemplates',
        'verify.waiverTemplates',
        'delete.v1Waivers',
        'copy.awardDefinitions',
        'verify.awardDefinitions',
        'delete.v1AwardCatalog',
        'copy.gameLocations',
        'verify.gameLocations',
        'delete.v1GameLocations',
        'delete.v1AdminStats',
        'verify.v1CommerceDiscardable',
        'delete.v1Commerce',
        'rebuild.leagueStats',
        'rebuild.lifetimeStats',
        'rebuild.sportHallOfFame',
        'validate.stats',
        'verify.sportHallOfFame',
        'delete.v1HallOfFame',
        'delete.v1ValidationReports',
        'record.cutoverLive',
        'checkpoint.v1FirestoreExport',
        'checkpoint.paymentCredentialsRetired',
        'checkpoint.serviceAccountKeyRevoked',
        'checkpoint.unattachedPicturesReuploaded',
        'checkpoint.abandonedRegistrationSweepEnabled',
      ]),
      run: z
        .object({
          operationId: z.string(),
          dryRun: z.boolean(),
          reason: z.string().transform((value) => value),
          startedByUserId: z.string(),
          startedAt: z.number(),
          updatedAt: z.number(),
          completedAt: z.number().optional(),
          status: z.enum(['running', 'complete', 'stopped']),
          pages: z.number(),
          nextResumeAfter: z.string().nullable(),
          counts: z
            .object({
              read: z.number(),
              written: z.number(),
              skipped: z.number(),
              checked: z.number(),
              missing: z.number(),
              mismatched: z.number(),
            })
            .strict(),
          details: z.record(z.string(), z.number()),
          findings: z.array(
            z
              .object({
                category: z.string(),
                id: z.string(),
                field: z.string(),
                reason: z.string(),
              })
              .strict(),
          ),
          findingsNotKept: z.number(),
          expectEmptySource: z.boolean(),
          acknowledgeUnexaminedSources: z.boolean().optional(),
          stoppedReason: z.string().optional(),
        })
        .strict()
        .optional(),
      preview: z
        .object({
          operationId: z.string(),
          dryRun: z.boolean(),
          reason: z.string().transform((value) => value),
          startedByUserId: z.string(),
          startedAt: z.number(),
          updatedAt: z.number(),
          completedAt: z.number().optional(),
          status: z.enum(['running', 'complete', 'stopped']),
          pages: z.number(),
          nextResumeAfter: z.string().nullable(),
          counts: z
            .object({
              read: z.number(),
              written: z.number(),
              skipped: z.number(),
              checked: z.number(),
              missing: z.number(),
              mismatched: z.number(),
            })
            .strict(),
          details: z.record(z.string(), z.number()),
          findings: z.array(
            z
              .object({
                category: z.string(),
                id: z.string(),
                field: z.string(),
                reason: z.string(),
              })
              .strict(),
          ),
          findingsNotKept: z.number(),
          expectEmptySource: z.boolean(),
          acknowledgeUnexaminedSources: z.boolean().optional(),
          stoppedReason: z.string().optional(),
        })
        .strict()
        .optional(),
      recorded: z
        .object({
          recordedAt: z.number(),
          recordedByUserId: z.string(),
          operationIds: z.array(z.string()).optional(),
          evidence: z.string().transform((value) => value),
        })
        .strict()
        .optional(),
    })
    .strict(),
  'sweepState/{sweepName}': z.object({
    fullScanLastRunAt: z.number().optional(),
    rollingCursor: z
      .discriminatedUnion('state', [
        z
          .object({
            state: z.literal('inLap'),
            afterKey: z.string(),
            afterValue: z.number().optional(),
            lapStartedAt: z.number(),
          })
          .strict(),
        z
          .object({
            state: z.literal('done'),
            lapStartedAt: z.number(),
            lapCompletedAt: z.number(),
          })
          .strict(),
      ])
      .optional(),
    deferred: z
      .array(
        z
          .object({
            key: z.string(),
            value: z.number().optional(),
            nextAttemptAt: z.number(),
            attemptCount: z.number(),
          })
          .strict(),
      )
      .optional(),
    updatedAt: z.number(),
  }),
});

export const CONFIG_PAGE_DOCUMENTS = Object.freeze({
  landingPage: Object.freeze({
    path: () => ['_appConfig', 'landingPage'],
    schema: LandingPageConfigSchema,
  }),
  rulesPage: Object.freeze({ path: () => ['_appConfig', 'rulesPage'], schema: RulesPageSchema }),
});

export const UNNAMED_SCHEMA_PAGE_DOCUMENTS = Object.freeze({
  landingPage: Object.freeze({
    path: () => ['_appConfig', 'landingPage'],
    schema: z.object({ heroTitle: z.string() }),
  }),
  rulesPage: Object.freeze({ path: () => ['_appConfig', 'rulesPage'], schema: RulesPageSchema }),
});

export const COLLECTION_DOC_ID_FIELDS = Object.freeze({
  'publicUsers/{userId}': 'uid',
  'registrationStarts/{userId}': 'userId',
  'sportGames/{gameId}/gameStatEvents/{eventId}': 'eventId',
  'statsValidationReports/{reportId}': 'reportId',
  'auditEvents/{auditEventId}': 'id',
  'pendingMedia/{pendingMediaId}': 'id',
  'adminNotificationHistory/{historyId}': 'archiveOccurrenceId',
  'notificationDeliveries/{deliveryId}': 'deliveryId',
  'notificationArchiveAllJobs/{jobId}': 'jobId',
  'migrationActionRuns/{actionId}': 'actionId',
});
