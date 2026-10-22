import { z } from 'zod';
import {
  workProjectIdSchema,
  userIdSchema,
  addRemoveActionSchema,
  workProjectTypeSchema,
  hallWingTypeSchema,
  commissionListingIdSchema,
  commissionProposalIdSchema,
  auditionIdSchema,
  auditionEntryIdSchema,
  craftSkillIdSchema,
  guildInviteConversationStatusSchema,
  guildInviteIdSchema,
  mediaAssetIdSchema,
  workRealmIdSchema,
  realmFileFolderIdSchema,
  realmFileShareRequestIdSchema,
  documentIdSegmentSchema,
  workFileFolderIdSchema,
  workFileIdSchema,
  stakeSharesOfferedSchema,
} from './atoms.js';
import { TRADE_PROFESSION_OPTIONS, TRADE_PROFESSION_VALUES } from '../constants/options.js';
import { WORK_REALM_FOUNDING_AGREEMENT_VERSION } from '../constants/member-agreements.js';
import {
  GUILD_INVITE_MESSAGE_INPUT,
  REALM_DESCRIPTION_INPUT,
  REALM_FILE_FOLDER_NAME_INPUT,
  REALM_NAME_INPUT,
  WORK_DESCRIPTION_INPUT,
  WORK_FILE_FOLDER_NAME_INPUT,
  WORK_TITLE_INPUT,
} from '../constants/text-fields.js';
import {
  REALM_SHARED_FILES_PAGE_LIMIT,
  REALM_FILE_PROMOTION_QUEUE_PAGE_LIMIT,
} from '../constants/pagination.js';
import { GUILD_STANDING_VALUES } from '../permissions/work-project-permissions-data.js';
import { FullWorkProjectSchema } from '../doc-schemas/work-project.js';
import { textFieldSchema } from './text-field.js';
import {
  RealmFileApprovedStatusSchema,
  RealmFilePendingApprovalStatusSchema,
  RealmFileActiveStatusSchema,
  REALM_FILE_PENDING_APPROVAL_STATUS,
  ContentMediaKindSchema,
} from '../doc-schemas/media-assets.js';

export const RealmSharedFileProjectionSchema = z
  .object({
    mediaAssetId: mediaAssetIdSchema,
    mediaKind: ContentMediaKindSchema,
    realmFileCanonStatus: RealmFileApprovedStatusSchema,
    name: z.string(),
    realmFileFolderId: realmFileFolderIdSchema,
    creatorUid: userIdSchema,
    createdAt: z.number(),
    workProjectId: workProjectIdSchema,
    workFileId: z.string(),
  })
  .strict();
export type RealmSharedFileProjection = z.infer<typeof RealmSharedFileProjectionSchema>;

export const RealmFileFolderProjectionSchema = z
  .object({
    realmFileFolderId: realmFileFolderIdSchema,
    name: z.string(),
    fileCount: z.number().int().min(0),
  })
  .strict();
export type RealmFileFolderProjection = z.infer<typeof RealmFileFolderProjectionSchema>;

