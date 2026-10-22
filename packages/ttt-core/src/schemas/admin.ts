import { z } from 'zod';
import { GuildChatConversationSchema } from './chat.js';
import {
  violationIdSchema,
  taskIdSchema,
  workProjectIdSchema,
  hallItemIdSchema,
  workProjectTypeSchema,
  moderationClearableSurfaceSchema,
  reportTargetItemIdSchema,
  reportTargetParentRefSchema,
  documentIdSegmentSchema,
  unpaddedValueSchema,
  reportGroupIdSchema,
  hallSubItemIdSchema,
  workRealmIdSchema,
  userIdSchema,
  safetyCaseIdSchema,
} from './atoms.js';
import {
  ReportDispositionSchema,
  ReportDispositionReasonCodeSchema,
  refineReportDispositionReasonCode,
  refineReportDispositionEvidenceRefs,
  type ReportableItemType,
} from '../doc-schemas/safety/foundation.js';
import {
  ChildSafetyAccountRoleSchema,
  ChildSafetyAccountSubjectDispositionSchema,
  SafetyCaseLaneSchema,
} from '../doc-schemas/safety/case.js';
import { ContentMediaKindSchema, MediaServingStatusSchema } from '../doc-schemas/media-assets.js';
import { MAX_MANIFEST_NCMEC_RECEIPTS } from '../doc-schemas/safety/evidence.js';
import { RuleGroupSchema } from '../doc-schemas/content.js';
import { AppModeSchema } from '../doc-schemas/system.js';
import { HALL_WING_TYPE_KEYS, WORK_PROJECT_TYPE_KEYS } from '../types/content.js';
import {
  SystemUidListSlotIdSchema,
  SystemUidSlotIdSchema,
  SystemVideoSlotIdSchema,
} from '../system-slots/system-slots.js';
import {
  MODERATION_CLEARABLE_TEXT_FIELDS,
  HALL_CLEARABLE_TEXT_FIELD_NAMES,
} from '../constants/business-content.js';
import { MAX_WORK_PROJECT_TITLE_LENGTH } from '../constants/business-work-project.js';
import {
  MAX_INTERNAL_REASON_LENGTH,
  MAX_USER_FACING_REASON_LENGTH,
  MAX_SAFETY_RESOLUTION_SUMMARY_LENGTH,
  MAX_CONTENT_PAGE_SECTIONS,
  MAX_DMCA_CONTACT_BLOCKS,
  MAX_DMCA_CONTACT_ROWS,
  MAX_SYSTEM_UID_LIST,
  MAX_FUTURE_PLAN_GROUPS,
  MAX_FUTURE_PLANS,
  MAX_PLATFORM_RULES,
  MAX_AGREEMENT_POINTS,
} from '../constants/business-admin.js';
import { USER_FACING_REASON_CODES } from '../constants/admin-labels.js';
import {
  ACCOUNT_ACTION_REASON_INPUT,
  DISPLAY_NAME_RESET_REASON_INPUT,
  ACCOUNT_REINSTATE_REASON_INPUT,
  ADMIN_DISPATCH_MESSAGE_INPUT,
  ADMIN_DISPATCH_SUBJECT_INPUT,
  AGREEMENT_POINT_INPUT,
  ANNOUNCEMENT_MESSAGE_INPUT,
  APP_MODE_FLIP_EVIDENCE_INPUT,
  APP_VERSION_INPUT,
  APPEAL_REVIEW_NOTES_INPUT,
  CLEAR_TEXT_REASON_INPUT,
  CLOSE_OUT_ADMIN_NOTE_INPUT,
  CONTENT_PAGE_BODY_INPUT,
  CONTENT_PAGE_HEADING_INPUT,
  DMCA_CONTACT_LABEL_INPUT,
  DMCA_CONTACT_VALUE_INPUT,
  FUTURE_PLAN_DESCRIPTION_INPUT,
  FUTURE_PLAN_GROUP_NAME_INPUT,
  FUTURE_PLAN_TITLE_INPUT,
  HIDE_REASON_INPUT,
  MAINTENANCE_MESSAGE_INPUT,
  MODERATION_ACTION_REASON_INPUT,
  PLATFORM_RULE_DESCRIPTION_INPUT,
  PLATFORM_RULE_TITLE_INPUT,
  PUBLIC_DOCUMENT_INTENTION_INPUT,
  PUBLIC_DOCUMENT_INTRO_INPUT,
  RETITLE_REASON_INPUT,
  SAFETY_INTERNAL_REASON_INPUT,
  TAKE_IT_DOWN_COPY_INPUT,
  USER_FACING_REASON_DETAIL_INPUT,
} from '../constants/text-fields.js';
import {
  SAFETY_ACTIONS_CONFIRMATION,
  SAFETY_CASE_REOPEN_CONFIRMATION,
} from '../constants/safety-confirmation-phrases.js';
import { textFieldSchema } from './text-field.js';

