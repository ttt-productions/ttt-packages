import { z } from 'zod';
import {
  MAX_WORK_PROJECT_TITLE_LENGTH,
  MAX_REALM_FILE_SHARE_REQUEST_ID_LENGTH,
} from '../constants/business.js';
import { WORK_PROJECT_TYPE_KEYS } from '../types/content.js';
import {
  MODERATION_CLEARABLE_TEXT_FIELDS,
  type ModerationClearableSurface,
} from '../constants/business-content.js';

// ID atoms — every callable input that includes an ID field uses one of these.
// Kept as separate constants (not aliases of a generic `idSchema`) so consumers
// reading a callable's schema can see exactly which entity the field refers to.
export const workProjectIdSchema = z.string().min(1);
export const userIdSchema = z.string().min(1);
export const guildInviteIdSchema = z.string().min(1);
export const violationIdSchema = z.string().min(1);
export const auditionIdSchema = z.string().min(1);
export const commissionListingIdSchema = z.string().min(1);
export const commissionProposalIdSchema = z.string().min(1);
export const auditionEntryIdSchema = z.string().min(1);
export const guildChatChannelIdSchema = z.string().min(1);
export const workFileFolderIdSchema = z.string().min(1);
export const workRealmIdSchema = z.string().min(1);
/** A folder in a Realm's shared-file pool (`workRealms/{id}/realmFileFolders/{id}`) —
 *  distinct from `workFileFolderIdSchema`, which addresses a WORK's private file folder. */
export const realmFileFolderIdSchema = z.string().min(1);
/** The CLIENT-generated stable id of one realm-file promotion request. Approval, decline,
 *  and withdrawal all carry it and compare it against the pending request recorded on the
 *  asset, so a stale tab can never decide a newer re-request.
 *
 *  BOUNDED at the atom: this id is client-chosen AND durably persisted (asset doc, audit
 *  payload, notification metadata, aggregation key), so an unbounded string is a write
 *  amplification an attacker can send without the UI. Every consumer inherits the cap by
 *  using this atom rather than restating a bound. */
export const realmFileShareRequestIdSchema = z
  .string()
  .min(1)
  .max(MAX_REALM_FILE_SHARE_REQUEST_ID_LENGTH);
export const notificationFanoutJobIdSchema = z.string().min(1);
export const taleIdSchema = z.string().min(1);
export const tuneIdSchema = z.string().min(1);
export const televisionIdSchema = z.string().min(1);
export const chapterIdSchema = z.string().min(1);
export const trackIdSchema = z.string().min(1);
export const episodeIdSchema = z.string().min(1);
export const craftSkillIdSchema = z.string().min(1);
export const taskIdSchema = z.string().min(1);
export const adminDispatchIdSchema = z.string().min(1);
export const reportGroupIdSchema = z.string().min(1);
export const mediaAssetIdSchema = z.string().min(1);
export const hallItemIdSchema = z.string().min(1);
export const itemIdSchema = z.string().min(1);
export const thresholdItemIdSchema = z.string().min(1);
export const changeRequestIdSchema = z.string().min(1);

// Action / enum atoms.
export const addRemoveActionSchema = z.enum(['add', 'remove']);
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

/**
 * A strict `YYYY-MM-DD` LOCAL calendar date. Declared once here (a leaf module) because both
 * the site-tour callable input (./users.ts) and the persisted site-tour state
 * (../doc-schemas/user.ts `notTodayDate`) must accept exactly the same shape — a looser
 * reader would let a value the writer rejects sit undetected in the document.
 * Deliberately NOT a full calendar validity check: it is a wire/shape bound, and the
 * semantic "is this the member's today" decision belongs to the reader.
 */
export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// String shape atoms. Length derives from the owning constant — every title alias
// (tale/tune/tv/chapter/track/episode/commission) resolves to the same value, so the
// UI counter, the Save guard, and this server bound are provably the same rule.
export const titleSchema = z.string().min(1).max(MAX_WORK_PROJECT_TITLE_LENGTH);


