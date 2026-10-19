// GENERATED fixture core schemas — the STRUCTURE of an illustrative application's registry
// (keys, closedness, unions and their discriminants, literal members, wrappers). Test data only.

import { z } from 'zod';

export const PublishedChapterSchema = z.object({
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  content: z.string(),
  photoAssetId: z.string(),
  hidden: z.boolean(),
  hiddenBy: z.enum(['direct', 'cascade']).optional(),
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
  moderatedAt: z.number().optional(),
  edgeSyncState: z.enum(['processing', 'failed']).nullable().optional(),
  edgeSyncProcessingAt: z.number().optional(),
  edgeSyncOp: z.enum(['block', 'blockClear']).optional(),
  edgeSyncDecision: z.number().optional(),
  edgeSyncAssetIds: z.array(z.string()).optional(),
  edgeSyncError: z.string().optional(),
  edgeSyncFailedAt: z.number().optional(),
});

export const PublishedTuneTrackSchema = z.object({
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  audioAssetId: z.string(),
  photoAssetId: z.string(),
  hidden: z.boolean(),
  hiddenBy: z.enum(['direct', 'cascade']).optional(),
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
  moderatedAt: z.number().optional(),
  edgeSyncState: z.enum(['processing', 'failed']).nullable().optional(),
  edgeSyncProcessingAt: z.number().optional(),
  edgeSyncOp: z.enum(['block', 'blockClear']).optional(),
  edgeSyncDecision: z.number().optional(),
  edgeSyncAssetIds: z.array(z.string()).optional(),
  edgeSyncError: z.string().optional(),
  edgeSyncFailedAt: z.number().optional(),
});

export const PublishedTelevisionEpisodeSchema = z.object({
  uid: z.string(),
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  videoAssetId: z.string(),
  photoAssetId: z.string(),
  hidden: z.boolean(),
  hiddenBy: z.enum(['direct', 'cascade']).optional(),
  moderationClearedFields: z.array(z.string()).optional(),
  moderationClearedReason: z.string().optional(),
  moderatedAt: z.number().optional(),
  edgeSyncState: z.enum(['processing', 'failed']).nullable().optional(),
  edgeSyncProcessingAt: z.number().optional(),
  edgeSyncOp: z.enum(['block', 'blockClear']).optional(),
  edgeSyncDecision: z.number().optional(),
  edgeSyncAssetIds: z.array(z.string()).optional(),
  edgeSyncError: z.string().optional(),
  edgeSyncFailedAt: z.number().optional(),
});

export const PublicUserSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  displayName_lowercase: z.string(),
  profilePictureAssetId: z.string().nullable().optional(),
  artisanCreator: z.number().optional(),
  disabled: z.boolean(),
  anonymizedAt: z.number().optional(),
});