export const CheckoutNextImportantTaskInputSchema = z.object({}).strict();
export type CheckoutNextImportantTaskInput = z.infer<typeof CheckoutNextImportantTaskInputSchema>;

export const MarkWorkLaterInputSchema = z
  .object({
    taskId: taskIdSchema,
    extendHours: z.union([z.literal(24), z.literal(48)]),
  })
  .strict();
export type MarkWorkLaterInput = z.infer<typeof MarkWorkLaterInputSchema>;

export const MarkWorkLaterResultSchema = z.object({
  success: z.literal(true),
  alreadyResolved: z.literal(true).optional(),
});
export type MarkWorkLaterResult = z.infer<typeof MarkWorkLaterResultSchema>;

export const ContentAppealDecisionSchema = z.enum(['approved', 'denied']);
export type ContentAppealDecision = z.infer<typeof ContentAppealDecisionSchema>;

export const ReviewContentAppealInputSchema = z
  .object({
    violationId: violationIdSchema,
    taskId: taskIdSchema,
    decision: ContentAppealDecisionSchema,
    adminNotes: textFieldSchema(APPEAL_REVIEW_NOTES_INPUT),
  })
  .strict();
export type ReviewContentAppealInput = z.infer<typeof ReviewContentAppealInputSchema>;

export const ReviewContentAppealResultSchema = z.object({
  success: z.literal(true),
  violationId: violationIdSchema,
  decision: ContentAppealDecisionSchema,
  userId: z.string(),
  auditEventId: z.string().min(1).optional(),
});
export type ReviewContentAppealResult = z.infer<typeof ReviewContentAppealResultSchema>;

const publicDocumentItemIdSchema = unpaddedValueSchema.max(128);
const publicDocumentIntroSchema = textFieldSchema(PUBLIC_DOCUMENT_INTRO_INPUT).optional();
const publicDocumentIntentionSchema = textFieldSchema(PUBLIC_DOCUMENT_INTENTION_INPUT).optional();
const appliesToTypeInputFields = {
  workProjectType: z.enum(WORK_PROJECT_TYPE_KEYS).optional(),
  hallWingType: z.enum(HALL_WING_TYPE_KEYS).optional(),
};

export const FuturePlanGroupInputSchema = z
  .object({
    id: publicDocumentItemIdSchema,
    name: textFieldSchema(FUTURE_PLAN_GROUP_NAME_INPUT),
    order: z.number().int().min(0),
    intention: publicDocumentIntentionSchema,
  })
  .strict();

export const FuturePlanItemInputSchema = z
  .object({
    id: publicDocumentItemIdSchema,
    title: textFieldSchema(FUTURE_PLAN_TITLE_INPUT),
    description: textFieldSchema(FUTURE_PLAN_DESCRIPTION_INPUT),
    groupId: publicDocumentItemIdSchema,
    order: z.number().int().min(0),
  })
  .strict();

export const FuturePlansContentInputSchema = z
  .object({
    intro: publicDocumentIntroSchema,
    groups: z.array(FuturePlanGroupInputSchema).max(MAX_FUTURE_PLAN_GROUPS),
    plans: z.array(FuturePlanItemInputSchema).max(MAX_FUTURE_PLANS),
  })
  .strict()
  .superRefine((content, ctx) => {
    const groupIds = new Set(content.groups.map((group) => group.id));
    if (groupIds.size !== content.groups.length) {
      ctx.addIssue({ code: 'custom', path: ['groups'], message: 'Each group needs its own id.' });
    }
    content.plans.forEach((plan, index) => {
      if (!groupIds.has(plan.groupId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['plans', index, 'groupId'],
          message: 'Every plan belongs to one of the groups.',
        });
      }
    });
  });
export type FuturePlansContentInput = z.infer<typeof FuturePlansContentInputSchema>;

export const PlatformRuleInputSchema = z
  .object({
    id: publicDocumentItemIdSchema,
    title: textFieldSchema(PLATFORM_RULE_TITLE_INPUT),
    description: textFieldSchema(PLATFORM_RULE_DESCRIPTION_INPUT),
    group: RuleGroupSchema,
    ...appliesToTypeInputFields,
    order: z.number().int().min(0),
  })
  .strict();

export const AgreementPointInputSchema = z
  .object({
    id: publicDocumentItemIdSchema,
    text: textFieldSchema(AGREEMENT_POINT_INPUT),
    ...appliesToTypeInputFields,
  })
  .strict();

export const ArtisanAgreementsInputSchema = z
  .object({
    intention: publicDocumentIntentionSchema,
    points: z.array(AgreementPointInputSchema).max(MAX_AGREEMENT_POINTS),
  })
  .strict();

