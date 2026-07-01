import { z } from 'zod';
import {
  violationIdSchema,
  taskIdSchema,
  workProjectIdSchema,
  hallItemIdSchema,
  workProjectTypeSchema,
} from './atoms.js';
import type { AdminTaskType } from '../types/admin.js';

const ADMIN_TASK_TYPES: [AdminTaskType, ...AdminTaskType[]] = [
  'adminDispatch',
  'thresholdLibraryReview',
  'userReport',
  'content-appeal',
  'stakeShareAnomaly',
  'pledgeLedgerAnomaly',
  'pledgePaymentRepairNeeded',
];

export const CheckoutNextImportantTaskInputSchema = z.object({}).strict();
export type CheckoutNextImportantTaskInput = z.infer<typeof CheckoutNextImportantTaskInputSchema>;

export const GetContentViolationInputSchema = z.object({
  violationId: violationIdSchema,
}).strict();
export type GetContentViolationInput = z.infer<typeof GetContentViolationInputSchema>;

export const MarkWorkLaterInputSchema = z.object({
  taskId: taskIdSchema,
  taskType: z.enum(ADMIN_TASK_TYPES),
  extendHours: z.union([z.literal(24), z.literal(48)]),
}).strict();
export type MarkWorkLaterInput = z.infer<typeof MarkWorkLaterInputSchema>;

export const ReviewContentAppealInputSchema = z.object({
  violationId: violationIdSchema,
  taskId: taskIdSchema,
  decision: z.enum(['approved', 'denied']),
  adminNotes: z.string().max(2000),
}).strict();
export type ReviewContentAppealInput = z.infer<typeof ReviewContentAppealInputSchema>;

// --- System-doc admin updates ---

const FuturePlanItemSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  order: z.number().int().min(0),
  videoUrl: z.string().url().max(2048).optional(),
  mediaType: z.enum(['video', 'image', 'audio', 'other']).optional(),
}).strict();

export const UpdateFuturePlansInputSchema = z.object({
  plans: z.array(FuturePlanItemSchema).max(200),
}).strict();
export type UpdateFuturePlansInput = z.infer<typeof UpdateFuturePlansInputSchema>;

const RuleSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  videoUrl: z.string().url().max(2048).optional(),
  group: z.enum(['generic', 'workProjectType', 'hallWingType', 'workRealm', 'merchandising']).optional(),
  subgroup: z.enum(['Tales', 'Tunes', 'Television', 'entertainment', 'educational', 'newsPolitical']).optional(),
  order: z.number().int().min(0),
}).strict();

const AgreementCategorySchema = z.object({
  points: z.array(z.string().min(1).max(2000)).max(200),
  videoUrl: z.string().url().max(2048).optional(),
}).strict();

const AgreementsSchema = z.object({
  tales: AgreementCategorySchema.optional(),
  tunes: AgreementCategorySchema.optional(),
  television: AgreementCategorySchema.optional(),
}).strict();

// Partial update — admin UI may send only `rules` or only `agreements`.
// Server merges. At least one field must be present.
export const UpdateRulesAndAgreementsInputSchema = z.object({
  rules: z.array(RuleSchema).max(500).optional(),
  agreements: AgreementsSchema.optional(),
}).strict().refine(
  (data) => data.rules !== undefined || data.agreements !== undefined,
  { message: 'At least one of `rules` or `agreements` must be provided.' },
);
export type UpdateRulesAndAgreementsInput = z.infer<typeof UpdateRulesAndAgreementsInputSchema>;

const AppConfigDocIdSchema = z.literal('app');

export const UpdateAppConfigInputSchema = z.object({
  docId: AppConfigDocIdSchema,
  data: z.object({
    appVersion: z.string().min(1).max(64).optional(),
    maintenanceMode: z.boolean().optional(),
    maintenanceMessage: z.string().max(2000).optional(),
    registrationEnabled: z.boolean().optional(),
    // Runtime abuse throttle: 0 < m <= 1 (tighten-only; 1 = no throttle).
    rateLimitMultiplier: z.number().gt(0).max(1).optional(),
  }).strict().refine(
    (d) => Object.keys(d).length > 0,
    { message: 'data must have at least one field' },
  ),
}).strict();
export type UpdateAppConfigInput = z.infer<typeof UpdateAppConfigInputSchema>;

// --- Admin list mutations ---

const uidSchema = z.string().min(1).max(128);

/**
 * Wire input for the `updateAdminList` callable in ttt-prod.
 * Used to grant or revoke admin / jrAdmin status on `_systemData/adminList`.
 *
 * All four fields are optional arrays of UIDs. At least one must be non-empty.
 * The callable's core function rejects conflicting input (e.g. same UID in
 * both addAdmins and removeAdmins) with HttpsError invalid-argument.
 */
