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
import {
  ContentMediaKindSchema,
  MediaServingStatusSchema,
} from '../doc-schemas/media-assets.js';
import { MAX_MANIFEST_NCMEC_RECEIPTS } from '../doc-schemas/safety/evidence.js';
import { RuleGroupSchema } from '../doc-schemas/content.js';
import { HALL_WING_TYPE_KEYS, WORK_PROJECT_TYPE_KEYS } from '../types/content.js';
import { AppModeSchema } from '../doc-schemas/system.js';
import {
  SystemUidListSlotIdSchema,
  SystemUidSlotIdSchema,
  SystemVideoSlotIdSchema,
} from '../system-slots/system-slots.js';
import {
  MODERATION_CLEARABLE_TEXT_FIELDS,
  HALL_CLEARABLE_TEXT_FIELD_NAMES,
} from '../constants/business-content.js';
import {
  MAX_WORK_PROJECT_TITLE_LENGTH,
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
} from '../constants/business.js';
import {
  ACCOUNT_ACTION_REASON_INPUT,
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
import { textFieldSchema } from './text-field.js';
import {
  SAFETY_ACTIONS_CONFIRMATION,
  SAFETY_CASE_REOPEN_CONFIRMATION,
} from '../constants/safety-confirmation-phrases.js';

export const CheckoutNextImportantTaskInputSchema = z.object({}).strict();
export type CheckoutNextImportantTaskInput = z.infer<typeof CheckoutNextImportantTaskInputSchema>;

export const GetContentViolationInputSchema = z.object({
  violationId: violationIdSchema,
}).strict();
export type GetContentViolationInput = z.infer<typeof GetContentViolationInputSchema>;

// No task type: the server derives it from the task doc, since a client-sent one could be forged.
// Callers pass only the task id + the extension window.
export const MarkWorkLaterInputSchema = z.object({
  taskId: taskIdSchema,
  extendHours: z.union([z.literal(24), z.literal(48)]),
}).strict();
export type MarkWorkLaterInput = z.infer<typeof MarkWorkLaterInputSchema>;

// `alreadyResolved` answers a task already gone: nothing was written.
export const MarkWorkLaterResultSchema = z.object({
  success: z.literal(true),
  alreadyResolved: z.literal(true).optional(),
});
export type MarkWorkLaterResult = z.infer<typeof MarkWorkLaterResultSchema>;

/** The two appeal-review decisions (ONE canonical declaration — shared by the review
 * input and its authoritative result). */
export const ContentAppealDecisionSchema = z.enum(['approved', 'denied']);
export type ContentAppealDecision = z.infer<typeof ContentAppealDecisionSchema>;

export const ReviewContentAppealInputSchema = z.object({
  violationId: violationIdSchema,
  taskId: taskIdSchema,
  decision: ContentAppealDecisionSchema,
  adminNotes: textFieldSchema(APPEAL_REVIEW_NOTES_INPUT),
}).strict();
export type ReviewContentAppealInput = z.infer<typeof ReviewContentAppealInputSchema>;

// Authoritative result of reviewContentAppeal.
export const ReviewContentAppealResultSchema = z.object({
  success: z.literal(true),
  violationId: violationIdSchema,
  /** Echo of the requested decision (always known — it is the input). */
  decision: ContentAppealDecisionSchema,
  /** The appealing user's uid ('' on the orphaned-task cleanup path, where the
   * underlying violation was already gone and only the stale task was cleared). */
  userId: z.string(),
  /** Operation-receipt audit id — the `admin.contentAppealReviewed` event written in the same
   * transaction. */
  auditEventId: z.string().min(1).optional(),
});
export type ReviewContentAppealResult = z.infer<typeof ReviewContentAppealResultSchema>;

// The Admin editors' strict CONTENT schemas, one per public document. A working copy is saved
// through `SavePublicDocumentDraftInputSchema` (./public-documents.ts), which pairs each
// document id with its content schema here; the content is FULL (a version is the whole
// document, never a partial merge). The client never sends a version — the release publish
// assigns it.

const publicDocumentItemIdSchema = z.string().min(1).max(128);
const publicDocumentIntroSchema = textFieldSchema(PUBLIC_DOCUMENT_INTRO_INPUT).optional();
const publicDocumentIntentionSchema = textFieldSchema(PUBLIC_DOCUMENT_INTENTION_INPUT).optional();
const appliesToTypeInputFields = {
  workProjectType: z.enum(WORK_PROJECT_TYPE_KEYS).optional(),
  hallWingType: z.enum(HALL_WING_TYPE_KEYS).optional(),
};

export const FuturePlanGroupInputSchema = z.object({
  id: publicDocumentItemIdSchema,
  name: textFieldSchema(FUTURE_PLAN_GROUP_NAME_INPUT),
  order: z.number().int().min(0),
  intention: publicDocumentIntentionSchema,
}).strict();

export const FuturePlanItemInputSchema = z.object({
  id: publicDocumentItemIdSchema,
  title: textFieldSchema(FUTURE_PLAN_TITLE_INPUT),
  description: textFieldSchema(FUTURE_PLAN_DESCRIPTION_INPUT),
  groupId: publicDocumentItemIdSchema,
  order: z.number().int().min(0),
}).strict();

export const FuturePlansContentInputSchema = z.object({
  intro: publicDocumentIntroSchema,
  groups: z.array(FuturePlanGroupInputSchema).max(MAX_FUTURE_PLAN_GROUPS),
  plans: z.array(FuturePlanItemInputSchema).max(MAX_FUTURE_PLANS),
}).strict().superRefine((content, ctx) => {
  // A plan whose group is missing would never render, so every plan names a group the document holds.
  const groupIds = new Set(content.groups.map((group) => group.id));
  if (groupIds.size !== content.groups.length) {
    ctx.addIssue({ code: 'custom', path: ['groups'], message: 'Each group needs its own id.' });
  }
  content.plans.forEach((plan, index) => {
    if (!groupIds.has(plan.groupId)) {
      ctx.addIssue({ code: 'custom', path: ['plans', index, 'groupId'], message: 'Every plan belongs to one of the groups.' });
    }
  });
});
export type FuturePlansContentInput = z.infer<typeof FuturePlansContentInputSchema>;

export const PlatformRuleInputSchema = z.object({
  id: publicDocumentItemIdSchema,
  title: textFieldSchema(PLATFORM_RULE_TITLE_INPUT),
  description: textFieldSchema(PLATFORM_RULE_DESCRIPTION_INPUT),
  group: RuleGroupSchema,
  ...appliesToTypeInputFields,
  order: z.number().int().min(0),
}).strict();

export const AgreementPointInputSchema = z.object({
  id: publicDocumentItemIdSchema,
  text: textFieldSchema(AGREEMENT_POINT_INPUT),
  ...appliesToTypeInputFields,
}).strict();

export const ArtisanAgreementsInputSchema = z.object({
  intention: publicDocumentIntentionSchema,
  points: z.array(AgreementPointInputSchema).max(MAX_AGREEMENT_POINTS),
}).strict();

export const RulesAndAgreementsContentInputSchema = z.object({
  intro: publicDocumentIntroSchema,
  groupIntentions: z.partialRecord(RuleGroupSchema, textFieldSchema(PUBLIC_DOCUMENT_INTENTION_INPUT)).optional(),
  rules: z.array(PlatformRuleInputSchema).max(MAX_PLATFORM_RULES),
  agreements: ArtisanAgreementsInputSchema,
}).strict();
export type RulesAndAgreementsContentInput = z.infer<typeof RulesAndAgreementsContentInputSchema>;

export const ContentPageSectionInputSchema = z.object({
  id: z.string().min(1).max(128),
  heading: textFieldSchema(CONTENT_PAGE_HEADING_INPUT),
  level: z.union([z.literal(1), z.literal(2)]),
  // Empty body is LEGAL: a bare divider heading (e.g. terms "Part 1 — Our
  // Intention") is real content. The input schema must accept everything the
  // stored ContentPageSectionSchema accepts, or a faithfully-seeded doc becomes
  // unsaveable in the admin editor.
  body: textFieldSchema(CONTENT_PAGE_BODY_INPUT),
  order: z.number().int().min(0),
}).strict();

/** The Terms of Service and Privacy Policy content (the one long-form legal page shape). */
export const LegalPageContentInputSchema = z.object({
  sections: z.array(ContentPageSectionInputSchema).min(1).max(MAX_CONTENT_PAGE_SECTIONS),
}).strict();
export type LegalPageContentInput = z.infer<typeof LegalPageContentInputSchema>;

export const TakeItDownPageCopyContentInputSchema = z.object({
  strings: z.record(z.string().min(1).max(128), textFieldSchema(TAKE_IT_DOWN_COPY_INPUT)),
}).strict().refine(
  (data) => {
    const count = Object.keys(data.strings).length;
    return count >= 1 && count <= 200;
  },
  { message: 'strings must contain between 1 and 200 entries.' },
);
export type TakeItDownPageCopyContentInput = z.infer<typeof TakeItDownPageCopyContentInputSchema>;

const DmcaContactRowInputSchema = z.object({
  id: z.string().min(1).max(128),
  label: textFieldSchema(DMCA_CONTACT_LABEL_INPUT),
  value: textFieldSchema(DMCA_CONTACT_VALUE_INPUT),
  order: z.number().int().min(0),
}).strict();

const DmcaContactBlockInputSchema = z.object({
  id: z.string().min(1).max(128),
  heading: textFieldSchema(CONTENT_PAGE_HEADING_INPUT),
  order: z.number().int().min(0),
  rows: z.array(DmcaContactRowInputSchema).min(1).max(MAX_DMCA_CONTACT_ROWS),
}).strict();

/**
 * The DMCA policy content: the intro line, the labeled contact blocks (at least one — the page
 * exists to name the designated agent), and the long-form process sections.
 */
export const DmcaPolicyContentInputSchema = z.object({
  intro: textFieldSchema(CONTENT_PAGE_BODY_INPUT),
  contactBlocks: z.array(DmcaContactBlockInputSchema).min(1).max(MAX_DMCA_CONTACT_BLOCKS),
  sections: z.array(ContentPageSectionInputSchema).max(MAX_CONTENT_PAGE_SECTIONS),
}).strict();
export type DmcaPolicyContentInput = z.infer<typeof DmcaPolicyContentInputSchema>;

const AppConfigDocIdSchema = z.literal('app');

export const UpdateAppConfigInputSchema = z.object({
  docId: AppConfigDocIdSchema,
  data: z.object({
    appVersion: textFieldSchema(APP_VERSION_INPUT).optional(),
    maintenanceMode: z.boolean().optional(),
    maintenanceMessage: textFieldSchema(MAINTENANCE_MESSAGE_INPUT).optional(),
    registrationEnabled: z.boolean().optional(),
    // Announcement banner copy; '' clears the banner (empty = nothing renders).
    announcementMessage: textFieldSchema(ANNOUNCEMENT_MESSAGE_INPUT).optional(),
    // Runtime abuse throttle: 0 < m <= 1 (tighten-only; 1 = no throttle).
    rateLimitMultiplier: z.number().gt(0).max(1).optional(),
  }).strict().refine(
    (d) => Object.keys(d).length > 0,
    { message: 'data must have at least one field' },
  ),
}).strict();
export type UpdateAppConfigInput = z.infer<typeof UpdateAppConfigInputSchema>;

export const UpdateAppConfigResultSchema = z.object({
  success: z.literal(true),
  updatedFields: z.array(z.string()),
});
export type UpdateAppConfigResult = z.infer<typeof UpdateAppConfigResultSchema>;

// recordAppModeFlip records the deployed app mode; it never sets it, so the only input is the
// admin's optional milestone evidence.
export const RecordAppModeFlipInputSchema = z.object({
  milestoneEvidence: textFieldSchema(APP_MODE_FLIP_EVIDENCE_INPUT).optional(),
}).strict();
export type RecordAppModeFlipInput = z.infer<typeof RecordAppModeFlipInputSchema>;

// What recordAppModeFlip answers: whether this call recorded a change (false when the marker
// already matched the deployed mode) and the mode before and after.
export const RecordAppModeFlipResultSchema = z.object({
  success: z.literal(true),
  recorded: z.boolean(),
  mode: AppModeSchema,
  previousMode: AppModeSchema.nullable(),
});
export type RecordAppModeFlipResult = z.infer<typeof RecordAppModeFlipResultSchema>;

// clearSystemVideoSlot empties one video slot; the server refuses while the slot's upload is still
// pending or processing.
export const ClearSystemVideoSlotInputSchema = z.object({
  slotId: SystemVideoSlotIdSchema,
}).strict();
export type ClearSystemVideoSlotInput = z.infer<typeof ClearSystemVideoSlotInputSchema>;

export const ClearSystemVideoSlotResultSchema = z.object({
  success: z.literal(true),
  /** False when the slot already held no video, so nothing changed. */
  cleared: z.boolean(),
});
export type ClearSystemVideoSlotResult = z.infer<typeof ClearSystemVideoSlotResultSchema>;

// updateSystemUidSlot sets one account slot: a `uid` slot takes one account id (null clears it), a
// `uidList` slot an ordered list (empty clears it). The value's shape must match the slot's kind.
export const UpdateSystemUidSlotInputSchema = z.union([
  z.object({
    slotId: SystemUidSlotIdSchema,
    value: userIdSchema.nullable(),
  }).strict(),
  z.object({
    slotId: SystemUidListSlotIdSchema,
    value: z.array(userIdSchema).max(MAX_SYSTEM_UID_LIST),
  }).strict(),
]);
export type UpdateSystemUidSlotInput = z.infer<typeof UpdateSystemUidSlotInputSchema>;

export const UpdateSystemUidSlotResultSchema = z.object({
  success: z.literal(true),
  /** False when the slot already held this value, so nothing was written. */
  changed: z.boolean(),
});
export type UpdateSystemUidSlotResult = z.infer<typeof UpdateSystemUidSlotResultSchema>;

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

// Authoritative result of updateAdminList — the grant/revoke delta counts computed inside
// the roster transaction (uids already in their target state are no-ops and not counted).
export const UpdateAdminListResultSchema = z.object({
  success: z.literal(true),
  adminsGranted: z.number().int().nonnegative(),
  adminsRevoked: z.number().int().nonnegative(),
  jrAdminsGranted: z.number().int().nonnegative(),
  jrAdminsRevoked: z.number().int().nonnegative(),
  /** Operation-receipt audit id — the `admin.systemRoleGranted` / `admin.systemRoleRevoked`
   * event(s) key off the same roster transaction. (No single domain id: a
   * roster edit spans multiple uids, so only the audit id is a meaningful receipt handle.) */
  auditEventId: z.string().min(1).optional(),
});
export type UpdateAdminListResult = z.infer<typeof UpdateAdminListResultSchema>;

export const CheckTrademarkInputSchema = z.object({
  // Primary: the work project's title (franchise-level check).
  workTitle: z.string().min(1).max(MAX_WORK_PROJECT_TITLE_LENGTH),
  // Optional: the sub-item title (chapter, track, episode), checked secondarily; null or absent
  // means there is none to check.
  subItemTitle: z.string().max(MAX_WORK_PROJECT_TITLE_LENGTH).nullish(),
}).strict();
export type CheckTrademarkInput = z.infer<typeof CheckTrademarkInputSchema>;

export const CheckTrademarkResultSchema = z.object({
  curatedMatch: z.boolean(),
  matchedEntry: z.string().nullable(),
  advisory: z.string(),
  checkedAt: z.number(),
});
export type CheckTrademarkResult = z.infer<typeof CheckTrademarkResultSchema>;

export const GetReportedContentDetailInputSchema = z.object({
  reportGroupId: reportGroupIdSchema,
}).strict();
export type GetReportedContentDetailInput = z.infer<typeof GetReportedContentDetailInputSchema>;

// getReportedContentDetail's result: produced by the callable in functions/, consumed by the admin
// report work-view.

/** One display-text field of the reported doc, labeled for the review panel. The server returns
 *  EVERY configured non-empty text field for the item type (title, description, body, …) in
 *  display order — never just the first non-empty one. */
export const ReportedTextFieldSchema = z.object({
  /** Raw doc field name (e.g. 'description', 'workingTitle'). */
  field: z.string().min(1),
  /** Human label the panel renders (e.g. 'Description', 'Title'). */
  label: z.string().min(1),
  /** Current live value, trimmed; empty fields are omitted from the array. */
  value: z.string().min(1),
});
export type ReportedTextField = z.infer<typeof ReportedTextFieldSchema>;

/** One media asset referenced by the reported content: id + kind + current serving state
 *  (for click-to-reveal) + the server-derived variant key the reveal must request. */
export const ReportedMediaAssetSchema = z.object({
  mediaAssetId: z.string().min(1),
  mediaKind: ContentMediaKindSchema.nullable(),
  servingStatus: MediaServingStatusSchema.nullable(),
  /** The variant key the reveal must request for its single display render (image origins split
   *  between 'full' and 'main'; video/audio are always 'main'). Null when the asset doc is
   *  missing/variant-less. */
  displayVariantKey: z.string().nullable(),
  /** Human label of WHAT this asset is on the reported item (e.g. 'Square cover',
   *  'Track photo — <title>'). Null when the server cannot derive one. */
  label: z.string().nullable(),
});
export type ReportedMediaAsset = z.infer<typeof ReportedMediaAssetSchema>;

export const GetReportedContentDetailResultSchema = z.object({
  itemType: z.string().min(1),
  reportedItemId: reportTargetItemIdSchema,
  /** First non-empty display-text field; textFields is the complete labeled set. */
  textSnapshot: z.string().nullable(),
  textFields: z.array(ReportedTextFieldSchema),
  mediaAssets: z.array(ReportedMediaAssetSchema),
  /** Whether the reported doc is currently hidden (best-effort, doc-flag based). */
  isHidden: z.boolean().nullable(),
  /** The content owner / uploader uid, when derivable. */
  ownerUid: z.string().nullable(),
  /**
   * The canonical moderation-clearable SURFACE this reported doc actually IS, resolved
   * SERVER-side: `chapter` / `tuneTrack` / `televisionEpisode` for a hall sub-item (through
   * `HALL_CONTENT_SURFACES_BY_WORK_TYPE`, from the parent hall doc the callable already reads),
   * `workProject` / `workRealm` for the shells.
   *
   * Why the resolved surface and not the `workProjectType` it was resolved from: the surface is
   * what a consumer needs — `MODERATION_CLEARABLE_TEXT_FIELDS[clearableSurface]` is the exact
   * clearable field set, one canonical index with no re-derivation. Shipping the work-project type
   * instead would make every consumer redo the routing AND the detail-vs-sub-item branch — the
   * hand-rolled duplication that map exists to prevent.
   *
   * Without it, the in-flow clear's field picker could only offer the hall-family UNION
   * (title/description/content), so an operator could tick `description` on a Tale chapter
   * (title/content) or `content` on a Tune track (title/description), pass the wire refinement,
   * and have the clear runner silently drop it. The picker offers only this surface's fields, and
   * the resolve path re-checks caller-supplied fields against the same set.
   *
   * `.nullish()`: null when the reported item is not a clearable text surface at all (a square
   * post, a chat message, a profile picture).
   */
  clearableSurface: moderationClearableSurfaceSchema.nullish(),
  /** The FROZEN report-time snapshot (captured at intake), so the operator sees what was
   *  reported even if the author edited the live doc to evade. Null when the report holds none. */
  reportTimeSnapshot: z.object({
    capturedText: z.string().nullable(),
    capturedMediaAssetIds: z.array(z.string()),
    revision: z.number().nullable(),
    capturedAt: z.number().nullable(),
  }).nullable(),
});
export type GetReportedContentDetailResult = z.infer<typeof GetReportedContentDetailResultSchema>;

export const HideHallSubItemInputSchema = z.object({
  hallItemId: hallItemIdSchema,
  workProjectType: workProjectTypeSchema,
  subItemId: hallSubItemIdSchema,
  reason: textFieldSchema(HIDE_REASON_INPUT),
}).strict();
export type HideHallSubItemInput = z.infer<typeof HideHallSubItemInputSchema>;

export const HideHallSubItemResultSchema = z.object({
  success: z.literal(true),
});
export type HideHallSubItemResult = z.infer<typeof HideHallSubItemResultSchema>;

export const RestoreHallSubItemInputSchema = z.object({
  hallItemId: hallItemIdSchema,
  workProjectType: workProjectTypeSchema,
  subItemId: hallSubItemIdSchema,
}).strict();
export type RestoreHallSubItemInput = z.infer<typeof RestoreHallSubItemInputSchema>;

export const RestoreHallSubItemResultSchema = z.object({
  success: z.literal(true),
});
export type RestoreHallSubItemResult = z.infer<typeof RestoreHallSubItemResultSchema>;

export const HideWorkProjectInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  reason: textFieldSchema(HIDE_REASON_INPUT),
}).strict();
export type HideWorkProjectInput = z.infer<typeof HideWorkProjectInputSchema>;

