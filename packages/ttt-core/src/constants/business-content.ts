// Content-surface business-rule constants — commissions, auditions, the social
// feed, and messaging.
import { MAX_WORK_PROJECT_TITLE_LENGTH } from "./business-work-project.js";

/** The maximum character length for a SquareStreetz post created on behalf of a workProject. */
export const MAX_SQUARE_STREETZ_DESCRIPTION_LENGTH = 150;

// --- Commission Board & Proposals ---

/** Maximum number of open commissions a workProject can have. */
export const MAX_COMMISSION_LISTINGS = 5;

/** Maximum number of proposal artisans saved to a commission. */
export const MAX_SAVED_PROPOSAL_ARTISANS = 5;

/** Maximum length for a commission title. */
export const MAX_COMMISSION_TITLE_LENGTH = MAX_WORK_PROJECT_TITLE_LENGTH;

/** Maximum length for a commission description / cover letter. */
export const MAX_COMMISSION_DESCRIPTION_LENGTH = 400;

// --- Auditions ---

/** Maximum length for an audition title. */
export const MAX_AUDITION_TITLE_LENGTH = 150;

/** Maximum length for an audition description. */
export const MAX_AUDITION_DESCRIPTION_LENGTH = 1000;

/**
 * Maximum sponsored-audition payout amount in whole USD accepted at the upload
 * trust boundary. Mirrors MAX_PLEDGE_PAYMENT_AMOUNT_CENTS ($500,000) expressed
 * in dollars — a finite ceiling that rejects absurd/garbage amounts before any
 * downstream processing.
 */
export const MAX_SPONSORED_AUDITION_AMOUNT_USD = 500_000;

// --- SquareStreetz (Social Feed) ---

/** Maximum length for a SquareStreetz post. */
export const MAX_POST_LENGTH = 500;

/** Maximum number of mentions allowed in a single SquareStreetz post. */
export const MAX_MENTIONS = 3;

/** Maximum characters of a mention's display name shown before truncation. */
export const MAX_MENTION_DISPLAY_LENGTH = 30;

// --- Messages & Invites ---

/** Maximum length for a guild-invite message. */
export const MAX_GUILD_INVITE_MESSAGE_LENGTH = 500;

/** Maximum length for a pledgePayment message. */
export const MAX_PLEDGE_PAYMENT_MESSAGE_LENGTH = 500;

/** Maximum length for a chat reply-to preview snippet stored on an attachment. */
export const MAX_CHAT_REPLY_PREVIEW_LENGTH = 280;