export const COLLECTION_SCHEMAS = Object.freeze({
  'userProfiles/{userId}': z.object({
    uid: z.string(),
    displayName: z.string(),
    displayName_lowercase: z.string(),
    profilePictureAssetId: z.string().nullable().optional(),
    artisanCreator: z.number().optional(),
    hasPledged: z.boolean().optional(),
    status: z.enum(['active', 'suspended', 'banned']).optional(),
    statusUpdatedAt: z.number().optional(),
    statusUpdatedBy: z.string().optional(),
    accountAccessVersion: z.number().optional(),
    accountAccessState: z.enum(['active', 'suspended', 'banned']).optional(),
    displayNameResetRequired: z.boolean().optional(),
    ownedWorkProjects: z
      .array(
        z.object({
          workProjectId: z.string(),
          workingTitle: z.string(),
          workingDescription: z.string(),
          type: z.string(),
          createdOn: z.number(),
          hallWingType: z.enum(['entertainment', 'educational', 'newsPolitical']),
        }),
      )
      .optional(),
    associatedWorkProjects: z
      .array(
        z.object({
          workProjectId: z.string(),
          workingTitle: z.string(),
          workingDescription: z.string(),
          type: z.string(),
          joinedOn: z.number(),
        }),
      )
      .optional(),
    createdAt: z.number(),
    anonymizedAt: z.number().optional(),
  }),
  'userProfiles/{userId}/privateData/{userId}': z.object({
    email: z.string(),
    isWaitingForNewsApproval: z.number().optional(),
    usPersonAttestedAt: z.number().optional(),
    nonUsArtisanInterest: z
      .object({ country: z.string(), region: z.string().optional(), requestedAt: z.number() })
      .optional(),
    squareStreetzAgreementsDate: z.number().optional(),
    squareStreetzAgreementsVersion: z.number().optional(),
    artisanCreatorAgreementsVersion: z.number().optional(),
    hallDownloadAcknowledgedAt: z.number().optional(),
    agreements: z
      .object({
        age: z.boolean().optional(),
        nudity: z.boolean().optional(),
        meet: z.boolean().optional(),
        cookies: z.boolean().optional(),
        terms: z.boolean().optional(),
        agreedOn: z.number().optional(),
        termsVersion: z.number().optional(),
        privacyVersion: z.number().optional(),
      })
      .optional(),
    publicDocumentAcceptance: z
      .object({
        documentVersions: z.record(
          z.enum([
            'termsOfService',
            'privacyPolicy',
            'rulesAndAgreements',
            'futurePlans',
            'dmcaPolicy',
            'takeItDownPageCopy',
          ]),
          z.number(),
        ),
        acceptedLevel: z.number(),
        legalReviewNoticeRevision: z.string().optional(),
        acceptedAt: z.number(),
      })
      .strict()
      .optional(),
    siteTour: z
      .object({
        completedVersion: z.number().optional(),
        completedAt: z.number().optional(),
        notTodayDate: z.string().optional(),
        automaticInvitesDisabledAt: z.number().optional(),
      })
      .optional(),
    statusReason: z.string().optional(),
    statusReasonAt: z.number().optional(),
    safetyLocked: z.boolean().optional(),
    craftSkillChangeMarker: z.number().optional(),
    accountType: z.enum(['teen', 'adult']),
    is18Plus: z.boolean(),
    agePolicyVersion: z.string(),
    accountCapabilityVersion: z.number(),
    ageAttestedAt: z.number(),
    adultUpgradedAt: z.number().optional(),
    ageManualCorrection: z
      .object({ at: z.number(), actorId: z.string(), reason: z.string() })
      .strict()
      .optional(),
    attestedDateOfBirth: z.string().optional(),
    attestedDobRecordedAt: z.number().optional(),
    attestedDobSource: z.enum(['artisanOnboarding']).optional(),
  }),
  'userProfiles/{userId}/privateData/hallLibraryPreferences': z.object({
    userId: z.string(),
    hiddenWorkIds: z.array(z.string()),
    inkedWorkIds: z.array(z.string()),
    inProgress: z.record(
      z.string(),
      z.object({
        itemId: z.string(),
        positionSeconds: z.number(),
        durationSeconds: z.number().optional(),
        updatedAt: z.number(),
      }),
    ),
    recentlyViewed: z.array(
      z.object({ hallItemId: z.string(), itemId: z.string().optional(), viewedAt: z.number() }),
    ),
    settings: z.object({ tunesAutoplay: z.boolean() }),
    lastUpdated: z.number(),
  }),
  'userProfiles/{userId}/profileCraftSkills/{craftSkillId}': z.discriminatedUnion('kind', [
    z.object({
      id: z.string(),
      name: z.string(),
      mediaAssetId: z.string(),
      tags: z.array(
        z.enum([
          'acting',
          'voice-over',
          'singing',
          'rapping',
          'instrumental-performance',
          'dance-choreography',
          'stand-up-sketch-comedy',
          'writing-storytelling',
          'songwriting',
          'poetry-spoken-word',
          'drawing-illustration',
          'painting',
          'animation',
          'graphic-design',
          'photography',
          'cinematography-camera',
          'video-editing',
          'visual-effects',
          'directing',
          'costume-makeup',
          'set-prop-design',
          'music-production',
          'composing-scoring',
          'sound-design',
        ]),
      ),
      createdAt: z.number(),
      type: z.enum(['image', 'video', 'audio']),
      hidden: z.boolean(),
      hiddenBy: z.enum(['direct', 'cascade']).optional(),
      attestation: z
        .object({
          statementKind: z.enum(['original', 'mimicOnTtt', 'mimicOffTtt']),
          statementVersion: z.number(),
          agreedAt: z.number(),
        })
        .strict(),
      kind: z.literal('original'),
    }),
    z.object({
      id: z.string(),
      name: z.string(),
      mediaAssetId: z.string(),
      tags: z.array(
        z.enum([
          'acting',
          'voice-over',
          'singing',
          'rapping',
          'instrumental-performance',
          'dance-choreography',
          'stand-up-sketch-comedy',
          'writing-storytelling',
          'songwriting',
          'poetry-spoken-word',
          'drawing-illustration',
          'painting',
          'animation',
          'graphic-design',
          'photography',
          'cinematography-camera',
          'video-editing',
          'visual-effects',
          'directing',
          'costume-makeup',
          'set-prop-design',
          'music-production',
          'composing-scoring',
          'sound-design',
        ]),
      ),
      createdAt: z.number(),
      type: z.enum(['image', 'video', 'audio']),
      hidden: z.boolean(),
      hiddenBy: z.enum(['direct', 'cascade']).optional(),
      attestation: z
        .object({
          statementKind: z.enum(['original', 'mimicOnTtt', 'mimicOffTtt']),
          statementVersion: z.number(),
          agreedAt: z.number(),
        })
        .strict(),
      kind: z.literal('mimicOnTtt'),
      source: z.object({ type: z.enum(['user', 'workProject']), id: z.string() }).strict(),
    }),
    z.object({
      id: z.string(),
      name: z.string(),
      mediaAssetId: z.string(),
      tags: z.array(
        z.enum([
          'acting',
          'voice-over',
          'singing',
          'rapping',
          'instrumental-performance',
          'dance-choreography',
          'stand-up-sketch-comedy',
          'writing-storytelling',
          'songwriting',
          'poetry-spoken-word',
          'drawing-illustration',
          'painting',
          'animation',
          'graphic-design',
          'photography',
          'cinematography-camera',
          'video-editing',
          'visual-effects',
          'directing',
          'costume-makeup',
          'set-prop-design',
          'music-production',
          'composing-scoring',
          'sound-design',
        ]),
      ),
      createdAt: z.number(),
      type: z.enum(['image', 'video', 'audio']),
      hidden: z.boolean(),
      hiddenBy: z.enum(['direct', 'cascade']).optional(),
      attestation: z
        .object({
          statementKind: z.enum(['original', 'mimicOnTtt', 'mimicOffTtt']),
          statementVersion: z.number(),
          agreedAt: z.number(),
        })
        .strict(),
      kind: z.literal('mimicOffTtt'),
    }),
  ]),
  'userProfiles/{userId}/auditionVotes/{auditionId}': z.object({
    votedForAuditionEntryId: z.string(),
    votedOn: z.number(),
    auditionEntryArtisanCreator: z.object({ uid: z.string() }),
  }),
  'userProfiles/{userId}/mentionHistory/{docId}': z.object({
    userId: z.string(),
    items: z.array(
      z
        .object({
          placeholder: z.string(),
          type: z.enum(['user', 'workProject', 'workRealm', 'commission', 'audition']),
          id: z.string(),
          viewedAt: z.number(),
        })
        .strict(),
    ),
  }),
  'userProfiles/{userId}/notificationHistory/{notificationId}': z.object({
    archiveOccurrenceId: z.string(),
    requestId: z.string(),
    payloadHash: z.string(),
    activeId: z.string(),
    observedActivityGeneration: z.string(),
    category: z.string(),
    audienceScope: z.string(),
    archivedSnapshot: z.object({
      type: z.string(),
      dedupKey: z.string(),
      category: z.string(),
      targetUserId: z.string().nullable(),
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
    handledBy: z.string().optional(),
  }),
  'userProfiles/{userId}/userLikes/likeHistory/squareStreetzLikes/{postId}': z.object({
    likedOn: z.number(),
  }),
  'publicUsers/{uid}': PublicUserSchema,
  'allWorkProjects/{workProjectId}': z.object({
    workProjectId: z.string(),
    createdOn: z.number(),
    type: z.string(),
    workingDescription: z.string(),
    workingTitle: z.string(),
    hallWingType: z.enum(['entertainment', 'educational', 'newsPolitical']),
    createdBy: z.object({ uid: z.string() }),
    status: z.enum(['open', 'published']),
    guildmateUserIds: z.record(z.string(), z.boolean()).optional(),
    invitedUserIds: z.record(z.string(), z.boolean()).optional(),
    workRealmId: z.string(),
    realmCanonStatus: z.enum(['canon', 'nonCanon']),
    pendingStakeShares: z
      .record(z.string(), z.object({ amount: z.number(), createdAt: z.number() }))
      .optional(),
    moderationRetitleRequired: z.boolean().optional(),
    moderationRetitleReason: z.string().optional(),
    moderationClearedFields: z.array(z.string()).optional(),
    moderationClearedReason: z.string().optional(),
    moderatedAt: z.number().optional(),
  }),
  'allWorkProjects/{workProjectId}/guildmateUsers/{uid}': z.object({
    uid: z.string(),
    guildStandings: z.array(z.custom()),
    tradeProfessions: z.array(z.string()),
    stakeShareCount: z.number(),
    joinedAt: z.number(),
    status: z.enum(['active', 'departed']),
    holderType: z.enum(['user', 'foundingWork']).optional(),
    guildAuthInputVersion: z.number().optional(),
    departedReason: z.enum(['voluntaryDeletion', 'bannedForCause', 'selfLeave']).optional(),
    departedAt: z.number().optional(),
  }),
  'allWorkProjects/{workProjectId}/publicGuildmateUsers/{uid}': z.object({
    uid: z.string(),
    tradeProfessions: z.array(z.string()),
    joinedAt: z.number(),
    status: z.enum(['active', 'departed']),
  }),
  'allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}': z.object({
    workFileFolderId: z.string(),
    workProjectId: z.string(),
    name: z.string(),
    isDefault: z.boolean(),
    canViewTradeProfessions: z.array(z.string()),
    canUploadTradeProfessions: z.array(z.string()),
    canDeleteTradeProfessions: z.array(z.string()),
    fileCount: z.number(),
    storageBytes: z.number(),
    createdBy: z.object({ uid: z.string() }),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
  'allWorkProjects/{workProjectId}/workFileFolders/{workFileFolderId}/workFiles/{workFileId}':
    z.object({
      workFileId: z.string(),
      workProjectId: z.string(),
      workFileFolderId: z.string(),
      name: z.string(),
      mediaAssetId: z.string(),
      contentType: z.string(),
      mediaKind: z.enum(['image', 'video', 'audio']),
      sizeBytes: z.number(),
      uploadedBy: z.object({ uid: z.string() }),
      createdAt: z.number(),
    }),
  'allWorkProjects/{workProjectId}/hallSubmissionReservation/reservation': z
    .object({ hallItemId: z.string(), createdAt: z.number() })
    .strict(),
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}': z.object({
    uid: z.string(),
    createdOn: z.number(),
    coverSquareAssetId: z.string().optional(),
    coverPosterAssetId: z.string().optional(),
    coverCinematicAssetId: z.string().optional(),
    workGenres: z.array(z.string()).optional(),
  }),
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}/taleChapters/{chapterId}': z.object({
    uid: z.string(),
    title: z.string(),
    content: z.string(),
    description: z.string(),
    order: z.number(),
    photoAssetId: z.string().optional(),
    status: z.enum(['unpublished', 'pending_approval', 'published']),
    createdOn: z.number(),
    moderationClearedFields: z.array(z.string()).optional(),
    moderationClearedReason: z.string().optional(),
    moderatedAt: z.number().optional(),
  }),
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}': z.object({
    uid: z.string(),
    coverSquareAssetId: z.string().optional(),
    coverPosterAssetId: z.string().optional(),
    coverCinematicAssetId: z.string().optional(),
    workGenres: z.array(z.string()),
    createdOn: z.number(),
  }),
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}/tuneTracks/{trackId}': z.object({
    uid: z.string(),
    title: z.string(),
    description: z.string().optional(),
    audioAssetId: z.string().optional(),
    mediaType: z.string().optional(),
    order: z.number(),
    photoAssetId: z.string().optional(),
    status: z.enum(['unpublished', 'pending_approval', 'published']),
    createdOn: z.number(),
    moderationClearedFields: z.array(z.string()).optional(),
    moderationClearedReason: z.string().optional(),
    moderatedAt: z.number().optional(),
  }),
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}': z.object({
    uid: z.string(),
    createdOn: z.number(),
    coverSquareAssetId: z.string().optional(),
    coverPosterAssetId: z.string().optional(),
    coverCinematicAssetId: z.string().optional(),
    workGenres: z.array(z.string()),
  }),
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}/televisionEpisodes/{episodeId}':
    z.object({
      uid: z.string(),
      title: z.string(),
      description: z.string().optional(),
      videoAssetId: z.string(),
      mediaType: z.string().optional(),
      order: z.number(),
      photoAssetId: z.string().optional(),
      status: z.enum(['unpublished', 'pending_approval', 'published']),
      createdOn: z.number(),
      moderationClearedFields: z.array(z.string()).optional(),
      moderationClearedReason: z.string().optional(),
      moderatedAt: z.number().optional(),
    }),
  'allWorkProjects/{workProjectId}/guildChatChannels/{guildChatChannelId}': z.object({
    guildChatChannelId: z.string(),
    workProjectId: z.string(),
    channelName: z.string(),
    description: z.string().optional(),
    requiredGuildStandings: z.array(z.string()),
    createdAt: z.number(),
    createdBy: z.string(),
    lastMessageAt: z.string().optional(),
    lastMessage: z.string().optional(),
    messageCount: z.number(),
    isArchived: z.boolean(),
    isDeleted: z.boolean().optional(),
    configVersion: z.number().optional(),
  }),
  'publicWorkProjects/{workProjectId}': z.object({
    workProjectId: z.string(),
    publicWorkStatus: z.enum(['draft', 'released']),
    publicWorkHidden: z.boolean(),
    publicWorkHiddenBy: z.enum(['direct', 'cascade']).optional(),
    workRealmId: z.string(),
    realmCanonStatus: z.enum(['canon', 'nonCanon']),
    type: z.enum(['Tales', 'Tunes', 'Television']),
    hallWingType: z.enum(['entertainment', 'educational', 'newsPolitical']),
    workingTitle: z.string(),
    workingTitle_lowercase: z.string(),
    workingDescription: z.string(),
    coverAssetId: z.string().optional(),
    workStewardUid: z.string(),
    foundingArtisanUid: z.string(),
    createdOn: z.number(),
    updatedOn: z.number(),
  }),
  'workRealms/{workRealmId}': z.object({
    workRealmId: z.string(),
    realmType: z.enum(['public', 'standalone']),
    realmStatus: z.enum(['draft', 'released']),
    realmHidden: z.boolean(),
    realmHiddenBy: z.enum(['direct', 'cascade']).optional(),
    workingTitle: z.string(),
    workingTitle_lowercase: z.string(),
    workingDescription: z.string(),
    realmCoverAssetId: z.string().optional(),
    workStewardUid: z.string(),
    foundingArtisanUid: z.string(),
    foundingWorkProjectId: z.string(),
    createdOn: z.number(),
    updatedOn: z.number(),
    hasEverPublishedWork: z.boolean().optional(),
    moderationRetitleRequired: z.boolean().optional(),
    moderationRetitleReason: z.string().optional(),
    moderationClearedFields: z.array(z.string()).optional(),
    moderationClearedReason: z.string().optional(),
    moderatedAt: z.number().optional(),
  }),
  'workRealms/{workRealmId}/realmFileFolders/{realmFileFolderId}': z.object({
    realmFileFolderId: z.string(),
    workRealmId: z.string(),
    name: z.string(),
    name_lowercase: z.string(),
    createdBy: z.object({ uid: z.string() }),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
  'guildInviteConversations/{guildInviteId}': z.object({
    guildInviteId: z.string(),
    workProjectId: z.string(),
    relatedUserIds: z.array(z.string()),
    workProject: z.object({ workProjectId: z.string(), type: z.string() }),
    createdBy: z.object({ uid: z.string() }),
    sender: z.object({ uid: z.string() }),
    recipient: z.object({ uid: z.string() }),
    stakeSharesOffered: z.number(),
    source: z.discriminatedUnion('type', [
      z.object({ type: z.literal('standalone') }).strict(),
      z
        .object({
          type: z.literal('craftSkill'),
          data: z
            .object({
              craftSkillId: z.string(),
              craftSkillOwnerUserId: z.string(),
              craftSkillName: z.string(),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          type: z.literal('commission'),
          data: z
            .object({
              commissionListingId: z.string(),
              commissionProposalId: z.string(),
              proposalArtisanUserId: z.string(),
              postingStakeSharesOffered: z.number(),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          type: z.literal('audition'),
          data: z
            .object({
              auditionId: z.string(),
              auditionEntryId: z.string(),
              respondentUserId: z.string(),
              postingStakeSharesOffered: z.number(),
            })
            .strict(),
        })
        .strict(),
    ]),
    status: z.enum(['pending', 'accepted', 'declined', 'cancelled', 'finalized']),
    createdAt: z.number(),
    updatedAt: z.number(),
    lastUpdatedAt: z.number(),
    finalizedAt: z.number().optional(),
    senderConfirmed: z.boolean(),
    senderConfirmedBy: z.string().optional(),
    recipientConfirmed: z.boolean(),
    conversationFileCount: z.number().optional(),
    conversationFileBytesUsed: z.number().optional(),
    conversationFileUploadCount: z.number().optional(),
    conversationFileBytesReserved: z.number().optional(),
  }),
  'guildInviteConversations/{guildInviteId}/conversationFiles/{conversationFileId}': z.object({
    conversationFileId: z.string(),
    mediaAssetId: z.string(),
    name: z.string(),
    mediaKind: z.enum(['image', 'video', 'audio']),
    contentType: z.string(),
    sizeBytes: z.number(),
    uploadedByUid: z.string(),
    createdAt: z.number(),
  }),
  'squareStreetzFeed/activePosts/socialPosts/{postId}': z.object({
    postId: z.string(),
    createdBy: z.object({ uid: z.string() }),
    authorId: z.string(),
    content: z.string(),
    mentions: z
      .array(
        z
          .object({
            placeholder: z.string(),
            type: z.enum(['user', 'workProject', 'workRealm', 'commission', 'audition']),
            id: z.string(),
          })
          .strict(),
      )
      .optional(),
    relatedIds: z.array(z.string()),
    mediaAssetId: z.string().optional(),
    mediaType: z.enum(['image', 'video', 'audio', 'other']).optional(),
    createdAt: z.number(),
    likes: z.number(),
    postType: z
      .enum([
        'PROFILE_PICTURE_UPDATE',
        'NEW_CRAFT_SKILL',
        'NEW_ARTISAN_CREATOR',
        'COMMISSION_ACCEPTED',
        'DELETE_CRAFT_SKILL',
        'USER_POST',
        'NEW_WORK_PROJECT',
        'LIBRARY_PUBLISHED',
        'NEW_AUDITION',
        'NEW_COMMISSION',
      ])
      .optional(),
    relatedAssetId: z.string().optional(),
    hidden: z.boolean(),
    hiddenBy: z.enum(['direct', 'cascade']).optional(),
  }),
  'squareStreetzFeed/trendingPosts': z.object({
    postIds: z.array(z.string()),
    lastUpdated: z.number(),
  }),
  'followEdges/{followEdgeId}': z.object({
    followerUid: z.string(),
    targetType: z.enum(['user', 'workProject', 'workRealm']),
    targetId: z.string(),
    followedOn: z.number(),
  }),
  'followCounters/{followCounterId}': z.object({
    followerCount: z.number(),
    updatedOn: z.number(),
  }),
  'squareAnnouncementJobs/{jobId}': z
    .object({
      jobId: z.string(),
      announcement: z.object({
        type: z.enum([
          'PROFILE_PICTURE_UPDATE',
          'NEW_CRAFT_SKILL',
          'NEW_ARTISAN_CREATOR',
          'COMMISSION_ACCEPTED',
          'DELETE_CRAFT_SKILL',
          'USER_POST',
          'NEW_WORK_PROJECT',
          'LIBRARY_PUBLISHED',
          'NEW_AUDITION',
          'NEW_COMMISSION',
        ]),
        payload: z.object({
          userId: z.string(),
          mentions: z
            .array(
              z
                .object({
                  placeholder: z.string(),
                  type: z.enum(['user', 'workProject', 'workRealm', 'commission', 'audition']),
                  id: z.string(),
                })
                .strict(),
            )
            .optional(),
          newMediaAssetId: z.string().optional(),
          craftSkill: z
            .object({
              id: z.string(),
              name: z.string(),
              mediaAssetId: z.string(),
              type: z.enum(['image', 'video', 'audio']),
              tags: z
                .array(
                  z.enum([
                    'acting',
                    'voice-over',
                    'singing',
                    'rapping',
                    'instrumental-performance',
                    'dance-choreography',
                    'stand-up-sketch-comedy',
                    'writing-storytelling',
                    'songwriting',
                    'poetry-spoken-word',
                    'drawing-illustration',
                    'painting',
                    'animation',
                    'graphic-design',
                    'photography',
                    'cinematography-camera',
                    'video-editing',
                    'visual-effects',
                    'directing',
                    'costume-makeup',
                    'set-prop-design',
                    'music-production',
                    'composing-scoring',
                    'sound-design',
                  ]),
                )
                .optional(),
              kind: z.enum(['original', 'mimicOnTtt', 'mimicOffTtt']).optional(),
              source: z
                .object({ type: z.enum(['user', 'workProject']), id: z.string() })
                .strict()
                .optional(),
            })
            .optional(),
          craftSkillId: z.string().optional(),
          workProjectTitle: z.string().optional(),
          workProjectId: z.string().optional(),
          workProjectType: z.enum(['Tales', 'Tunes', 'Television']).optional(),
          workProjectDescription: z.string().optional(),
          workRealmId: z.string().optional(),
          workRealmTitle: z.string().optional(),
          hallItemId: z.string().optional(),
          hallItemTitle: z.string().optional(),
          hallSubItemType: z.enum(['chapter', 'track', 'episode']).optional(),
          content: z.string().optional(),
          mediaAssetId: z.string().optional(),
          mediaType: z.enum(['image', 'video', 'audio', 'other']).optional(),
          createdAt: z.number().optional(),
          auditionId: z.string().optional(),
          commissionListingId: z.string().optional(),
          auditionAnnounceKind: z.enum(['work', 'platform', 'sponsored']).optional(),
          projectId: z.string().optional(),
          postId: z.string().optional(),
        }),
      }),
      source: z.record(z.string(), z.string()),
      status: z.enum(['pending', 'processing', 'delivered', 'dead']),
      attemptCount: z.number(),
      lastError: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
    })
    .strict(),
  'pledgePayments/{pledgePaymentId}': z.object({
    pledgePaymentId: z.string(),
    userId: z.string(),
    amount: z.number(),
    refundedAmount: z.number(),
    disputeLostAmount: z.number(),
    netAmount: z.number(),
    currency: z.string(),
    paymentInstrument: z.literal('card'),
    status: z.literal('completed'),
    refundState: z.enum(['none', 'partial', 'full']),
    disputeState: z.enum(['none', 'underReview', 'won', 'lost']),
    disputeNumber: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
  'pledgePaymentProviderRefs/{pledgePaymentId}': z.object({
    pledgePaymentId: z.string(),
    userId: z.string(),
    stripeSessionId: z.string(),
    paymentIntentId: z.string(),
    latestChargeId: z.string().nullable(),
    refundIds: z.array(z.string()),
    disputeId: z.string().nullable(),
    ageAttestedAt: z.number(),
    legalReviewNotice: z
      .object({ revision: z.string(), acknowledgedAt: z.number() })
      .strict()
      .optional(),
    refundCorrelation: z
      .object({
        requestId: z.string(),
        intendedAmount: z.number(),
        refundId: z.string().optional(),
      })
      .optional(),
    refundObservedAt: z.number().optional(),
    disputeObservedAt: z.number().optional(),
    lastRefundFailureReason: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
  'processedStripeEvents/{stripeEventId}': z.object({
    eventId: z.string(),
    eventType: z.string(),
    processedAt: z.number(),
    pledgePaymentId: z.string().nullable(),
  }),
  'pledgePaymentLedgerEvents/{ledgerId}': z.object({
    ledgerId: z.string(),
    pledgePaymentId: z.string(),
    subtype: z.string(),
    reason: z.string(),
    before: z.record(z.string(), z.unknown()).nullable(),
    after: z.record(z.string(), z.unknown()).nullable(),
    source: z.literal('firestore-trigger'),
    createdAt: z.number(),
  }),
  'paymentWebhookQuarantine/{stripeEventId}': z.object({
    eventId: z.string(),
    eventType: z.string(),
    livemode: z.boolean(),
    reason: z.string(),
    recoverable: z.boolean(),
    stripeObjectIds: z.object({
      sessionId: z.string().optional(),
      paymentIntentId: z.string().optional(),
      chargeId: z.string().optional(),
    }),
    pledgePaymentId: z.string().optional(),
    userId: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    rawSafeSummary: z.string(),
    status: z.enum(['open', 'resolved', 'ignored']),
    adminTaskId: z.string().optional(),
    createdAt: z.number(),
    resolvedAt: z.number().optional(),
    resolvedBy: z.string().optional(),
    resolutionNote: z.string().optional(),
  }),
  'pledgePaymentTotals/summary': z.object({
    netRaised: z.number(),
    grossRaised: z.number(),
    totalRefunded: z.number(),
    pledgeCount: z.number(),
    updatedAt: z.number(),
  }),
  'pledgeRefundRequests/{requestId}': z.object({
    pledgePaymentId: z.string(),
    userId: z.string(),
    amount: z.number(),
    status: z.enum(['requested', 'approving', 'initiated', 'denied', 'completed', 'failed']),
    reason: z.string().optional(),
    denialReason: z.string().optional(),
    resolvedBy: z.string().optional(),
    requestedAt: z.number(),
    resolvedAt: z.number().optional(),
    approvingAt: z.number().optional(),
    completedAt: z.number().optional(),
    failedAt: z.number().optional(),
    failureFollowUpResolvedAt: z.number().optional(),
  }),
  'thresholdItems/{thresholdItemId}': z.object({
    thresholdItemId: z.string(),
    hallItemId: z.string(),
    workProjectId: z.string(),
    workProjectType: z.enum(['Tales', 'Tunes', 'Television']),
    itemId: z.string(),
    itemsKey: z.enum(['tuneTracks', 'chapters', 'televisionEpisodes']),
    order: z.number(),
    hallWingType: z.enum(['entertainment', 'educational', 'newsPolitical']),
    submittedAt: z.number(),
    reviewStatus: z.enum(['pending', 'needs_revision', 'approved']),
    adminNotes: z.string().optional(),
    reviewedAt: z.number().optional(),
    reviewedBy: z.string().optional(),
    hasRealPeople: z.boolean(),
    attestConsistentFormat: z.literal(true),
    attestNoCredits: z.literal(true),
    attestNoBegging: z.literal(true),
    attestHumanMadeOriginal: z.literal(true),
    attestedAt: z.number(),
    legalReviewNotice: z
      .object({ revision: z.string(), acknowledgedAt: z.number() })
      .strict()
      .optional(),
    confirmedNoBegging: z.literal(true).optional(),
    confirmedNoCredits: z.literal(true).optional(),
    confirmedConsistentFormat: z.literal(true).optional(),
    confirmedRealPeopleAttestation: z.literal(true).optional(),
    publishParkedReason: z.string().optional(),
    publishParkedAt: z.number().optional(),
  }),
  'hallItems/{hallItemId}': z.object({
    hallItemId: z.string(),
    workProjectId: z.string(),
    workProjectType: z.enum(['Tales', 'Tunes', 'Television']),
    status: z.enum(['published', 'paused', 'banned']),
    createdOn: z.number(),
    publishedAt: z.number().optional(),
    hallWingType: z.enum(['entertainment', 'educational', 'newsPolitical']),
    title: z.string().optional(),
    description: z.string().optional(),
    coverSquareAssetId: z.string(),
    coverPosterAssetId: z.string(),
    coverCinematicAssetId: z.string(),
    workGenres: z.array(z.string()).optional(),
    followerCount: z.number().optional(),
    hidden: z.boolean(),
    hiddenBy: z.enum(['direct', 'cascade']).optional(),
    moderationClearedFields: z.array(z.string()).optional(),
    moderationClearedReason: z.string().optional(),
    moderatedAt: z.number().optional(),
    hasRealPeople: z.boolean().optional(),
  }),
  'hallItems/{hallItemId}/hallItemTales/{itemId}': PublishedChapterSchema,
  'hallItems/{hallItemId}/hallItemTunes/{itemId}': PublishedTuneTrackSchema,
  'hallItems/{hallItemId}/hallItemTelevision/{itemId}': PublishedTelevisionEpisodeSchema,
  'hallContentChangeRequests/{changeRequestId}': z.object({
    changeRequestId: z.string(),
    requestKind: z.literal('text'),
    targetKey: z.string(),
    hallItemId: z.string().nullable(),
    workProjectId: z.string(),
    workProjectType: z.enum(['Tales', 'Tunes', 'Television']).nullable(),
    surface: z.enum([
      'tale',
      'tune',
      'television',
      'chapter',
      'tuneTrack',
      'televisionEpisode',
      'workRealm',
    ]),
    workRealmId: z.string().nullable(),
    subItemId: z.string().nullable(),
    proposerUid: z.string(),
    proposedFields: z.record(z.string(), z.string()),
    status: z.enum(['requested', 'approved', 'denied']),
    createdAt: z.number(),
    lastUpdatedAt: z.number(),
    resolvedAt: z.number().optional(),
    resolvedBy: z.string().optional(),
    resolutionReason: z.string().optional(),
  }),
  'commissionListings/{commissionListingId}': z.object({
    commissionListingId: z.string(),
    title: z.string(),
    description: z.string(),
    commissionAttachment: z
      .object({
        pendingMediaId: z.string().optional(),
        name: z.string(),
        mediaAssetId: z.string(),
        type: z.enum(['image', 'video', 'audio']),
        size: z.number(),
      })
      .optional(),
    requiredTradeProfessions: z.array(z.string()),
    stakeSharesOffered: z.number(),
    createdAt: z.number(),
    createdBy: z.object({ uid: z.string() }),
    workProjectAssociatedWith: z.object({ workProjectId: z.string(), type: z.string() }),
    status: z.enum(['open', 'closed']),
    closedAt: z.number().optional(),
    savedProposalArtisans: z.array(z.string()),
    shortId: z.string().optional(),
    shortUrl: z.string().optional(),
    hidden: z.boolean(),
    hiddenBy: z.enum(['direct', 'cascade']).optional(),
  }),
  'commissionListings/{commissionListingId}/commissionProposals/{commissionProposalId}': z.object({
    commissionProposalId: z.string(),
    commissionListingId: z.string(),
    workProjectId: z.string(),
    proposalText: z.string(),
    proposalFileAssetId: z.string().optional(),
    proposalFileType: z.enum(['image', 'video', 'audio']).optional(),
    createdBy: z.object({ uid: z.string() }),
    createdOn: z.number(),
    status: z.enum(['open', 'invited', 'accepted', 'rejected']),
    guildInviteId: z.string().optional(),
    invitedOn: z.number().optional(),
    acceptedOn: z.number().optional(),
    rejectedAt: z.number().optional(),
    hidden: z.boolean().optional(),
    hiddenBy: z.enum(['direct', 'cascade']).optional(),
  }),
  'auditionBoard/{auditionId}': z.object({
    auditionId: z.string(),
    type: z.enum(['platformAudition', 'sponsoredAudition', 'workAudition']),
    title: z.string(),
    description: z.string(),
    videoAssetId: z.string(),
    mediaType: z.enum(['video']),
    entriesCloseAt: z.number(),
    auditionCloseAt: z.number(),
    createdOn: z.number(),
    createdBy: z.object({ uid: z.string() }),
    workProjectId: z.string().optional(),
    mode: z.enum(['open', 'curated']).optional(),
    curatedAssemblyStatus: z.enum(['assembling', 'ready', 'failed', 'closed']).optional(),
    expectedOptionCount: z.number().optional(),
    curatedFailureReason: z.string().optional(),
    sponsoredAuditionAmountUSD: z.number().optional(),
    stakeSharesOffered: z.number().optional(),
    status: z.enum(['open', 'closed', 'pendingReview']),
    closedAt: z.number().optional(),
    auditionEntryCount: z.number().optional(),
    shortId: z.string().optional(),
    shortUrl: z.string().optional(),
    hidden: z.boolean(),
    hiddenBy: z.enum(['direct', 'cascade']).optional(),
  }),
  'auditionBoard/{auditionId}/auditionEntries/{auditionEntryId}': z.object({
    auditionEntryId: z.string(),
    auditionId: z.string(),
    workProjectId: z.string().optional(),
    videoAssetId: z.string(),
    mediaType: z.enum(['video']),
    createdBy: z.object({ uid: z.string() }),
    createdAt: z.number(),
    votes: z.number(),
    shortId: z.string().optional(),
    shortUrl: z.string().optional(),
    isCreatorOption: z.boolean().optional(),
    hidden: z.boolean(),
    hiddenBy: z.enum(['direct', 'cascade']).optional(),
  }),
  'contentReports/{reportId}': z
    .object({
      schemaVersion: z.literal(1),
      reportId: z.string(),
      reporterUid: z.string(),
      reason: z.enum([
        'Spam',
        'Harassment',
        'Hate Speech',
        'Violence or Threats',
        'Sexual Content',
        'Self-Harm',
        'Impersonation',
        'Intellectual Property',
        'Child Safety Concern',
        'Nonconsensual Intimate Image (NCII)',
        'Not related to on-site entertainment',
        'Other',
      ]),
      resolvedTarget: z
        .object({
          schemaVersion: z.literal(1),
          itemType: z.enum([
            'username',
            'craft-skill',
            'commission-listing',
            'commission-proposal',
            'square-streetz-post',
            'profile-picture',
            'guild-invite-message',
            'guild-chat-message',
            'conversation-file',
            'hall-library-item',
            'hall-library-sub-item',
            'audition',
            'audition-entry',
            'work-project',
            'work-asset',
            'work-realm',
          ]),
          canonicalParentPath: z.string(),
          canonicalItemId: z.string(),
          revision: z.number(),
          ownerUid: z.string(),
          ownerBlockKey: z.string(),
          mediaAssetId: z.string().optional(),
          channelId: z.string().optional(),
          messageId: z.string().optional(),
          locator: z.discriminatedUnion('kind', [
            z.object({ kind: z.literal('mediaAsset'), mediaAssetId: z.string() }).strict(),
            z
              .object({
                kind: z.literal('hallItem'),
                hallItemId: z.string(),
                subItemId: z.string().optional(),
              })
              .strict(),
            z.object({ kind: z.literal('squarePost'), postId: z.string() }).strict(),
            z.object({ kind: z.literal('profileImage'), profileUid: z.string() }).strict(),
            z.object({ kind: z.literal('username'), profileUid: z.string() }).strict(),
            z
              .object({
                kind: z.literal('craftSkill'),
                profileUid: z.string(),
                craftSkillId: z.string(),
              })
              .strict(),
            z
              .object({ kind: z.literal('commissionListing'), commissionListingId: z.string() })
              .strict(),
            z
              .object({
                kind: z.literal('commissionProposal'),
                commissionListingId: z.string(),
                commissionProposalId: z.string(),
              })
              .strict(),
            z.object({ kind: z.literal('workProject'), workProjectId: z.string() }).strict(),
            z
              .object({
                kind: z.literal('workAsset'),
                workProjectId: z.string(),
                workAssetId: z.string(),
              })
              .strict(),
            z.object({ kind: z.literal('workRealm'), workRealmId: z.string() }).strict(),
            z.object({ kind: z.literal('audition'), auditionId: z.string() }).strict(),
            z
              .object({
                kind: z.literal('auditionEntry'),
                auditionId: z.string(),
                auditionEntryId: z.string(),
              })
              .strict(),
            z
              .object({
                kind: z.literal('guildInviteMessage'),
                channelId: z.string(),
                messageId: z.string(),
              })
              .strict(),
            z
              .object({
                kind: z.literal('conversationFile'),
                conversation: z.discriminatedUnion('kind', [
                  z.object({ kind: z.literal('guildInvite'), guildInviteId: z.string() }).strict(),
                  z
                    .object({ kind: z.literal('adminSupport'), adminDispatchId: z.string() })
                    .strict(),
                ]),
                conversationFileId: z.string(),
                mediaAssetId: z.string(),
              })
              .strict(),
            z
              .object({
                kind: z.literal('guildChatMessage'),
                channelId: z.string(),
                messageId: z.string(),
              })
              .strict(),
            z.object({ kind: z.literal('url'), url: z.string() }).strict(),
            z.object({ kind: z.literal('additionalText'), textRef: z.string() }).strict(),
          ]),
          resolvedAt: z.number(),
        })
        .strict(),
      snapshotRef: z.string(),
      canonicalTargetKey: z.string(),
      narrativeRef: z.string().optional(),
      protectedFork: z.enum(['childSafetyCase', 'nciiCase']).optional(),
      escalatedToCase: z.string().optional(),
      status: z.enum(['pending_review', 'grouped', 'actioned', 'dismissed']),
      createdAt: z.number(),
      updatedAt: z.number(),
    })
    .strict(),
  'contentReports/{reportId}/publicProjection/{reportId}': z
    .object({
      schemaVersion: z.literal(1),
      reportId: z.string(),
      itemType: z.enum([
        'username',
        'craft-skill',
        'commission-listing',
        'commission-proposal',
        'square-streetz-post',
        'profile-picture',
        'guild-invite-message',
        'guild-chat-message',
        'conversation-file',
        'hall-library-item',
        'hall-library-sub-item',
        'audition',
        'audition-entry',
        'work-project',
        'work-asset',
        'work-realm',
      ]),
      reason: z.enum([
        'Spam',
        'Harassment',
        'Hate Speech',
        'Violence or Threats',
        'Sexual Content',
        'Self-Harm',
        'Impersonation',
        'Intellectual Property',
        'Child Safety Concern',
        'Nonconsensual Intimate Image (NCII)',
        'Not related to on-site entertainment',
        'Other',
      ]),
      status: z.enum(['pending_review', 'grouped', 'actioned', 'dismissed']),
      createdAt: z.number(),
    })
    .strict(),
  'contentReports/{reportId}/privateDetails/snapshot': z
    .object({
      schemaVersion: z.literal(1),
      itemType: z.enum([
        'username',
        'craft-skill',
        'commission-listing',
        'commission-proposal',
        'square-streetz-post',
        'profile-picture',
        'guild-invite-message',
        'guild-chat-message',
        'conversation-file',
        'hall-library-item',
        'hall-library-sub-item',
        'audition',
        'audition-entry',
        'work-project',
        'work-asset',
        'work-realm',
      ]),
      canonicalItemId: z.string(),
      revision: z.number(),
      contentSummaryRef: z.string(),
      contentHashes: z.array(z.string()).optional(),
      capturedText: z.string().optional(),
      capturedMediaAssetIds: z.array(z.string()).optional(),
      capturedAt: z.number(),
    })
    .strict(),
  'contentReports/{reportId}/privateDetails/narrative': z
    .object({
      schemaVersion: z.literal(1),
      reportId: z.string(),
      reporterUid: z.string(),
      text: z.string(),
      createdAt: z.number(),
    })
    .strict(),
  'contentReports/{reportId}/privateDetails/narrativeEscalation': z
    .object({
      schemaVersion: z.literal(1),
      reportId: z.string(),
      reporterUid: z.string(),
      text: z.string(),
      createdAt: z.number(),
    })
    .strict(),
  'activeReportGroups/{groupKey}': z
    .object({
      schemaVersion: z.literal(1),
      groupKey: z.string(),
      itemType: z.enum([
        'username',
        'craft-skill',
        'commission-listing',
        'commission-proposal',
        'square-streetz-post',
        'profile-picture',
        'guild-invite-message',
        'guild-chat-message',
        'conversation-file',
        'hall-library-item',
        'hall-library-sub-item',
        'audition',
        'audition-entry',
        'work-project',
        'work-asset',
        'work-realm',
      ]),
      totalReports: z.number(),
      highestReasonScore: z.number(),
      lastReportAt: z.number(),
      latestReason: z.enum([
        'Spam',
        'Harassment',
        'Hate Speech',
        'Violence or Threats',
        'Sexual Content',
        'Self-Harm',
        'Impersonation',
        'Intellectual Property',
        'Child Safety Concern',
        'Nonconsensual Intimate Image (NCII)',
        'Not related to on-site entertainment',
        'Other',
      ]),
      status: z.enum(['pending', 'reviewing', 'processing', 'failed', 'resolved']),
      reportedItemId: z.string().optional(),
      parentItemId: z.string().nullable().optional(),
      reportedUserId: z.string().optional(),
      moderationState: z.enum(['admin_hidden', 'resolved_restored', 'resolved_removed']).optional(),
      contentHidden: z.boolean().optional(),
      moderatedAt: z.number().optional(),
      edgeSyncState: z.enum(['processing', 'failed']).nullable().optional(),
      edgeSyncProcessingAt: z.number().optional(),
      edgeSyncOp: z.enum(['block', 'blockClear']).optional(),
      edgeSyncDecision: z.number().optional(),
      edgeSyncOwnerType: z
        .enum([
          'userProfile',
          'craftSkill',
          'squareStreetzPost',
          'workProject',
          'workContent',
          'hallItem',
          'commissionListing',
          'commissionProposal',
          'audition',
          'auditionEntry',
          'conversationFile',
          'realmFile',
          'safetyEvidence',
          'systemContent',
        ])
        .optional(),
      edgeSyncOwnerId: z.string().optional(),
      edgeSyncAssetIds: z.array(z.string()).optional(),
      edgeSyncError: z.string().optional(),
      edgeSyncFailedAt: z.number().optional(),
      resolutionOutcome: z.enum(['founded', 'unfounded']).optional(),
      resolvedBy: z.string().optional(),
      resolvedAt: z.number().optional(),
      resolutionUserFacingReasonCode: z.string().optional(),
      resolutionUserFacingReasonDetail: z.string().optional(),
      resolutionAdminNote: z.string().optional(),
      tombstoneAppliedAt: z.number().optional(),
      lastError: z.string().nullable().optional(),
      failedAt: z.number().nullable().optional(),
      failedCommandDocId: z.string().optional(),
      supersededByCaseId: z.string().optional(),
      supersededAt: z.number().optional(),
      supersededPartialAt: z.number().optional(),
      pendingHoldRelease: z.boolean().optional(),
      pendingRootTerminalization: z.boolean().optional(),
    })
    .strict(),
  'activeReportGroups/{groupKey}/reportGroupCountedReports/{reportId}': z
    .object({ reportId: z.string(), countedAt: z.number() })
    .strict(),
  'adminTasks/{taskId}': z.object({
    id: z.string().optional(),
    taskType: z.enum([
      'adminDispatch',
      'thresholdLibraryReview',
      'userReport',
      'content-appeal',
      'stakeShareAnomaly',
      'pledgeLedgerAnomaly',
      'pledgePaymentRepairNeeded',
      'pledgeDisputeOpened',
      'pledgeRefundRequested',
      'pledgeRefundFailed',
      'hallContentChangeRequest',
    ]),
    taskId: z.string(),
    originalPath: z.string(),
    status: z.enum(['pending', 'checkedOut', 'workLater', 'completed']),
    checkoutDetails: z
      .object({
        userId: z.string(),
        checkedOutAt: z.number(),
        expiresAt: z.number(),
        workLaterUntil: z.number().nullable(),
      })
      .nullable(),
    summary: z.string(),
    priority: z.number(),
    createdAt: z.number(),
    lastUpdatedAt: z.number(),
    completedAt: z.number().optional(),
    itemData: z.unknown().optional(),
    violationId: z.string().optional(),
    userId: z.string().optional(),
    fileType: z.string().optional(),
    rejectionReason: z.string().optional(),
    appealMessage: z.string().optional(),
    rejectedFilePath: z.string().optional(),
    foundingArtisanUid: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    partyKind: z.enum(['user', 'workProject']).optional(),
    workProjectId: z.string().optional(),
    hallItemId: z.string().optional(),
    reportedUserId: z.string().nullable().optional(),
    reportedItemType: z.string().nullable().optional(),
    reportedItemId: z.string().nullable().optional(),
    parentItemId: z.string().nullable().optional(),
    closureHistory: z
      .array(z.object({ completedAt: z.number().nullable(), reopenedAt: z.number() }))
      .optional(),
    supersededByCaseId: z.string().optional(),
  }),
  'contentViolations/{violationId}': z.object({
    id: z.string(),
    userId: z.string(),
    fileType: z.string(),
    violationType: z.enum(['text', 'media']).optional(),
    reason: z.string(),
    timestamp: z.number(),
    appealStatus: z.enum(['none', 'pending', 'approved', 'denied']),
    flaggedWords: z.array(z.string()).optional(),
    originalText: z.string().optional(),
    originalFileName: z.string().optional(),
    mediaKind: z.enum(['image', 'video', 'audio']).optional(),
    scores: z
      .object({ adult: z.string(), violence: z.string(), racy: z.string() })
      .nullable()
      .optional(),
    rejectedFilePath: z.string().optional(),
    pendingFile: z
      .object({
        id: z.string().optional(),
        userId: z.string().optional(),
        fileOrigin: z
          .enum([
            'profile-picture',
            'craft-skill-media',
            'squareStreetz',
            'commission-posting',
            'commission-proposal',
            'audition-prompt',
            'audition-entry',
            'admin-audition-prompt',
            'hallLibrary-cover-square',
            'hallLibrary-cover-poster',
            'hallLibrary-cover-cinematic',
            'realm-cover',
            'chapter-photo',
            'tune-track-photo',
            'tune-track-audio',
            'television-episode-photo',
            'television-episode-video',
            'conversation-file',
            'work-asset',
            'system-content',
            'ncii-evidence',
          ])
          .optional(),
        originalFileName: z.string().optional(),
        originalContentType: z.string().optional().optional(),
        originalSize: z.number().optional().optional(),
        pendingStoragePath: z.string().optional(),
        targetInfo: z.unknown().optional().optional(),
        textContent: z.string().optional().optional(),
        clientContext: z
          .object({ surface: z.string(), targetIds: z.array(z.string()).optional() })
          .strict()
          .optional(),
        clientMediaClaim: z
          .object({
            kind: z.enum(['image', 'video', 'audio', 'file']),
            source: z.enum(['file-picker', 'camera-capture', 'media-recorder']),
          })
          .strict()
          .optional()
          .optional(),
        publicationState: z
          .enum(['notStarted', 'activating', 'publishing', 'live', 'publicationFailed'])
          .optional()
          .optional(),
        moderationOverride: z.string().optional().optional(),
        createdAt: z.number().optional(),
        updatedAt: z.number().optional(),
        processingStartedAt: z.number().optional().optional(),
        processingAttemptCount: z.number().optional().optional(),
        processingLeaseExpiresAt: z.number().optional().optional(),
        terminalAt: z.number().optional().optional(),
        status: z.literal('processing').optional(),
      })
      .strict()
      .optional(),
    appealMessage: z.string().optional(),
    appealedAt: z.number().optional(),
    reviewedBy: z.string().optional(),
    reviewedAt: z.number().optional(),
    reviewDecision: z.enum(['approved', 'denied']).optional(),
    reviewNotes: z.string().optional(),
  }),
  'moderationCascadeManifests/{cascadeId}': z.object({
    cascadeId: z.string(),
    action: z.enum(['hide', 'restore']),
    entityType: z.enum([
      'square-streetz-post',
      'audition',
      'audition-entry',
      'commission-listing',
      'commission-proposal',
      'craft-skill',
      'profile-picture',
      'work-asset',
      'conversation-file',
      'hall-library-item',
      'hall-library-sub-item',
      'work-project',
      'work-realm',
    ]),
    entityId: z.string(),
    parentEntityId: z.string().optional(),
    targetKey: z.string(),
    decision: z.number(),
    actorUid: z.string(),
    reason: z.string(),
    createdAt: z.number(),
    completedAt: z.number().optional(),
    status: z.enum(['pending', 'complete', 'failed']),
    attemptCount: z.number().optional(),
    nextAttemptAt: z.number().optional(),
    lastError: z.string().optional(),
  }),
  'moderationCascadeManifests/{cascadeId}/changedDocs/{changedDocId}': z.object({
    docPath: z.string(),
    entityType: z.enum([
      'workProject',
      'hallItem',
      'subItemProjection',
      'workRealm',
      'mediaAsset',
      'squareStreetzPost',
      'audition',
      'auditionEntry',
      'commissionListing',
      'commissionProposal',
      'craftSkill',
      'craftSkillReference',
    ]),
    fieldPath: z.string(),
    previousValue: z.boolean(),
    newValue: z.boolean(),
    restored: z.boolean(),
    restoredAt: z.number().optional(),
    restoreSkipped: z.literal('directHidden').optional(),
    edgeSyncOwnerType: z
      .enum([
        'userProfile',
        'craftSkill',
        'squareStreetzPost',
        'workProject',
        'workContent',
        'hallItem',
        'commissionListing',
        'commissionProposal',
        'audition',
        'auditionEntry',
        'conversationFile',
        'realmFile',
        'safetyEvidence',
        'systemContent',
      ])
      .optional(),
    edgeSyncOwnerId: z.string().optional(),
    edgeSyncAssetIds: z.array(z.string()).optional(),
  }),
  'auditEvents/{eventId}': z.object({
    id: z.string(),
    type: z.string(),
    schemaVersion: z.number(),
    actor: z
      .discriminatedUnion('actorMode', [
        z.object({
          uid: z.string().nullable(),
          isAdmin: z.boolean(),
          actorMode: z.enum(['user', 'guildmateUser', 'system']),
        }),
        z.object({
          uid: z.string().nullable(),
          isAdmin: z.boolean(),
          actorMode: z.enum(['adminReview', 'adminOverride']),
          systemRole: z.enum(['admin', 'jrAdmin']),
        }),
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
  'stakeShareAuditEvents/{eventId}': z.object({
    eventId: z.string(),
    subtype: z.string(),
    reason: z.string(),
    workProjectId: z.string(),
    guildmateUserUid: z.string(),
    guildmateUserPath: z.string(),
    beforeStakeShares: z.number().nullable(),
    afterStakeShares: z.number().nullable(),
    createdAt: z.number(),
    source: z.string(),
  }),
  'pendingAdminDispatches/{adminDispatchId}': z.object({
    adminDispatchId: z.string(),
    partyKind: z.enum(['user', 'workProject']),
    workProjectId: z.string().optional(),
    contextRef: z
      .discriminatedUnion('kind', [
        z.object({ kind: z.literal('thresholdItem'), thresholdItemId: z.string() }),
        z.object({
          kind: z.literal('hallContent'),
          hallItemId: z.string(),
          subItemId: z.string().nullable(),
        }),
        z.object({ kind: z.literal('hallContentChangeRequest'), changeRequestId: z.string() }),
      ])
      .optional(),
    userId: z.string(),
    initiatorUserId: z.string(),
    initiatedBy: z.enum(['user', 'admin']),
    subject: z.string(),
    status: z.enum(['open', 'user_reply', 'admin_reply', 'closed_resolved', 'closed_unresolved']),
    createdAt: z.number(),
    lastUpdatedAt: z.number(),
    lastMessageAt: z.number(),
    awaitingAdminReply: z.boolean(),
    closedBy: z.string().optional(),
    conversationFileCount: z.number().optional(),
    conversationFileBytesUsed: z.number().optional(),
    conversationFileUploadCount: z.number().optional(),
    conversationFileBytesReserved: z.number().optional(),
  }),
  'pendingAdminDispatches/{adminDispatchId}/conversationMessages/{adminDispatchMessageId}':
    z.object({
      senderId: z.string(),
      text: z.string(),
      createdAt: z.number(),
      messageId: z.string().optional(),
      threadId: z.string().optional(),
      type: z.string().optional(),
      guildInviteId: z.string().optional(),
      isSystemMessage: z.boolean().optional(),
      sentAs: z.enum(['admin']).optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
    }),
  'pendingAdminDispatches/{adminDispatchId}/conversationFiles/{conversationFileId}': z.object({
    conversationFileId: z.string(),
    mediaAssetId: z.string(),
    name: z.string(),
    mediaKind: z.enum(['image', 'video', 'audio']),
    contentType: z.string(),
    sizeBytes: z.number(),
    uploadedByUid: z.string(),
    createdAt: z.number(),
  }),
  'pendingAdminDispatches/{adminDispatchId}/dispatchReadMarkers/{uid}': z.object({
    adminDispatchId: z.string(),
    uid: z.string(),
    lastSeenMessageAt: z.number(),
    updatedAt: z.number(),
  }),
  'pendingMedia/{pendingMediaId}': z.discriminatedUnion('status', [
    z
      .object({
        id: z.string(),
        userId: z.string(),
        fileOrigin: z.enum([
          'profile-picture',
          'craft-skill-media',
          'squareStreetz',
          'commission-posting',
          'commission-proposal',
          'audition-prompt',
          'audition-entry',
          'admin-audition-prompt',
          'hallLibrary-cover-square',
          'hallLibrary-cover-poster',
          'hallLibrary-cover-cinematic',
          'realm-cover',
          'chapter-photo',
          'tune-track-photo',
          'tune-track-audio',
          'television-episode-photo',
          'television-episode-video',
          'conversation-file',
          'work-asset',
          'system-content',
          'ncii-evidence',
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
          'profile-picture',
          'craft-skill-media',
          'squareStreetz',
          'commission-posting',
          'commission-proposal',
          'audition-prompt',
          'audition-entry',
          'admin-audition-prompt',
          'hallLibrary-cover-square',
          'hallLibrary-cover-poster',
          'hallLibrary-cover-cinematic',
          'realm-cover',
          'chapter-photo',
          'tune-track-photo',
          'tune-track-audio',
          'television-episode-photo',
          'television-episode-video',
          'conversation-file',
          'work-asset',
          'system-content',
          'ncii-evidence',
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
          'profile-picture',
          'craft-skill-media',
          'squareStreetz',
          'commission-posting',
          'commission-proposal',
          'audition-prompt',
          'audition-entry',
          'admin-audition-prompt',
          'hallLibrary-cover-square',
          'hallLibrary-cover-poster',
          'hallLibrary-cover-cinematic',
          'realm-cover',
          'chapter-photo',
          'tune-track-photo',
          'tune-track-audio',
          'television-episode-photo',
          'television-episode-video',
          'conversation-file',
          'work-asset',
          'system-content',
          'ncii-evidence',
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
                    type: z.literal('profile.pictureUpdated'),
                    ids: z.object({ userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('craftSkill.created'),
                    ids: z.object({ userId: z.string(), craftSkillId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('squareStreetz.postCreated'),
                    ids: z.object({ userId: z.string(), postId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('audition.promptCreated'),
                    ids: z
                      .object({
                        userId: z.string(),
                        auditionId: z.string(),
                        workProjectId: z.string().optional(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('audition.entryCreated'),
                    ids: z
                      .object({
                        userId: z.string(),
                        auditionId: z.string(),
                        auditionEntryId: z.string(),
                        workProjectId: z.string().optional(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('commission.created'),
                    ids: z
                      .object({
                        userId: z.string(),
                        commissionListingId: z.string(),
                        workProjectId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('commission.commissionProposalSubmitted'),
                    ids: z
                      .object({
                        userId: z.string(),
                        commissionListingId: z.string(),
                        workProjectId: z.string(),
                        commissionProposalId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.updated'),
                    ids: z.object({ workProjectId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('hallLibrary.coverUpdated'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        itemType: z.enum(['tale', 'tune', 'television']),
                        itemId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workRealm.coverUpdated'),
                    ids: z.object({ workRealmId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('hallLibrary.subItemUpdated'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        itemType: z.enum(['chapter', 'tuneTrack', 'televisionEpisode']),
                        parentId: z.string(),
                        itemId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('moderation.violationCreated'),
                    ids: z
                      .object({
                        userId: z.string(),
                        violationId: z.string(),
                        fileOrigin: z.enum([
                          'profile-picture',
                          'craft-skill-media',
                          'squareStreetz',
                          'commission-posting',
                          'commission-proposal',
                          'audition-prompt',
                          'audition-entry',
                          'admin-audition-prompt',
                          'hallLibrary-cover-square',
                          'hallLibrary-cover-poster',
                          'hallLibrary-cover-cinematic',
                          'realm-cover',
                          'chapter-photo',
                          'tune-track-photo',
                          'tune-track-audio',
                          'television-episode-photo',
                          'television-episode-video',
                          'conversation-file',
                          'work-asset',
                          'system-content',
                          'ncii-evidence',
                        ]),
                        pendingMediaId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('follow.created'),
                    ids: z
                      .object({
                        followerUid: z.string(),
                        targetType: z.enum(['user', 'workProject', 'workRealm']),
                        targetId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('follow.removed'),
                    ids: z
                      .object({
                        followerUid: z.string(),
                        targetType: z.enum(['user', 'workProject', 'workRealm']),
                        targetId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('squareStreetz.postLiked'),
                    ids: z
                      .object({ userId: z.string(), postId: z.string(), authorId: z.string() })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('squareStreetz.postUnliked'),
                    ids: z
                      .object({ userId: z.string(), postId: z.string(), authorId: z.string() })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('profile.preferencesUpdated'),
                    ids: z.object({ userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('craftSkill.deleted'),
                    ids: z.object({ userId: z.string(), craftSkillId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('craftSkill.updated'),
                    ids: z.object({ userId: z.string(), craftSkillId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.created'),
                    ids: z.object({ userId: z.string(), workProjectId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.published'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        userId: z.string(),
                        workRealmId: z.string().optional(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.stakeSharesUpdated'),
                    ids: z.object({ workProjectId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.guildInviteSent'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        guildInviteId: z.string(),
                        inviterId: z.string(),
                        inviteeId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.guildInviteAccepted'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        guildInviteId: z.string(),
                        userId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.guildInviteDeclined'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        guildInviteId: z.string(),
                        userId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.guildInviteCancelled'),
                    ids: z
                      .object({ workProjectId: z.string(), guildInviteId: z.string() })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.guildmateLeft'),
                    ids: z.object({ workProjectId: z.string(), userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('audition.entryVoted'),
                    ids: z
                      .object({
                        userId: z.string(),
                        auditionId: z.string(),
                        auditionEntryId: z.string(),
                        workProjectId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('audition.closed'),
                    ids: z
                      .object({ auditionId: z.string(), workProjectId: z.string().optional() })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('commission.closed'),
                    ids: z
                      .object({ commissionListingId: z.string(), workProjectId: z.string() })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('commission.commissionProposalSaved'),
                    ids: z
                      .object({
                        commissionListingId: z.string(),
                        commissionProposalId: z.string(),
                        userId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('commission.commissionProposalRemoved'),
                    ids: z
                      .object({
                        commissionListingId: z.string(),
                        commissionProposalId: z.string(),
                        userId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('thresholdLibrary.submitted'),
                    ids: z.object({ workProjectId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('thresholdLibrary.approved'),
                    ids: z.object({ thresholdItemId: z.string(), hallItemId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('thresholdLibrary.needsRevision'),
                    ids: z.object({ thresholdItemId: z.string(), hallItemId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('adminDispatch.threadUpdated'),
                    ids: z.object({ adminDispatchId: z.string().nullable() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('admin.appealReviewed'),
                    ids: z.object({ violationId: z.string(), userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('admin.adminDispatchReviewed'),
                    ids: z.object({}).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('mention.read'),
                    ids: z.object({ userId: z.string(), mentionId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('auth.statusChanged'),
                    ids: z.object({ userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('violation.appealSubmitted'),
                    ids: z.object({ userId: z.string(), violationId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('profile.displayNameChanged'),
                    ids: z.object({ userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('admin.displayNameResetForced'),
                    ids: z.object({ userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workRealm.detailsUpdated'),
                    ids: z.object({ workRealmId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('hallContentChangeRequest.approved'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        workRealmId: z.string().optional(),
                        hallItemId: z.string().optional(),
                        subItemId: z.string().optional(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('systemSlot.uidUpdated'),
                    ids: z.object({ slotId: z.enum(['founder', 'team']) }).strict(),
                  })
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
          'profile-picture',
          'craft-skill-media',
          'squareStreetz',
          'commission-posting',
          'commission-proposal',
          'audition-prompt',
          'audition-entry',
          'admin-audition-prompt',
          'hallLibrary-cover-square',
          'hallLibrary-cover-poster',
          'hallLibrary-cover-cinematic',
          'realm-cover',
          'chapter-photo',
          'tune-track-photo',
          'tune-track-audio',
          'television-episode-photo',
          'television-episode-video',
          'conversation-file',
          'work-asset',
          'system-content',
          'ncii-evidence',
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
          'profile-picture',
          'craft-skill-media',
          'squareStreetz',
          'commission-posting',
          'commission-proposal',
          'audition-prompt',
          'audition-entry',
          'admin-audition-prompt',
          'hallLibrary-cover-square',
          'hallLibrary-cover-poster',
          'hallLibrary-cover-cinematic',
          'realm-cover',
          'chapter-photo',
          'tune-track-photo',
          'tune-track-audio',
          'television-episode-photo',
          'television-episode-video',
          'conversation-file',
          'work-asset',
          'system-content',
          'ncii-evidence',
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
                    type: z.literal('profile.pictureUpdated'),
                    ids: z.object({ userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('craftSkill.created'),
                    ids: z.object({ userId: z.string(), craftSkillId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('squareStreetz.postCreated'),
                    ids: z.object({ userId: z.string(), postId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('audition.promptCreated'),
                    ids: z
                      .object({
                        userId: z.string(),
                        auditionId: z.string(),
                        workProjectId: z.string().optional(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('audition.entryCreated'),
                    ids: z
                      .object({
                        userId: z.string(),
                        auditionId: z.string(),
                        auditionEntryId: z.string(),
                        workProjectId: z.string().optional(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('commission.created'),
                    ids: z
                      .object({
                        userId: z.string(),
                        commissionListingId: z.string(),
                        workProjectId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('commission.commissionProposalSubmitted'),
                    ids: z
                      .object({
                        userId: z.string(),
                        commissionListingId: z.string(),
                        workProjectId: z.string(),
                        commissionProposalId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.updated'),
                    ids: z.object({ workProjectId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('hallLibrary.coverUpdated'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        itemType: z.enum(['tale', 'tune', 'television']),
                        itemId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workRealm.coverUpdated'),
                    ids: z.object({ workRealmId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('hallLibrary.subItemUpdated'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        itemType: z.enum(['chapter', 'tuneTrack', 'televisionEpisode']),
                        parentId: z.string(),
                        itemId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('moderation.violationCreated'),
                    ids: z
                      .object({
                        userId: z.string(),
                        violationId: z.string(),
                        fileOrigin: z.enum([
                          'profile-picture',
                          'craft-skill-media',
                          'squareStreetz',
                          'commission-posting',
                          'commission-proposal',
                          'audition-prompt',
                          'audition-entry',
                          'admin-audition-prompt',
                          'hallLibrary-cover-square',
                          'hallLibrary-cover-poster',
                          'hallLibrary-cover-cinematic',
                          'realm-cover',
                          'chapter-photo',
                          'tune-track-photo',
                          'tune-track-audio',
                          'television-episode-photo',
                          'television-episode-video',
                          'conversation-file',
                          'work-asset',
                          'system-content',
                          'ncii-evidence',
                        ]),
                        pendingMediaId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('follow.created'),
                    ids: z
                      .object({
                        followerUid: z.string(),
                        targetType: z.enum(['user', 'workProject', 'workRealm']),
                        targetId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('follow.removed'),
                    ids: z
                      .object({
                        followerUid: z.string(),
                        targetType: z.enum(['user', 'workProject', 'workRealm']),
                        targetId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('squareStreetz.postLiked'),
                    ids: z
                      .object({ userId: z.string(), postId: z.string(), authorId: z.string() })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('squareStreetz.postUnliked'),
                    ids: z
                      .object({ userId: z.string(), postId: z.string(), authorId: z.string() })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('profile.preferencesUpdated'),
                    ids: z.object({ userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('craftSkill.deleted'),
                    ids: z.object({ userId: z.string(), craftSkillId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('craftSkill.updated'),
                    ids: z.object({ userId: z.string(), craftSkillId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.created'),
                    ids: z.object({ userId: z.string(), workProjectId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.published'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        userId: z.string(),
                        workRealmId: z.string().optional(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.stakeSharesUpdated'),
                    ids: z.object({ workProjectId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.guildInviteSent'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        guildInviteId: z.string(),
                        inviterId: z.string(),
                        inviteeId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.guildInviteAccepted'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        guildInviteId: z.string(),
                        userId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.guildInviteDeclined'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        guildInviteId: z.string(),
                        userId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.guildInviteCancelled'),
                    ids: z
                      .object({ workProjectId: z.string(), guildInviteId: z.string() })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workProject.guildmateLeft'),
                    ids: z.object({ workProjectId: z.string(), userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('audition.entryVoted'),
                    ids: z
                      .object({
                        userId: z.string(),
                        auditionId: z.string(),
                        auditionEntryId: z.string(),
                        workProjectId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('audition.closed'),
                    ids: z
                      .object({ auditionId: z.string(), workProjectId: z.string().optional() })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('commission.closed'),
                    ids: z
                      .object({ commissionListingId: z.string(), workProjectId: z.string() })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('commission.commissionProposalSaved'),
                    ids: z
                      .object({
                        commissionListingId: z.string(),
                        commissionProposalId: z.string(),
                        userId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('commission.commissionProposalRemoved'),
                    ids: z
                      .object({
                        commissionListingId: z.string(),
                        commissionProposalId: z.string(),
                        userId: z.string(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('thresholdLibrary.submitted'),
                    ids: z.object({ workProjectId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('thresholdLibrary.approved'),
                    ids: z.object({ thresholdItemId: z.string(), hallItemId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('thresholdLibrary.needsRevision'),
                    ids: z.object({ thresholdItemId: z.string(), hallItemId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('adminDispatch.threadUpdated'),
                    ids: z.object({ adminDispatchId: z.string().nullable() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('admin.appealReviewed'),
                    ids: z.object({ violationId: z.string(), userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('admin.adminDispatchReviewed'),
                    ids: z.object({}).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('mention.read'),
                    ids: z.object({ userId: z.string(), mentionId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('auth.statusChanged'),
                    ids: z.object({ userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('violation.appealSubmitted'),
                    ids: z.object({ userId: z.string(), violationId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('profile.displayNameChanged'),
                    ids: z.object({ userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('admin.displayNameResetForced'),
                    ids: z.object({ userId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('workRealm.detailsUpdated'),
                    ids: z.object({ workRealmId: z.string() }).strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('hallContentChangeRequest.approved'),
                    ids: z
                      .object({
                        workProjectId: z.string(),
                        workRealmId: z.string().optional(),
                        hallItemId: z.string().optional(),
                        subItemId: z.string().optional(),
                      })
                      .strict(),
                  })
                  .strict(),
                z
                  .object({
                    type: z.literal('systemSlot.uidUpdated'),
                    ids: z.object({ slotId: z.enum(['founder', 'team']) }).strict(),
                  })
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
  ]),
  'pendingMediaArchive/{pendingMediaId}': z.union([
    z.discriminatedUnion('status', [
      z
        .object({
          id: z.string(),
          userId: z.string(),
          fileOrigin: z.enum([
            'profile-picture',
            'craft-skill-media',
            'squareStreetz',
            'commission-posting',
            'commission-proposal',
            'audition-prompt',
            'audition-entry',
            'admin-audition-prompt',
            'hallLibrary-cover-square',
            'hallLibrary-cover-poster',
            'hallLibrary-cover-cinematic',
            'realm-cover',
            'chapter-photo',
            'tune-track-photo',
            'tune-track-audio',
            'television-episode-photo',
            'television-episode-video',
            'conversation-file',
            'work-asset',
            'system-content',
            'ncii-evidence',
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
                      type: z.literal('profile.pictureUpdated'),
                      ids: z.object({ userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('craftSkill.created'),
                      ids: z.object({ userId: z.string(), craftSkillId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('squareStreetz.postCreated'),
                      ids: z.object({ userId: z.string(), postId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('audition.promptCreated'),
                      ids: z
                        .object({
                          userId: z.string(),
                          auditionId: z.string(),
                          workProjectId: z.string().optional(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('audition.entryCreated'),
                      ids: z
                        .object({
                          userId: z.string(),
                          auditionId: z.string(),
                          auditionEntryId: z.string(),
                          workProjectId: z.string().optional(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('commission.created'),
                      ids: z
                        .object({
                          userId: z.string(),
                          commissionListingId: z.string(),
                          workProjectId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('commission.commissionProposalSubmitted'),
                      ids: z
                        .object({
                          userId: z.string(),
                          commissionListingId: z.string(),
                          workProjectId: z.string(),
                          commissionProposalId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.updated'),
                      ids: z.object({ workProjectId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('hallLibrary.coverUpdated'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          itemType: z.enum(['tale', 'tune', 'television']),
                          itemId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workRealm.coverUpdated'),
                      ids: z.object({ workRealmId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('hallLibrary.subItemUpdated'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          itemType: z.enum(['chapter', 'tuneTrack', 'televisionEpisode']),
                          parentId: z.string(),
                          itemId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('moderation.violationCreated'),
                      ids: z
                        .object({
                          userId: z.string(),
                          violationId: z.string(),
                          fileOrigin: z.enum([
                            'profile-picture',
                            'craft-skill-media',
                            'squareStreetz',
                            'commission-posting',
                            'commission-proposal',
                            'audition-prompt',
                            'audition-entry',
                            'admin-audition-prompt',
                            'hallLibrary-cover-square',
                            'hallLibrary-cover-poster',
                            'hallLibrary-cover-cinematic',
                            'realm-cover',
                            'chapter-photo',
                            'tune-track-photo',
                            'tune-track-audio',
                            'television-episode-photo',
                            'television-episode-video',
                            'conversation-file',
                            'work-asset',
                            'system-content',
                            'ncii-evidence',
                          ]),
                          pendingMediaId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('follow.created'),
                      ids: z
                        .object({
                          followerUid: z.string(),
                          targetType: z.enum(['user', 'workProject', 'workRealm']),
                          targetId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('follow.removed'),
                      ids: z
                        .object({
                          followerUid: z.string(),
                          targetType: z.enum(['user', 'workProject', 'workRealm']),
                          targetId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('squareStreetz.postLiked'),
                      ids: z
                        .object({ userId: z.string(), postId: z.string(), authorId: z.string() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('squareStreetz.postUnliked'),
                      ids: z
                        .object({ userId: z.string(), postId: z.string(), authorId: z.string() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('profile.preferencesUpdated'),
                      ids: z.object({ userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('craftSkill.deleted'),
                      ids: z.object({ userId: z.string(), craftSkillId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('craftSkill.updated'),
                      ids: z.object({ userId: z.string(), craftSkillId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.created'),
                      ids: z.object({ userId: z.string(), workProjectId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.published'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          userId: z.string(),
                          workRealmId: z.string().optional(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.stakeSharesUpdated'),
                      ids: z.object({ workProjectId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.guildInviteSent'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          guildInviteId: z.string(),
                          inviterId: z.string(),
                          inviteeId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.guildInviteAccepted'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          guildInviteId: z.string(),
                          userId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.guildInviteDeclined'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          guildInviteId: z.string(),
                          userId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.guildInviteCancelled'),
                      ids: z
                        .object({ workProjectId: z.string(), guildInviteId: z.string() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.guildmateLeft'),
                      ids: z.object({ workProjectId: z.string(), userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('audition.entryVoted'),
                      ids: z
                        .object({
                          userId: z.string(),
                          auditionId: z.string(),
                          auditionEntryId: z.string(),
                          workProjectId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('audition.closed'),
                      ids: z
                        .object({ auditionId: z.string(), workProjectId: z.string().optional() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('commission.closed'),
                      ids: z
                        .object({ commissionListingId: z.string(), workProjectId: z.string() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('commission.commissionProposalSaved'),
                      ids: z
                        .object({
                          commissionListingId: z.string(),
                          commissionProposalId: z.string(),
                          userId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('commission.commissionProposalRemoved'),
                      ids: z
                        .object({
                          commissionListingId: z.string(),
                          commissionProposalId: z.string(),
                          userId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('thresholdLibrary.submitted'),
                      ids: z.object({ workProjectId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('thresholdLibrary.approved'),
                      ids: z
                        .object({ thresholdItemId: z.string(), hallItemId: z.string() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('thresholdLibrary.needsRevision'),
                      ids: z
                        .object({ thresholdItemId: z.string(), hallItemId: z.string() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('adminDispatch.threadUpdated'),
                      ids: z.object({ adminDispatchId: z.string().nullable() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('admin.appealReviewed'),
                      ids: z.object({ violationId: z.string(), userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('admin.adminDispatchReviewed'),
                      ids: z.object({}).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('mention.read'),
                      ids: z.object({ userId: z.string(), mentionId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('auth.statusChanged'),
                      ids: z.object({ userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('violation.appealSubmitted'),
                      ids: z.object({ userId: z.string(), violationId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('profile.displayNameChanged'),
                      ids: z.object({ userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('admin.displayNameResetForced'),
                      ids: z.object({ userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workRealm.detailsUpdated'),
                      ids: z.object({ workRealmId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('hallContentChangeRequest.approved'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          workRealmId: z.string().optional(),
                          hallItemId: z.string().optional(),
                          subItemId: z.string().optional(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('systemSlot.uidUpdated'),
                      ids: z.object({ slotId: z.enum(['founder', 'team']) }).strict(),
                    })
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
          archivedAt: z.number(),
        })
        .strict(),
      z
        .object({
          id: z.string(),
          userId: z.string(),
          fileOrigin: z.enum([
            'profile-picture',
            'craft-skill-media',
            'squareStreetz',
            'commission-posting',
            'commission-proposal',
            'audition-prompt',
            'audition-entry',
            'admin-audition-prompt',
            'hallLibrary-cover-square',
            'hallLibrary-cover-poster',
            'hallLibrary-cover-cinematic',
            'realm-cover',
            'chapter-photo',
            'tune-track-photo',
            'tune-track-audio',
            'television-episode-photo',
            'television-episode-video',
            'conversation-file',
            'work-asset',
            'system-content',
            'ncii-evidence',
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
          archivedAt: z.number(),
        })
        .strict(),
      z
        .object({
          id: z.string(),
          userId: z.string(),
          fileOrigin: z.enum([
            'profile-picture',
            'craft-skill-media',
            'squareStreetz',
            'commission-posting',
            'commission-proposal',
            'audition-prompt',
            'audition-entry',
            'admin-audition-prompt',
            'hallLibrary-cover-square',
            'hallLibrary-cover-poster',
            'hallLibrary-cover-cinematic',
            'realm-cover',
            'chapter-photo',
            'tune-track-photo',
            'tune-track-audio',
            'television-episode-photo',
            'television-episode-video',
            'conversation-file',
            'work-asset',
            'system-content',
            'ncii-evidence',
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
                      type: z.literal('profile.pictureUpdated'),
                      ids: z.object({ userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('craftSkill.created'),
                      ids: z.object({ userId: z.string(), craftSkillId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('squareStreetz.postCreated'),
                      ids: z.object({ userId: z.string(), postId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('audition.promptCreated'),
                      ids: z
                        .object({
                          userId: z.string(),
                          auditionId: z.string(),
                          workProjectId: z.string().optional(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('audition.entryCreated'),
                      ids: z
                        .object({
                          userId: z.string(),
                          auditionId: z.string(),
                          auditionEntryId: z.string(),
                          workProjectId: z.string().optional(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('commission.created'),
                      ids: z
                        .object({
                          userId: z.string(),
                          commissionListingId: z.string(),
                          workProjectId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('commission.commissionProposalSubmitted'),
                      ids: z
                        .object({
                          userId: z.string(),
                          commissionListingId: z.string(),
                          workProjectId: z.string(),
                          commissionProposalId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.updated'),
                      ids: z.object({ workProjectId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('hallLibrary.coverUpdated'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          itemType: z.enum(['tale', 'tune', 'television']),
                          itemId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workRealm.coverUpdated'),
                      ids: z.object({ workRealmId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('hallLibrary.subItemUpdated'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          itemType: z.enum(['chapter', 'tuneTrack', 'televisionEpisode']),
                          parentId: z.string(),
                          itemId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('moderation.violationCreated'),
                      ids: z
                        .object({
                          userId: z.string(),
                          violationId: z.string(),
                          fileOrigin: z.enum([
                            'profile-picture',
                            'craft-skill-media',
                            'squareStreetz',
                            'commission-posting',
                            'commission-proposal',
                            'audition-prompt',
                            'audition-entry',
                            'admin-audition-prompt',
                            'hallLibrary-cover-square',
                            'hallLibrary-cover-poster',
                            'hallLibrary-cover-cinematic',
                            'realm-cover',
                            'chapter-photo',
                            'tune-track-photo',
                            'tune-track-audio',
                            'television-episode-photo',
                            'television-episode-video',
                            'conversation-file',
                            'work-asset',
                            'system-content',
                            'ncii-evidence',
                          ]),
                          pendingMediaId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('follow.created'),
                      ids: z
                        .object({
                          followerUid: z.string(),
                          targetType: z.enum(['user', 'workProject', 'workRealm']),
                          targetId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('follow.removed'),
                      ids: z
                        .object({
                          followerUid: z.string(),
                          targetType: z.enum(['user', 'workProject', 'workRealm']),
                          targetId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('squareStreetz.postLiked'),
                      ids: z
                        .object({ userId: z.string(), postId: z.string(), authorId: z.string() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('squareStreetz.postUnliked'),
                      ids: z
                        .object({ userId: z.string(), postId: z.string(), authorId: z.string() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('profile.preferencesUpdated'),
                      ids: z.object({ userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('craftSkill.deleted'),
                      ids: z.object({ userId: z.string(), craftSkillId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('craftSkill.updated'),
                      ids: z.object({ userId: z.string(), craftSkillId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.created'),
                      ids: z.object({ userId: z.string(), workProjectId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.published'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          userId: z.string(),
                          workRealmId: z.string().optional(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.stakeSharesUpdated'),
                      ids: z.object({ workProjectId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.guildInviteSent'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          guildInviteId: z.string(),
                          inviterId: z.string(),
                          inviteeId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.guildInviteAccepted'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          guildInviteId: z.string(),
                          userId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.guildInviteDeclined'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          guildInviteId: z.string(),
                          userId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.guildInviteCancelled'),
                      ids: z
                        .object({ workProjectId: z.string(), guildInviteId: z.string() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workProject.guildmateLeft'),
                      ids: z.object({ workProjectId: z.string(), userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('audition.entryVoted'),
                      ids: z
                        .object({
                          userId: z.string(),
                          auditionId: z.string(),
                          auditionEntryId: z.string(),
                          workProjectId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('audition.closed'),
                      ids: z
                        .object({ auditionId: z.string(), workProjectId: z.string().optional() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('commission.closed'),
                      ids: z
                        .object({ commissionListingId: z.string(), workProjectId: z.string() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('commission.commissionProposalSaved'),
                      ids: z
                        .object({
                          commissionListingId: z.string(),
                          commissionProposalId: z.string(),
                          userId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('commission.commissionProposalRemoved'),
                      ids: z
                        .object({
                          commissionListingId: z.string(),
                          commissionProposalId: z.string(),
                          userId: z.string(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('thresholdLibrary.submitted'),
                      ids: z.object({ workProjectId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('thresholdLibrary.approved'),
                      ids: z
                        .object({ thresholdItemId: z.string(), hallItemId: z.string() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('thresholdLibrary.needsRevision'),
                      ids: z
                        .object({ thresholdItemId: z.string(), hallItemId: z.string() })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('adminDispatch.threadUpdated'),
                      ids: z.object({ adminDispatchId: z.string().nullable() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('admin.appealReviewed'),
                      ids: z.object({ violationId: z.string(), userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('admin.adminDispatchReviewed'),
                      ids: z.object({}).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('mention.read'),
                      ids: z.object({ userId: z.string(), mentionId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('auth.statusChanged'),
                      ids: z.object({ userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('violation.appealSubmitted'),
                      ids: z.object({ userId: z.string(), violationId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('profile.displayNameChanged'),
                      ids: z.object({ userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('admin.displayNameResetForced'),
                      ids: z.object({ userId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('workRealm.detailsUpdated'),
                      ids: z.object({ workRealmId: z.string() }).strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('hallContentChangeRequest.approved'),
                      ids: z
                        .object({
                          workProjectId: z.string(),
                          workRealmId: z.string().optional(),
                          hallItemId: z.string().optional(),
                          subItemId: z.string().optional(),
                        })
                        .strict(),
                    })
                    .strict(),
                  z
                    .object({
                      type: z.literal('systemSlot.uidUpdated'),
                      ids: z.object({ slotId: z.enum(['founder', 'team']) }).strict(),
                    })
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
          archivedAt: z.number(),
        })
        .strict(),
    ]),
    z
      .object({
        parseFailed: z.literal(true),
        archivedAt: z.number(),
        raw: z.record(z.string(), z.unknown()),
      })
      .strict(),
  ]),
  'mediaAssets/{mediaAssetId}': z
    .object({
      mediaAssetId: z.string(),
      mediaKind: z.enum(['image', 'video', 'audio']),
      fileOrigin: z.enum([
        'profile-picture',
        'craft-skill-media',
        'squareStreetz',
        'commission-posting',
        'commission-proposal',
        'audition-prompt',
        'audition-entry',
        'admin-audition-prompt',
        'hallLibrary-cover-square',
        'hallLibrary-cover-poster',
        'hallLibrary-cover-cinematic',
        'realm-cover',
        'chapter-photo',
        'tune-track-photo',
        'tune-track-audio',
        'television-episode-photo',
        'television-episode-video',
        'conversation-file',
        'work-asset',
        'system-content',
        'ncii-evidence',
      ]),
      ownerType: z.enum([
        'userProfile',
        'craftSkill',
        'squareStreetzPost',
        'workProject',
        'workContent',
        'hallItem',
        'commissionListing',
        'commissionProposal',
        'audition',
        'auditionEntry',
        'conversationFile',
        'realmFile',
        'safetyEvidence',
        'systemContent',
      ]),
      ownerId: z.string(),
      workProjectId: z.string().optional(),
      realmId: z.string().optional(),
      createdByUid: z.string(),
      accessTier: z.enum(['broad', 'scoped', 'artisan', 'adminOnly']),
      servingStatus: z.enum(['servable', 'hidden', 'quarantined', 'deleted']),
      variants: z.record(
        z.string(),
        z
          .object({
            contentType: z.string(),
            sizeBytes: z.number(),
            width: z.number().optional(),
            height: z.number().optional(),
            durationSec: z.number().optional(),
            downloadFilename: z.string().optional(),
          })
          .strict(),
      ),
      moderationStatus: z.enum(['approved', 'quarantined']),
      retentionPolicy: z.enum(['standard', 'preserveForTrustAndSafety', 'legalHold']),
      legalHold: z.boolean(),
      originalDeletedAt: z.number().optional(),
      originLineage: z
        .object({
          lineageVersion: z.literal(1),
          rootIngestId: z.string(),
          rootAssetId: z.string(),
          sourceAssetId: z.string().optional(),
          originatingUploaderUid: z.string(),
          originatingUploadEventId: z.string(),
          originalUploadCreatedAt: z.number(),
          rootSha256: z.string(),
          originalSha256: z.string().optional(),
          variantSha256s: z.record(
            z.enum(['full', 'medium', 'small', 'main', 'poster']),
            z.string(),
          ),
          copyReason: z.enum([
            'original',
            'variant',
            'hall_publish',
            'profile_derivative',
            'moderation_copy',
            'evidence_copy',
            'other',
          ]),
          createdFromOwnerType: z
            .enum([
              'userProfile',
              'craftSkill',
              'squareStreetzPost',
              'workProject',
              'workContent',
              'hallItem',
              'commissionListing',
              'commissionProposal',
              'audition',
              'auditionEntry',
              'conversationFile',
              'realmFile',
              'safetyEvidence',
              'systemContent',
            ])
            .optional(),
          createdFromOwnerId: z.string().optional(),
          copyActorUid: z.string().optional(),
          currentOwnerType: z.enum([
            'userProfile',
            'craftSkill',
            'squareStreetzPost',
            'workProject',
            'workContent',
            'hallItem',
            'commissionListing',
            'commissionProposal',
            'audition',
            'auditionEntry',
            'conversationFile',
            'realmFile',
            'safetyEvidence',
            'systemContent',
          ]),
          currentOwnerId: z.string(),
        })
        .strict()
        .optional(),
      realmFileCanonStatus: z.enum(['none', 'pendingApproval', 'nonCanon', 'canon']),
      realmFileFolderId: z.string().optional(),
      realmFileShareRequestId: z.string().optional(),
      realmFileShareRequestedByUid: z.string().optional(),
      realmFileShareRequestedAt: z.number().optional(),
      authorityVersion: z.number().optional(),
      authorityPayloadHash: z.string().optional(),
      authoritySyncState: z.enum(['pending', 'applied', 'deadLetter']).optional(),
      publicationState: z.enum(['unpublished', 'published', 'retired']).optional(),
      scope: z
        .discriminatedUnion('kind', [
          z.object({ kind: z.literal('workProject'), workProjectId: z.string() }).strict(),
          z
            .object({
              kind: z.literal('workFileFolder'),
              workProjectId: z.string(),
              workFileFolderId: z.string(),
            })
            .strict(),
          z.object({ kind: z.literal('guildInvite'), guildInviteId: z.string() }).strict(),
          z.object({ kind: z.literal('adminSupport'), adminDispatchId: z.string() }).strict(),
        ])
        .optional(),
      authorityAppliedAt: z.number().optional(),
      publishedAt: z.number().optional(),
      lastAuthorityError: z
        .object({
          code: z.string(),
          message: z.string(),
          retryable: z.boolean().optional(),
          details: z.record(z.string(), z.unknown()).optional(),
          at: z.number().optional(),
        })
        .strict()
        .optional(),
      authoritySyncAttemptCount: z.number().optional(),
      authoritySyncNextAttemptAt: z.number().optional(),
      retirement: z
        .object({
          requestedAt: z.number(),
          pendingVariantKeys: z.array(z.string()),
          attemptCount: z.number(),
          nextAttemptAt: z.number(),
          lastDeferral: z.enum(['held', 'failed']).optional(),
          lastError: z
            .object({
              code: z.string(),
              message: z.string(),
              retryable: z.boolean().optional(),
              details: z.record(z.string(), z.unknown()).optional(),
              at: z.number().optional(),
            })
            .strict()
            .optional(),
        })
        .strict()
        .optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
    })
    .strict(),
  'mediaActivationJobs/{jobId}': z
    .object({
      jobId: z.string(),
      schemaVersion: z.number(),
      assetId: z.string(),
      pendingMediaId: z.string(),
      fileOrigin: z.enum([
        'profile-picture',
        'craft-skill-media',
        'squareStreetz',
        'commission-posting',
        'commission-proposal',
        'audition-prompt',
        'audition-entry',
        'admin-audition-prompt',
        'hallLibrary-cover-square',
        'hallLibrary-cover-poster',
        'hallLibrary-cover-cinematic',
        'realm-cover',
        'chapter-photo',
        'tune-track-photo',
        'tune-track-audio',
        'television-episode-photo',
        'television-episode-video',
        'conversation-file',
        'work-asset',
        'system-content',
        'ncii-evidence',
      ]),
      authorityVersion: z.number(),
      payloadHash: z.string(),
      authorityPayload: z
        .object({
          schemaVersion: z.number(),
          assetId: z.string(),
          authorityVersion: z.number(),
          operationId: z.string(),
          payloadHash: z.string(),
          servingStatus: z.enum(['servable', 'hidden', 'quarantined', 'deleted']),
          accessTier: z.enum(['broad', 'scoped', 'artisan', 'adminOnly']),
          ownerType: z.enum([
            'userProfile',
            'craftSkill',
            'squareStreetzPost',
            'workProject',
            'workContent',
            'hallItem',
            'commissionListing',
            'commissionProposal',
            'audition',
            'auditionEntry',
            'conversationFile',
            'realmFile',
            'safetyEvidence',
            'systemContent',
          ]),
          ownerId: z.string(),
          scope: z
            .discriminatedUnion('kind', [
              z.object({ kind: z.literal('workProject'), workProjectId: z.string() }).strict(),
              z
                .object({
                  kind: z.literal('workFileFolder'),
                  workProjectId: z.string(),
                  workFileFolderId: z.string(),
                })
                .strict(),
              z.object({ kind: z.literal('guildInvite'), guildInviteId: z.string() }).strict(),
              z.object({ kind: z.literal('adminSupport'), adminDispatchId: z.string() }).strict(),
            ])
            .nullable(),
          variants: z.record(
            z.string(),
            z
              .object({
                contentType: z.string(),
                sizeBytes: z.number(),
                width: z.number().optional(),
                height: z.number().optional(),
                durationSec: z.number().optional(),
                downloadFilename: z.string().optional(),
              })
              .strict(),
          ),
          updatedAtMs: z.number(),
        })
        .strict(),
      publicationKind: z.enum([
        'profilePicture',
        'squarePostMedia',
        'workAsset',
        'hallCover',
        'realmCover',
        'workContentMedia',
        'auditionMedia',
        'commissionListingMedia',
        'commissionProposalMedia',
        'craftSkillMedia',
        'conversationFile',
        'systemVideoSlot',
      ]),
      publicationArgs: z.unknown(),
      status: z.enum(['pending', 'authorityApplied', 'complete', 'deadLetter']),
      attemptCount: z.number(),
      nextAttemptAt: z.number(),
      lastError: z
        .object({
          code: z.string(),
          message: z.string(),
          retryable: z.boolean().optional(),
          details: z.record(z.string(), z.unknown()).optional(),
          at: z.number().optional(),
        })
        .strict()
        .optional(),
      parentKey: z.string().optional(),
      parentWaitStartedAt: z.number().optional(),
      createdAt: z.number(),
      authorityAppliedAt: z.number().optional(),
      completedAt: z.number().optional(),
      deadLetteredAt: z.number().optional(),
      expireAt: z.custom().optional(),
    })
    .strict(),
  'mediaCopyIntents/{newAssetId}': z.discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('copy'),
        newAssetId: z.string(),
        state: z.enum(['copying', 'reaping']),
        createdAt: z.number(),
        updatedAt: z.number(),
        reapAfter: z.number(),
        reapAttemptCount: z.number(),
        reapClaimedAt: z.number().optional(),
        sourceAssetId: z.string(),
        ownerType: z.enum([
          'userProfile',
          'craftSkill',
          'squareStreetzPost',
          'workProject',
          'workContent',
          'hallItem',
          'commissionListing',
          'commissionProposal',
          'audition',
          'auditionEntry',
          'conversationFile',
          'realmFile',
          'safetyEvidence',
          'systemContent',
        ]),
        ownerId: z.string(),
        variantKeys: z.array(z.enum(['full', 'medium', 'small', 'main', 'poster'])),
      })
      .strict(),
    z
      .object({
        kind: z.literal('ingest'),
        newAssetId: z.string(),
        state: z.enum(['copying', 'reaping']),
        createdAt: z.number(),
        updatedAt: z.number(),
        reapAfter: z.number(),
        reapAttemptCount: z.number(),
        reapClaimedAt: z.number().optional(),
        pendingMediaId: z.string(),
      })
      .strict(),
  ]),
  'activeUserNotifications/{notificationId}': z.object({
    id: z.string(),
    type: z.string(),
    dedupKey: z.string(),
    category: z.string(),
    targetUserId: z.string().nullable(),
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
  'activeAdminNotifications/{notificationId}': z.object({
    id: z.string(),
    type: z.string(),
    dedupKey: z.string(),
    category: z.string(),
    targetUserId: z.string().nullable(),
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
  'adminNotificationHistory/{notificationId}': z.object({
    archiveOccurrenceId: z.string(),
    requestId: z.string(),
    payloadHash: z.string(),
    activeId: z.string(),
    observedActivityGeneration: z.string(),
    category: z.string(),
    audienceScope: z.string(),
    archivedSnapshot: z.object({
      type: z.string(),
      dedupKey: z.string(),
      category: z.string(),
      targetUserId: z.string().nullable(),
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
    handledBy: z.string().optional(),
  }),
  'pendingNotifications/{notificationId}': z.object({
    id: z.string(),
    type: z.string(),
    category: z.string(),
    targetUserId: z.string().nullable(),
    actorId: z.string(),
    metadata: z.record(z.string(), z.unknown()),
    createdAt: z.number(),
  }),
  'notificationDeliveries/{deliveryId}': z.object({
    deliveryId: z.string(),
    state: z.enum(['queued', 'materialized', 'skipped', 'deadLetter']),
    notificationType: z.string(),
    eventId: z.string(),
    recipientUid: z.string().nullable(),
    aggregationKey: z.string(),
    strategy: z.enum(['increment', 'staticRelight']),
    payload: z.object({
      actorId: z.string().nullable(),
      metadata: z.record(z.string(), z.unknown()),
      occurrenceAt: z.number(),
    }),
    payloadVersion: z.number(),
    materializationClass: z.enum(['directQueued', 'realtimeFallback', 'fanoutOrphan', 'retry']),
    createdAt: z.number(),
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    lastError: z.string().nullable(),
    materializedAt: z.number().nullable(),
    deadLetteredAt: z.number().nullable(),
    skipReason: z.enum(['recipientIneligible']).optional(),
    skippedAt: z.number().optional(),
    expireAt: z.unknown().optional(),
  }),
  'notificationFanoutJobs/{jobId}': z.object({
    jobId: z.string(),
    schemaVersion: z.number(),
    notificationType: z.string(),
    eventId: z.string(),
    priority: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    payload: z.record(z.string(), z.unknown()),
    phases: z.array(
      z.object({
        selector: z.record(z.string(), z.unknown()),
        cursor: z.unknown().nullable(),
        done: z.boolean(),
      }),
    ),
    phaseIndex: z.number(),
    revision: z.number(),
    status: z.enum(['pending', 'complete', 'deadLetter']),
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    lastError: z.string().nullable(),
    createdAt: z.number(),
    updatedAt: z.number(),
    completedAt: z.number().nullable(),
    deadLetteredAt: z.number().nullable(),
    expireAt: z.unknown().optional(),
    requestId: z.string().optional(),
    actorUid: z.string().optional(),
    payloadHash: z.string().optional(),
  }),
  'notificationArchiveAllJobs/{jobId}': z
    .object({
      schemaVersion: z.literal(1),
      jobId: z.string(),
      userId: z.string(),
      category: z.enum(['user', 'admin']),
      actorSystemRole: z.enum(['admin', 'jrAdmin']).nullable().optional(),
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
    })
    .passthrough(),
  'chatChannelAuthProjections/{authPairKey}': z.object({
    channelRefScope: z.enum(['channel', 'invite']),
    workProjectId: z.string().nullable(),
    guildChatChannelId: z.string().nullable(),
    guildInviteId: z.string().nullable(),
    uid: z.string(),
    channelKey: z.string(),
    channelAuthState: z.enum(['authorized', 'removed']),
    channelAuthVersion: z.number(),
    inputFingerprint: z.string(),
    updatedAt: z.number(),
    lastReconciledAt: z.number().optional(),
  }),
  'chatScopeDegraded/{scopeKey}': z.object({
    scopeKey: z.string(),
    scopeKind: z.enum(['channel', 'memberInWork']),
    workProjectId: z.string().nullable(),
    guildChatChannelId: z.string().nullable(),
    guildInviteId: z.string().nullable(),
    uid: z.string().nullable(),
    unresolvedCauseCount: z.number(),
    updatedAt: z.number(),
  }),
  'chatScopeDegraded/{scopeKey}/chatScopeDegradedCauses/{causeId}': z.object({
    causeId: z.string(),
    kind: z.enum(['syncEvent', 'fanoutJob']),
    ref: z.string(),
    deadLetteredAt: z.number(),
  }),
  'chatSyncEvents/{eventId}': z.object({
    eventId: z.string(),
    targetDo: z.string(),
    kind: z.enum(['channelAuth', 'accountAccess', 'config']),
    version: z.number(),
    payload: z.record(z.string(), z.unknown()).nullable(),
    tombstone: z.boolean().optional(),
    payloadHash: z.string(),
    status: z.enum(['pending', 'delivered', 'deadLetter']),
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    lastError: z.string().nullable(),
    createdAt: z.number(),
    deliveredResult: z.record(z.string(), z.unknown()).nullable(),
    deliveredAt: z.number().nullable(),
    deadLetteredAt: z.number().nullable(),
    expireAt: z.unknown().optional(),
  }),
  'chatSyncFanoutJobs/{jobId}': z.discriminatedUnion('selectorKind', [
    z
      .object({
        jobId: z.string(),
        causeVersion: z.number(),
        cursor: z.object({ pageIndex: z.number(), lastDocId: z.string().nullable() }),
        revision: z.number(),
        status: z.enum(['pending', 'complete', 'deadLetter']),
        attemptCount: z.number(),
        nextAttemptAt: z.number(),
        lastError: z.string().nullable(),
        createdAt: z.number(),
        completedAt: z.number().nullable(),
        deadLetteredAt: z.number().nullable(),
        expireAt: z.unknown().optional(),
        selectorKind: z.literal('channelMembers'),
        selectorArgs: z
          .object({
            workProjectId: z.string(),
            guildChatChannelId: z.string(),
            channelKey: z.string(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        jobId: z.string(),
        causeVersion: z.number(),
        cursor: z.object({ pageIndex: z.number(), lastDocId: z.string().nullable() }),
        revision: z.number(),
        status: z.enum(['pending', 'complete', 'deadLetter']),
        attemptCount: z.number(),
        nextAttemptAt: z.number(),
        lastError: z.string().nullable(),
        createdAt: z.number(),
        completedAt: z.number().nullable(),
        deadLetteredAt: z.number().nullable(),
        expireAt: z.unknown().optional(),
        selectorKind: z.literal('policyEditAffectedUsers'),
        selectorArgs: z
          .object({
            workProjectId: z.string(),
            guildChatChannelId: z.string(),
            channelKey: z.string(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        jobId: z.string(),
        causeVersion: z.number(),
        cursor: z.object({ pageIndex: z.number(), lastDocId: z.string().nullable() }),
        revision: z.number(),
        status: z.enum(['pending', 'complete', 'deadLetter']),
        attemptCount: z.number(),
        nextAttemptAt: z.number(),
        lastError: z.string().nullable(),
        createdAt: z.number(),
        completedAt: z.number().nullable(),
        deadLetteredAt: z.number().nullable(),
        expireAt: z.unknown().optional(),
        selectorKind: z.literal('workChannelsForUser'),
        selectorArgs: z.object({ uid: z.string(), workProjectId: z.string() }).strict(),
      })
      .strict(),
    z
      .object({
        jobId: z.string(),
        causeVersion: z.number(),
        cursor: z.object({ pageIndex: z.number(), lastDocId: z.string().nullable() }),
        revision: z.number(),
        status: z.enum(['pending', 'complete', 'deadLetter']),
        attemptCount: z.number(),
        nextAttemptAt: z.number(),
        lastError: z.string().nullable(),
        createdAt: z.number(),
        completedAt: z.number().nullable(),
        deadLetteredAt: z.number().nullable(),
        expireAt: z.unknown().optional(),
        selectorKind: z.literal('inviteParticipants'),
        selectorArgs: z
          .object({ guildInviteId: z.string(), participantUids: z.array(z.string()) })
          .strict(),
      })
      .strict(),
  ]),
  'chatMessageOutbox/{commandId}': z.object({
    commandId: z.string(),
    kind: z.enum(['userMsg', 'systemMsg']),
    threadRef: z.string(),
    payload: z.record(z.string(), z.unknown()),
    payloadVersion: z.number(),
    status: z.enum(['pending', 'applied', 'deadLetter']),
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    lastError: z.string().nullable(),
    createdAt: z.number(),
    appliedAt: z.number().nullable(),
    deadLetteredAt: z.number().nullable(),
    expireAt: z.unknown().optional(),
  }),
  'chatAdminActionCommands/{requestId}': z.object({
    requestId: z.string(),
    actorUid: z.string(),
    actorMode: z.enum(['adminReview', 'adminOverride']),
    systemRole: z.enum(['admin', 'jrAdmin']),
    channelRef: z.record(z.string(), z.unknown()),
    messageSeq: z.number(),
    action: z.enum(['hide', 'delete']),
    caseId: z.string(),
    reason: z.string(),
    expectedMessageRevision: z.number(),
    payloadHash: z.string(),
    state: z.enum(['queued', 'delivering', 'safetyRepair', 'applied', 'failed', 'deadLetter']),
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    lastError: z.string().nullable(),
    result: z.record(z.string(), z.unknown()).nullable(),
    doRevisionId: z.string().nullable(),
    terminalFailureGeneration: z.number(),
    createdAt: z.number(),
    appliedAt: z.number().nullable(),
    failedAt: z.number().nullable(),
    deadLetteredAt: z.number().nullable(),
    reconciled: z.boolean(),
    reconciledAt: z.number().nullable(),
    safetyRepair: z.boolean(),
    safetyRepairGeneration: z.number(),
    reconcileAttemptCount: z.number(),
    expireAt: z.unknown().optional(),
  }),
  'chatHistoryAnonymizationJobs/{jobId}': z.object({
    jobId: z.string(),
    channelDoId: z.string(),
    epoch: z.number(),
    anonymizedUid: z.string(),
    sourceManifestKey: z.string().nullable(),
    sourceManifestHash: z.string().nullable(),
    sourceGeneration: z.number().nullable(),
    replacementGeneration: z.number().nullable(),
    newManifestKey: z.string().nullable(),
    scanCursor: z.number(),
    rewriteCursor: z.number(),
    deleteCursor: z.number(),
    swappedAt: z.number().nullable(),
    state: z.enum(['scanning', 'rewriting', 'swapping', 'deleting', 'done', 'failed']),
    legalHoldPaused: z.boolean(),
    attemptCount: z.number(),
    nextAttemptAt: z.number(),
    lastError: z.string().nullable(),
    createdAt: z.number(),
    updatedAt: z.number(),
    expireAt: z.unknown().optional(),
  }),
  'chatHistoryAnonymizationJobs/{jobId}/affectedChunks/{chunkOrdinal}': z.object({
    chunkOrdinal: z.number(),
    sourceChunkKey: z.string(),
    sourceSha256: z.string(),
    replacementChunkKey: z.string().nullable(),
    replacementSha256: z.string().nullable(),
    rewriteState: z.enum(['pending', 'done']),
    deleteState: z.enum(['pending', 'done']),
  }),
  'chatParkedDeliveries/{deliveryId}': z
    .object({
      targetDo: z.string(),
      roomKind: z.enum(['channel', 'inbox']),
      eventId: z.string(),
      deliveryKind: z.string(),
      roomAttemptCount: z.number(),
      roomLastError: z.string().nullable(),
      parkedAt: z.number(),
      status: z.enum(['deadLetter', 'pending', 'delivered']),
      attemptCount: z.number(),
      nextAttemptAt: z.number(),
      lastError: z.string().nullable(),
      createdAt: z.number(),
      deadLetteredAt: z.number().nullable(),
      deliveredAt: z.number().nullable(),
      expireAt: z.unknown().optional(),
    })
    .strict(),
  'craftSkillsByTag/{tag}/taggedCraftSkills/{compositeId}': z.object({
    craftSkillId: z.string(),
    compositeId: z.string(),
    userId: z.string(),
    craftSkillName: z.string(),
    craftSkillAssetId: z.string(),
    craftSkillType: z.enum(['image', 'video', 'audio']),
    tags: z.array(
      z.enum([
        'acting',
        'voice-over',
        'singing',
        'rapping',
        'instrumental-performance',
        'dance-choreography',
        'stand-up-sketch-comedy',
        'writing-storytelling',
        'songwriting',
        'poetry-spoken-word',
        'drawing-illustration',
        'painting',
        'animation',
        'graphic-design',
        'photography',
        'cinematography-camera',
        'video-editing',
        'visual-effects',
        'directing',
        'costume-makeup',
        'set-prop-design',
        'music-production',
        'composing-scoring',
        'sound-design',
      ]),
    ),
    createdAt: z.number(),
    hidden: z.boolean(),
    hiddenBy: z.enum(['direct', 'cascade']).optional(),
    kind: z.enum(['original', 'mimicOnTtt', 'mimicOffTtt']),
    source: z
      .object({ type: z.enum(['user', 'workProject']), id: z.string() })
      .strict()
      .optional(),
  }),
  'reservedDisplayNames/{displayNameUppercase}': z.object({
    userId: z.string(),
    displayName: z.string(),
  }),
  'reservedRealmNames/{workingTitleUppercase}': z.object({
    workRealmId: z.string(),
    workingTitle: z.string(),
    retired: z.boolean().optional(),
  }),
  'accountDeletionRequests/{uid}': z
    .object({
      schemaVersion: z.literal(1),
      uid: z.string(),
      status: z.enum([
        'pending',
        'cancelled',
        'scrubbing',
        'leased',
        'parkedOnHold',
        'completed',
        'superseded',
      ]),
      requestedAt: z.number(),
      scheduledScrubAt: z.number(),
      graceDays: z.number(),
      cancelledAt: z.number().optional(),
      tokenRevocationNextAttemptAt: z.number().optional(),
      tokensRevokedAt: z.number().optional(),
      scrubStartedAt: z.number().optional(),
      parkedReason: z.string().optional(),
      parkedAt: z.number().optional(),
      lastHoldCheckAt: z.number().optional(),
      completedAt: z.number().optional(),
      supersededAt: z.number().optional(),
      supersededReason: z.string().optional(),
      erasureLease: z
        .object({
          epoch: z.number(),
          state: z.enum(['active', 'revoked', 'released']),
          acquiredAt: z.number(),
          expiresAt: z.number(),
          phase: z.string().optional(),
          revokedByHoldRefId: z.string().optional(),
          revokedAt: z.number().optional(),
          releasedAt: z.number().optional(),
        })
        .strict()
        .optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
    })
    .strict(),
  'shortLinks/{shortId}': z.object({
    shortId: z.string(),
    shortUrl: z.string(),
    destinationUrl: z.string(),
    type: z.enum(['audition', 'audition-entry', 'commission', 'hall-library-item']),
    metadata: z.object({
      auditionId: z.string().nullable(),
      auditionEntryId: z.string().nullable(),
      commissionListingId: z.string().nullable(),
      hallItemId: z.string().nullable(),
    }),
    createdAt: z.number(),
    createdBy: z.string(),
    clicks: z.number(),
  }),
  'feedbackSubmissions/{feedbackType}/userSuggestions/{suggestionId}': z.object({
    suggestionText: z.string(),
    count: z.number(),
    submittedBy: z.array(z.object({ userId: z.string() })),
    lastSubmitted: z.number(),
  }),
  'statusReconcileQueue/{uid}': z.discriminatedUnion('authEffect', [
    z.object({
      uid: z.string(),
      enqueuedAt: z.number(),
      lastAttemptAt: z.number().optional(),
      attemptCount: z.number(),
      reason: z.literal('statusChangePending'),
      authEffect: z.literal('accountStatus').optional(),
      targetStatus: z.enum(['active', 'suspended', 'banned']),
      writeId: z.string(),
    }),
    z
      .object({
        uid: z.string(),
        enqueuedAt: z.number(),
        lastAttemptAt: z.number().optional(),
        attemptCount: z.number(),
        reason: z.literal('postCommitAuthEffectFailed'),
        authEffect: z.literal('publicDocumentsAcceptedClaim'),
      })
      .strict(),
    z
      .object({
        uid: z.string(),
        enqueuedAt: z.number(),
        lastAttemptAt: z.number().optional(),
        attemptCount: z.number(),
        reason: z.literal('postCommitAuthEffectFailed'),
        authEffect: z.literal('adminClaims'),
      })
      .strict(),
    z
      .object({
        uid: z.string(),
        enqueuedAt: z.number(),
        lastAttemptAt: z.number().optional(),
        attemptCount: z.number(),
        reason: z.literal('postCommitAuthEffectFailed'),
        authEffect: z.literal('registeredMemberClaim'),
      })
      .strict(),
  ]),
  'publicDocuments/{documentId}/publicDocumentVersions/{versionId}': z.discriminatedUnion(
    'documentId',
    [
      z.object({
        documentId: z.literal('termsOfService'),
        content: z.object({
          sections: z.array(
            z.object({
              id: z.string(),
              heading: z.string(),
              level: z.union([z.literal(1), z.literal(2)]),
              body: z.string(),
              order: z.number(),
            }),
          ),
        }),
        version: z.number(),
        releaseId: z.string(),
        publishedBy: z.string(),
        publishedAt: z.number(),
      }),
      z.object({
        documentId: z.literal('privacyPolicy'),
        content: z.object({
          sections: z.array(
            z.object({
              id: z.string(),
              heading: z.string(),
              level: z.union([z.literal(1), z.literal(2)]),
              body: z.string(),
              order: z.number(),
            }),
          ),
        }),
        version: z.number(),
        releaseId: z.string(),
        publishedBy: z.string(),
        publishedAt: z.number(),
      }),
      z.object({
        documentId: z.literal('rulesAndAgreements'),
        content: z.object({
          intro: z.string().optional(),
          groupIntentions: z
            .record(z.enum(['generic', 'merchandising', 'hallWing', 'workRealm']), z.string())
            .optional(),
          rules: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              description: z.string(),
              group: z.enum(['generic', 'merchandising', 'hallWing', 'workRealm']),
              workProjectType: z.enum(['Tales', 'Tunes', 'Television']).optional(),
              hallWingType: z.enum(['entertainment', 'educational', 'newsPolitical']).optional(),
              order: z.number(),
            }),
          ),
          agreements: z.object({
            intention: z.string().optional(),
            points: z.array(
              z.object({
                id: z.string(),
                text: z.string(),
                workProjectType: z.enum(['Tales', 'Tunes', 'Television']).optional(),
                hallWingType: z.enum(['entertainment', 'educational', 'newsPolitical']).optional(),
              }),
            ),
          }),
        }),
        version: z.number(),
        releaseId: z.string(),
        publishedBy: z.string(),
        publishedAt: z.number(),
      }),
      z.object({
        documentId: z.literal('futurePlans'),
        content: z.object({
          intro: z.string().optional(),
          groups: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              order: z.number(),
              intention: z.string().optional(),
            }),
          ),
          plans: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              description: z.string(),
              groupId: z.string(),
              order: z.number(),
            }),
          ),
        }),
        version: z.number(),
        releaseId: z.string(),
        publishedBy: z.string(),
        publishedAt: z.number(),
      }),
      z.object({
        documentId: z.literal('dmcaPolicy'),
        content: z.object({
          intro: z.string(),
          contactBlocks: z.array(
            z.object({
              id: z.string(),
              heading: z.string(),
              order: z.number(),
              rows: z.array(
                z.object({
                  id: z.string(),
                  label: z.string(),
                  value: z.string(),
                  order: z.number(),
                }),
              ),
            }),
          ),
          sections: z.array(
            z.object({
              id: z.string(),
              heading: z.string(),
              level: z.union([z.literal(1), z.literal(2)]),
              body: z.string(),
              order: z.number(),
            }),
          ),
        }),
        version: z.number(),
        releaseId: z.string(),
        publishedBy: z.string(),
        publishedAt: z.number(),
      }),
      z.object({
        documentId: z.literal('takeItDownPageCopy'),
        content: z.object({ strings: z.record(z.string(), z.string()) }),
        version: z.number(),
        releaseId: z.string(),
        publishedBy: z.string(),
        publishedAt: z.number(),
      }),
    ],
  ),
  'publicDocumentDrafts/{documentId}': z.discriminatedUnion('documentId', [
    z.object({
      documentId: z.literal('termsOfService'),
      content: z.object({
        sections: z.array(
          z.object({
            id: z.string(),
            heading: z.string(),
            level: z.union([z.literal(1), z.literal(2)]),
            body: z.string(),
            order: z.number(),
          }),
        ),
      }),
      baseVersion: z.number(),
      revision: z.number(),
      savedBy: z.string(),
      savedAt: z.number(),
    }),
    z.object({
      documentId: z.literal('privacyPolicy'),
      content: z.object({
        sections: z.array(
          z.object({
            id: z.string(),
            heading: z.string(),
            level: z.union([z.literal(1), z.literal(2)]),
            body: z.string(),
            order: z.number(),
          }),
        ),
      }),
      baseVersion: z.number(),
      revision: z.number(),
      savedBy: z.string(),
      savedAt: z.number(),
    }),
    z.object({
      documentId: z.literal('rulesAndAgreements'),
      content: z.object({
        intro: z.string().optional(),
        groupIntentions: z
          .record(z.enum(['generic', 'merchandising', 'hallWing', 'workRealm']), z.string())
          .optional(),
        rules: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string(),
            group: z.enum(['generic', 'merchandising', 'hallWing', 'workRealm']),
            workProjectType: z.enum(['Tales', 'Tunes', 'Television']).optional(),
            hallWingType: z.enum(['entertainment', 'educational', 'newsPolitical']).optional(),
            order: z.number(),
          }),
        ),
        agreements: z.object({
          intention: z.string().optional(),
          points: z.array(
            z.object({
              id: z.string(),
              text: z.string(),
              workProjectType: z.enum(['Tales', 'Tunes', 'Television']).optional(),
              hallWingType: z.enum(['entertainment', 'educational', 'newsPolitical']).optional(),
            }),
          ),
        }),
      }),
      baseVersion: z.number(),
      revision: z.number(),
      savedBy: z.string(),
      savedAt: z.number(),
    }),
    z.object({
      documentId: z.literal('futurePlans'),
      content: z.object({
        intro: z.string().optional(),
        groups: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            order: z.number(),
            intention: z.string().optional(),
          }),
        ),
        plans: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string(),
            groupId: z.string(),
            order: z.number(),
          }),
        ),
      }),
      baseVersion: z.number(),
      revision: z.number(),
      savedBy: z.string(),
      savedAt: z.number(),
    }),
    z.object({
      documentId: z.literal('dmcaPolicy'),
      content: z.object({
        intro: z.string(),
        contactBlocks: z.array(
          z.object({
            id: z.string(),
            heading: z.string(),
            order: z.number(),
            rows: z.array(
              z.object({ id: z.string(), label: z.string(), value: z.string(), order: z.number() }),
            ),
          }),
        ),
        sections: z.array(
          z.object({
            id: z.string(),
            heading: z.string(),
            level: z.union([z.literal(1), z.literal(2)]),
            body: z.string(),
            order: z.number(),
          }),
        ),
      }),
      baseVersion: z.number(),
      revision: z.number(),
      savedBy: z.string(),
      savedAt: z.number(),
    }),
    z.object({
      documentId: z.literal('takeItDownPageCopy'),
      content: z.object({ strings: z.record(z.string(), z.string()) }),
      baseVersion: z.number(),
      revision: z.number(),
      savedBy: z.string(),
      savedAt: z.number(),
    }),
  ]),
  'publicDocumentReleases/{releaseId}': z.object({
    releaseId: z.string(),
    documents: z.array(
      z
        .object({
          documentId: z.enum([
            'termsOfService',
            'privacyPolicy',
            'rulesAndAgreements',
            'futurePlans',
            'dmcaPolicy',
            'takeItDownPageCopy',
          ]),
          version: z.number(),
        })
        .strict(),
    ),
    requireAcceptance: z.boolean(),
    requiredAcceptanceLevel: z.number(),
    publishedBy: z.string(),
    publishedAt: z.number(),
  }),
  'childSafetyCaseList/{caseId}': z
    .object({
      schemaVersion: z.literal(1),
      caseId: z.string(),
      revision: z.number(),
      canonicalIncidentKey: z.string(),
      incidentClass: z.enum([
        'apparentCsam',
        'enticement',
        'minorSexTrafficking',
        'sextortion',
        'csamSolicitation',
        'imminentCsea',
        'nonReportableSafety',
      ]),
      sourceSignalSummary: z
        .object({
          count: z.number(),
          latestKind: z.enum(['hashMatch', 'report', 'aiFlag', 'manual', 'copyMatch']),
          latestAt: z.number(),
        })
        .strict(),
      workStatus: z.enum([
        'new',
        'triaged',
        'reporting',
        'actioning',
        'processing',
        'failed',
        'operationallyResolved',
      ]),
      preservationStatus: z.enum([
        'preReportHold',
        'statutoryHold',
        'extendedHold',
        'dispositionPending',
        'destroyed',
      ]),
      ncmecStatus: z.enum(['awaitingManualFiling', 'completed']),
      accountActionStatus: z.enum([
        'noAccountActionRequired',
        'operatorDecisionPending',
        'pending',
        'resolved',
      ]),
      reportDisposition: z.enum([
        'undetermined',
        'reportRequired',
        'notRequired',
        'correctedNoApparentViolation',
      ]),
      actualKnowledgeAt: z.number().optional(),
      reportState: z
        .enum(['reportAsSoonAsReasonablyPossible', 'submissionInProgress', 'completed'])
        .optional(),
      submissionCompletedAt: z.number().optional(),
      preserveUntil: z.number().optional(),
      openHoldCount: z.number(),
      relatedCaseIds: z.array(z.string()).optional(),
      contextResolutionPending: z.boolean().optional(),
      testListDrill: z.literal(true).optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
    })
    .strict(),
  'activeSafetyCaseAlerts/{caseId}': z
    .object({
      schemaVersion: z.literal(1),
      caseId: z.string(),
      caseKind: z.enum(['childSafety', 'ncii']),
      createdAt: z.number(),
    })
    .strict(),
  'childSafetyCases/{caseId}': z
    .object({
      schemaVersion: z.literal(1),
      caseId: z.string(),
      evidenceManifestId: z.string(),
      currentReasonInternal: z.string(),
      leaseOwner: z.string().optional(),
      leaseExpiresAt: z.number().optional(),
      fencingOwnerToken: z.string().optional(),
      fencingGeneration: z.number().optional(),
      chatMessageLocator: z
        .discriminatedUnion('kind', [
          z.object({ kind: z.literal('mediaAsset'), mediaAssetId: z.string() }).strict(),
          z
            .object({
              kind: z.literal('hallItem'),
              hallItemId: z.string(),
              subItemId: z.string().optional(),
            })
            .strict(),
          z.object({ kind: z.literal('squarePost'), postId: z.string() }).strict(),
          z.object({ kind: z.literal('profileImage'), profileUid: z.string() }).strict(),
          z.object({ kind: z.literal('username'), profileUid: z.string() }).strict(),
          z
            .object({
              kind: z.literal('craftSkill'),
              profileUid: z.string(),
              craftSkillId: z.string(),
            })
            .strict(),
          z
            .object({ kind: z.literal('commissionListing'), commissionListingId: z.string() })
            .strict(),
          z
            .object({
              kind: z.literal('commissionProposal'),
              commissionListingId: z.string(),
              commissionProposalId: z.string(),
            })
            .strict(),
          z.object({ kind: z.literal('workProject'), workProjectId: z.string() }).strict(),
          z
            .object({
              kind: z.literal('workAsset'),
              workProjectId: z.string(),
              workAssetId: z.string(),
            })
            .strict(),
          z.object({ kind: z.literal('workRealm'), workRealmId: z.string() }).strict(),
          z.object({ kind: z.literal('audition'), auditionId: z.string() }).strict(),
          z
            .object({
              kind: z.literal('auditionEntry'),
              auditionId: z.string(),
              auditionEntryId: z.string(),
            })
            .strict(),
          z
            .object({
              kind: z.literal('guildInviteMessage'),
              channelId: z.string(),
              messageId: z.string(),
            })
            .strict(),
          z
            .object({
              kind: z.literal('conversationFile'),
              conversation: z.discriminatedUnion('kind', [
                z.object({ kind: z.literal('guildInvite'), guildInviteId: z.string() }).strict(),
                z.object({ kind: z.literal('adminSupport'), adminDispatchId: z.string() }).strict(),
              ]),
              conversationFileId: z.string(),
              mediaAssetId: z.string(),
            })
            .strict(),
          z
            .object({
              kind: z.literal('guildChatMessage'),
              channelId: z.string(),
              messageId: z.string(),
            })
            .strict(),
          z.object({ kind: z.literal('url'), url: z.string() }).strict(),
          z.object({ kind: z.literal('additionalText'), textRef: z.string() }).strict(),
        ])
        .optional(),
      contextResolutionPending: z.boolean().optional(),
      crossoverLegs: z
        .object({
          servingDeny: z.enum(['pending', 'done', 'failed']).optional(),
          photoDna: z.enum(['pending', 'done', 'failed']).optional(),
          itemsCursor: z
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
        })
        .strict()
        .optional(),
    })
    .strict(),
  'childSafetyCases/{caseId}/sourceSignals/{signalId}': z
    .object({
      at: z.number(),
      kind: z.enum(['hashMatch', 'report', 'aiFlag', 'manual', 'copyMatch']),
      detector: z.string().optional(),
      sourceRef: z.string(),
      actorId: z.string().optional(),
    })
    .strict(),
  'childSafetyCases/{caseId}/childSafetyDecisions/{decisionId}': z
    .object({
      at: z.number(),
      actorId: z.string(),
      kind: z.enum([
        'workStatus',
        'accountAction',
        'reportDisposition',
        'reasonUpdate',
        'caseClosed',
      ]),
      from: z.string(),
      to: z.string(),
      reasonInternal: z.string(),
      reasonUserFacing: z.string().optional(),
      evidenceItemsViewedCount: z.number(),
      closure: z
        .object({
          outcome: z.enum(['founded', 'unfounded']),
          resolutionSummary: z.string(),
          adminNote: z.string().optional(),
          closedByUid: z.string(),
          closedAt: z.number(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  'childSafetyCases/{caseId}/childSafetyDecisions/{decisionId}/childSafetyDecisionViews/{viewId}': z
    .object({ evidenceItemId: z.string(), at: z.number() })
    .strict(),
  'childSafetyCases/{caseId}/childSafetyCaseAccounts/{uid}': z
    .object({
      role: z.enum(['uploader', 'requester', 'distributor', 'questionable']),
      subjectDisposition: z.enum(['subject', 'questionable', 'excluded']),
      platformAction: z.enum(['none', 'watch', 'suspend', 'safetyLocked', 'ban']),
      reasonUserFacing: z.string(),
      reasonInternal: z.string(),
      updatedAt: z.number(),
    })
    .strict(),
  'childSafetyCases/{caseId}/childSafetyCaseAccounts/{uid}/childSafetyCaseAccountHistory/{historyId}':
    z
      .object({
        role: z.enum(['uploader', 'requester', 'distributor', 'questionable']),
        subjectDisposition: z.enum(['subject', 'questionable', 'excluded']),
        platformAction: z.enum(['none', 'watch', 'suspend', 'safetyLocked', 'ban']),
        reasonUserFacing: z.string(),
        reasonInternal: z.string(),
        at: z.number(),
      })
      .strict(),
  'childSafetyCases/{caseId}/childSafetyCaseCrossoverItems/{mediaAssetId}': z
    .object({
      schemaVersion: z.literal(1),
      caseId: z.string(),
      mediaAssetId: z.string(),
      servingDeny: z.enum(['pending', 'done', 'failed']),
      servingDeniedAt: z.number().optional(),
      servingDenyFailedAt: z.number().optional(),
      servingDenyLastError: z.string().optional(),
      photoDna: z.enum(['pending', 'done', 'failed']).optional(),
      photoDnaScannedAt: z.number().optional(),
      photoDnaFailedAt: z.number().optional(),
      photoDnaLastError: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
    })
    .strict(),
  'childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}': z
    .object({
      kind: z.enum(['initial', 'supplemental', 'correction']),
      state: z.enum(['awaitingManualFiling', 'completed']),
      completionChannel: z.enum(['manualPortal']).optional(),
      submissionCompletedAt: z.number().optional(),
      completionProofType: z.enum(['portalConfirmation']).optional(),
      completionProofRef: z.string().optional(),
      reportId: z.string().optional(),
      responseCode: z.number().optional(),
    })
    .strict(),
  'childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}/ncmecSubmissionFiles/{fileId}': z
    .object({
      localEvidenceItemId: z.string(),
      ncmecFileId: z.string().optional(),
      md5: z.string().optional(),
      fileInfoState: z.enum(['pending', 'sent', 'ack']),
    })
    .strict(),
  'childSafetyCases/{caseId}/ncmecSubmissions/{submissionId}/ncmecCompletionProof/record': z.object(
    {
      caseId: z.string(),
      submissionId: z.string(),
      channel: z.enum(['manualPortal']),
      proofType: z.enum(['portalConfirmation']),
      portalReceiptArtifactId: z.string(),
      proofText: z.string().optional(),
      ncmecReportId: z.string(),
      recordedByUid: z.string(),
      recordedAt: z.number(),
    },
  ),
  'childSafetyCases/{caseId}/legalProcess/{eventId}': z
    .object({
      at: z.number(),
      kind: z.enum(['leWatch', 'leDataRequest', 'leShutdown', 'leDestruction', 'disclosure']),
      verifiedBy: z.string(),
      instruction: z.string(),
      handedOver: z.boolean().optional(),
    })
    .strict(),
  'childSafetyCases/{caseId}/portalReceiptArtifacts/{artifactId}': z.object({
    schemaVersion: z.literal(1),
    caseId: z.string(),
    submissionId: z.string(),
    evidenceVaultKey: z.string(),
    objectGeneration: z.string(),
    sha256: z.string(),
    contentType: z.string(),
    sizeBytes: z.number(),
    capturedAt: z.number(),
    registeredByUid: z.string(),
    description: z.string().optional(),
  }),
  'childSafetyCases/{caseId}/ncmecPortalCorrections/{correctionId}': z.object({
    schemaVersion: z.literal(1),
    caseId: z.string(),
    ncmecReportId: z.string(),
    correctionFiledAt: z.number(),
    reason: z.string(),
    recordedByUid: z.string(),
    recordedAt: z.number(),
  }),
  'childSafetyOwningAliases/{aliasId}': z
    .object({
      schemaVersion: z.literal(1),
      caseId: z.string(),
      aliasType: z.enum(['incidentKey', 'rootIngest', 'canonicalTarget', 'messageRange']),
      canonicalValueHash: z.string(),
      createdAt: z.number(),
      generation: z.number().optional(),
      updatedAt: z.number().optional(),
    })
    .strict(),
  'safetyHoldRefs/{holdRefId}': z
    .object({
      schemaVersion: z.literal(1),
      caseId: z.string(),
      resourceType: z.enum([
        'contentDoc',
        'mediaAsset',
        'account',
        'chatMessageRange',
        'channel',
        'nciiTemporaryTarget',
        'storageObject',
        'reportEvidenceObject',
      ]),
      resourceId: z.string(),
      resourceKeyHash: z.string(),
      canonicalResourceKey: z.string(),
      ownerUid: z.string().optional(),
      blocksDeletion: z.boolean(),
      blocksAnonymization: z.boolean(),
      blocksReplacementCleanup: z.boolean(),
      state: z.enum(['active', 'released']),
      holdClass: z.enum([
        'childSafety',
        'nciiTemporary',
        'legalRetention',
        'preservationEvidence',
        'ordinaryReport',
      ]),
      createdAt: z.number(),
      releasedAt: z.number().optional(),
      releaseReason: z.string().optional(),
      sourceRequestId: z.string().optional(),
      expiresAt: z.number().optional(),
      releaseCommandId: z.string().optional(),
    })
    .strict(),
  'safetyHoldResources/{resourceKeyHash}': z
    .object({
      schemaVersion: z.literal(1),
      resourceKeyHash: z.string(),
      canonicalResourceKey: z.string(),
      activeRefCount: z.number(),
      blocksDeletionCount: z.number(),
      blocksAnonymizationCount: z.number(),
      blocksReplacementCleanupCount: z.number(),
      updatedAt: z.number(),
    })
    .strict(),
  'safetyResourceCommands/{commandDocId}': z
    .object({
      schemaVersion: z.literal(1),
      resourceKeyHash: z.string(),
      canonicalResourceKey: z.string(),
      commandId: z.string(),
      commandKind: z.enum(['nciiRemoval', 'csamActiveByteRemoval', 'evidenceDisposition']),
      resourceType: z.enum([
        'mediaAsset',
        'hallItem',
        'squarePost',
        'profileImage',
        'username',
        'craftSkill',
        'commissionListing',
        'commissionProposal',
        'workProject',
        'workAsset',
        'workRealm',
        'audition',
        'auditionEntry',
        'guildInviteMessage',
        'conversationFile',
        'guildChatMessage',
        'url',
        'additionalText',
      ]),
      authorizedFor: z
        .object({
          requestIds: z.array(z.string()),
          caseId: z.string().optional(),
          linkedCaseIds: z.array(z.string()).optional(),
          requestIdsOverflowed: z.boolean().optional(),
        })
        .strict(),
      bypassHoldRefIds: z.array(z.string()),
      bypassHoldRefsOverflowed: z.boolean().optional(),
      state: z.enum(['authorized', 'executing', 'verifiedRemoved', 'failed']),
      attemptCount: z.number(),
      leaseOwner: z.string().optional(),
      leaseExpiresAt: z.number().optional(),
      lastErrorCode: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
      verifiedRemovedAt: z.number().optional(),
    })
    .strict(),
  'safetyResourceCommands/{commandDocId}/authorizedRequests/{requestId}': z
    .object({ requestId: z.string(), caseId: z.string().optional(), addedAt: z.number() })
    .strict(),
  'safetyResourceCommands/{commandDocId}/bypassRefs/{refId}': z
    .object({
      refId: z.string(),
      holdClass: z.enum([
        'childSafety',
        'nciiTemporary',
        'legalRetention',
        'preservationEvidence',
        'ordinaryReport',
      ]),
      addedAt: z.number(),
    })
    .strict(),
  'safetyEvidenceManifests/{manifestId}': z
    .object({
      schemaVersion: z.literal(1),
      manifestId: z.string(),
      caseId: z.string(),
      createdAt: z.number(),
      sourceKind: z.enum(['media', 'communication', 'externalFact']),
      original: z
        .object({
          bucket: z.string(),
          key: z.string(),
          generation: z.string(),
          contentType: z.string(),
          filename: z.string().optional(),
          sizeBytes: z.number(),
          md5: z.string(),
          sha256: z.string(),
          capturedAt: z.number(),
        })
        .strict()
        .optional(),
      variants: z
        .array(
          z.object({ variantKey: z.string(), sha256: z.string(), sizeBytes: z.number() }).strict(),
        )
        .optional(),
      lineage: z
        .object({
          lineageVersion: z.literal(1),
          rootIngestId: z.string(),
          rootAssetId: z.string(),
          sourceAssetId: z.string().optional(),
          originatingUploaderUid: z.string(),
          originatingUploadEventId: z.string(),
          originalUploadCreatedAt: z.number(),
          rootSha256: z.string(),
          originalSha256: z.string().optional(),
          variantSha256s: z.record(
            z.enum(['full', 'medium', 'small', 'main', 'poster']),
            z.string(),
          ),
          copyReason: z.enum([
            'original',
            'variant',
            'hall_publish',
            'profile_derivative',
            'moderation_copy',
            'evidence_copy',
            'other',
          ]),
          createdFromOwnerType: z
            .enum([
              'userProfile',
              'craftSkill',
              'squareStreetzPost',
              'workProject',
              'workContent',
              'hallItem',
              'commissionListing',
              'commissionProposal',
              'audition',
              'auditionEntry',
              'conversationFile',
              'realmFile',
              'safetyEvidence',
              'systemContent',
            ])
            .optional(),
          createdFromOwnerId: z.string().optional(),
          copyActorUid: z.string().optional(),
          currentOwnerType: z.enum([
            'userProfile',
            'craftSkill',
            'squareStreetzPost',
            'workProject',
            'workContent',
            'hallItem',
            'commissionListing',
            'commissionProposal',
            'audition',
            'auditionEntry',
            'conversationFile',
            'realmFile',
            'safetyEvidence',
            'systemContent',
          ]),
          currentOwnerId: z.string(),
        })
        .strict()
        .optional(),
      communication: z
        .object({
          channelId: z.string(),
          messageSeqStart: z.number(),
          messageSeqEnd: z.number(),
          transcriptObjectRef: z.string(),
          attachmentItemIds: z.array(z.string()),
        })
        .strict()
        .optional(),
      externalFact: z
        .object({
          factKind: z.enum(['lawEnforcement', 'thirdPartyReport', 'operatorKnowledge', 'other']),
          narrativeRef: z.string(),
          establishedActualKnowledgeAt: z.number().optional(),
          sourceContactRef: z.string().optional(),
        })
        .strict()
        .optional(),
      subjectAccountsRef: z.string(),
      provenanceRefs: z.array(z.string()),
      contentDocSnapshotRef: z.string().optional(),
      contentDocRevision: z.number().optional(),
      detector: z
        .object({
          source: z.string(),
          listId: z.string(),
          sdkVersion: z.string(),
          requestTraceId: z.string(),
          matchResult: z.string(),
        })
        .strict()
        .optional(),
      evidenceCopy: z
        .object({
          destinationBucket: z.string(),
          destinationKey: z.string(),
          keyVersion: z.string(),
          verifyMethod: z.string(),
          verifyResult: z.string(),
        })
        .strict()
        .optional(),
      reporter: z
        .object({ reporterUidRef: z.string(), narrativeRef: z.string() })
        .strict()
        .optional(),
      ncmecReceiptRefs: z.array(z.string()),
    })
    .strict(),
  'safetyEvidenceJobs/{jobId}': z
    .object({
      schemaVersion: z.literal(1),
      jobId: z.string(),
      caseId: z.string(),
      phase: z.enum(['capture', 'verify', 'disposition']),
      commandId: z.string(),
      status: z.enum(['pending', 'running', 'verified', 'disposed', 'deadLetter']),
      attemptCount: z.number(),
      nextAttemptAt: z.number(),
      leaseOwner: z.string().optional(),
      leaseExpiresAt: z.number().optional(),
      lastErrorCode: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
      completedAt: z.number().optional(),
      disposedAt: z.number().optional(),
      deadLetterAt: z.number().optional(),
    })
    .strict(),
  'safetyEvidenceJobs/{jobId}/safetyEvidenceJobItems/{itemId}': z.union([
    z
      .object({
        role: z.enum(['source', 'destination']),
        bucket: z.string(),
        key: z.string(),
        generation: z.string().optional(),
        sizeBytes: z.number(),
        sha256: z.string(),
        md5: z.string().optional(),
        verifyResult: z.enum(['pending', 'ok', 'mismatch']),
      })
      .strict(),
    z
      .object({
        role: z.literal('control'),
        sourceDiscriminator: z.string(),
        request: z.discriminatedUnion('kind', [
          z
            .object({
              kind: z.literal('media'),
              sourceBucket: z.string(),
              sourceKey: z.string(),
              lineage: z
                .object({
                  lineageVersion: z.literal(1),
                  rootIngestId: z.string(),
                  rootAssetId: z.string(),
                  sourceAssetId: z.string().optional(),
                  originatingUploaderUid: z.string(),
                  originatingUploadEventId: z.string(),
                  originalUploadCreatedAt: z.number(),
                  rootSha256: z.string(),
                  originalSha256: z.string().optional(),
                  variantSha256s: z.record(
                    z.enum(['full', 'medium', 'small', 'main', 'poster']),
                    z.string(),
                  ),
                  copyReason: z.enum([
                    'original',
                    'variant',
                    'hall_publish',
                    'profile_derivative',
                    'moderation_copy',
                    'evidence_copy',
                    'other',
                  ]),
                  createdFromOwnerType: z
                    .enum([
                      'userProfile',
                      'craftSkill',
                      'squareStreetzPost',
                      'workProject',
                      'workContent',
                      'hallItem',
                      'commissionListing',
                      'commissionProposal',
                      'audition',
                      'auditionEntry',
                      'conversationFile',
                      'realmFile',
                      'safetyEvidence',
                      'systemContent',
                    ])
                    .optional(),
                  createdFromOwnerId: z.string().optional(),
                  copyActorUid: z.string().optional(),
                  currentOwnerType: z.enum([
                    'userProfile',
                    'craftSkill',
                    'squareStreetzPost',
                    'workProject',
                    'workContent',
                    'hallItem',
                    'commissionListing',
                    'commissionProposal',
                    'audition',
                    'auditionEntry',
                    'conversationFile',
                    'realmFile',
                    'safetyEvidence',
                    'systemContent',
                  ]),
                  currentOwnerId: z.string(),
                })
                .strict(),
              variants: z
                .array(
                  z
                    .object({ variantKey: z.string(), sha256: z.string(), sizeBytes: z.number() })
                    .strict(),
                )
                .optional(),
              detector: z
                .object({
                  source: z.string(),
                  listId: z.string(),
                  sdkVersion: z.string(),
                  requestTraceId: z.string(),
                  matchResult: z.string(),
                })
                .strict()
                .optional(),
              contentDocSnapshotRef: z.string().optional(),
              contentDocRevision: z.number().optional(),
            })
            .strict(),
          z
            .object({
              kind: z.literal('communication'),
              communication: z
                .object({
                  channelId: z.string(),
                  messageSeqStart: z.number(),
                  messageSeqEnd: z.number(),
                  transcriptObjectRef: z.string(),
                  attachmentItemIds: z.array(z.string()),
                })
                .strict(),
              contentDocSnapshotRef: z.string().optional(),
              contentDocRevision: z.number().optional(),
            })
            .strict(),
          z
            .object({
              kind: z.literal('externalFact'),
              externalFact: z
                .object({
                  factKind: z.enum([
                    'lawEnforcement',
                    'thirdPartyReport',
                    'operatorKnowledge',
                    'other',
                  ]),
                  narrativeRef: z.string(),
                  establishedActualKnowledgeAt: z.number().optional(),
                  sourceContactRef: z.string().optional(),
                })
                .strict(),
              contentDocSnapshotRef: z.string().optional(),
              contentDocRevision: z.number().optional(),
            })
            .strict(),
        ]),
        provenanceRefs: z.array(z.string()),
      })
      .strict(),
    z
      .object({
        role: z.literal('control'),
        sourceDiscriminator: z.string(),
        captureJobId: z.string(),
        requestKind: z.enum(['media', 'communication', 'externalFact']),
      })
      .strict(),
  ]),
  'safetyEvidenceJobs/{jobId}/safetyEvidenceJobDisposition/{locationId}': z
    .object({
      bucket: z.string(),
      key: z.string(),
      generation: z.string().optional(),
      method: z.enum(['delete', 'cryptoErase']),
      verifiedAt: z.number(),
      result: z.enum(['gone', 'leftover']),
      leftoverDetail: z.string().optional(),
    })
    .strict(),
  'eventProvenance/{eventId}': z
    .object({
      schemaVersion: z.literal(1),
      kind: z.enum(['uploadInit', 'uploadFinalize', 'messageSend', 'reportSubmit']),
      subjectRefs: z
        .object({
          uid: z.string().optional(),
          assetId: z.string().optional(),
          channelId: z.string().optional(),
          messageSeq: z.number().optional(),
          reportId: z.string().optional(),
        })
        .strict(),
      trustedClientIp: z.string(),
      userAgent: z.string(),
      at: z.number(),
      sessionId: z.string(),
      retentionClass: z.enum(['routine', 'casePromoted']),
    })
    .strict(),
  'quarantineSagaJobs/{caseId}': z
    .object({
      schemaVersion: z.literal(1),
      caseId: z.string(),
      quarantineStatus: z.enum(['running', 'quarantineComplete', 'deadLetter']),
      phase: z.enum([
        'holdCommitted',
        'sourceManifestCaptured',
        'servingDenyRequested',
        'servingDenyVerified',
        'evidenceCopying',
        'evidenceVerified',
        'activeCopiesRemovalRequested',
        'activeCopiesRemovalVerified',
        'quarantineComplete',
      ]),
      phaseVersion: z.number(),
      commandId: z.string(),
      relatedAssetIds: z.array(z.string()),
      attemptCount: z.number(),
      nextAttemptAt: z.number(),
      leaseOwner: z.string().optional(),
      leaseExpiresAt: z.number().optional(),
      lastError: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
      completedAt: z.number().optional(),
    })
    .strict(),
  'quarantineSagaJobs/{caseId}/relatedAssets/{assetId}': z
    .object({ rootIngestId: z.string(), addedAt: z.number() })
    .strict(),
  'ncmecSubmissionJobs/{ncmecJobId}': z
    .object({
      schemaVersion: z.literal(1),
      caseId: z.string(),
      submissionId: z.string(),
      state: z.enum(['awaitingManualFiling', 'completed']),
      commandId: z.string(),
      attemptCount: z.number(),
      nextAttemptAt: z.number(),
      leaseOwner: z.string().optional(),
      leaseExpiresAt: z.number().optional(),
      lastErrorCode: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
      completedAt: z.number().optional(),
    })
    .strict(),
  'accountActionCommands/{accountActionCommandId}': z
    .object({
      schemaVersion: z.literal(1),
      caseId: z.string(),
      targetUid: z.string(),
      action: z.enum(['ban', 'suspend', 'watch', 'safetyLocked', 'reinstate', 'none']),
      source: z.enum(['autoHash', 'operator']),
      status: z.enum(['pending', 'applied', 'reverted', 'deadLetter']),
      commandId: z.string(),
      attemptCount: z.number(),
      nextAttemptAt: z.number(),
      leaseOwner: z.string().optional(),
      leaseExpiresAt: z.number().optional(),
      lastError: z.string().optional(),
      deadLetterAt: z.number().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
      completedAt: z.number().optional(),
    })
    .strict(),
  'safetySlaMonitors/{monitorId}': z
    .object({
      schemaVersion: z.literal(1),
      caseId: z.string().optional(),
      requestId: z.string().optional(),
      monitorKind: z.enum([
        'photoDnaContract',
        'actualKnowledgeUnreported',
        'ncmecRetry',
        'quarantineStall',
        'evidenceStall',
        'accountActionPending',
        'nciiRemovalDeadline',
      ]),
      armedAt: z.number(),
      deadlineAt: z.number(),
      escalationLevel: z.number(),
      lastFiredAt: z.number().optional(),
      monitorStage: z.enum(['provisional', 'binding']).optional(),
      basisSubmissionId: z.string().optional(),
      status: z.enum(['armed', 'overdue', 'resolved']),
      resolvedAt: z.number().optional(),
      resolutionBasis: z.string().optional(),
    })
    .strict(),
  'safetyMonitorHeartbeat/global': z
    .object({ schemaVersion: z.literal(1), lastRunAt: z.number(), expectedIntervalMs: z.number() })
    .strict(),
  'ageAttestationNonces/{nonceHash}': z
    .object({
      schemaVersion: z.literal(1),
      bracket: z.enum(['teen', 'adult']),
      policyVersion: z.string(),
      signingKeyVersion: z.string(),
      requestSessionHash: z.string(),
      issuedAt: z.number(),
      expiresAt: z.number(),
      consumedAt: z.number().optional(),
      consumedByUid: z.string().optional(),
      status: z.enum(['issued', 'consumed', 'expired']),
      ttlExpireAt: z.unknown().optional(),
    })
    .strict(),
  'operatorStepUp/{uid}': z.object({
    secret: z.string(),
    status: z.enum(['pending', 'active']),
    grantExpiresAt: z.number().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    confirmedAt: z.number().optional(),
    failedAttempts: z.number().optional(),
    lockedUntil: z.number().optional(),
  }),
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
  'nciiAllegations/{allegationId}': z
    .object({
      schemaVersion: z.literal(1),
      allegationId: z.string(),
      caseId: z.string().optional(),
      reporterType: z.enum(['authenticatedUser', 'anonymousPublic', 'operator']),
      submittedAt: z.number(),
      targetLocator: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('mediaAsset'), mediaAssetId: z.string() }).strict(),
        z
          .object({
            kind: z.literal('hallItem'),
            hallItemId: z.string(),
            subItemId: z.string().optional(),
          })
          .strict(),
        z.object({ kind: z.literal('squarePost'), postId: z.string() }).strict(),
        z.object({ kind: z.literal('profileImage'), profileUid: z.string() }).strict(),
        z.object({ kind: z.literal('username'), profileUid: z.string() }).strict(),
        z
          .object({
            kind: z.literal('craftSkill'),
            profileUid: z.string(),
            craftSkillId: z.string(),
          })
          .strict(),
        z
          .object({ kind: z.literal('commissionListing'), commissionListingId: z.string() })
          .strict(),
        z
          .object({
            kind: z.literal('commissionProposal'),
            commissionListingId: z.string(),
            commissionProposalId: z.string(),
          })
          .strict(),
        z.object({ kind: z.literal('workProject'), workProjectId: z.string() }).strict(),
        z
          .object({
            kind: z.literal('workAsset'),
            workProjectId: z.string(),
            workAssetId: z.string(),
          })
          .strict(),
        z.object({ kind: z.literal('workRealm'), workRealmId: z.string() }).strict(),
        z.object({ kind: z.literal('audition'), auditionId: z.string() }).strict(),
        z
          .object({
            kind: z.literal('auditionEntry'),
            auditionId: z.string(),
            auditionEntryId: z.string(),
          })
          .strict(),
        z
          .object({
            kind: z.literal('guildInviteMessage'),
            channelId: z.string(),
            messageId: z.string(),
          })
          .strict(),
        z
          .object({
            kind: z.literal('conversationFile'),
            conversation: z.discriminatedUnion('kind', [
              z.object({ kind: z.literal('guildInvite'), guildInviteId: z.string() }).strict(),
              z.object({ kind: z.literal('adminSupport'), adminDispatchId: z.string() }).strict(),
            ]),
            conversationFileId: z.string(),
            mediaAssetId: z.string(),
          })
          .strict(),
        z
          .object({
            kind: z.literal('guildChatMessage'),
            channelId: z.string(),
            messageId: z.string(),
          })
          .strict(),
        z.object({ kind: z.literal('url'), url: z.string() }).strict(),
        z.object({ kind: z.literal('additionalText'), textRef: z.string() }).strict(),
      ]),
      allegationReason: z.string(),
      status: z.enum(['received', 'linked', 'dismissed', 'escalated']),
      resolvedTarget: z
        .object({
          schemaVersion: z.literal(1),
          itemType: z.enum([
            'username',
            'craft-skill',
            'commission-listing',
            'commission-proposal',
            'square-streetz-post',
            'profile-picture',
            'guild-invite-message',
            'guild-chat-message',
            'conversation-file',
            'hall-library-item',
            'hall-library-sub-item',
            'audition',
            'audition-entry',
            'work-project',
            'work-asset',
            'work-realm',
          ]),
          canonicalParentPath: z.string(),
          canonicalItemId: z.string(),
          revision: z.number(),
          ownerUid: z.string(),
          ownerBlockKey: z.string(),
          mediaAssetId: z.string().optional(),
          channelId: z.string().optional(),
          messageId: z.string().optional(),
          locator: z.discriminatedUnion('kind', [
            z.object({ kind: z.literal('mediaAsset'), mediaAssetId: z.string() }).strict(),
            z
              .object({
                kind: z.literal('hallItem'),
                hallItemId: z.string(),
                subItemId: z.string().optional(),
              })
              .strict(),
            z.object({ kind: z.literal('squarePost'), postId: z.string() }).strict(),
            z.object({ kind: z.literal('profileImage'), profileUid: z.string() }).strict(),
            z.object({ kind: z.literal('username'), profileUid: z.string() }).strict(),
            z
              .object({
                kind: z.literal('craftSkill'),
                profileUid: z.string(),
                craftSkillId: z.string(),
              })
              .strict(),
            z
              .object({ kind: z.literal('commissionListing'), commissionListingId: z.string() })
              .strict(),
            z
              .object({
                kind: z.literal('commissionProposal'),
                commissionListingId: z.string(),
                commissionProposalId: z.string(),
              })
              .strict(),
            z.object({ kind: z.literal('workProject'), workProjectId: z.string() }).strict(),
            z
              .object({
                kind: z.literal('workAsset'),
                workProjectId: z.string(),
                workAssetId: z.string(),
              })
              .strict(),
            z.object({ kind: z.literal('workRealm'), workRealmId: z.string() }).strict(),
            z.object({ kind: z.literal('audition'), auditionId: z.string() }).strict(),
            z
              .object({
                kind: z.literal('auditionEntry'),
                auditionId: z.string(),
                auditionEntryId: z.string(),
              })
              .strict(),
            z
              .object({
                kind: z.literal('guildInviteMessage'),
                channelId: z.string(),
                messageId: z.string(),
              })
              .strict(),
            z
              .object({
                kind: z.literal('conversationFile'),
                conversation: z.discriminatedUnion('kind', [
                  z.object({ kind: z.literal('guildInvite'), guildInviteId: z.string() }).strict(),
                  z
                    .object({ kind: z.literal('adminSupport'), adminDispatchId: z.string() })
                    .strict(),
                ]),
                conversationFileId: z.string(),
                mediaAssetId: z.string(),
              })
              .strict(),
            z
              .object({
                kind: z.literal('guildChatMessage'),
                channelId: z.string(),
                messageId: z.string(),
              })
              .strict(),
            z.object({ kind: z.literal('url'), url: z.string() }).strict(),
            z.object({ kind: z.literal('additionalText'), textRef: z.string() }).strict(),
          ]),
          resolvedAt: z.number(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  'takeItDownRequests/{requestId}': z
    .object({
      schemaVersion: z.literal(1),
      requestId: z.string(),
      caseId: z.string().optional(),
      requesterRole: z.enum(['depictedPerson', 'authorizedRepresentative']),
      targetLocatorSummary: z
        .object({
          kind: z.enum([
            'mediaAsset',
            'hallItem',
            'squarePost',
            'profileImage',
            'username',
            'craftSkill',
            'commissionListing',
            'commissionProposal',
            'workProject',
            'workAsset',
            'workRealm',
            'audition',
            'auditionEntry',
            'guildInviteMessage',
            'conversationFile',
            'guildChatMessage',
            'url',
            'additionalText',
          ]),
          surfaceLabel: z.string(),
          hasResolvedTarget: z.boolean(),
        })
        .strict(),
      receivedAt: z.number(),
      completenessStatus: z.enum(['incomplete', 'complete']),
      validityStatus: z.enum(['pending', 'valid', 'invalid', 'unableToLocate']),
      invalidReasonCode: z
        .enum([
          'missingSignature',
          'missingLocator',
          'missingNonconsentStatement',
          'missingContactInformation',
          'requesterNotDepictedPersonOrAuthorizedRepresentative',
          'authorityNotEstablished',
          'locatorNotResolvableAfterReasonableEffort',
          'requestOutsideCoveredDepiction',
          'duplicateSuperseded',
          'fraudulentOrBadFaith',
          'otherCounselApproved',
        ])
        .optional(),
      completenessDeterminedAt: z.number().optional(),
      validityDeterminedAt: z.number().optional(),
      completedBySubmissionId: z.string().optional(),
      validRequestReceivedAt: z.number().optional(),
      removalDeadlineAt: z.number().optional(),
      publicStatus: z.enum([
        'received',
        'needsMoreInfo',
        'validInProgress',
        'completed',
        'unableToLocate',
        'invalidGeneralReason',
      ]),
      requestClosedAt: z.number().optional(),
      removalCompletionAt: z.number().optional(),
      finalClosedAt: z.number().optional(),
      removalCompletionOutcome: z
        .enum(['completed', 'completedWithApprovedException', 'unableToComplete'])
        .nullable()
        .optional(),
      retentionCompletedAt: z.number().nullable().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
    })
    .strict(),
  'takeItDownRequests/{requestId}/privateDetails/requester': z
    .object({
      schemaVersion: z.literal(1),
      requesterName: z.string(),
      contactEmail: z.string(),
      contactPhone: z.string().optional(),
      electronicSignature: z
        .object({
          signedName: z.string(),
          signedAt: z.number(),
          signatureMethod: z.enum(['typedName', 'drawnSignature']),
        })
        .strict(),
      authorizedRepresentative: z
        .object({
          representedPersonName: z.string(),
          authorityBasis: z.string(),
          authorityCertification: z.boolean(),
          authorityEvidenceRef: z.string().optional(),
          authorityProofScan: z
            .object({
              scanStatus: z.enum(['pending', 'clean', 'matched', 'rejected', 'unavailable']),
              objectGeneration: z.string(),
              objectHash: z.string(),
              scannedAt: z.number().optional(),
            })
            .strict()
            .optional(),
        })
        .strict()
        .optional(),
      nonconsentStatement: z.string(),
      supportingFacts: z.string(),
      goodFaithCertification: z.boolean(),
      accuracyCertification: z.boolean().optional(),
      targetLocator: z
        .discriminatedUnion('kind', [
          z.object({ kind: z.literal('mediaAsset'), mediaAssetId: z.string() }).strict(),
          z
            .object({
              kind: z.literal('hallItem'),
              hallItemId: z.string(),
              subItemId: z.string().optional(),
            })
            .strict(),
          z.object({ kind: z.literal('squarePost'), postId: z.string() }).strict(),
          z.object({ kind: z.literal('profileImage'), profileUid: z.string() }).strict(),
          z.object({ kind: z.literal('username'), profileUid: z.string() }).strict(),
          z
            .object({
              kind: z.literal('craftSkill'),
              profileUid: z.string(),
              craftSkillId: z.string(),
            })
            .strict(),
          z
            .object({ kind: z.literal('commissionListing'), commissionListingId: z.string() })
            .strict(),
          z
            .object({
              kind: z.literal('commissionProposal'),
              commissionListingId: z.string(),
              commissionProposalId: z.string(),
            })
            .strict(),
          z.object({ kind: z.literal('workProject'), workProjectId: z.string() }).strict(),
          z
            .object({
              kind: z.literal('workAsset'),
              workProjectId: z.string(),
              workAssetId: z.string(),
            })
            .strict(),
          z.object({ kind: z.literal('workRealm'), workRealmId: z.string() }).strict(),
          z.object({ kind: z.literal('audition'), auditionId: z.string() }).strict(),
          z
            .object({
              kind: z.literal('auditionEntry'),
              auditionId: z.string(),
              auditionEntryId: z.string(),
            })
            .strict(),
          z
            .object({
              kind: z.literal('guildInviteMessage'),
              channelId: z.string(),
              messageId: z.string(),
            })
            .strict(),
          z
            .object({
              kind: z.literal('conversationFile'),
              conversation: z.discriminatedUnion('kind', [
                z.object({ kind: z.literal('guildInvite'), guildInviteId: z.string() }).strict(),
                z.object({ kind: z.literal('adminSupport'), adminDispatchId: z.string() }).strict(),
              ]),
              conversationFileId: z.string(),
              mediaAssetId: z.string(),
            })
            .strict(),
          z
            .object({
              kind: z.literal('guildChatMessage'),
              channelId: z.string(),
              messageId: z.string(),
            })
            .strict(),
          z.object({ kind: z.literal('url'), url: z.string() }).strict(),
          z.object({ kind: z.literal('additionalText'), textRef: z.string() }).strict(),
        ])
        .optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
    })
    .strict(),
  'takeItDownRequests/{requestId}/takeItDownSubmissions/{submissionId}': z
    .object({
      schemaVersion: z.literal(1),
      submissionId: z.string(),
      sequence: z.number(),
      receivedAt: z.number(),
      suppliedFieldCodes: z.array(
        z.enum([
          'requesterName',
          'contactEmail',
          'contactPhone',
          'requesterRole',
          'electronicSignature',
          'authorityBasis',
          'authorityCertification',
          'authorityEvidence',
          'targetLocator',
          'nonconsentStatement',
          'supportingFacts',
          'goodFaithCertification',
        ]),
      ),
      evidenceIds: z.array(z.string()),
      cumulativeRequestSnapshotHash: z.string(),
      cumulativeCompleteness: z.enum(['incomplete', 'complete']),
      firstCompletedRequest: z.boolean(),
      supersedesSubmissionId: z.string().optional(),
      createdBy: z.enum(['requester', 'operator', 'system']),
    })
    .strict(),
  'takeItDownRequests/{requestId}/validityDecisions/{decisionId}': z
    .object({
      schemaVersion: z.literal(1),
      decisionId: z.string(),
      requestId: z.string(),
      result: z.enum(['valid', 'invalid', 'unableToLocate']),
      basisSubmissionIds: z.array(z.string()),
      validFromSubmissionId: z.string().optional(),
      validRequestReceivedAt: z.number().optional(),
      reasonCode: z
        .enum([
          'missingSignature',
          'missingLocator',
          'missingNonconsentStatement',
          'missingContactInformation',
          'requesterNotDepictedPersonOrAuthorizedRepresentative',
          'authorityNotEstablished',
          'locatorNotResolvableAfterReasonableEffort',
          'requestOutsideCoveredDepiction',
          'duplicateSuperseded',
          'fraudulentOrBadFaith',
          'otherCounselApproved',
        ])
        .optional(),
      rationaleRef: z.string(),
      decidedByUid: z.string(),
      decidedAt: z.number(),
    })
    .strict(),
  'takeItDownRequests/{requestId}/validityDecisions/{decisionId}/takeItDownValidityRationale/record':
    z
      .object({
        requestId: z.string(),
        decisionId: z.string(),
        result: z.enum(['valid', 'invalid', 'unableToLocate']),
        reasonCode: z
          .enum([
            'missingSignature',
            'missingLocator',
            'missingNonconsentStatement',
            'missingContactInformation',
            'requesterNotDepictedPersonOrAuthorizedRepresentative',
            'authorityNotEstablished',
            'locatorNotResolvableAfterReasonableEffort',
            'requestOutsideCoveredDepiction',
            'duplicateSuperseded',
            'fraudulentOrBadFaith',
            'otherCounselApproved',
          ])
          .optional(),
        text: z.string(),
        authoredByUid: z.string(),
        authoredAt: z.number(),
      })
      .strict(),
  'takeItDownRequests/{requestId}/takeItDownActions/{actionId}': z
    .object({
      schemaVersion: z.literal(1),
      actionId: z.string(),
      at: z.number(),
      actorId: z.string(),
      capability: z.enum([
        'nciiRequestReviewer',
        'nciiEvidenceReviewer',
        'nciiAppealReviewer',
        'childSafetyReviewer',
        'legalDispositionAuthority',
      ]),
      actionType: z.enum([
        'intakeReceived',
        'completenessDecided',
        'validityDecided',
        'tempHoldPlaced',
        'tempHoldReleased',
        'removalStarted',
        'removalCompleted',
        'hashBlockReversed',
        'childSafetyCaseLinked',
        'legalDispositionRecorded',
      ]),
      result: z.enum(['succeeded', 'failed', 'deferred', 'rejected']),
      summary: z.string(),
      detailRef: z.string(),
    })
    .strict(),
  'takeItDownRequests/{requestId}/takeItDownEvidenceDisposition/{evidenceId}': z
    .object({
      bucket: z.string(),
      key: z.string(),
      generation: z.string().optional(),
      method: z.enum(['delete', 'cryptoErase']),
      verifiedAt: z.number(),
      result: z.enum(['gone', 'leftover']),
      leftoverDetail: z.string().optional(),
    })
    .strict(),
  'takeItDownRequests/{requestId}/takeItDownEvidence/{evidenceId}': z
    .object({
      schemaVersion: z.literal(1),
      evidenceId: z.string(),
      requestId: z.string(),
      uploadContext: z.literal('takeItDownEvidence'),
      submitterUid: z.string().optional(),
      bucket: z.string(),
      key: z.string(),
      generation: z.string(),
      contentType: z.string(),
      sizeBytes: z.number(),
      sha256: z.string(),
      md5: z.string(),
      capturedAt: z.number(),
      createdAt: z.number(),
    })
    .strict(),
  'nciiCases/{caseId}': z
    .object({
      schemaVersion: z.literal(1),
      caseId: z.string(),
      revision: z.number(),
      lane: z.enum(['ncii', 'likeness']),
      internalStatus: z.enum([
        'open',
        'removalInProgress',
        'processing',
        'failed',
        'removed',
        'rejected',
        'closed',
      ]),
      childSafetyLinkStatus: z.enum([
        'none',
        'assessmentPending',
        'linked',
        'resolvedNoChildSafetyCase',
      ]),
      crossover: z
        .object({
          minorAssessment: z.enum(['adult', 'unknown', 'possibleMinor', 'confirmedMinor']),
          csamAssessment: z.enum([
            'notAssessed',
            'notApparent',
            'apparentViolation',
            'validatedHashMatch',
          ]),
          childSafetyCaseId: z.string().optional(),
          assessedByUid: z.string().optional(),
          assessedAt: z.number().optional(),
        })
        .strict(),
      childSafetyCaseId: z.string().optional(),
      nciiRemovalDeadlineAt: z.number().optional(),
      closure: z
        .object({
          outcome: z.enum(['founded', 'unfounded']),
          resolutionSummary: z.string(),
          adminNote: z.string().optional(),
          closedByUid: z.string(),
          closedAt: z.number(),
        })
        .strict()
        .optional(),
      chatMessageLocator: z
        .discriminatedUnion('kind', [
          z.object({ kind: z.literal('mediaAsset'), mediaAssetId: z.string() }).strict(),
          z
            .object({
              kind: z.literal('hallItem'),
              hallItemId: z.string(),
              subItemId: z.string().optional(),
            })
            .strict(),
          z.object({ kind: z.literal('squarePost'), postId: z.string() }).strict(),
          z.object({ kind: z.literal('profileImage'), profileUid: z.string() }).strict(),
          z.object({ kind: z.literal('username'), profileUid: z.string() }).strict(),
          z
            .object({
              kind: z.literal('craftSkill'),
              profileUid: z.string(),
              craftSkillId: z.string(),
            })
            .strict(),
          z
            .object({ kind: z.literal('commissionListing'), commissionListingId: z.string() })
            .strict(),
          z
            .object({
              kind: z.literal('commissionProposal'),
              commissionListingId: z.string(),
              commissionProposalId: z.string(),
            })
            .strict(),
          z.object({ kind: z.literal('workProject'), workProjectId: z.string() }).strict(),
          z
            .object({
              kind: z.literal('workAsset'),
              workProjectId: z.string(),
              workAssetId: z.string(),
            })
            .strict(),
          z.object({ kind: z.literal('workRealm'), workRealmId: z.string() }).strict(),
          z.object({ kind: z.literal('audition'), auditionId: z.string() }).strict(),
          z
            .object({
              kind: z.literal('auditionEntry'),
              auditionId: z.string(),
              auditionEntryId: z.string(),
            })
            .strict(),
          z
            .object({
              kind: z.literal('guildInviteMessage'),
              channelId: z.string(),
              messageId: z.string(),
            })
            .strict(),
          z
            .object({
              kind: z.literal('conversationFile'),
              conversation: z.discriminatedUnion('kind', [
                z.object({ kind: z.literal('guildInvite'), guildInviteId: z.string() }).strict(),
                z.object({ kind: z.literal('adminSupport'), adminDispatchId: z.string() }).strict(),
              ]),
              conversationFileId: z.string(),
              mediaAssetId: z.string(),
            })
            .strict(),
          z
            .object({
              kind: z.literal('guildChatMessage'),
              channelId: z.string(),
              messageId: z.string(),
            })
            .strict(),
          z.object({ kind: z.literal('url'), url: z.string() }).strict(),
          z.object({ kind: z.literal('additionalText'), textRef: z.string() }).strict(),
        ])
        .optional(),
      contextResolutionPending: z.boolean().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
    })
    .strict(),
  'nciiCases/{caseId}/allegationLinks/{allegationId}': z
    .object({
      allegationId: z.string(),
      linkedAt: z.number(),
      linkedByUid: z.string(),
      reportId: z.string().optional(),
    })
    .strict(),
  'nciiCases/{caseId}/requestLinks/{requestId}': z
    .object({ requestId: z.string(), linkedAt: z.number(), linkedByUid: z.string() })
    .strict(),
  'nciiCases/{caseId}/removalActions/{actionId}': z
    .object({
      at: z.number(),
      actorId: z.string(),
      surface: z.string(),
      targetItemType: z.string(),
      targetItemId: z.string(),
      method: z.enum(['tombstone', 'accountAction', 'assetBlock']),
      result: z.string(),
    })
    .strict(),
  'nciiCases/{caseId}/blockedHashes/{hashId}': z
    .object({
      hashId: z.string(),
      algorithm: z.literal('sha256'),
      digest: z.string(),
      source: z.enum(['requestEvidence', 'platformOriginal', 'platformCopy', 'knownIdenticalCopy']),
      createdAt: z.number(),
      createdByUid: z.string(),
      status: z.enum(['active', 'reversed']),
      reversedAt: z.number().optional(),
      reversedByUid: z.string().optional(),
      reversalReason: z.string().optional(),
    })
    .strict(),
  'nciiCases/{caseId}/closureEvents/{eventId}': z.discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('caseClosed'),
        revision: z.number(),
        closure: z
          .object({
            outcome: z.enum(['founded', 'unfounded']),
            resolutionSummary: z.string(),
            adminNote: z.string().optional(),
            closedByUid: z.string(),
            closedAt: z.number(),
          })
          .strict(),
        at: z.number(),
      })
      .strict(),
    z
      .object({
        kind: z.literal('caseReopened'),
        revision: z.number(),
        reasonInternal: z.string(),
        actorId: z.string(),
        at: z.number(),
      })
      .strict(),
  ]),
  'nciiRetainedEvidenceInventory/{inventoryId}': z
    .object({
      schemaVersion: z.literal(1),
      inventoryId: z.string(),
      reason: z.enum([
        'orphan',
        'fileTooLarge',
        'imageTooLarge',
        'archiveOrPolyglot',
        'malformedPath',
        'scanRejected',
        'capOverflow',
      ]),
      bucket: z.string(),
      key: z.string(),
      generation: z.string(),
      requestReference: z.string().optional(),
      contentType: z.string().optional(),
      sizeBytes: z.number().optional(),
      detectedAt: z.number(),
      createdAt: z.number(),
    })
    .strict(),
  'nciiInventoryDeadLetter/{inventoryId}': z
    .object({
      schemaVersion: z.literal(1),
      inventoryId: z.string(),
      reason: z.enum([
        'orphan',
        'fileTooLarge',
        'imageTooLarge',
        'archiveOrPolyglot',
        'malformedPath',
        'scanRejected',
        'capOverflow',
      ]),
      bucket: z.string(),
      key: z.string(),
      generation: z.string(),
      requestReference: z.string().optional(),
      contentType: z.string().optional(),
      sizeBytes: z.number().optional(),
      detectedAt: z.number(),
      createdAt: z.number(),
    })
    .strict(),
  'nciiTemporaryHolds/{holdId}': z
    .object({
      schemaVersion: z.literal(1),
      holdId: z.string(),
      requestId: z.string(),
      caseId: z.string().optional(),
      resourceType: z.literal('nciiTemporaryTarget'),
      safetyHoldRefId: z.string(),
      target: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('mediaAsset'), mediaAssetId: z.string() }).strict(),
        z
          .object({
            kind: z.literal('hallItem'),
            hallItemId: z.string(),
            subItemId: z.string().optional(),
          })
          .strict(),
        z.object({ kind: z.literal('squarePost'), postId: z.string() }).strict(),
        z.object({ kind: z.literal('profileImage'), profileUid: z.string() }).strict(),
        z.object({ kind: z.literal('username'), profileUid: z.string() }).strict(),
        z
          .object({
            kind: z.literal('craftSkill'),
            profileUid: z.string(),
            craftSkillId: z.string(),
          })
          .strict(),
        z
          .object({ kind: z.literal('commissionListing'), commissionListingId: z.string() })
          .strict(),
        z
          .object({
            kind: z.literal('commissionProposal'),
            commissionListingId: z.string(),
            commissionProposalId: z.string(),
          })
          .strict(),
        z.object({ kind: z.literal('workProject'), workProjectId: z.string() }).strict(),
        z
          .object({
            kind: z.literal('workAsset'),
            workProjectId: z.string(),
            workAssetId: z.string(),
          })
          .strict(),
        z.object({ kind: z.literal('workRealm'), workRealmId: z.string() }).strict(),
        z.object({ kind: z.literal('audition'), auditionId: z.string() }).strict(),
        z
          .object({
            kind: z.literal('auditionEntry'),
            auditionId: z.string(),
            auditionEntryId: z.string(),
          })
          .strict(),
        z
          .object({
            kind: z.literal('guildInviteMessage'),
            channelId: z.string(),
            messageId: z.string(),
          })
          .strict(),
        z
          .object({
            kind: z.literal('conversationFile'),
            conversation: z.discriminatedUnion('kind', [
              z.object({ kind: z.literal('guildInvite'), guildInviteId: z.string() }).strict(),
              z.object({ kind: z.literal('adminSupport'), adminDispatchId: z.string() }).strict(),
            ]),
            conversationFileId: z.string(),
            mediaAssetId: z.string(),
          })
          .strict(),
        z
          .object({
            kind: z.literal('guildChatMessage'),
            channelId: z.string(),
            messageId: z.string(),
          })
          .strict(),
        z.object({ kind: z.literal('url'), url: z.string() }).strict(),
        z.object({ kind: z.literal('additionalText'), textRef: z.string() }).strict(),
      ]),
      rootLineageRef: z.string().optional(),
      contentHashes: z.array(z.string()).optional(),
      ownerUid: z.string().optional(),
      capturedRevision: z.number().optional(),
      capturedGeneration: z.string().optional(),
      snapshotRef: z.string(),
      purpose: z.literal('nciiTemporaryPreservation'),
      createdAt: z.number(),
      expiresAt: z.number(),
      status: z.enum(['active', 'extended', 'released']),
      releasedAt: z.number().optional(),
      releaseReason: z.string().optional(),
    })
    .strict(),
  'nciiRemovalJobs/{jobId}': z
    .object({
      schemaVersion: z.literal(1),
      jobId: z.string(),
      caseId: z.string(),
      requestId: z.string(),
      generation: z.number(),
      phase: z.enum([
        'resolveTargets',
        'discoverKnownCopies',
        'denyServing',
        'removeOrTombstone',
        'writeHashBlocks',
        'verifyRemoval',
        'complete',
      ]),
      status: z.enum(['pending', 'running', 'retryableFailure', 'deadLetter', 'completed']),
      cursor: z
        .object({
          phase: z.enum([
            'resolveTargets',
            'discoverKnownCopies',
            'denyServing',
            'removeOrTombstone',
            'writeHashBlocks',
            'verifyRemoval',
            'complete',
          ]),
          lastSurface: z.enum([
            'original',
            'hallCopy',
            'profileMedia',
            'conversationFile',
            'variant',
            'cacheServing',
            'exactHashMatch',
          ]),
          lastCursorToken: z.string().optional(),
        })
        .strict()
        .optional(),
      leaseOwner: z.string().optional(),
      leaseExpiresAt: z.number().optional(),
      attemptCount: z.number(),
      nextAttemptAt: z.number().optional(),
      lastErrorCode: z.string().optional(),
      createdAt: z.number(),
      updatedAt: z.number(),
      completedAt: z.number().optional(),
      deadLetterAt: z.number().optional(),
    })
    .strict(),
  'nciiRemovalJobs/{jobId}/nciiRemovalTargets/{targetKeyHash}': z
    .object({
      targetKeyHash: z.string(),
      locator: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('mediaAsset'), mediaAssetId: z.string() }).strict(),
        z
          .object({
            kind: z.literal('hallItem'),
            hallItemId: z.string(),
            subItemId: z.string().optional(),
          })
          .strict(),
        z.object({ kind: z.literal('squarePost'), postId: z.string() }).strict(),
        z.object({ kind: z.literal('profileImage'), profileUid: z.string() }).strict(),
        z.object({ kind: z.literal('username'), profileUid: z.string() }).strict(),
        z
          .object({
            kind: z.literal('craftSkill'),
            profileUid: z.string(),
            craftSkillId: z.string(),
          })
          .strict(),
        z
          .object({ kind: z.literal('commissionListing'), commissionListingId: z.string() })
          .strict(),
        z
          .object({
            kind: z.literal('commissionProposal'),
            commissionListingId: z.string(),
            commissionProposalId: z.string(),
          })
          .strict(),
        z.object({ kind: z.literal('workProject'), workProjectId: z.string() }).strict(),
        z
          .object({
            kind: z.literal('workAsset'),
            workProjectId: z.string(),
            workAssetId: z.string(),
          })
          .strict(),
        z.object({ kind: z.literal('workRealm'), workRealmId: z.string() }).strict(),
        z.object({ kind: z.literal('audition'), auditionId: z.string() }).strict(),
        z
          .object({
            kind: z.literal('auditionEntry'),
            auditionId: z.string(),
            auditionEntryId: z.string(),
          })
          .strict(),
        z
          .object({
            kind: z.literal('guildInviteMessage'),
            channelId: z.string(),
            messageId: z.string(),
          })
          .strict(),
        z
          .object({
            kind: z.literal('conversationFile'),
            conversation: z.discriminatedUnion('kind', [
              z.object({ kind: z.literal('guildInvite'), guildInviteId: z.string() }).strict(),
              z.object({ kind: z.literal('adminSupport'), adminDispatchId: z.string() }).strict(),
            ]),
            conversationFileId: z.string(),
            mediaAssetId: z.string(),
          })
          .strict(),
        z
          .object({
            kind: z.literal('guildChatMessage'),
            channelId: z.string(),
            messageId: z.string(),
          })
          .strict(),
        z.object({ kind: z.literal('url'), url: z.string() }).strict(),
        z.object({ kind: z.literal('additionalText'), textRef: z.string() }).strict(),
      ]),
      surface: z.enum([
        'original',
        'hallCopy',
        'profileMedia',
        'conversationFile',
        'variant',
        'cacheServing',
        'exactHashMatch',
      ]),
      expectedGeneration: z.number().optional(),
      servingDenyState: z.enum(['pending', 'denied', 'failed']),
      removalState: z.enum(['pending', 'removed', 'tombstoned', 'failed']),
      verificationState: z.enum(['pending', 'verifiedGone', 'leftover']),
      outcome: z.enum([
        'pending',
        'removed',
        'tombstoned',
        'verifiedGone',
        'leftoverRetrying',
        'unableToComplete',
        'terminalException',
      ]),
      attemptCount: z.number(),
      leaseOwner: z.string().optional(),
      leaseExpiresAt: z.number().optional(),
      lastErrorCode: z.string().optional(),
      updatedAt: z.number(),
    })
    .strict(),
  '_appConfig/app': z.object({
    appVersion: z.string(),
    maintenanceMode: z.boolean(),
    maintenanceMessage: z.string().optional(),
    registrationEnabled: z.boolean(),
    announcementMessage: z.string().optional(),
    rateLimitMultiplier: z.number().optional(),
    publicDocumentVersions: z
      .object({
        documents: z.record(
          z.enum([
            'termsOfService',
            'privacyPolicy',
            'rulesAndAgreements',
            'futurePlans',
            'dmcaPolicy',
            'takeItDownPageCopy',
          ]),
          z.object({ currentVersion: z.number(), requiredVersion: z.number() }).strict(),
        ),
        requiredAcceptanceLevel: z.number(),
      })
      .strict()
      .optional(),
  }),
  '_appConfig/futurePlans': z.object({
    lastUpdated: z.number(),
    intro: z.string().optional(),
    groups: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        order: z.number(),
        intention: z.string().optional(),
      }),
    ),
    plans: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        groupId: z.string(),
        order: z.number(),
      }),
    ),
    version: z.number().optional(),
  }),
  '_appConfig/rulesAndAgreements': z.object({
    intro: z.string().optional(),
    groupIntentions: z
      .record(z.enum(['generic', 'merchandising', 'hallWing', 'workRealm']), z.string())
      .optional(),
    rules: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        group: z.enum(['generic', 'merchandising', 'hallWing', 'workRealm']),
        workProjectType: z.enum(['Tales', 'Tunes', 'Television']).optional(),
        hallWingType: z.enum(['entertainment', 'educational', 'newsPolitical']).optional(),
        order: z.number(),
      }),
    ),
    agreements: z.object({
      intention: z.string().optional(),
      points: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          workProjectType: z.enum(['Tales', 'Tunes', 'Television']).optional(),
          hallWingType: z.enum(['entertainment', 'educational', 'newsPolitical']).optional(),
        }),
      ),
    }),
    version: z.number().optional(),
    lastUpdated: z.number().optional(),
  }),
  '_appConfig/termsOfService': z.object({
    version: z.number(),
    lastUpdated: z.number(),
    sections: z.array(
      z.object({
        id: z.string(),
        heading: z.string(),
        level: z.union([z.literal(1), z.literal(2)]),
        body: z.string(),
        order: z.number(),
      }),
    ),
  }),
  '_appConfig/privacyPolicy': z.object({
    version: z.number(),
    lastUpdated: z.number(),
    sections: z.array(
      z.object({
        id: z.string(),
        heading: z.string(),
        level: z.union([z.literal(1), z.literal(2)]),
        body: z.string(),
        order: z.number(),
      }),
    ),
  }),
  '_appConfig/takeItDownPageCopy': z.object({
    version: z.number(),
    lastUpdated: z.number(),
    strings: z.record(z.string(), z.string()),
  }),
  '_appConfig/dmcaPolicy': z.object({
    version: z.number(),
    lastUpdated: z.number(),
    intro: z.string(),
    contactBlocks: z.array(
      z.object({
        id: z.string(),
        heading: z.string(),
        order: z.number(),
        rows: z.array(
          z.object({ id: z.string(), label: z.string(), value: z.string(), order: z.number() }),
        ),
      }),
    ),
    sections: z.array(
      z.object({
        id: z.string(),
        heading: z.string(),
        level: z.union([z.literal(1), z.literal(2)]),
        body: z.string(),
        order: z.number(),
      }),
    ),
  }),
  '_appConfig/systemUidSlots': z
    .object({
      slots: z.record(z.enum(['founder', 'team']), z.union([z.string(), z.array(z.string())])),
      version: z.number(),
      lastUpdated: z.number(),
    })
    .strict(),
  '_serverData/agePolicy': z
    .object({
      agePolicyVersion: z.string(),
      registrationGracePeriodMinutes: z.number(),
      cleanupSchedule: z.string(),
      ageTokenTtlSeconds: z.number(),
      keyRetirementVerificationMinutes: z.number(),
    })
    .strict(),
  '_serverData/nciiPolicy': z
    .object({
      policyVersion: z.literal('ncii.2026-06-23.v1'),
      requesterPiiRetentionDays: z.number(),
      evidenceRetentionDays: z.number(),
      blockedHashRetentionPolicy: z.literal('indefiniteUntilReversed'),
      allowedEvidenceMimeTypes: z.array(z.string()),
      maxEvidenceFileBytes: z.number(),
      maxEvidenceFilesPerRequest: z.number(),
      maxEvidenceTotalBytesPerRequest: z.number(),
      uploadReservationMinutes: z.number(),
      abandonedUploadCleanupHours: z.number(),
      tempHoldInitialHours: z.number(),
      tempHoldPendingValidityExtensionHours: z.number(),
      tempHoldMaxTotalHours: z.number(),
      incompleteInvalidReleaseDelayHours: z.number(),
      intakeRateLimitWindowSeconds: z.number(),
      intakeRateLimitMaxPerIp: z.number(),
      idempotencyWindowHours: z.number(),
      maxEvidenceDecodePixels: z.number(),
      maxEvidenceImageDimension: z.number(),
      maxEvidenceVideoFrames: z.number(),
      maxEvidenceVideoDurationSec: z.number(),
      evidenceParserTimeoutSec: z.number(),
      evidenceScanCpuBudgetMs: z.number(),
      evidenceScanMemoryBudgetMb: z.number(),
      rejectArchiveAndPolyglotPayloads: z.boolean(),
      approvedBy: z.literal('operatorLaunchDefault'),
    })
    .strict(),
  '_serverData/privilegedReviewerSecurity': z
    .object({
      requiredSecondFactor: z.literal('passkeyWebAuthn'),
      privilegedReauthTtlSeconds: z.number(),
      privilegedSessionDeviceBound: z.boolean(),
      twoStepReauthCapabilities: z.array(
        z.enum([
          'evidenceReveal',
          'ncmecCredentialUse',
          'reverseHashBlock',
          'legalDisposition',
          'falsePositiveCorrection',
          'ncmecManualFallback',
        ]),
      ),
      recoveryCodeCount: z.number(),
      recoveryCodeUse: z.literal('auditedHighSeverity+forcesReenroll+criticalAlarm'),
      allowPrivilegedSessionRevocation: z.boolean(),
      everyInvocationAudited: z.boolean(),
    })
    .strict(),
  '_serverData/feedbackLists/feedbackAliases/{aliasId}': z.object({
    canonicalId: z.string(),
    originalType: z.string(),
  }),
  '_systemData/adminList': z.object({ admins: z.array(z.string()), jrAdmins: z.array(z.string()) }),
  '_systemData/profanityList': z.object({
    words: z.array(z.string()),
    updatedAt: z.number(),
    wordCount: z.number(),
    wordListVersion: z.number().optional(),
  }),
  '_systemData/reservedUsernames': z.object({ names: z.array(z.string()), updatedAt: z.number() }),
  '_systemData/blockedFranchiseNames': z.object({
    names: z.array(z.string()),
    updatedAt: z.number(),
  }),
  '_systemData/appMode': z.object({ current: z.enum(['charter', 'full']), updatedAt: z.number() }),
  '_systemData/systemVideoSlots': z
    .object({
      slots: z.record(
        z.enum([
          'landing-hero',
          'guide-app-in-five-minutes',
          'guide-finding-your-way-around',
          'guide-find-something-to-enjoy',
          'guide-start-a-work-as-steward',
          'guide-how-to-join-a-work',
          'guide-what-is-a-realm',
          'guide-what-is-a-work',
          'guide-what-is-a-guild',
          'guide-what-are-stakes',
          'guide-how-bouquets-and-payouts-will-work',
          'help-work-project-information',
          'help-work-team-communication',
          'help-work-your-team',
          'help-work-guildmate-users',
          'help-work-member-stake-shares',
          'help-work-member-guild-standings',
          'help-work-member-trade-professions',
          'help-work-pending-invitations',
          'help-work-invite-by-craft',
          'help-work-project-files',
          'help-work-find-talent',
          'help-work-community-feedback',
          'help-work-project-auditions',
          'help-work-submit-to-hall',
          'help-work-episodic-publishing',
          'help-work-platform-correspondence',
          'help-hall',
          'help-square',
          'help-notice-board',
          'help-craft-fair',
          'help-audition-stage',
          'help-audition-sponsored-prize',
          'help-audition-view-sponsored-prize',
          'help-admin-audition-sponsored-prize',
          'help-messages-admin-dispatches',
          'help-messages-guild-invites',
          'help-profile-overview',
          'help-profile-square-activity',
          'help-profile-following',
          'help-profile-artisan-tools',
          'help-profile-work-projects',
          'help-profile-crafts',
          'future-plans-page',
          'rules-page',
          'rules-general',
          'rules-merchandising',
          'rules-hall-wing',
          'rules-realm',
          'rules-artisan-agreements',
        ]),
        z
          .object({
            assetId: z.string().nullable(),
            uploadPendingMediaId: z.string().nullable(),
            updatedAt: z.number(),
          })
          .strict(),
      ),
      version: z.number(),
    })
    .strict(),
});

export const COLLECTION_DOC_ID_FIELDS = Object.freeze({
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTales/{taleId}/taleChapters/{chapterId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTunes/{tuneId}/tuneTracks/{trackId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}': 'uid',
  'allWorkProjects/{workProjectId}/workProjectTelevision/{televisionId}/televisionEpisodes/{episodeId}':
    'uid',
  'allWorkProjects/{workProjectId}/guildChatChannels/{guildChatChannelId}': 'guildChatChannelId',
  'hallItems/{hallItemId}/hallItemTales/{itemId}': 'uid',
  'hallItems/{hallItemId}/hallItemTunes/{itemId}': 'uid',
  'hallItems/{hallItemId}/hallItemTelevision/{itemId}': 'uid',
  'activeUserNotifications/{notificationId}': 'id',
  'activeAdminNotifications/{notificationId}': 'id',
  'adminNotificationHistory/{notificationId}': 'archiveOccurrenceId',
  'userProfiles/{userId}/notificationHistory/{notificationId}': 'archiveOccurrenceId',
  'pendingNotifications/{notificationId}': 'id',
  'statusReconcileQueue/{uid}': 'uid',
});