export const HideWorkProjectResultSchema = z.object({
  success: z.literal(true),
  cascadeId: z.string().min(1),
});
export type HideWorkProjectResult = z.infer<typeof HideWorkProjectResultSchema>;

export const HideWorkRealmInputSchema = z.object({
  workRealmId: workRealmIdSchema,
  reason: textFieldSchema(HIDE_REASON_INPUT),
}).strict();
export type HideWorkRealmInput = z.infer<typeof HideWorkRealmInputSchema>;

export const HideWorkRealmResultSchema = z.object({
  success: z.literal(true),
  cascadeId: z.string().min(1),
});
export type HideWorkRealmResult = z.infer<typeof HideWorkRealmResultSchema>;

// `cascadeId` is OPTIONAL: the app backends derive all active cascades for the target when it is
// omitted, and restore just that one cascade when it is supplied.
export const RestoreWorkProjectInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  cascadeId: documentIdSegmentSchema.optional(),
}).strict();
export type RestoreWorkProjectInput = z.infer<typeof RestoreWorkProjectInputSchema>;

export const RestoreWorkProjectResultSchema = z.object({
  success: z.literal(true),
});
export type RestoreWorkProjectResult = z.infer<typeof RestoreWorkProjectResultSchema>;

export const RestoreWorkRealmInputSchema = z.object({
  workRealmId: workRealmIdSchema,
  cascadeId: documentIdSegmentSchema.optional(),
}).strict();
export type RestoreWorkRealmInput = z.infer<typeof RestoreWorkRealmInputSchema>;