export const GetRealmSharedFilesInputSchema = z
  .object({
    realmId: workRealmIdSchema,
    limit: z.number().int().min(1).max(REALM_SHARED_FILES_PAGE_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
  })
  .strict();
export type GetRealmSharedFilesInput = z.infer<typeof GetRealmSharedFilesInputSchema>;

export const GetRealmSharedFilesResponseSchema = z
  .object({
    files: z.array(RealmSharedFileProjectionSchema),
    folders: z.array(RealmFileFolderProjectionSchema),
    nextCursor: z.string().min(1).nullable().optional(),
  })
  .strict();
export type GetRealmSharedFilesResponse = z.infer<typeof GetRealmSharedFilesResponseSchema>;

export const RealmFilePromotionQueueRowSchema = z
  .object({
    mediaAssetId: mediaAssetIdSchema,
    mediaKind: ContentMediaKindSchema,
    realmFileCanonStatus: RealmFilePendingApprovalStatusSchema,
    name: z.string(),
    creatorUid: userIdSchema,
    workProjectId: workProjectIdSchema,
    workFileId: z.string(),
    realmFileShareRequestId: realmFileShareRequestIdSchema,
    realmFileShareRequestedByUid: userIdSchema,
    realmFileShareRequestedAt: z.number(),
  })
  .strict();
export type RealmFilePromotionQueueRow = z.infer<typeof RealmFilePromotionQueueRowSchema>;

export const GetRealmFilePromotionQueueInputSchema = z
  .object({
    workRealmId: workRealmIdSchema,
    limit: z.number().int().min(1).max(REALM_FILE_PROMOTION_QUEUE_PAGE_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
  })
  .strict();
export type GetRealmFilePromotionQueueInput = z.infer<typeof GetRealmFilePromotionQueueInputSchema>;

export const GetRealmFilePromotionQueueResponseSchema = z
  .object({
    requests: z.array(RealmFilePromotionQueueRowSchema),
    folders: z.array(RealmFileFolderProjectionSchema),
    nextCursor: z.string().min(1).nullable().optional(),
  })
  .strict();
export type GetRealmFilePromotionQueueResponse = z.infer<
  typeof GetRealmFilePromotionQueueResponseSchema
>;

export const WorkFileRealmShareStateSchema = z
  .object({
    workFileId: z.string(),
    realmFileCanonStatus: RealmFileActiveStatusSchema,
    realmFileShareRequestId: realmFileShareRequestIdSchema.optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const isPending = val.realmFileCanonStatus === REALM_FILE_PENDING_APPROVAL_STATUS;
    if (isPending && val.realmFileShareRequestId === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['realmFileShareRequestId'],
        message:
          'a pending row must carry its request id — it is what the withdraw call compares against',
      });
    }
    if (!isPending && val.realmFileShareRequestId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['realmFileShareRequestId'],
        message: 'a resolved row must not carry a request id — the request is no longer pending',
      });
    }
  });
export type WorkFileRealmShareState = z.infer<typeof WorkFileRealmShareStateSchema>;

export const GetWorkFileRealmShareStatesInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
  })
  .strict();
export type GetWorkFileRealmShareStatesInput = z.infer<
  typeof GetWorkFileRealmShareStatesInputSchema
>;

export const GetWorkFileRealmShareStatesResponseSchema = z
  .object({
    states: z.array(WorkFileRealmShareStateSchema),
  })
  .strict();
export type GetWorkFileRealmShareStatesResponse = z.infer<
  typeof GetWorkFileRealmShareStatesResponseSchema
>;

export const RealmFileListsChangeSchema = z
  .object({
    mediaAssetId: mediaAssetIdSchema,
    workProjectId: workProjectIdSchema,
    workFileId: z.string(),
    sharedFile: RealmSharedFileProjectionSchema.nullable(),
    promotionRequest: RealmFilePromotionQueueRowSchema.nullable(),
    shareState: WorkFileRealmShareStateSchema.nullable(),
    folders: z.array(RealmFileFolderProjectionSchema).optional(),
  })
  .strict();
export type RealmFileListsChange = z.infer<typeof RealmFileListsChangeSchema>;

export const RealmFileTransitionResultSchema = z.object({
  success: z.literal(true),
  change: RealmFileListsChangeSchema,
});
export type RealmFileTransitionResult = z.infer<typeof RealmFileTransitionResultSchema>;

export const RealmFileFolderResultSchema = z.object({
  success: z.literal(true),
  folder: RealmFileFolderProjectionSchema.optional(),
});
export type RealmFileFolderResult = z.infer<typeof RealmFileFolderResultSchema>;

export const DeleteRealmFileFolderResultSchema = z.object({
  success: z.literal(true),
  realmFileFolderId: realmFileFolderIdSchema,
});
export type DeleteRealmFileFolderResult = z.infer<typeof DeleteRealmFileFolderResultSchema>;

export const workProjectTitleSchema = textFieldSchema(WORK_TITLE_INPUT);
export const workProjectDescriptionSchema = textFieldSchema(WORK_DESCRIPTION_INPUT);
// Its declaration's characters keep the reservation key (`workRealmNameReservationKey`) one
// document-id segment (RULE-STD-ARCH-106).
export const realmWorkingTitleSchema = textFieldSchema(REALM_NAME_INPUT);
export const realmWorkingDescriptionSchema = textFieldSchema(REALM_DESCRIPTION_INPUT);
export const workFileFolderNameSchema = textFieldSchema(WORK_FILE_FOLDER_NAME_INPUT);
export const realmFileFolderNameSchema = textFieldSchema(REALM_FILE_FOLDER_NAME_INPUT);

const baseFields = {
  workingTitle: workProjectTitleSchema,
  workingDescription: workProjectDescriptionSchema,
  workProjectType: workProjectTypeSchema,
  hallWingType: hallWingTypeSchema,
};

