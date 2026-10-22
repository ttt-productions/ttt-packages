import { z } from 'zod';
import {
  MAX_WORK_PROJECT_TITLE_LENGTH,
  MAX_WORK_PROJECT_STAKE_SHARES,
  MAX_REALM_FILE_SHARE_REQUEST_ID_LENGTH,
} from '../constants/business-work-project.js';
import { MAX_REPORT_TARGET_ID_LENGTH } from '../constants/business-admin.js';
import { FIRESTORE_DOCUMENT_ID_MAX_BYTES } from '../constants/business-platform.js';
import { TRADE_PROFESSION_OPTIONS } from '../constants/options.js';
import {
  MODERATION_CLEARABLE_TEXT_FIELDS,
  type ModerationClearableSurface,
} from '../constants/business-content.js';
import { HALL_WING_TYPE_KEYS, WORK_PROJECT_TYPE_KEYS } from '../types/content.js';
import { GUILD_STANDING_IDS } from '../permissions/work-project-permissions-data.js';

export const stakeSharesOfferedSchema = z.number().int().min(1).max(MAX_WORK_PROJECT_STAKE_SHARES);

export const unpaddedValueSchema = z
  .string()
  .min(1)
  .refine((value) => value === value.trim(), {
    message: 'This value cannot begin or end with whitespace.',
  });

// Firestore reserves the `__name__` form and caps an id at 1,500 bytes.
export const documentIdSegmentSchema = unpaddedValueSchema
  .refine((id) => !id.includes('/'), {
    message: 'An id is one path segment and cannot contain "/".',
  })
  .refine((id) => id !== '.' && id !== '..', { message: 'An id cannot be "." or "..".' })
  .refine((id) => !/^__.*__$/.test(id), { message: 'An id cannot use the reserved __name__ form.' })
  .refine((id) => new TextEncoder().encode(id).length <= FIRESTORE_DOCUMENT_ID_MAX_BYTES, {
    message: 'An id is longer than Firestore allows.',
  });

export const reportTargetItemIdSchema = documentIdSegmentSchema.max(MAX_REPORT_TARGET_ID_LENGTH);
export const reportTargetUserIdSchema = documentIdSegmentSchema.max(MAX_REPORT_TARGET_ID_LENGTH);
export const reportTargetParentRefSchema = z
  .string()
  .min(1)
  .max(MAX_REPORT_TARGET_ID_LENGTH)
  .refine(
    (ref) => {
      const parts = ref.split('/');
      return (
        parts.length <= 2 && parts.every((part) => documentIdSegmentSchema.safeParse(part).success)
      );
    },
    { message: 'A parent reference is one id, or two ids joined by "/".' },
  );

export const workProjectIdSchema = documentIdSegmentSchema;
export const userIdSchema = documentIdSegmentSchema;
export const guildInviteIdSchema = documentIdSegmentSchema;
export const violationIdSchema = documentIdSegmentSchema;
export const auditionIdSchema = documentIdSegmentSchema;
export const commissionListingIdSchema = documentIdSegmentSchema;
export const commissionProposalIdSchema = documentIdSegmentSchema;
export const auditionEntryIdSchema = documentIdSegmentSchema;
export const guildChatChannelIdSchema = documentIdSegmentSchema;
export const workFileFolderIdSchema = documentIdSegmentSchema;
export const workRealmIdSchema = documentIdSegmentSchema;
export const realmFileFolderIdSchema = documentIdSegmentSchema;
export const realmFileShareRequestIdSchema = documentIdSegmentSchema.max(
  MAX_REALM_FILE_SHARE_REQUEST_ID_LENGTH,
);
export const notificationFanoutJobIdSchema = documentIdSegmentSchema;
export const taleIdSchema = documentIdSegmentSchema;
export const tuneIdSchema = documentIdSegmentSchema;
export const televisionIdSchema = documentIdSegmentSchema;
export const chapterIdSchema = documentIdSegmentSchema;
export const trackIdSchema = documentIdSegmentSchema;
export const episodeIdSchema = documentIdSegmentSchema;
export const craftSkillIdSchema = documentIdSegmentSchema;
export const taskIdSchema = documentIdSegmentSchema;
export const adminDispatchIdSchema = documentIdSegmentSchema;
export const reportGroupIdSchema = documentIdSegmentSchema;
export const mediaAssetIdSchema = documentIdSegmentSchema;
export const hallItemIdSchema = documentIdSegmentSchema;
export const itemIdSchema = documentIdSegmentSchema;
export const thresholdItemIdSchema = documentIdSegmentSchema;
export const changeRequestIdSchema = documentIdSegmentSchema;
export const hallSubItemIdSchema = documentIdSegmentSchema;
export const workFileIdSchema = documentIdSegmentSchema;
export const conversationFileIdSchema = documentIdSegmentSchema;
export const pendingMediaIdSchema = documentIdSegmentSchema;
export const squareStreetzPostIdSchema = documentIdSegmentSchema;
export const safetyCaseIdSchema = documentIdSegmentSchema;
export const nciiAllegationIdSchema = documentIdSegmentSchema;
export const takeItDownRequestIdSchema = documentIdSegmentSchema;
export const activeNotificationIdSchema = documentIdSegmentSchema;
export const shortLinkIdSchema = documentIdSegmentSchema;
export const pledgePaymentIdSchema = documentIdSegmentSchema;
export const pledgeRefundRequestIdSchema = documentIdSegmentSchema;

export const addRemoveActionSchema = z.enum(['add', 'remove']);
export const SYSTEM_ROLES = ['admin', 'jrAdmin'] as const;
export const systemRoleSchema = z.enum(SYSTEM_ROLES);
export type SystemRole = (typeof SYSTEM_ROLES)[number];
export const workProjectTypeSchema = z.enum(WORK_PROJECT_TYPE_KEYS);
export const hallWingTypeSchema = z.enum(HALL_WING_TYPE_KEYS);

// The cast only supplies zod's non-empty-tuple shape; it lives here because the constants layer is
// zod-free.
export const moderationClearableSurfaceSchema = z.enum(
  Object.keys(MODERATION_CLEARABLE_TEXT_FIELDS) as [
    ModerationClearableSurface,
    ...ModerationClearableSurface[],
  ],
);

// Lives in this leaf module: doc-schemas/messaging.ts and work-project-management.ts both derive
// from it and import each other's siblings.
export const guildInviteConversationStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'finalized',
]);
export type GuildInviteConversationStatus = z.infer<typeof guildInviteConversationStatusSchema>;

// Lives in this leaf module so doc-schemas/operational.ts never imports ./schemas/utility.
export const ShortLinkTargetTypeSchema = z.enum([
  'audition',
  'audition-entry',
  'commission',
  'hall-library-item',
]);
export type ShortLinkTargetType = z.infer<typeof ShortLinkTargetTypeSchema>;

export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const storedTitleSchema = z.string().min(1).max(MAX_WORK_PROJECT_TITLE_LENGTH);

// Nullish: the Firebase callable client sends an `undefined` field as null.
export const LegalReviewNoticeAcknowledgedInputSchema = z.literal(true).nullish();

export const guildChatChannelRequirementSchema = z.enum([
  ...GUILD_STANDING_IDS,
  ...TRADE_PROFESSION_OPTIONS,
]);