export const RestoreWorkRealmResultSchema = z.object({
  success: z.literal(true),
});
export type RestoreWorkRealmResult = z.infer<typeof RestoreWorkRealmResultSchema>;

export const RequireWorkProjectRetitleInputSchema = z.object({
  reason: textFieldSchema(RETITLE_REASON_INPUT),
  workProjectId: workProjectIdSchema,
}).strict();
export type RequireWorkProjectRetitleInput = z.infer<typeof RequireWorkProjectRetitleInputSchema>;

export const RequireWorkRealmRetitleInputSchema = z.object({
  reason: textFieldSchema(RETITLE_REASON_INPUT),
  workRealmId: workRealmIdSchema,
}).strict();
export type RequireWorkRealmRetitleInput = z.infer<typeof RequireWorkRealmRetitleInputSchema>;

// ONE result for both Work and Realm retitle callables.
export const RequireRetitleResultSchema = z.object({
  success: z.literal(true),
});
export type RequireRetitleResult = z.infer<typeof RequireRetitleResultSchema>;

// Page-level "Clear text (moderation)" callables: the per-field extension of the retitle family.

// The clearable SHELL fields (raw doc field names) for the workProject + workRealm contexts.
// Derived from the canonical clearable-field map — the two shell surfaces share the same fields.
const ModerationShellClearFieldSchema = z.enum(MODERATION_CLEARABLE_TEXT_FIELDS.workProject);
export type ModerationShellClearField = z.infer<typeof ModerationShellClearFieldSchema>;