export const RulesAndAgreementsContentInputSchema = z
  .object({
    intro: publicDocumentIntroSchema,
    groupIntentions: z
      .partialRecord(RuleGroupSchema, textFieldSchema(PUBLIC_DOCUMENT_INTENTION_INPUT))
      .optional(),
    rules: z.array(PlatformRuleInputSchema).max(MAX_PLATFORM_RULES),
    agreements: ArtisanAgreementsInputSchema,
  })
  .strict();
export type RulesAndAgreementsContentInput = z.infer<typeof RulesAndAgreementsContentInputSchema>;

export const ContentPageSectionInputSchema = z
  .object({
    id: publicDocumentItemIdSchema,
    heading: textFieldSchema(CONTENT_PAGE_HEADING_INPUT),
    level: z.union([z.literal(1), z.literal(2)]),
    // Must accept everything the stored ContentPageSectionSchema accepts, or a seeded doc becomes
    // unsaveable.
    body: textFieldSchema(CONTENT_PAGE_BODY_INPUT),
    order: z.number().int().min(0),
  })
  .strict();

export const LegalPageContentInputSchema = z
  .object({
    sections: z.array(ContentPageSectionInputSchema).min(1).max(MAX_CONTENT_PAGE_SECTIONS),
  })
  .strict();
export type LegalPageContentInput = z.infer<typeof LegalPageContentInputSchema>;

export const TakeItDownPageCopyContentInputSchema = z
  .object({
    strings: z.record(z.string().min(1).max(128), textFieldSchema(TAKE_IT_DOWN_COPY_INPUT)),
  })
  .strict()
  .refine(
    (data) => {
      const count = Object.keys(data.strings).length;
      return count >= 1 && count <= 200;
    },
    { message: 'strings must contain between 1 and 200 entries.' },
  );
export type TakeItDownPageCopyContentInput = z.infer<typeof TakeItDownPageCopyContentInputSchema>;

const DmcaContactRowInputSchema = z
  .object({
    id: publicDocumentItemIdSchema,
    label: textFieldSchema(DMCA_CONTACT_LABEL_INPUT),
    value: textFieldSchema(DMCA_CONTACT_VALUE_INPUT),
    order: z.number().int().min(0),
  })
  .strict();

const DmcaContactBlockInputSchema = z
  .object({
    id: publicDocumentItemIdSchema,
    heading: textFieldSchema(CONTENT_PAGE_HEADING_INPUT),
    order: z.number().int().min(0),
    rows: z.array(DmcaContactRowInputSchema).min(1).max(MAX_DMCA_CONTACT_ROWS),
  })
  .strict();

export const DmcaPolicyContentInputSchema = z
  .object({
    intro: textFieldSchema(CONTENT_PAGE_BODY_INPUT),
    contactBlocks: z.array(DmcaContactBlockInputSchema).min(1).max(MAX_DMCA_CONTACT_BLOCKS),
    sections: z.array(ContentPageSectionInputSchema).max(MAX_CONTENT_PAGE_SECTIONS),
  })
  .strict();
export type DmcaPolicyContentInput = z.infer<typeof DmcaPolicyContentInputSchema>;

const AppConfigDocIdSchema = z.literal('app');

export const UpdateAppConfigInputSchema = z
  .object({
    docId: AppConfigDocIdSchema,
    data: z
      .object({
        appVersion: textFieldSchema(APP_VERSION_INPUT).optional(),
        maintenanceMode: z.boolean().optional(),
        maintenanceMessage: textFieldSchema(MAINTENANCE_MESSAGE_INPUT).optional(),
        registrationEnabled: z.boolean().optional(),
        announcementMessage: textFieldSchema(ANNOUNCEMENT_MESSAGE_INPUT).optional(),
        rateLimitMultiplier: z.number().gt(0).max(1).optional(),
      })
      .strict()
      .refine((d) => Object.keys(d).length > 0, { message: 'data must have at least one field' }),
  })
  .strict();
export type UpdateAppConfigInput = z.infer<typeof UpdateAppConfigInputSchema>;

export const UpdateAppConfigResultSchema = z.object({
  success: z.literal(true),
  updatedFields: z.array(z.string()),
});
export type UpdateAppConfigResult = z.infer<typeof UpdateAppConfigResultSchema>;

export const RecordAppModeFlipInputSchema = z
  .object({
    milestoneEvidence: textFieldSchema(APP_MODE_FLIP_EVIDENCE_INPUT).optional(),
  })
  .strict();
export type RecordAppModeFlipInput = z.infer<typeof RecordAppModeFlipInputSchema>;

export const RecordAppModeFlipResultSchema = z.object({
  success: z.literal(true),
  recorded: z.boolean(),
  mode: AppModeSchema,
  previousMode: AppModeSchema.nullable(),
});
export type RecordAppModeFlipResult = z.infer<typeof RecordAppModeFlipResultSchema>;