export const UpdateAdminListInputSchema = z.object({
  addAdmins: z.array(uidSchema).optional(),
  removeAdmins: z.array(uidSchema).optional(),
  addJrAdmins: z.array(uidSchema).optional(),
  removeJrAdmins: z.array(uidSchema).optional(),
})
  .strict()
  .refine(
    (data) =>
      (data.addAdmins?.length ?? 0) +
        (data.removeAdmins?.length ?? 0) +
        (data.addJrAdmins?.length ?? 0) +
        (data.removeJrAdmins?.length ?? 0) >
      0,
    { message: 'At least one of addAdmins/removeAdmins/addJrAdmins/removeJrAdmins must be non-empty.' },
  );

export type UpdateAdminListInput = z.infer<typeof UpdateAdminListInputSchema>;

// --- Admin moderation: hide / restore / retitle content + Work/Realm objects ---

export const CheckTrademarkInputSchema = z.object({
  // Primary: the work project's title (franchise-level check).
  workTitle: z.string().min(1).max(200),
  // Optional: the sub-item title (chapter, track, episode). Checked secondarily.
  // `.nullish()` (not `.optional()`): the Firebase callable client serializes an
  // undefined argument as JSON null, and the work-view caller passes
  // `subItemTitle: subItem?.title` which is undefined when the sub-item hasn't
  // loaded — that arrives here as null. A bare `.optional()` would 400 on it.
  subItemTitle: z.string().max(200).nullish(),
}).strict();
export type CheckTrademarkInput = z.infer<typeof CheckTrademarkInputSchema>;

export const GetReportedContentDetailInputSchema = z.object({
  reportGroupId: z.string().min(1),
}).strict();
export type GetReportedContentDetailInput = z.infer<typeof GetReportedContentDetailInputSchema>;

export const HideHallSubItemInputSchema = z.object({
  hallItemId: hallItemIdSchema,
  workProjectType: workProjectTypeSchema,
  subItemId: z.string().min(1),
  reason: z.string().min(1),
}).strict();
export type HideHallSubItemInput = z.infer<typeof HideHallSubItemInputSchema>;

export const RestoreHallSubItemInputSchema = z.object({
  hallItemId: hallItemIdSchema,
  workProjectType: workProjectTypeSchema,
  subItemId: z.string().min(1),
}).strict();
export type RestoreHallSubItemInput = z.infer<typeof RestoreHallSubItemInputSchema>;

export const HideWorkProjectInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  reason: z.string().min(1),
}).strict();
export type HideWorkProjectInput = z.infer<typeof HideWorkProjectInputSchema>;

export const HideWorkRealmInputSchema = z.object({
  workRealmId: z.string().min(1),
  reason: z.string().min(1),
}).strict();
export type HideWorkRealmInput = z.infer<typeof HideWorkRealmInputSchema>;

export const RestoreWorkProjectInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  cascadeId: z.string().min(1),
}).strict();
export type RestoreWorkProjectInput = z.infer<typeof RestoreWorkProjectInputSchema>;

export const RestoreWorkRealmInputSchema = z.object({
  workRealmId: z.string().min(1),
  cascadeId: z.string().min(1),
}).strict();
export type RestoreWorkRealmInput = z.infer<typeof RestoreWorkRealmInputSchema>;

// The `requireWorkProjectRetitle` / `requireWorkRealmRetitle` callables share this base
// `{ reason }` shape and each `.extend(...)` it with its own id field at parse time.
export const RequireRetitleInputSchema = z.object({
  reason: z.string().min(1).max(500),
}).strict();
export type RequireRetitleInput = z.infer<typeof RequireRetitleInputSchema>;

// --- resolveAdminTask — the ONE guided close-out for EVERY admin case type ---

// [EUAS-005] The content-action target set ALSO accepts hall-library-sub-item (hide/restore only),
// which routes to the dedicated `runSetHallSubItemHidden` core (not `runModerateReportedContent`).
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
] as const;

const ContentActionSchema = z
  .object({
    button: z.enum(['hideContent', 'restoreContent', 'permaRemoveContent']),
    targetType: z.enum(CONTENT_ACTION_TARGET_TYPES),
    reportedItemId: z.string().min(1),
    parentItemId: z.string().min(1).optional(),
  })
  .strict();

const WarnUserSchema = z
  .object({
    button: z.literal('warnUser'),
    userId: z.string().min(1),
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(5000),
  })
  .strict();

const SuspendOrBanSchema = z
  .object({
    button: z.enum(['suspendUser', 'banUser']),
    userId: z.string().min(1),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();

const ReinstateUserSchema = z
  .object({ button: z.literal('reinstateUser'), userId: z.string().min(1), reason: z.string().trim().max(2000).optional() })
  .strict();

const ForceUsernameResetSchema = z
  .object({ button: z.literal('forceUsernameReset'), userId: z.string().min(1), reason: z.string().trim().min(1).max(2000).optional() })
  .strict();

/** Whole-object Work/Realm remedies — `reportedItemId` is the workProjectId / workRealmId. */
const WorkObjectActionSchema = z
  .object({
    button: z.enum(['hideWorkObject', 'restoreWorkObject', 'forceRetitle']),
    targetType: z.enum(['work-project', 'work-realm']),
    reportedItemId: z.string().min(1),
  })
  .strict();

/** Chat message tombstone — channel + seq from the report, revision from the live thread-read. */
const TombstoneChatSchema = z
  .object({
    button: z.literal('tombstoneChat'),
    channel: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('channel'), workProjectId: z.string().min(1), guildChatChannelId: z.string().min(1) }).strict(),
      z.object({ kind: z.literal('invite'), guildInviteId: z.string().min(1) }).strict(),
    ]),
    messageSeq: z.number().int().nonnegative(),
    expectedMessageRevision: z.number().int().nonnegative(),
  })
  .strict();