export const ClearWorkProjectTextInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  fields: z.array(ModerationShellClearFieldSchema).min(1),
  reason: textFieldSchema(CLEAR_TEXT_REASON_INPUT),
}).strict();
export type ClearWorkProjectTextInput = z.infer<typeof ClearWorkProjectTextInputSchema>;

export const ClearWorkRealmTextInputSchema = z.object({
  workRealmId: workRealmIdSchema,
  fields: z.array(ModerationShellClearFieldSchema).min(1),
  reason: textFieldSchema(CLEAR_TEXT_REASON_INPUT),
}).strict();
export type ClearWorkRealmTextInput = z.infer<typeof ClearWorkRealmTextInputSchema>;

// ONE result for both Work and Realm text-clear callables.
export const ClearModerationTextResultSchema = z.object({
  success: z.literal(true),
});
export type ClearModerationTextResult = z.infer<typeof ClearModerationTextResultSchema>;

// The clearable TEXT fields across the whole hall content family — derived from the canonical
// map (union of every hall surface's fields), never restated literals.
const HallClearFieldSchema = z.enum(HALL_CLEARABLE_TEXT_FIELD_NAMES);
export type HallClearField = z.infer<typeof HallClearFieldSchema>;

export const ClearHallContentTextInputSchema = z.object({
  hallItemId: hallItemIdSchema,
  workProjectType: workProjectTypeSchema,
  subItemId: hallSubItemIdSchema.optional(),
  fields: z.array(HallClearFieldSchema).min(1),
  reason: textFieldSchema(CLEAR_TEXT_REASON_INPUT),
}).strict();
export type ClearHallContentTextInput = z.infer<typeof ClearHallContentTextInputSchema>;