export const ClearSystemVideoSlotInputSchema = z
  .object({
    slotId: SystemVideoSlotIdSchema,
  })
  .strict();
export type ClearSystemVideoSlotInput = z.infer<typeof ClearSystemVideoSlotInputSchema>;

export const ClearSystemVideoSlotResultSchema = z.object({
  success: z.literal(true),
  cleared: z.boolean(),
});
export type ClearSystemVideoSlotResult = z.infer<typeof ClearSystemVideoSlotResultSchema>;

export const UpdateSystemUidSlotInputSchema = z.union([
  z
    .object({
      slotId: SystemUidSlotIdSchema,
      value: userIdSchema.nullable(),
    })
    .strict(),
  z
    .object({
      slotId: SystemUidListSlotIdSchema,
      value: z.array(userIdSchema).max(MAX_SYSTEM_UID_LIST),
    })
    .strict(),
]);
export type UpdateSystemUidSlotInput = z.infer<typeof UpdateSystemUidSlotInputSchema>;

export const UpdateSystemUidSlotResultSchema = z.object({
  success: z.literal(true),
  changed: z.boolean(),
});
export type UpdateSystemUidSlotResult = z.infer<typeof UpdateSystemUidSlotResultSchema>;

export const UpdateAdminListInputSchema = z
  .object({
    addAdminUids: z.array(userIdSchema).optional(),
    removeAdminUids: z.array(userIdSchema).optional(),
    addJrAdminUids: z.array(userIdSchema).optional(),
    removeJrAdminUids: z.array(userIdSchema).optional(),
  })
  .strict()
  .refine(
    (data) =>
      (data.addAdminUids?.length ?? 0) +
        (data.removeAdminUids?.length ?? 0) +
        (data.addJrAdminUids?.length ?? 0) +
        (data.removeJrAdminUids?.length ?? 0) >
      0,
    {
      message:
        'At least one of addAdminUids/removeAdminUids/addJrAdminUids/removeJrAdminUids must be non-empty.',
    },
  );
export type UpdateAdminListInput = z.infer<typeof UpdateAdminListInputSchema>;

export const UpdateAdminListResultSchema = z.object({
  success: z.literal(true),
  adminsGranted: z.number().int().nonnegative(),
  adminsRevoked: z.number().int().nonnegative(),
  jrAdminsGranted: z.number().int().nonnegative(),
  jrAdminsRevoked: z.number().int().nonnegative(),
  auditEventId: z.string().min(1).optional(),
});
export type UpdateAdminListResult = z.infer<typeof UpdateAdminListResultSchema>;

export const CheckTrademarkInputSchema = z
  .object({
    workTitle: z.string().min(1).max(MAX_WORK_PROJECT_TITLE_LENGTH),
    subItemTitle: z.string().max(MAX_WORK_PROJECT_TITLE_LENGTH).optional(),
  })
  .strict();
export type CheckTrademarkInput = z.infer<typeof CheckTrademarkInputSchema>;

export const CheckTrademarkResultSchema = z.object({
  curatedMatch: z.boolean(),
  matchedEntry: z.string().nullable(),
  advisory: z.string(),
  checkedAt: z.number(),
});
export type CheckTrademarkResult = z.infer<typeof CheckTrademarkResultSchema>;

export const GetReportedContentDetailInputSchema = z
  .object({
    reportGroupId: reportGroupIdSchema,
  })
  .strict();
export type GetReportedContentDetailInput = z.infer<typeof GetReportedContentDetailInputSchema>;

export const ReportedTextFieldSchema = z.object({
  field: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
});
export type ReportedTextField = z.infer<typeof ReportedTextFieldSchema>;

export const ReportedMediaAssetSchema = z.object({
  mediaAssetId: z.string().min(1),
  mediaKind: ContentMediaKindSchema.nullable(),
  servingStatus: MediaServingStatusSchema.nullable(),
  displayVariantKey: z.string().nullable(),
  label: z.string().nullable(),
});
export type ReportedMediaAsset = z.infer<typeof ReportedMediaAssetSchema>;

export const GetReportedContentDetailResultSchema = z.object({
  itemType: z.string().min(1),
  reportedItemId: reportTargetItemIdSchema,
  textSnapshot: z.string().nullable(),
  textFields: z.array(ReportedTextFieldSchema),
  mediaAssets: z.array(ReportedMediaAssetSchema),
  isHidden: z.boolean().nullable(),
  ownerUid: z.string().nullable(),
  clearableSurface: moderationClearableSurfaceSchema.nullish(),
  reportTimeSnapshot: z
    .object({
      capturedText: z.string().nullable(),
      capturedMediaAssetIds: z.array(z.string()),
      revision: z.number().nullable(),
      capturedAt: z.number().nullable(),
    })
    .nullable(),
});
export type GetReportedContentDetailResult = z.infer<typeof GetReportedContentDetailResultSchema>;