export const StagedActionSchema = z.discriminatedUnion('button', [
  ContentActionSchema,
  WarnUserSchema,
  SuspendOrBanSchema,
  ReinstateUserSchema,
  ForceUsernameResetSchema,
  WorkObjectActionSchema,
  TombstoneChatSchema,
]);
export type StagedAction = z.infer<typeof StagedActionSchema>;

export const NormalReportInputSchema = z
  .object({
    caseType: z.literal('normalReport').default('normalReport'),
    taskId: z.string().min(1),
    outcome: z.enum(['founded', 'unfounded']),
    resolutionSummary: z.string().trim().min(1).max(2000),
    actions: z.array(StagedActionSchema).max(16).default([]),
    userFacingReasonCode: z.string().trim().min(1).max(128).optional(),
    userFacingReasonDetail: z.string().trim().max(2000).optional(),
    adminNote: z.string().trim().max(4000).optional(),
  })
  .strict();
export type ResolveAdminTaskInput = z.infer<typeof NormalReportInputSchema>;

const SafetyDispositionActionSchema = z
  .object({
    button: z.literal('setReportDisposition'),
    disposition: z.enum(['reportRequired', 'notRequired', 'correctedNoApparentViolation']),
    dispositionReasonCode: z.enum([
      'outOfScopeNotCsea',
      'basisInvalidatedFalseMatch',
      'duplicateOfFiledReport',
      'leDirectedNoReport',
      'nonReportableSafetyConfirmed',
    ]),
    evidenceRefs: z.array(z.string().min(1)).min(1).max(32),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

const QuarantineActionSchema = z.object({ button: z.literal('quarantinePreserveFile') }).strict();

// [C-01/EUAS-002] No client-supplied requestId — the linked statutory request id(s) are derived
// SERVER-SIDE from the case's `requestLinks` inside `enqueueNciiRemovalForCase`.
const HashRemoveActionSchema = z.object({ button: z.literal('hashRemoveFile') }).strict();

const SafetyAccountActionSchema = z
  .object({
    button: z.enum(['suspendUser', 'banUser', 'reinstateUser']),
    targetUid: z.string().min(1),
    reasonInternal: z.string().trim().min(4).max(2000),
    reasonUserFacing: z.string().trim().min(1).max(280),
    role: z.enum(['uploader', 'requester', 'distributor', 'questionable']),
    subjectDisposition: z.enum(['subject', 'questionable', 'excluded']),
  })
  .strict();

export const SafetyStagedActionSchema = z.discriminatedUnion('button', [
  SafetyDispositionActionSchema,
  QuarantineActionSchema,
  HashRemoveActionSchema,
  SafetyAccountActionSchema,
]);
export type SafetyStagedAction = z.infer<typeof SafetyStagedActionSchema>;

export const SafetyCaseInputSchema = z
  .object({
    caseType: z.enum(['csam', 'ncii']),
    caseId: z.string().min(1),
    outcome: z.enum(['founded', 'unfounded']),
    resolutionSummary: z.string().trim().min(1).max(2000),
    actions: z.array(SafetyStagedActionSchema).max(16).default([]),
    adminNote: z.string().trim().max(4000).optional(),
    // [EUAS-017] Optimistic-concurrency token (`childSafetyCaseList.revision` / `nciiCases.revision`).
    // The close is rejected if the case changed since the operator loaded it — concurrent stale closes
    // can't silently overwrite. Optional for backward compatibility; the console always supplies it.
    expectedRevision: z.number().int().nonnegative().optional(),
    // Interim reauth: a single explicit typed confirmation for the privileged safety actions,
    // standing in for the passkey two-step until [H-17]. The callable is full-admin gated.
    confirmation: z.literal('I confirm these safety actions'),
  })
  .strict();
export type SafetyCaseInput = z.infer<typeof SafetyCaseInputSchema>;

export const ReopenSafetyCaseInputSchema = z
  .object({
    caseType: z.enum(['csam', 'ncii']),
    caseId: z.string().min(1),
    reasonInternal: z.string().trim().min(4).max(2000),
    expectedRevision: z.number().int().nonnegative().optional(),
    confirmation: z.literal('I confirm reopening this safety case'),
  })
  .strict();
export type ReopenSafetyCaseInput = z.infer<typeof ReopenSafetyCaseInputSchema>;


