import { z } from 'zod';
import {
  MAX_WORK_PROJECT_TITLE_LENGTH,
  MAX_WORK_PROJECT_STAKE_SHARES,
  MAX_REALM_FILE_SHARE_REQUEST_ID_LENGTH,
  MAX_REPORT_TARGET_ID_LENGTH,
  FIRESTORE_DOCUMENT_ID_MAX_BYTES,
} from '../constants/business.js';
import { WORK_PROJECT_TYPE_KEYS } from '../types/content.js';
import {
  MODERATION_CLEARABLE_TEXT_FIELDS,
  type ModerationClearableSurface,
} from '../constants/business-content.js';

/** A stake-share offer (a commission listing, an audition): whole, positive, within the Work total. */
export const stakeSharesOfferedSchema = z.number().int().min(1).max(MAX_WORK_PROJECT_STAKE_SHARES);

// One Firestore document-id segment. A client string that becomes a path segment is validated as ONE
// segment before any path is built from it: a "/" addresses a different document or a subcollection,
// "." and ".." are not ids, and Firestore reserves the "__name__" form and caps an id at 1,500 bytes.
// Every id atom below derives from it.
export const documentIdSegmentSchema = z
  .string()
  .min(1)
  .refine((id) => !id.includes('/'), { message: 'An id is one path segment and cannot contain "/".' })
  .refine((id) => id !== '.' && id !== '..', { message: 'An id cannot be "." or "..".' })
  .refine((id) => !/^__.*__$/.test(id), { message: 'An id cannot use the reserved __name__ form.' })
  .refine((id) => new TextEncoder().encode(id).length <= FIRESTORE_DOCUMENT_ID_MAX_BYTES, {
    message: 'An id is longer than Firestore allows.',
  });

// The ids a report names as its target. They are HINTS the server re-derives (ARCH-106), so each is
// bounded and shaped as the path it could become. A chat report's parent is a channel reference of
// one or two ids joined by "/" (a Work channel is `workProjectId/guildChatChannelId`, an invite
// is a single id) and a conversation-file report's is `<kind>/<scopeId>`.
export const reportTargetItemIdSchema = documentIdSegmentSchema.max(MAX_REPORT_TARGET_ID_LENGTH);
export const reportTargetUserIdSchema = documentIdSegmentSchema.max(MAX_REPORT_TARGET_ID_LENGTH);
export const reportTargetParentRefSchema = z
  .string()
  .min(1)
  .max(MAX_REPORT_TARGET_ID_LENGTH)
  .refine(
    (ref) => {
      const parts = ref.split('/');
      return parts.length <= 2 && parts.every((part) => documentIdSegmentSchema.safeParse(part).success);
    },
    { message: 'A parent reference is one id, or two ids joined by "/".' },
  );

// ID atoms — every callable input that includes an ID field uses one of these.
// Kept as separate constants (not aliases of a generic `idSchema`) so consumers
// reading a callable's schema can see exactly which entity the field refers to.
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
/** A folder in a Realm's shared-file pool (`workRealms/{id}/realmFileFolders/{id}`) —
 *  distinct from `workFileFolderIdSchema`, which addresses a WORK's private file folder. */
export const realmFileFolderIdSchema = documentIdSegmentSchema;
/** The CLIENT-generated stable id of one realm-file promotion request. Approval, decline,
 *  and withdrawal all carry it and compare it against the pending request recorded on the
 *  asset, so a stale tab can never decide a newer re-request.
 *
 *  BOUNDED at the atom: this id is client-chosen AND durably persisted (asset doc, audit
 *  payload, notification metadata, aggregation key), so an unbounded string is a write
 *  amplification an attacker can send without the UI. Every consumer inherits the cap by
 *  using this atom rather than restating a bound. */
export const realmFileShareRequestIdSchema = documentIdSegmentSchema.max(MAX_REALM_FILE_SHARE_REQUEST_ID_LENGTH);
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
/** A Hall sub-item — a chapter, track, or episode — where the Work type, not the field, names its kind. */
export const hallSubItemIdSchema = documentIdSegmentSchema;
export const workFileIdSchema = documentIdSegmentSchema;
export const conversationFileIdSchema = documentIdSegmentSchema;
export const pendingMediaIdSchema = documentIdSegmentSchema;
export const squareStreetzPostIdSchema = documentIdSegmentSchema;
/** A child-safety or NCII case; both lanes key a case by one id. */
export const safetyCaseIdSchema = documentIdSegmentSchema;
export const nciiAllegationIdSchema = documentIdSegmentSchema;
export const takeItDownRequestIdSchema = documentIdSegmentSchema;
/** A member's active notification card. */
export const activeNotificationIdSchema = documentIdSegmentSchema;
export const shortLinkIdSchema = documentIdSegmentSchema;
export const pledgePaymentIdSchema = documentIdSegmentSchema;
export const pledgeRefundRequestIdSchema = documentIdSegmentSchema;

