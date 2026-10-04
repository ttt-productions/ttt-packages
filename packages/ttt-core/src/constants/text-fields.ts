// The declaration of every TTT text field a person types: its input format, its min, and its max
// (ARCH-102). input-format-core owns the formats and the one check; this file only says which
// format each field uses and how long it may be. The field's form input, its wire schema
// (`textFieldSchema`), and its writer all read the one declaration, so they accept exactly the same
// texts. Every text is trimmed before it is judged and kept; `keepAsTyped` is reserved for the
// legal public documents and the NCII statutory fields, whose words are kept verbatim.

import { CHAT_MESSAGE_TEXT_INPUT } from '@ttt-productions/chat-schemas';
import { defineInputFormat, type InputFormatSpec } from '@ttt-productions/input-format-core';
import type { TextFieldDeclaration } from '../utils/text-field.js';
import {
  MAX_CHAPTER_CONTENT_LENGTH,
  MAX_CHAPTER_TITLE_LENGTH,
  MAX_FILE_FOLDER_NAME_LENGTH,
  MAX_TELEVISION_EPISODE_DESCRIPTION_LENGTH,
  MAX_TELEVISION_EPISODE_TITLE_LENGTH,
  MAX_TUNE_TRACK_DESCRIPTION_LENGTH,
  MAX_TUNE_TRACK_TITLE_LENGTH,
  MAX_WORK_PROJECT_DESCRIPTION_LENGTH,
  MAX_WORK_PROJECT_TITLE_LENGTH,
  MAX_WORK_REALM_DESCRIPTION_LENGTH,
  MAX_WORK_REALM_TITLE_LENGTH,
} from './business-work-project.js';
import {
  MAX_AUDITION_DESCRIPTION_LENGTH,
  MAX_AUDITION_TITLE_LENGTH,
  MAX_COMMISSION_DESCRIPTION_LENGTH,
  MAX_COMMISSION_TITLE_LENGTH,
  MAX_GUILD_INVITE_MESSAGE_LENGTH,
  MAX_HALL_CHANGE_REQUEST_REASON_LENGTH,
  MAX_POST_LENGTH,
  type ModerationClearableSurface,
  type MODERATION_CLEARABLE_TEXT_FIELDS,
} from './business-content.js';
import {
  MAX_ADMIN_DISPATCH_INITIAL_TEXT_LENGTH,
  MAX_ADMIN_DISPATCH_SUBJECT_LENGTH,
  MAX_AGREEMENT_POINT_LENGTH,
  MAX_ANNOUNCEMENT_MESSAGE_LENGTH,
  MAX_APP_VERSION_LENGTH,
  MAX_APPEAL_MESSAGE_LENGTH,
  MAX_APPEAL_REVIEW_NOTES_LENGTH,
  MAX_BROADCAST_TITLE_LENGTH,
  MAX_CONTENT_PAGE_BODY_LENGTH,
  MAX_CONTENT_PAGE_HEADING_LENGTH,
  MAX_DMCA_CONTACT_LABEL_LENGTH,
  MAX_DMCA_CONTACT_VALUE_LENGTH,
  MAX_FEEDBACK_SUGGESTION_LENGTH,
  MAX_FUTURE_PLAN_DESCRIPTION_LENGTH,
  MAX_FUTURE_PLAN_TITLE_LENGTH,
  MAX_INTERNAL_REASON_LENGTH,
  MAX_MAINTENANCE_MESSAGE_LENGTH,
  MAX_NCII_AUTHORITY_BASIS_LENGTH,
  MAX_NCII_NONCONSENT_STATEMENT_LENGTH,
  MAX_NCII_RATIONALE_LENGTH,
  MAX_NCII_REPRESENTED_PERSON_NAME_LENGTH,
  MAX_NCII_REQUESTER_NAME_LENGTH,
  MAX_NCII_SIGNED_NAME_LENGTH,
  MAX_NCII_SUPPORTING_FACTS_LENGTH,
  MAX_NCMEC_PORTAL_PROOF_TEXT_LENGTH,
  MAX_NOTIFICATION_MESSAGE_LENGTH,
  MAX_PLATFORM_RULE_DESCRIPTION_LENGTH,
  MAX_PLATFORM_RULE_TITLE_LENGTH,
  MAX_REPORT_COMMENT_LENGTH,
  MAX_REQUIRE_RETITLE_REASON_LENGTH,
  MAX_SAFETY_ADMIN_NOTE_LENGTH,
  MAX_SAFETY_ARTIFACT_DESCRIPTION_LENGTH,
  MAX_TAKE_IT_DOWN_COPY_LENGTH,
  MAX_THRESHOLD_REVIEW_NOTES_LENGTH,
  MAX_USER_FACING_REASON_DETAIL_LENGTH,
  MAX_USER_FACING_REASON_LENGTH,
  MIN_SAFETY_RATIONALE_LENGTH,
} from './business-admin.js';
import {
  MAX_ARTISAN_LOCATION_LENGTH,
  MAX_THEME_NAME_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from './business-user.js';
import {
  MAX_GUILD_CHAT_CHANNEL_DESCRIPTION_LENGTH,
  MAX_GUILD_CHAT_CHANNEL_NAME_LENGTH,
} from './chat.js';
import {
  MAX_CURATED_PROFANITY_TERM_LENGTH,
  MIN_CURATED_PROFANITY_TERM_LENGTH,
} from './moderation.js';

// --- Works, Realms, and the Hall ---

/** A Work's title — its one name, which the Hall entry snapshots at first publication. */
export const WORK_TITLE_INPUT = defineInputFormat({ label: 'Title', format: 'englishNormal', min: 1, max: MAX_WORK_PROJECT_TITLE_LENGTH });
/** A Work's description — the Hall entry snapshots it with the title. */
export const WORK_DESCRIPTION_INPUT = defineInputFormat({ label: 'Description', format: 'none', min: 1, max: MAX_WORK_PROJECT_DESCRIPTION_LENGTH });
/** A Realm's name, which is also its platform-wide reservation key. */
export const REALM_NAME_INPUT = defineInputFormat({ label: 'Realm name', format: 'englishNormal', min: 1, max: MAX_WORK_REALM_TITLE_LENGTH });
export const REALM_DESCRIPTION_INPUT = defineInputFormat({ label: 'Realm description', format: 'none', min: 1, max: MAX_WORK_REALM_DESCRIPTION_LENGTH });
export const CHAPTER_TITLE_INPUT = defineInputFormat({ label: 'Chapter title', format: 'englishNormal', min: 1, max: MAX_CHAPTER_TITLE_LENGTH });
export const CHAPTER_CONTENT_INPUT = defineInputFormat({ label: 'Chapter text', format: 'none', min: 0, max: MAX_CHAPTER_CONTENT_LENGTH });
export const TUNE_TRACK_TITLE_INPUT = defineInputFormat({ label: 'Track title', format: 'englishNormal', min: 1, max: MAX_TUNE_TRACK_TITLE_LENGTH });
export const TUNE_TRACK_DESCRIPTION_INPUT = defineInputFormat({ label: 'Track description', format: 'none', min: 0, max: MAX_TUNE_TRACK_DESCRIPTION_LENGTH });
export const TELEVISION_EPISODE_TITLE_INPUT = defineInputFormat({ label: 'Episode title', format: 'englishNormal', min: 1, max: MAX_TELEVISION_EPISODE_TITLE_LENGTH });
export const TELEVISION_EPISODE_DESCRIPTION_INPUT = defineInputFormat({ label: 'Episode description', format: 'none', min: 0, max: MAX_TELEVISION_EPISODE_DESCRIPTION_LENGTH });
/** An admin's reason for denying a published change request; the deny itself requires it. */
export const HALL_CHANGE_REQUEST_DENY_REASON_INPUT = defineInputFormat({ label: 'Reason', format: 'none', min: 0, max: MAX_HALL_CHANGE_REQUEST_REASON_LENGTH });
export const THRESHOLD_REVIEW_NOTES_INPUT = defineInputFormat({ label: 'Review notes', format: 'none', min: 0, max: MAX_THRESHOLD_REVIEW_NOTES_LENGTH });
export const WORK_FILE_FOLDER_NAME_INPUT = defineInputFormat({ label: 'Folder name', format: 'singleLine', min: 1, max: MAX_FILE_FOLDER_NAME_LENGTH });
export const REALM_FILE_FOLDER_NAME_INPUT = defineInputFormat({ label: 'Folder name', format: 'singleLine', min: 1, max: MAX_FILE_FOLDER_NAME_LENGTH });

/** A field as a published change request proposes it: its authoring declaration, except that a
 *  proposal always carries text — an optional field cannot be changed to nothing. */
function proposedText<const S extends InputFormatSpec>(declaration: S) {
  return defineInputFormat({ ...declaration, min: Math.max(declaration.min, 1) });
}

/**
 * Each published surface's changeable text fields and the declaration a proposed value must meet.
 * A Tale / Tune / Television detail is the Work's own title and description, so it takes the Work's
 * declarations; a Realm proposal takes the Realm's.
 */
export const HALL_CONTENT_CHANGE_REQUEST_INPUTS: {
  readonly [S in Exclude<ModerationClearableSurface, 'workProject'>]: Readonly<
    Record<(typeof MODERATION_CLEARABLE_TEXT_FIELDS)[S][number], TextFieldDeclaration>
  >;
} = {
  tale: { title: WORK_TITLE_INPUT, description: WORK_DESCRIPTION_INPUT },
  tune: { title: WORK_TITLE_INPUT, description: WORK_DESCRIPTION_INPUT },
  television: { title: WORK_TITLE_INPUT, description: WORK_DESCRIPTION_INPUT },
  chapter: { title: CHAPTER_TITLE_INPUT, content: proposedText(CHAPTER_CONTENT_INPUT) },
  tuneTrack: { title: TUNE_TRACK_TITLE_INPUT, description: proposedText(TUNE_TRACK_DESCRIPTION_INPUT) },
  televisionEpisode: {
    title: TELEVISION_EPISODE_TITLE_INPUT,
    description: proposedText(TELEVISION_EPISODE_DESCRIPTION_INPUT),
  },
  workRealm: { workingTitle: REALM_NAME_INPUT, workingDescription: REALM_DESCRIPTION_INPUT },
};

// --- Commissions, auditions, and the guild ---

export const COMMISSION_TITLE_INPUT = defineInputFormat({ label: 'Commission title', format: 'englishNormal', min: 1, max: MAX_COMMISSION_TITLE_LENGTH });
export const COMMISSION_DESCRIPTION_INPUT = defineInputFormat({ label: 'Commission description', format: 'none', min: 1, max: MAX_COMMISSION_DESCRIPTION_LENGTH });
export const COMMISSION_COVER_LETTER_INPUT = defineInputFormat({ label: 'Cover letter', format: 'none', min: 1, max: MAX_COMMISSION_DESCRIPTION_LENGTH });
export const AUDITION_TITLE_INPUT = defineInputFormat({ label: 'Audition title', format: 'englishNormal', min: 1, max: MAX_AUDITION_TITLE_LENGTH });
export const AUDITION_DESCRIPTION_INPUT = defineInputFormat({ label: 'Audition description', format: 'none', min: 0, max: MAX_AUDITION_DESCRIPTION_LENGTH });
export const GUILD_INVITE_MESSAGE_INPUT = defineInputFormat({ label: 'Invite message', format: 'none', min: 1, max: MAX_GUILD_INVITE_MESSAGE_LENGTH });
export const GUILD_CHAT_CHANNEL_NAME_INPUT = defineInputFormat({ label: 'Channel name', format: 'singleLine', min: 1, max: MAX_GUILD_CHAT_CHANNEL_NAME_LENGTH });
export const GUILD_CHAT_CHANNEL_DESCRIPTION_INPUT = defineInputFormat({ label: 'Channel description', format: 'none', min: 0, max: MAX_GUILD_CHAT_CHANNEL_DESCRIPTION_LENGTH });

// --- Posts, messages, and chat ---

/** A Square post's text: the text post and a media post's caption are one field. */
export const SQUARE_POST_TEXT_INPUT = defineInputFormat({ label: 'Post', format: 'none', min: 1, max: MAX_POST_LENGTH });
/** A message in an admin-support thread: the live chat message's format and bounds, from the chat contract. */
export const SUPPORT_THREAD_MESSAGE_INPUT = defineInputFormat({
  label: 'Message',
  format: CHAT_MESSAGE_TEXT_INPUT.format,
  min: CHAT_MESSAGE_TEXT_INPUT.min,
  max: CHAT_MESSAGE_TEXT_INPUT.max,
});
/** A support thread's or an admin message's subject. */
export const ADMIN_DISPATCH_SUBJECT_INPUT = defineInputFormat({ label: 'Subject', format: 'singleLine', min: 1, max: MAX_ADMIN_DISPATCH_SUBJECT_LENGTH });
/** A support thread's first message, and the body of an admin message or warning. */
export const ADMIN_DISPATCH_MESSAGE_INPUT = defineInputFormat({ label: 'Message', format: 'none', min: 1, max: MAX_ADMIN_DISPATCH_INITIAL_TEXT_LENGTH });
export const BROADCAST_TITLE_INPUT = defineInputFormat({ label: 'Title', format: 'singleLine', min: 1, max: MAX_BROADCAST_TITLE_LENGTH });
export const BROADCAST_MESSAGE_INPUT = defineInputFormat({ label: 'Message', format: 'none', min: 1, max: MAX_NOTIFICATION_MESSAGE_LENGTH });

// --- Accounts and members ---

export const USERNAME_INPUT = defineInputFormat({ label: 'Username', format: 'englishNormalNoSpaces', min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH });
export const ARTISAN_REGION_INPUT = defineInputFormat({ label: 'Region', format: 'singleLine', min: 0, max: MAX_ARTISAN_LOCATION_LENGTH });
/** A feedback suggestion: one word of English letters, stored lowercase. */
export const FEEDBACK_SUGGESTION_INPUT = defineInputFormat({ label: 'Suggestion', format: 'englishLettersOnly', min: 1, max: MAX_FEEDBACK_SUGGESTION_LENGTH });
export const APPEAL_MESSAGE_INPUT = defineInputFormat({ label: 'Appeal message', format: 'none', min: 1, max: MAX_APPEAL_MESSAGE_LENGTH });
/** A report's comment, and an admin's reason for marking NCII evidence. */
export const REPORT_COMMENT_INPUT = defineInputFormat({ label: 'Comment', format: 'none', min: 1, max: MAX_REPORT_COMMENT_LENGTH });
/** The name of a theme a member builds in Theme Studio. */
export const THEME_NAME_INPUT = defineInputFormat({ label: 'Theme name', format: 'singleLine', min: 1, max: MAX_THEME_NAME_LENGTH });

// --- Admin and moderation ---

/** The reason for hiding a Work, a Realm, or a Hall sub-item. */
export const HIDE_REASON_INPUT = defineInputFormat({ label: 'Reason', format: 'none', min: 1, max: MAX_INTERNAL_REASON_LENGTH });
export const RETITLE_REASON_INPUT = defineInputFormat({ label: 'Reason', format: 'none', min: 1, max: MAX_REQUIRE_RETITLE_REASON_LENGTH });
export const CLEAR_TEXT_REASON_INPUT = defineInputFormat({ label: 'Reason', format: 'none', min: 1, max: MAX_REQUIRE_RETITLE_REASON_LENGTH });
/** The reason on a reported item's hide or removal; the action itself requires it. */
export const MODERATION_ACTION_REASON_INPUT = defineInputFormat({ label: 'Reason', format: 'none', min: 0, max: MAX_INTERNAL_REASON_LENGTH });
/** An admin's reason for an account action — a suspension, a ban, a forced username reset —
 *  or a forced display-name reset's note. */
export const ACCOUNT_ACTION_REASON_INPUT = defineInputFormat({ label: 'Reason', format: 'none', min: 1, max: MAX_INTERNAL_REASON_LENGTH });
/** An admin's optional note on a reinstatement. */
export const ACCOUNT_REINSTATE_REASON_INPUT = defineInputFormat({ label: 'Reason', format: 'none', min: 0, max: MAX_INTERNAL_REASON_LENGTH });
export const USER_FACING_REASON_DETAIL_INPUT = defineInputFormat({ label: 'Reason detail', format: 'none', min: 0, max: MAX_USER_FACING_REASON_DETAIL_LENGTH });
/** The admin note on a report's or a safety case's close-out. */
export const CLOSE_OUT_ADMIN_NOTE_INPUT = defineInputFormat({ label: 'Admin note', format: 'none', min: 0, max: MAX_SAFETY_ADMIN_NOTE_LENGTH });
/** The resolution note an admin leaves when checking in an admin task (an ops anomaly's disposition). */
export const ADMIN_TASK_RESOLUTION_INPUT = defineInputFormat({ label: 'Resolution note', format: 'none', min: 0, max: MAX_INTERNAL_REASON_LENGTH });
export const APPEAL_REVIEW_NOTES_INPUT = defineInputFormat({ label: 'Review notes', format: 'none', min: 0, max: MAX_APPEAL_REVIEW_NOTES_LENGTH });
/** A pledge refund denial reason, shown to the requester; the deny itself requires it. */
export const PLEDGE_REFUND_DENIAL_REASON_INPUT = defineInputFormat({ label: 'Denial reason', format: 'none', min: 1, max: MAX_USER_FACING_REASON_LENGTH });
export const CURATED_PROFANITY_TERM_INPUT = defineInputFormat({
  label: 'Word',
  format: 'singleLine',
  min: MIN_CURATED_PROFANITY_TERM_LENGTH,
  max: MAX_CURATED_PROFANITY_TERM_LENGTH,
});
export const MAINTENANCE_MESSAGE_INPUT = defineInputFormat({ label: 'Maintenance message', format: 'none', min: 0, max: MAX_MAINTENANCE_MESSAGE_LENGTH });
/** The site announcement banner; empty clears it. */
export const ANNOUNCEMENT_MESSAGE_INPUT = defineInputFormat({ label: 'Announcement', format: 'none', min: 0, max: MAX_ANNOUNCEMENT_MESSAGE_LENGTH });
export const APP_VERSION_INPUT = defineInputFormat({ label: 'App version', format: 'none', min: 1, max: MAX_APP_VERSION_LENGTH });

// --- The safety console ---

export const TAKE_IT_DOWN_VALIDITY_RATIONALE_INPUT = defineInputFormat({ label: 'Rationale', format: 'none', min: MIN_SAFETY_RATIONALE_LENGTH, max: MAX_NCII_RATIONALE_LENGTH });
/** An operator's internal reason for reopening a safety case or taking a safety account action. */
export const SAFETY_INTERNAL_REASON_INPUT = defineInputFormat({ label: 'Internal reason', format: 'none', min: MIN_SAFETY_RATIONALE_LENGTH, max: MAX_INTERNAL_REASON_LENGTH });
export const NCMEC_ARTIFACT_DESCRIPTION_INPUT = defineInputFormat({ label: 'Description', format: 'singleLine', min: 0, max: MAX_SAFETY_ARTIFACT_DESCRIPTION_LENGTH });
export const NCMEC_PORTAL_PROOF_TEXT_INPUT = defineInputFormat({ label: 'Proof note', format: 'none', min: 0, max: MAX_NCMEC_PORTAL_PROOF_TEXT_LENGTH });
export const NCMEC_CORRECTION_REASON_INPUT = defineInputFormat({ label: 'Correction reason', format: 'none', min: 1, max: MAX_INTERNAL_REASON_LENGTH });

// --- Kept as typed: the legal public documents ---

export const FUTURE_PLAN_TITLE_INPUT = defineInputFormat({ label: 'Title', format: 'singleLine', min: 1, max: MAX_FUTURE_PLAN_TITLE_LENGTH, keepAsTyped: true });
export const FUTURE_PLAN_DESCRIPTION_INPUT = defineInputFormat({ label: 'Description', format: 'none', min: 1, max: MAX_FUTURE_PLAN_DESCRIPTION_LENGTH, keepAsTyped: true });
export const PLATFORM_RULE_TITLE_INPUT = defineInputFormat({ label: 'Title', format: 'singleLine', min: 1, max: MAX_PLATFORM_RULE_TITLE_LENGTH, keepAsTyped: true });
export const PLATFORM_RULE_DESCRIPTION_INPUT = defineInputFormat({ label: 'Description', format: 'none', min: 1, max: MAX_PLATFORM_RULE_DESCRIPTION_LENGTH, keepAsTyped: true });
export const AGREEMENT_POINT_INPUT = defineInputFormat({ label: 'Agreement point', format: 'singleLine', min: 1, max: MAX_AGREEMENT_POINT_LENGTH, keepAsTyped: true });
/** A legal page's section heading, and a DMCA contact block's heading. */
export const CONTENT_PAGE_HEADING_INPUT = defineInputFormat({ label: 'Heading', format: 'singleLine', min: 1, max: MAX_CONTENT_PAGE_HEADING_LENGTH, keepAsTyped: true });
/** A legal page's section body (empty is a bare divider heading), and the DMCA policy's intro. */
export const CONTENT_PAGE_BODY_INPUT = defineInputFormat({ label: 'Text', format: 'none', min: 0, max: MAX_CONTENT_PAGE_BODY_LENGTH, keepAsTyped: true });
export const DMCA_CONTACT_LABEL_INPUT = defineInputFormat({ label: 'Label', format: 'singleLine', min: 1, max: MAX_DMCA_CONTACT_LABEL_LENGTH, keepAsTyped: true });
export const DMCA_CONTACT_VALUE_INPUT = defineInputFormat({ label: 'Value', format: 'singleLine', min: 1, max: MAX_DMCA_CONTACT_VALUE_LENGTH, keepAsTyped: true });
export const TAKE_IT_DOWN_COPY_INPUT = defineInputFormat({ label: 'Text', format: 'none', min: 1, max: MAX_TAKE_IT_DOWN_COPY_LENGTH, keepAsTyped: true });

// --- Kept as typed: the NCII statutory fields ---

export const NCII_REQUESTER_NAME_INPUT = defineInputFormat({ label: 'Your name', format: 'singleLine', min: 1, max: MAX_NCII_REQUESTER_NAME_LENGTH, keepAsTyped: true });
export const NCII_SIGNED_NAME_INPUT = defineInputFormat({ label: 'Signature', format: 'singleLine', min: 1, max: MAX_NCII_SIGNED_NAME_LENGTH, keepAsTyped: true });
export const NCII_REPRESENTED_PERSON_NAME_INPUT = defineInputFormat({ label: 'Name of the person you represent', format: 'singleLine', min: 1, max: MAX_NCII_REPRESENTED_PERSON_NAME_LENGTH, keepAsTyped: true });
export const NCII_AUTHORITY_BASIS_INPUT = defineInputFormat({ label: 'Basis of authority', format: 'none', min: 1, max: MAX_NCII_AUTHORITY_BASIS_LENGTH, keepAsTyped: true });
export const NCII_NONCONSENT_STATEMENT_INPUT = defineInputFormat({ label: 'Statement', format: 'none', min: 1, max: MAX_NCII_NONCONSENT_STATEMENT_LENGTH, keepAsTyped: true });
export const NCII_SUPPORTING_FACTS_INPUT = defineInputFormat({ label: 'Supporting facts', format: 'none', min: 0, max: MAX_NCII_SUPPORTING_FACTS_LENGTH, keepAsTyped: true });