export const RealmCreationModeSchema = z.enum([
  'newPublicRealm',
  'newStandaloneRealm',
  'existingPublicRealm',
]);
export type RealmCreationMode = z.infer<typeof RealmCreationModeSchema>;

export const CreateWorkProjectInputSchema = z.discriminatedUnion('realmCreationMode', [
  z
    .object({
      ...baseFields,
      realmCreationMode: z.literal('newPublicRealm'),
      realmWorkingTitle: realmWorkingTitleSchema,
      realmWorkingDescription: realmWorkingDescriptionSchema,
      realmFoundingAgreementVersion: z.literal(WORK_REALM_FOUNDING_AGREEMENT_VERSION),
    })
    .strict(),
  z
    .object({
      ...baseFields,
      realmCreationMode: z.literal('newStandaloneRealm'),
    })
    .strict(),
  z
    .object({
      ...baseFields,
      realmCreationMode: z.literal('existingPublicRealm'),
      workRealmId: workRealmIdSchema,
    })
    .strict(),
]);
export type CreateWorkProjectInput = z.infer<typeof CreateWorkProjectInputSchema>;

export const CreateWorkProjectResultSchema = z
  .object({
    success: z.literal(true),
    workProjectId: workProjectIdSchema,
    workProjectData: FullWorkProjectSchema,
  })
  .strict()
  .superRefine((result, ctx) => {
    if (result.workProjectData.workProjectId !== result.workProjectId) {
      ctx.addIssue({ code: 'custom', path: ['workProjectData', 'workProjectId'] });
    }
  });
export type CreateWorkProjectResult = z.infer<typeof CreateWorkProjectResultSchema>;

export const DeleteWorkAssetInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    workAssetId: documentIdSegmentSchema,
  })
  .strict();
export type DeleteWorkAssetInput = z.infer<typeof DeleteWorkAssetInputSchema>;

export const InviteSourceSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('standalone'),
    })
    .strict(),
  z
    .object({
      type: z.literal('craftSkill'),
      data: z
        .object({
          craftSkillId: craftSkillIdSchema,
          craftSkillOwnerUserId: userIdSchema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('commission'),
      data: z
        .object({
          commissionListingId: commissionListingIdSchema,
          commissionProposalId: commissionProposalIdSchema,
          proposalArtisanUserId: userIdSchema,
          postingStakeSharesOffered: z.number().int().min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('audition'),
      data: z
        .object({
          auditionId: auditionIdSchema,
          auditionEntryId: auditionEntryIdSchema,
          respondentUserId: userIdSchema,
          postingStakeSharesOffered: z.number().int().min(1),
        })
        .strict(),
    })
    .strict(),
]);
export type InviteSource = z.infer<typeof InviteSourceSchema>;
export type InviteSourceType = InviteSource['type'];

export const InviteUserToGuildInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    inviteeUid: userIdSchema,
    message: textFieldSchema(GUILD_INVITE_MESSAGE_INPUT),
    stakeSharesOffered: stakeSharesOfferedSchema,
    source: InviteSourceSchema,
  })
  .strict();
export type InviteUserToGuildInput = z.infer<typeof InviteUserToGuildInputSchema>;

export const InviteUserToGuildResultSchema = z.object({
  success: z.literal(true),
  guildInviteId: guildInviteIdSchema,
  invitedUsername: z.string(),
});
export type InviteUserToGuildResult = z.infer<typeof InviteUserToGuildResultSchema>;

export const ListGuildInvitesInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    statuses: z.array(guildInviteConversationStatusSchema).min(1),
    cursor: z.string().min(1).optional(),
  })
  .strict();
export type ListGuildInvitesInput = z.infer<typeof ListGuildInvitesInputSchema>;

export const UpdateGuildmateTradeProfessionsInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    userId: userIdSchema,
    tradeProfession: z.enum(TRADE_PROFESSION_VALUES),
    action: addRemoveActionSchema,
  })
  .strict();
export type UpdateGuildmateTradeProfessionsInput = z.infer<
  typeof UpdateGuildmateTradeProfessionsInputSchema
>;

export const UpdateGuildmateTradeProfessionsResultSchema = z.object({
  success: z.literal(true),
});
export type UpdateGuildmateTradeProfessionsResult = z.infer<
  typeof UpdateGuildmateTradeProfessionsResultSchema
>;

const GUILD_STANDING_VALUES_ENUM = GUILD_STANDING_VALUES as [
  (typeof GUILD_STANDING_VALUES)[number],
  ...(typeof GUILD_STANDING_VALUES)[number][],
];

export const UpdateGuildmateStandingInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    userId: userIdSchema,
    guildStanding: z.enum(GUILD_STANDING_VALUES_ENUM),
    action: addRemoveActionSchema,
  })
  .strict();
export type UpdateGuildmateStandingInput = z.infer<typeof UpdateGuildmateStandingInputSchema>;

export const UpdateGuildmateStandingResultSchema = z.object({
  success: z.literal(true),
});
export type UpdateGuildmateStandingResult = z.infer<typeof UpdateGuildmateStandingResultSchema>;

export const LeaveWorkProjectInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
  })
  .strict();
export type LeaveWorkProjectInput = z.infer<typeof LeaveWorkProjectInputSchema>;

export const LeaveWorkProjectResultSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});
export type LeaveWorkProjectResult = z.infer<typeof LeaveWorkProjectResultSchema>;

export const UpdatePublicWorkProjectDetailsInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    workingTitle: workProjectTitleSchema.optional(),
    workingDescription: workProjectDescriptionSchema.optional(),
  })
  .strict()
  .refine((input) => input.workingTitle !== undefined || input.workingDescription !== undefined);
export type UpdatePublicWorkProjectDetailsInput = z.infer<
  typeof UpdatePublicWorkProjectDetailsInputSchema
>;

export const UpdatePublicWorkProjectDetailsResultSchema = z.object({
  success: z.literal(true),
});
export type UpdatePublicWorkProjectDetailsResult = z.infer<
  typeof UpdatePublicWorkProjectDetailsResultSchema
>;

export const UpdateWorkRealmDetailsInputSchema = z
  .object({
    workRealmId: workRealmIdSchema,
    workingTitle: realmWorkingTitleSchema.optional(),
    workingDescription: realmWorkingDescriptionSchema.optional(),
  })
  .strict()
  .refine((input) => input.workingTitle !== undefined || input.workingDescription !== undefined);
export type UpdateWorkRealmDetailsInput = z.infer<typeof UpdateWorkRealmDetailsInputSchema>;

export const UpdateWorkRealmDetailsResultSchema = z.object({
  success: z.literal(true),
});
export type UpdateWorkRealmDetailsResult = z.infer<typeof UpdateWorkRealmDetailsResultSchema>;

export const CheckRealmNameAvailableInputSchema = z
  .object({
    workingTitle: realmWorkingTitleSchema,
  })
  .strict();
export type CheckRealmNameAvailableInput = z.infer<typeof CheckRealmNameAvailableInputSchema>;

export const CheckRealmNameAvailableResultSchema = z.object({
  available: z.boolean(),
  reason: z.literal('taken').optional(),
});
export type CheckRealmNameAvailableResult = z.infer<typeof CheckRealmNameAvailableResultSchema>;

const tradeProfessionListSchema = z
  .array(z.enum(TRADE_PROFESSION_VALUES))
  .max(TRADE_PROFESSION_OPTIONS.length);

export const CreateFileFolderInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    name: workFileFolderNameSchema,
    canViewTradeProfessions: tradeProfessionListSchema,
    canUploadTradeProfessions: tradeProfessionListSchema,
    canDeleteTradeProfessions: tradeProfessionListSchema,
  })
  .strict();
export type CreateFileFolderInput = z.infer<typeof CreateFileFolderInputSchema>;

export const CreateFileFolderResultSchema = z.object({
  success: z.literal(true),
  folderId: workFileFolderIdSchema,
});
export type CreateFileFolderResult = z.infer<typeof CreateFileFolderResultSchema>;

export const RenameFileFolderInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    folderId: workFileFolderIdSchema,
    name: workFileFolderNameSchema,
  })
  .strict();
export type RenameFileFolderInput = z.infer<typeof RenameFileFolderInputSchema>;

export const RenameFileFolderResultSchema = z.object({
  success: z.literal(true),
});
export type RenameFileFolderResult = z.infer<typeof RenameFileFolderResultSchema>;

export const UpdateFolderProfessionsInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    folderId: workFileFolderIdSchema,
    canViewTradeProfessions: tradeProfessionListSchema,
    canUploadTradeProfessions: tradeProfessionListSchema,
    canDeleteTradeProfessions: tradeProfessionListSchema,
  })
  .strict();
export type UpdateFolderProfessionsInput = z.infer<typeof UpdateFolderProfessionsInputSchema>;