// Action / enum atoms.
export const addRemoveActionSchema = z.enum(['add', 'remove']);
// The admin system roles an acting operator can hold. ONE declaration (ARCH-102): every
// doc schema, type, actor context, and claims sync derives from it — never restate
// 'admin' | 'jrAdmin'. (jrAdmin is neutered for the solo launch; the union stays canonical.)
export const SYSTEM_ROLES = ['admin', 'jrAdmin'] as const;
export const systemRoleSchema = z.enum(SYSTEM_ROLES);
export type SystemRole = (typeof SYSTEM_ROLES)[number];
// Derives from the ONE canonical WORK_PROJECT_TYPE_KEYS (types/content.ts) — never re-declared.
export const workProjectTypeSchema = z.enum(WORK_PROJECT_TYPE_KEYS);
export const hallWingTypeSchema = z.enum(['entertainment', 'educational', 'newsPolitical']);

// The moderation-clearable SURFACE atom (`workProject` | `workRealm` | `tale` | `tune` |
// `television` | `chapter` | `tuneTrack` | `televisionEpisode`). Derived from the KEYS of the
// canonical MODERATION_CLEARABLE_TEXT_FIELDS map (constants/business-content.ts) rather than
// restating them, so a surface added to that map is on the wire automatically and the enum can
// never drift from the field map a consumer indexes with the parsed value. The cast only supplies
// zod's non-empty-tuple shape — the runtime values ARE the map's keys, and `z.infer` is exactly
// `ModerationClearableSurface`. Lives here (a leaf module) because the constants layer is
// deliberately zod-free, mirroring `workProjectTypeSchema` above.
export const moderationClearableSurfaceSchema = z.enum(
  Object.keys(MODERATION_CLEARABLE_TEXT_FIELDS) as [
    ModerationClearableSurface,
    ...ModerationClearableSurface[],
  ],
);

// The ONE canonical guild-invite conversation status set (state machine: pending →
// accepted (transient, trigger-consumed) → finalized, or pending → declined/cancelled).
// Lives here (a leaf module) because both the doc schema (doc-schemas/messaging.ts) and
// the list-invites input (work-project-management.ts) derive from it and those two files
// import each other's siblings — never re-declare it inline.
export const guildInviteConversationStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'cancelled',
  'finalized',
]);
export type GuildInviteConversationStatus = z.infer<typeof guildInviteConversationStatusSchema>;

// The ONE set of things a short link can point at — an audition, one audition entry, a commission
// listing, or a whole Hall entry (a book, album, or show; never one chapter, track, or episode, and
// never a Realm). The create input (schemas/utility.ts) and the stored link (doc-schemas/operational.ts)
// both derive from it; it lives in this leaf module so the doc schema never imports ./schemas/utility.
export const ShortLinkTargetTypeSchema = z.enum(['audition', 'audition-entry', 'commission', 'hall-library-item']);
export type ShortLinkTargetType = z.infer<typeof ShortLinkTargetTypeSchema>;

/**
 * A strict `YYYY-MM-DD` LOCAL calendar date. Declared once here (a leaf module) because both
 * the site-tour callable input (./users.ts) and the persisted site-tour state
 * (../doc-schemas/user.ts `notTodayDate`) must accept exactly the same shape — a looser
 * reader would let a value the writer rejects sit undetected in the document.
 * Deliberately NOT a full calendar validity check: it is a wire/shape bound, and the
 * semantic "is this the member's today" decision belongs to the reader.
 */
export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// A stored title a server-written payload carries (notification metadata). It is not a typed
// field — a typed title is a `textFieldSchema` over its declaration — and a stored title can hold
// the moderation placeholder, so it is bounded by the title length alone.
export const storedTitleSchema = z.string().min(1).max(MAX_WORK_PROJECT_TITLE_LENGTH);



/**
 * The founder legal-review notice checkbox on a callable input (pledge checkout, Hall
 * submission). `true` when ticked; omitted — or `null`, which the Firebase callable client
 * sends for an `undefined` field — when not. The backend requires `true` exactly while
 * LEGAL_REVIEW_NOTICE_ACTIVE and records the receipt itself; the client never sends a revision
 * or a time.
 */
export const LegalReviewNoticeAcknowledgedInputSchema = z.literal(true).nullish();