export const HideHallSubItemInputSchema = z
  .object({
    hallItemId: hallItemIdSchema,
    workProjectType: workProjectTypeSchema,
    subItemId: hallSubItemIdSchema,
    reason: textFieldSchema(HIDE_REASON_INPUT),
  })
  .strict();
export type HideHallSubItemInput = z.infer<typeof HideHallSubItemInputSchema>;

export const HideHallSubItemResultSchema = z.object({
  success: z.literal(true),
});
export type HideHallSubItemResult = z.infer<typeof HideHallSubItemResultSchema>;

export const RestoreHallSubItemInputSchema = z
  .object({
    hallItemId: hallItemIdSchema,
    workProjectType: workProjectTypeSchema,
    subItemId: hallSubItemIdSchema,
  })
  .strict();
export type RestoreHallSubItemInput = z.infer<typeof RestoreHallSubItemInputSchema>;

export const RestoreHallSubItemResultSchema = z.object({
  success: z.literal(true),
});
export type RestoreHallSubItemResult = z.infer<typeof RestoreHallSubItemResultSchema>;

export const HideWorkProjectInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    reason: textFieldSchema(HIDE_REASON_INPUT),
  })
  .strict();
export type HideWorkProjectInput = z.infer<typeof HideWorkProjectInputSchema>;

export const HideWorkProjectResultSchema = z.object({
  success: z.literal(true),
  cascadeId: z.string().min(1),
});
export type HideWorkProjectResult = z.infer<typeof HideWorkProjectResultSchema>;

export const HideWorkRealmInputSchema = z
  .object({
    workRealmId: workRealmIdSchema,
    reason: textFieldSchema(HIDE_REASON_INPUT),
  })
  .strict();
export type HideWorkRealmInput = z.infer<typeof HideWorkRealmInputSchema>;

export const HideWorkRealmResultSchema = z.object({
  success: z.literal(true),
  cascadeId: z.string().min(1),
});
export type HideWorkRealmResult = z.infer<typeof HideWorkRealmResultSchema>;

export const RestoreWorkProjectInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    cascadeId: documentIdSegmentSchema.optional(),
  })
  .strict();
export type RestoreWorkProjectInput = z.infer<typeof RestoreWorkProjectInputSchema>;

export const RestoreWorkProjectResultSchema = z.object({
  success: z.literal(true),
});
export type RestoreWorkProjectResult = z.infer<typeof RestoreWorkProjectResultSchema>;

export const RestoreWorkRealmInputSchema = z
  .object({
    workRealmId: workRealmIdSchema,
    cascadeId: documentIdSegmentSchema.optional(),
  })
  .strict();
export type RestoreWorkRealmInput = z.infer<typeof RestoreWorkRealmInputSchema>;

export const RestoreWorkRealmResultSchema = z.object({
  success: z.literal(true),
});
export type RestoreWorkRealmResult = z.infer<typeof RestoreWorkRealmResultSchema>;

export const RequireWorkProjectRetitleInputSchema = z
  .object({
    reason: textFieldSchema(RETITLE_REASON_INPUT),
    workProjectId: workProjectIdSchema,
  })
  .strict();
export type RequireWorkProjectRetitleInput = z.infer<typeof RequireWorkProjectRetitleInputSchema>;

export const RequireWorkRealmRetitleInputSchema = z
  .object({
    reason: textFieldSchema(RETITLE_REASON_INPUT),
    workRealmId: workRealmIdSchema,
  })
  .strict();
export type RequireWorkRealmRetitleInput = z.infer<typeof RequireWorkRealmRetitleInputSchema>;

export const RequireRetitleResultSchema = z.object({
  success: z.literal(true),
});
export type RequireRetitleResult = z.infer<typeof RequireRetitleResultSchema>;

const ModerationShellClearFieldSchema = z.enum(MODERATION_CLEARABLE_TEXT_FIELDS.workProject);
export type ModerationShellClearField = z.infer<typeof ModerationShellClearFieldSchema>;

export const ClearWorkProjectTextInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    fields: z.array(ModerationShellClearFieldSchema).min(1),
    reason: textFieldSchema(CLEAR_TEXT_REASON_INPUT),
  })
  .strict();
export type ClearWorkProjectTextInput = z.infer<typeof ClearWorkProjectTextInputSchema>;

export const ClearWorkRealmTextInputSchema = z
  .object({
    workRealmId: workRealmIdSchema,
    fields: z.array(ModerationShellClearFieldSchema).min(1),
    reason: textFieldSchema(CLEAR_TEXT_REASON_INPUT),
  })
  .strict();
export type ClearWorkRealmTextInput = z.infer<typeof ClearWorkRealmTextInputSchema>;

export const ClearModerationTextResultSchema = z.object({
  success: z.literal(true),
});
export type ClearModerationTextResult = z.infer<typeof ClearModerationTextResultSchema>;