export const UpdateFolderProfessionsResultSchema = z.object({
  success: z.literal(true),
});
export type UpdateFolderProfessionsResult = z.infer<typeof UpdateFolderProfessionsResultSchema>;

export const DeleteFileFolderInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    folderId: workFileFolderIdSchema,
  })
  .strict();
export type DeleteFileFolderInput = z.infer<typeof DeleteFileFolderInputSchema>;

export const DeleteFileFolderResultSchema = z.object({
  success: z.literal(true),
});
export type DeleteFileFolderResult = z.infer<typeof DeleteFileFolderResultSchema>;

export const DeleteWorkFileInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    folderId: workFileFolderIdSchema,
    workFileId: workFileIdSchema,
  })
  .strict();
export type DeleteWorkFileInput = z.infer<typeof DeleteWorkFileInputSchema>;

export const DeleteWorkFileResultSchema = z.object({
  success: z.literal(true),
});
export type DeleteWorkFileResult = z.infer<typeof DeleteWorkFileResultSchema>;

export const UpdateWorkFileRealmCanonInputSchema = z
  .object({
    workRealmId: workRealmIdSchema,
    mediaAssetId: mediaAssetIdSchema,
    canon: z.boolean(),
  })
  .strict();
export type UpdateWorkFileRealmCanonInput = z.infer<typeof UpdateWorkFileRealmCanonInputSchema>;

export const UpdateWorkFileRealmShareInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    workFileId: workFileIdSchema,
    requestId: realmFileShareRequestIdSchema,
  })
  .strict();
export type UpdateWorkFileRealmShareInput = z.infer<typeof UpdateWorkFileRealmShareInputSchema>;

export const WithdrawRealmFilePromotionRequestInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    workFileId: workFileIdSchema,
    requestId: realmFileShareRequestIdSchema,
  })
  .strict();
export type WithdrawRealmFilePromotionRequestInput = z.infer<
  typeof WithdrawRealmFilePromotionRequestInputSchema
>;

export const ApproveRealmFilePromotionInputSchema = z
  .object({
    workRealmId: workRealmIdSchema,
    mediaAssetId: mediaAssetIdSchema,
    realmFileFolderId: realmFileFolderIdSchema,
    requestId: realmFileShareRequestIdSchema,
  })
  .strict();
export type ApproveRealmFilePromotionInput = z.infer<typeof ApproveRealmFilePromotionInputSchema>;

export const DeclineRealmFilePromotionInputSchema = z
  .object({
    workRealmId: workRealmIdSchema,
    mediaAssetId: mediaAssetIdSchema,
    requestId: realmFileShareRequestIdSchema,
  })
  .strict();
export type DeclineRealmFilePromotionInput = z.infer<typeof DeclineRealmFilePromotionInputSchema>;

export const AdminUpdateWorkFileRealmUnshareInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    workFileId: workFileIdSchema,
  })
  .strict();
export type AdminUpdateWorkFileRealmUnshareInput = z.infer<
  typeof AdminUpdateWorkFileRealmUnshareInputSchema
>;

export const CreateRealmFileFolderInputSchema = z
  .object({
    workRealmId: workRealmIdSchema,
    name: realmFileFolderNameSchema,
  })
  .strict();
export type CreateRealmFileFolderInput = z.infer<typeof CreateRealmFileFolderInputSchema>;

export const UpdateRealmFileFolderInputSchema = z
  .object({
    workRealmId: workRealmIdSchema,
    realmFileFolderId: realmFileFolderIdSchema,
    name: realmFileFolderNameSchema,
  })
  .strict();
export type UpdateRealmFileFolderInput = z.infer<typeof UpdateRealmFileFolderInputSchema>;

export const DeleteRealmFileFolderInputSchema = z
  .object({
    workRealmId: workRealmIdSchema,
    realmFileFolderId: realmFileFolderIdSchema,
  })
  .strict();
export type DeleteRealmFileFolderInput = z.infer<typeof DeleteRealmFileFolderInputSchema>;

export const UpdateRealmFileFolderAssignmentInputSchema = z
  .object({
    workRealmId: workRealmIdSchema,
    mediaAssetId: mediaAssetIdSchema,
    expectedRealmFileFolderId: realmFileFolderIdSchema,
    realmFileFolderId: realmFileFolderIdSchema,
  })
  .strict();
export type UpdateRealmFileFolderAssignmentInput = z.infer<
  typeof UpdateRealmFileFolderAssignmentInputSchema
>;