export const ClearHallContentTextResultSchema = z.object({
  success: z.literal(true),
});
export type ClearHallContentTextResult = z.infer<typeof ClearHallContentTextResultSchema>;

// getLatestHideCascade resolves the latest hide-cascade id for a Work/Realm.

export const GetLatestHideCascadeInputSchema = z.object({
  entityId: documentIdSegmentSchema,
  targetType: z.enum(['work-project', 'work-realm']),
}).strict();
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
export type GetPendingGuildInviteCountResult = z.infer<typeof GetPendingGuildInviteCountResultSchema>;

// moderateReportedContent hides, restores, or soft perma-removes an individual reported item.

// The single-item content-action target set (SUBSET of ReportableItemType — excludes the
// close-out-only hall-library-sub-item).
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
  // Conversation File — the hide/restore/remove action targets the file owner record +
  // its mediaAsset (the `work-asset` shape), never a chat message.
  'conversation-file',
] as const satisfies readonly ReportableItemType[];

export const ModerateReportedContentInputSchema = z.object({
  reportGroupId: reportGroupIdSchema,
  targetType: z.enum(MODERATE_REPORTED_CONTENT_TARGET_TYPES),
  reportedItemId: reportTargetItemIdSchema,
  parentItemId: reportTargetParentRefSchema.optional(),
  action: z.enum(['hide', 'restore', 'remove']),
  // A destructive action (hide/remove) MUST carry a reason; restore is a reversal.
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

// resolveAdminTask — the ONE guided close-out for EVERY admin case type.

// The content-action target set ALSO accepts hall-library-sub-item (hide/restore only),
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
  // Conversation File — same content action as `work-asset`, routed at the file record.
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
    // A warning IS an admin dispatch (resolveAdminTask → runCreateAdminDispatchToUser),
    // so it shares the dispatch subject/body caps.
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
  .object({ button: z.literal('reinstateUser'), userId: userIdSchema, reason: textFieldSchema(ACCOUNT_REINSTATE_REASON_INPUT).optional() })
  .strict();

const ForceUsernameResetSchema = z
  .object({ button: z.literal('forceUsernameReset'), userId: userIdSchema, reason: textFieldSchema(ACCOUNT_ACTION_REASON_INPUT).optional() })
  .strict();

/** Whole-object Work/Realm remedies — `reportedItemId` is the workProjectId / workRealmId. */
const WorkObjectActionSchema = z
  .object({
    button: z.enum(['hideWorkObject', 'restoreWorkObject', 'forceRetitle']),
    targetType: z.enum(['work-project', 'work-realm']),
    reportedItemId: reportTargetItemIdSchema,
  })
  .strict();

// The in-flow clear-content disposition: the staged counterpart of the page-level clear-text
// callables.

/** The three targets the in-flow text clear can neutralize — the Work/Realm shells plus a single
 *  published hall sub-item. Compile-linked subset of the canonical reportable-item enum. */
const CLEAR_CONTENT_TEXT_TARGET_TYPES = [
  'work-project',
  'work-realm',
  'hall-library-sub-item',
] as const satisfies readonly ReportableItemType[];
export type ClearContentTextTargetType = (typeof CLEAR_CONTENT_TEXT_TARGET_TYPES)[number];

/** Every field name the staged clear can carry across those three targets — the union of the two
 *  canonical clearable owners (`MODERATION_CLEARABLE_TEXT_FIELDS` for the shells,
 *  `HALL_CLEARABLE_TEXT_FIELD_NAMES` for the hall family), i.e. the same two sources
 *  `ClearWorkProjectTextInputSchema` / `ClearHallContentTextInputSchema` derive from. No field
 *  literal is restated here. */
const CLEAR_CONTENT_TEXT_FIELDS = [
  ...MODERATION_CLEARABLE_TEXT_FIELDS.workProject,
  ...HALL_CLEARABLE_TEXT_FIELD_NAMES,
] as const;
const ClearContentTextFieldSchema = z.enum(CLEAR_CONTENT_TEXT_FIELDS);
export type ClearContentTextField = z.infer<typeof ClearContentTextFieldSchema>;

/** Which fields each target legally accepts — projected from those same owners, so a
 *  target/field mismatch is refused at the wire instead of reaching a clear runner that would
 *  drop it. Enforced by the cross-field refinement on `StagedActionSchema` below. */
const CLEAR_CONTENT_TEXT_FIELDS_BY_TARGET = {
  'work-project': MODERATION_CLEARABLE_TEXT_FIELDS.workProject,
  'work-realm': MODERATION_CLEARABLE_TEXT_FIELDS.workRealm,
  'hall-library-sub-item': HALL_CLEARABLE_TEXT_FIELD_NAMES,
} as const satisfies Record<ClearContentTextTargetType, readonly ClearContentTextField[]>;

/** Per-field text clear — the guided close-out's staged counterpart of the page-level
 *  `clearWorkProjectText` / `clearWorkRealmText` / `clearHallContentText` callables (the
 *  per-field extension of `forceRetitle`). `reportedItemId` is the workProjectId / workRealmId /
 *  sub-item id; `parentItemId` is the parent hall item id, required only for the sub-item target.
 *  `workProjectType` is deliberately NOT on the wire — the server re-reads it from the doc (the
 *  hall hide-branch precedent). */
const ClearContentTextActionSchema = z
  .object({
    button: z.literal('clearContentText'),
    targetType: z.enum(CLEAR_CONTENT_TEXT_TARGET_TYPES),
    reportedItemId: reportTargetItemIdSchema,
    parentItemId: reportTargetParentRefSchema.optional(),
    fields: z.array(ClearContentTextFieldSchema).min(1),
  })
  .strict();

/** Chat message tombstone — channel + seq from the report, revision from the live thread-read. */
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
  // The clearContentText arm's two cross-field rules, applied at the union (the
  // SafetyStagedActionSchema pattern below) because no other arm carries these fields:
  // every chosen field must belong to the chosen target's canonical clearable set, and the
  // hall sub-item target must name its parent hall item.
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
    userFacingReasonCode: z.string().trim().min(1).max(128).optional(),
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
    // Derived from the ONE canonical disposition enum — 'undetermined' is the initial
    // state, never an operator-settable target, so it is excluded (not re-declared).
    disposition: ReportDispositionSchema.exclude(['undetermined']),
    dispositionReasonCode: ReportDispositionReasonCodeSchema,
    // Derived from the ONE receipts-cap constant (doc-schemas/safety/evidence.ts) — the same
    // bound the callable + the embedded SetReportDispositionInputV1Schema use. No field-level min:
    // the reportRequired⇒non-empty rule lives in the shared cross-field refinement below, so every
    // other disposition may legally stage this action with no evidence revealed.
    evidenceRefs: z.array(z.string().min(1)).max(MAX_MANIFEST_NCMEC_RECEIPTS),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

const QuarantineActionSchema = z.object({ button: z.literal('quarantinePreserveFile') }).strict();

// No client-supplied requestId — the linked statutory request id(s) are derived
// SERVER-SIDE from the case's `requestLinks` inside `enqueueNciiRemovalForCase`.
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
  // The setReportDisposition arm reuses the ONE canonical cross-field rules (foundation.ts) via the
  // shared refinements — never re-declaring them here: the disposition↔reason pairing AND the
  // reportRequired⇒evidence-present rule. Other arms carry no such fields.
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
    // Optimistic-concurrency token (`childSafetyCaseList.revision` / `nciiCases.revision`).
    // The close is rejected if the case changed since the operator loaded it — concurrent stale closes
    // can't silently overwrite. Optional; the console always supplies it.
    expectedRevision: z.number().int().nonnegative().optional(),
    // Reauth: a single explicit typed confirmation for the privileged safety actions. The
    // callable is full-admin gated.
    confirmation: z.literal(SAFETY_ACTIONS_CONFIRMATION),
  })
  .strict();