const HallClearFieldSchema = z.enum(HALL_CLEARABLE_TEXT_FIELD_NAMES);
export type HallClearField = z.infer<typeof HallClearFieldSchema>;

export const ClearHallContentTextInputSchema = z
  .object({
    hallItemId: hallItemIdSchema,
    workProjectType: workProjectTypeSchema,
    subItemId: hallSubItemIdSchema.optional(),
    fields: z.array(HallClearFieldSchema).min(1),
    reason: textFieldSchema(CLEAR_TEXT_REASON_INPUT),
  })
  .strict();
export type ClearHallContentTextInput = z.infer<typeof ClearHallContentTextInputSchema>;

export const ClearHallContentTextResultSchema = z.object({
  success: z.literal(true),
});
export type ClearHallContentTextResult = z.infer<typeof ClearHallContentTextResultSchema>;

export const GetLatestHideCascadeInputSchema = z
  .object({
    entityId: documentIdSegmentSchema,
    targetType: z.enum(['work-project', 'work-realm']),
  })
  .strict();
export type GetLatestHideCascadeInput = z.infer<typeof GetLatestHideCascadeInputSchema>;

export const GetLatestHideCascadeResultSchema = z.object({
  cascadeId: z.string().min(1).nullable(),
});
export type GetLatestHideCascadeResult = z.infer<typeof GetLatestHideCascadeResultSchema>;

export const GetPendingGuildInviteCountInputSchema = z.object({}).strict();
export type GetPendingGuildInviteCountInput = z.infer<typeof GetPendingGuildInviteCountInputSchema>;

export const GetPendingGuildInviteCountResultSchema = z.object({
  count: z.number().int().nonnegative(),
});
export type GetPendingGuildInviteCountResult = z.infer<
  typeof GetPendingGuildInviteCountResultSchema
>;

const MODERATE_REPORTED_CONTENT_TARGET_TYPES = [
  'square-streetz-post',
  'audition',
  'audition-entry',
  'commission-listing',
  'commission-proposal',
  'work-asset',
  'profile-picture',
  'hall-library-item',
  'craft-skill',
  'conversation-file',
] as const satisfies readonly ReportableItemType[];

export const ModerateReportedContentInputSchema = z
  .object({
    reportGroupId: reportGroupIdSchema,
    targetType: z.enum(MODERATE_REPORTED_CONTENT_TARGET_TYPES),
    reportedItemId: reportTargetItemIdSchema,
    parentItemId: reportTargetParentRefSchema.optional(),
    action: z.enum(['hide', 'restore', 'remove']),
    reason: textFieldSchema(MODERATION_ACTION_REASON_INPUT).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if ((val.action === 'hide' || val.action === 'remove') && !val.reason) {
      ctx.addIssue({
        code: 'custom',
        message: 'A reason is required to hide or remove content.',
        path: ['reason'],
      });
    }
  });
export type ModerateReportedContentInput = z.infer<typeof ModerateReportedContentInputSchema>;

const CONTENT_ACTION_TARGET_TYPES = [
  'square-streetz-post',
  'audition',
  'audition-entry',
  'commission-listing',
  'commission-proposal',
  'work-asset',
  'profile-picture',
  'hall-library-item',
  'craft-skill',
  'hall-library-sub-item',
  'conversation-file',
] as const satisfies readonly ReportableItemType[];

const ContentActionSchema = z
  .object({
    button: z.enum(['hideContent', 'restoreContent', 'permaRemoveContent']),
    targetType: z.enum(CONTENT_ACTION_TARGET_TYPES),
    reportedItemId: reportTargetItemIdSchema,
    parentItemId: reportTargetParentRefSchema.optional(),
  })
  .strict();

const WarnUserSchema = z
  .object({
    button: z.literal('warnUser'),
    userId: userIdSchema,
    subject: textFieldSchema(ADMIN_DISPATCH_SUBJECT_INPUT),
    message: textFieldSchema(ADMIN_DISPATCH_MESSAGE_INPUT),
  })
  .strict();

const SuspendOrBanSchema = z
  .object({
    button: z.enum(['suspendUser', 'banUser']),
    userId: userIdSchema,
    reason: textFieldSchema(ACCOUNT_ACTION_REASON_INPUT),
  })
  .strict();

const ReinstateUserSchema = z
  .object({
    button: z.literal('reinstateUser'),
    userId: userIdSchema,
    reason: textFieldSchema(ACCOUNT_REINSTATE_REASON_INPUT).optional(),
  })
  .strict();

const ForceUsernameResetSchema = z
  .object({
    button: z.literal('forceUsernameReset'),
    userId: userIdSchema,
    reason: textFieldSchema(DISPLAY_NAME_RESET_REASON_INPUT).optional(),
  })
  .strict();

const WorkObjectActionSchema = z
  .object({
    button: z.enum(['hideWorkObject', 'restoreWorkObject', 'forceRetitle']),
    targetType: z.enum(['work-project', 'work-realm']),
    reportedItemId: reportTargetItemIdSchema,
  })
  .strict();

const CLEAR_CONTENT_TEXT_TARGET_TYPES = [
  'work-project',
  'work-realm',
  'hall-library-sub-item',
] as const satisfies readonly ReportableItemType[];
export type ClearContentTextTargetType = (typeof CLEAR_CONTENT_TEXT_TARGET_TYPES)[number];

const CLEAR_CONTENT_TEXT_FIELDS = [
  ...MODERATION_CLEARABLE_TEXT_FIELDS.workProject,
  ...HALL_CLEARABLE_TEXT_FIELD_NAMES,
] as const;
const ClearContentTextFieldSchema = z.enum(CLEAR_CONTENT_TEXT_FIELDS);
export type ClearContentTextField = z.infer<typeof ClearContentTextFieldSchema>;

const CLEAR_CONTENT_TEXT_FIELDS_BY_TARGET = {
  'work-project': MODERATION_CLEARABLE_TEXT_FIELDS.workProject,
  'work-realm': MODERATION_CLEARABLE_TEXT_FIELDS.workRealm,
  'hall-library-sub-item': HALL_CLEARABLE_TEXT_FIELD_NAMES,
} as const satisfies Record<ClearContentTextTargetType, readonly ClearContentTextField[]>;

const ClearContentTextActionSchema = z
  .object({
    button: z.literal('clearContentText'),
    targetType: z.enum(CLEAR_CONTENT_TEXT_TARGET_TYPES),
    reportedItemId: reportTargetItemIdSchema,
    parentItemId: reportTargetParentRefSchema.optional(),
    fields: z.array(ClearContentTextFieldSchema).min(1),
  })
  .strict();

const TombstoneChatSchema = z
  .object({
    button: z.literal('tombstoneChat'),
    channel: GuildChatConversationSchema,
    messageSeq: z.number().int().nonnegative(),
    expectedMessageRevision: z.number().int().nonnegative(),
  })
  .strict();

export const StagedActionSchema = z
  .discriminatedUnion('button', [
    ContentActionSchema,
    WarnUserSchema,
    SuspendOrBanSchema,
    ReinstateUserSchema,
    ForceUsernameResetSchema,
    WorkObjectActionSchema,
    ClearContentTextActionSchema,
    TombstoneChatSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.button !== 'clearContentText') return;
    const clearable: readonly string[] = CLEAR_CONTENT_TEXT_FIELDS_BY_TARGET[value.targetType];
    value.fields.forEach((field, index) => {
      if (!clearable.includes(field)) {
        ctx.addIssue({
          code: 'custom',
          message: `Field '${field}' is not clearable on a '${value.targetType}' target.`,
          path: ['fields', index],
        });
      }
    });
    if (value.targetType === 'hall-library-sub-item' && !value.parentItemId) {
      ctx.addIssue({
        code: 'custom',
        message: 'parentItemId (the parent hall item id) is required for a hall sub-item target.',
        path: ['parentItemId'],
      });
    }
  });
export type StagedAction = z.infer<typeof StagedActionSchema>;

export const NormalReportInputSchema = z
  .object({
    caseType: z.literal('normalReport').default('normalReport'),
    taskId: taskIdSchema,
    outcome: z.enum(['founded', 'unfounded']),
    resolutionSummary: z.string().trim().min(1).max(MAX_SAFETY_RESOLUTION_SUMMARY_LENGTH),
    actions: z.array(StagedActionSchema).max(16).default([]),
    userFacingReasonCode: z.enum(USER_FACING_REASON_CODES).optional(),
    userFacingReasonDetail: textFieldSchema(USER_FACING_REASON_DETAIL_INPUT).optional(),
    adminNote: textFieldSchema(CLOSE_OUT_ADMIN_NOTE_INPUT).optional(),
  })
  .strict();
export type NormalReportInput = z.infer<typeof NormalReportInputSchema>;

export const ResolveAdminTaskResultSchema = z.object({
  success: z.literal(true),
  auditEventId: z.string().min(1).optional(),
});
export type ResolveAdminTaskResult = z.infer<typeof ResolveAdminTaskResultSchema>;