export type SafetyCaseInput = z.infer<typeof SafetyCaseInputSchema>;
// `resolveAdminTask` parses one of the two closes, chosen by `caseType`.
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

// Dead-letter operations — adminReplayDeadLetter + getDeadLetters (Ops Repairs).

/** Every ledger the dead-letter replay callable supports. */
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

/** Every replay lane whose target is a flat top-level document. */
export const FlatDeadLetterCollectionSchema = DeadLetterCollectionSchema.exclude(['hallSubItemEdgeSync']);
export type FlatDeadLetterCollection = z.infer<typeof FlatDeadLetterCollectionSchema>;

/**
 * Canonical identity for a published Hall sub-item edge-sync replay target. The work type derives
 * the only valid nested collection through PATH_BUILDERS.hallItemSubItem; callers never submit a
 * Firestore path or collection segment.
 */
export const HallSubItemEdgeSyncReplayTargetSchema = z.object({
  hallItemId: hallItemIdSchema,
  workProjectType: workProjectTypeSchema,
  subItemId: hallSubItemIdSchema,
}).strict();
export type HallSubItemEdgeSyncReplayTarget = z.infer<typeof HallSubItemEdgeSyncReplayTargetSchema>;

export const AdminReplayDeadLetterInputSchema = z
  .discriminatedUnion('collection', [
    z.object({
      collection: FlatDeadLetterCollectionSchema,
      docId: documentIdSegmentSchema.max(200),
      reason: z.string().min(1).max(MAX_INTERNAL_REASON_LENGTH),
      dryRun: z.boolean().optional(),
    }).strict(),
    z.object({
      collection: z.literal('hallSubItemEdgeSync'),
      ...HallSubItemEdgeSyncReplayTargetSchema.shape,
      reason: z.string().min(1).max(MAX_INTERNAL_REASON_LENGTH),
      dryRun: z.boolean().optional(),
    }).strict(),
  ]);
export type AdminReplayDeadLetterInput = z.infer<typeof AdminReplayDeadLetterInputSchema>;

export const GetDeadLettersInputSchema = z
  .object({
    /** Restrict to one listable flat ledger; absent = all listable flat ledgers. */
    collection: FlatDeadLetterCollectionSchema.optional(),
    /** Per-ledger row cap (the callable's own ceiling applies regardless). */
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict()
  .nullish();
export type GetDeadLettersInput = z.infer<typeof GetDeadLettersInputSchema>;

/** The `getOpsStatus` input: the snapshot takes no parameters, and anything sent is refused. */
export const GetOpsStatusInputSchema = z.object({}).strict();
export type GetOpsStatusInput = z.infer<typeof GetOpsStatusInputSchema>;