const SafetyDispositionActionSchema = z
  .object({
    button: z.literal('setReportDisposition'),
    disposition: ReportDispositionSchema.exclude(['undetermined']),
    dispositionReasonCode: ReportDispositionReasonCodeSchema,
    evidenceRefs: z.array(z.string().min(1)).max(MAX_MANIFEST_NCMEC_RECEIPTS),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

const QuarantineActionSchema = z.object({ button: z.literal('quarantinePreserveFile') }).strict();

const HashRemoveActionSchema = z.object({ button: z.literal('hashRemoveFile') }).strict();

const SafetyAccountActionSchema = z
  .object({
    button: z.enum(['suspendUser', 'banUser', 'reinstateUser']),
    targetUid: userIdSchema,
    reasonInternal: textFieldSchema(SAFETY_INTERNAL_REASON_INPUT),
    reasonUserFacing: z.string().trim().min(1).max(MAX_USER_FACING_REASON_LENGTH),
    role: ChildSafetyAccountRoleSchema,
    subjectDisposition: ChildSafetyAccountSubjectDispositionSchema,
  })
  .strict();

export const SafetyStagedActionSchema = z
  .discriminatedUnion('button', [
    SafetyDispositionActionSchema,
    QuarantineActionSchema,
    HashRemoveActionSchema,
    SafetyAccountActionSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.button === 'setReportDisposition') {
      refineReportDispositionReasonCode(value, ctx);
      refineReportDispositionEvidenceRefs(value, ctx);
    }
  });
export type SafetyStagedAction = z.infer<typeof SafetyStagedActionSchema>;

export const SafetyCaseInputSchema = z
  .object({
    caseType: SafetyCaseLaneSchema,
    caseId: safetyCaseIdSchema,
    outcome: z.enum(['founded', 'unfounded']),
    resolutionSummary: z.string().trim().min(1).max(MAX_SAFETY_RESOLUTION_SUMMARY_LENGTH),
    actions: z.array(SafetyStagedActionSchema).max(16).default([]),
    adminNote: textFieldSchema(CLOSE_OUT_ADMIN_NOTE_INPUT).optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
    confirmation: z.literal(SAFETY_ACTIONS_CONFIRMATION),
  })
  .strict();
export type SafetyCaseInput = z.infer<typeof SafetyCaseInputSchema>;
export type ResolveAdminTaskInput = NormalReportInput | SafetyCaseInput;

export const ReopenSafetyCaseInputSchema = z
  .object({
    caseType: SafetyCaseLaneSchema,
    caseId: safetyCaseIdSchema,
    reasonInternal: textFieldSchema(SAFETY_INTERNAL_REASON_INPUT),
    expectedRevision: z.number().int().nonnegative().optional(),
    confirmation: z.literal(SAFETY_CASE_REOPEN_CONFIRMATION),
  })
  .strict();
export type ReopenSafetyCaseInput = z.infer<typeof ReopenSafetyCaseInputSchema>;

export const DeadLetterCollectionSchema = z.enum([
  'chatSyncEvents',
  'chatAdminActionCommands',
  'notificationDeliveries',
  'chatMessageOutbox',
  'squareAnnouncementJobs',
  'chatSyncFanoutJobs',
  'mediaAssets',
  'quarantineSagaJobs',
  'nciiRemovalJobs',
  'safetyEvidenceJobs',
  'accountActionCommands',
  'activeReportGroups',
  'hallSubItemEdgeSync',
  'chatParkedDeliveries',
]);
export type DeadLetterCollection = z.infer<typeof DeadLetterCollectionSchema>;

export const FlatDeadLetterCollectionSchema = DeadLetterCollectionSchema.exclude([
  'hallSubItemEdgeSync',
]);
export type FlatDeadLetterCollection = z.infer<typeof FlatDeadLetterCollectionSchema>;

export const HallSubItemEdgeSyncReplayTargetSchema = z
  .object({
    hallItemId: hallItemIdSchema,
    workProjectType: workProjectTypeSchema,
    subItemId: hallSubItemIdSchema,
  })
  .strict();
export type HallSubItemEdgeSyncReplayTarget = z.infer<typeof HallSubItemEdgeSyncReplayTargetSchema>;

export const AdminReplayDeadLetterInputSchema = z.discriminatedUnion('collection', [
  z
    .object({
      collection: FlatDeadLetterCollectionSchema,
      docId: documentIdSegmentSchema.max(200),
      reason: z.string().min(1).max(MAX_INTERNAL_REASON_LENGTH),
      dryRun: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      collection: z.literal('hallSubItemEdgeSync'),
      ...HallSubItemEdgeSyncReplayTargetSchema.shape,
      reason: z.string().min(1).max(MAX_INTERNAL_REASON_LENGTH),
      dryRun: z.boolean().optional(),
    })
    .strict(),
]);
export type AdminReplayDeadLetterInput = z.infer<typeof AdminReplayDeadLetterInputSchema>;

export const GetDeadLettersInputSchema = z
  .object({
    collection: FlatDeadLetterCollectionSchema.optional(),
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict()
  .nullish();
export type GetDeadLettersInput = z.infer<typeof GetDeadLettersInputSchema>;

export const GetOpsStatusInputSchema = z.object({}).strict();
export type GetOpsStatusInput = z.infer<typeof GetOpsStatusInputSchema>;
