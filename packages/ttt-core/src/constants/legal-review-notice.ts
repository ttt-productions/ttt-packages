// ============================================================================
// FOUNDER LEGAL-REVIEW NOTICE — the ONE owner of the notice copy, its placements,
// and the plain-text helper for backend-owned copy. The on/off switch and the
// immutable revision id live in ./legal-review-notice-state.ts.
//
// TTT's public pages were written by the founder before any legal review. The
// notice says so wherever people read policy, create accounts, upload, publish,
// or pledge. The app renders it through one component,
// `<LegalReviewNotice context=… variant=… />`; nothing restates these words or
// keeps a local flag.
//
// Copy is settled and verbatim — never reword it in place. A wording change is a
// new LEGAL_REVIEW_NOTICE_REVISION (the package test pins each revision's copy).
// Links are semantic targets, not URLs: a public document id, or the founder's
// note itself; the app maps them to routes or its note dialog.
// ============================================================================

import { SPECIAL_DOCS } from '../paths/collections.js';
import { PUBLIC_DOCUMENT_LABELS, type PublicDocumentId } from './public-documents.js';
import { LEGAL_REVIEW_NOTICE_ACTIVE, LEGAL_REVIEW_NOTICE_REVISION } from './legal-review-notice-state.js';
import type { LegalReviewNoticeReceipt } from '../doc-schemas/legal-review-notice.js';

// ── Copy model ───────────────────────────────────────────────────────────────

/** Where a notice link points: a public document, or the founder's full note. */
export type LegalReviewNoticeLinkTarget = PublicDocumentId | 'founderNote';

/** One run of notice copy. A link carries a semantic target, never a URL. */
export type LegalReviewNoticeSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'link'; readonly label: string; readonly target: LegalReviewNoticeLinkTarget };

// ── The settled copy ─────────────────────────────────────────────────────────

/** The full note's heading (the note's first sentence). */
export const LEGAL_REVIEW_NOTICE_HEADING = "A note from DJ, TTT's founder.";

/** The full note's body. */
export const LEGAL_REVIEW_NOTICE_BODY =
  "These pages describe how I intend TTT to work: my principles and what I'm trying to build. " +
  'I wrote them myself, with help from AI tools, before I could afford a lawyer, so none of it ' +
  "has had legal review, and I honestly don't know whether all of it is legally sound. Charter " +
  "Season support keeps TTT running first; after that, it's how I'll get a lawyer to turn this " +
  'into real, reviewed legal wording. The words may change when that happens. My intentions ' +
  "won't. If a change needs your agreement, I'll ask you before it applies.";

/** The short line. Its closing sentence links to the full note. */
export const LEGAL_REVIEW_NOTICE_SHORT_LINE: readonly LegalReviewNoticeSegment[] = [
  { kind: 'text', text: "TTT's terms are my intentions, written by me and not yet reviewed by a lawyer. " },
  { kind: 'link', label: "Read the founder's note.", target: 'founderNote' },
];

/** The required acknowledgment checkbox (Hall submission, pledge). */
export const LEGAL_REVIEW_NOTICE_CHECKBOX =
  "I understand TTT's terms express the founder's intentions, have not had legal review, and " +
  'will be updated once Charter Season support makes that possible.';

// The registration Terms checkbox. While the notice is active it carries the notice clause;
// otherwise it is the plain agreement. Both link the two documents by their canonical labels.
const REGISTRATION_TERMS_AGREEMENT_LEAD: readonly LegalReviewNoticeSegment[] = [
  { kind: 'text', text: 'I have read and agree to the ' },
  { kind: 'link', label: PUBLIC_DOCUMENT_LABELS[SPECIAL_DOCS.TERMS_PAGE], target: SPECIAL_DOCS.TERMS_PAGE },
  { kind: 'text', text: ' and ' },
  { kind: 'link', label: PUBLIC_DOCUMENT_LABELS[SPECIAL_DOCS.PRIVACY_PAGE], target: SPECIAL_DOCS.PRIVACY_PAGE },
];

const REGISTRATION_TERMS_AGREEMENT_WITH_NOTICE: readonly LegalReviewNoticeSegment[] = [
  ...REGISTRATION_TERMS_AGREEMENT_LEAD,
  { kind: 'text', text: ", and I understand they express the founder's intentions and have not had legal review." },
];

const REGISTRATION_TERMS_AGREEMENT_WITHOUT_NOTICE: readonly LegalReviewNoticeSegment[] = [
  ...REGISTRATION_TERMS_AGREEMENT_LEAD,
  { kind: 'text', text: '.' },
];

/** The registration Terms checkbox label, with the notice clause exactly while the notice is active. */
export function registrationTermsAgreementSegments(): readonly LegalReviewNoticeSegment[] {
  return LEGAL_REVIEW_NOTICE_ACTIVE
    ? REGISTRATION_TERMS_AGREEMENT_WITH_NOTICE
    : REGISTRATION_TERMS_AGREEMENT_WITHOUT_NOTICE;
}

// ── Variants and placements ──────────────────────────────────────────────────

/**
 * How the notice renders:
 * - `inline`   — the short line, in the flow of surrounding text;
 * - `strip`    — the short line as a compact strip;
 * - `card`     — the full note (heading + body);
 * - `checkbox` — the required acknowledgment checkbox.
 */
export const LEGAL_REVIEW_NOTICE_VARIANTS = ['inline', 'strip', 'card', 'checkbox'] as const;
export type LegalReviewNoticeVariant = (typeof LEGAL_REVIEW_NOTICE_VARIANTS)[number];

type LegalReviewNoticeVariantList = readonly [LegalReviewNoticeVariant, ...LegalReviewNoticeVariant[]];

/**
 * Every placement of the notice and the variants it may render (the first is its default).
 * The keys ARE the typed context union. Take It Down and the DMCA policy are statutory
 * processes and carry no notice, so they have no context
 * (see `publicDocumentCarriesLegalReviewNotice`).
 */
export const LEGAL_REVIEW_NOTICE_PLACEMENTS = {
  /** Terms, Privacy, Rules & Agreements, Future Plans — beside the current content, rendered at
   *  display time (never stored in the document body); also the Admin editors' preview. */
  publicDocument: ['strip'],
  /** Registration — the full note above the agreement checkboxes. */
  registration: ['card'],
  /** The "Our stuff has changed" re-acceptance prompt — the full note. */
  reacceptance: ['card'],
  /** Pledge checkout — a compact explanation plus a separate required checkbox on every pledge. */
  pledge: ['strip', 'checkbox'],
  /** Hall submission — a required checkbox in the publish attestations, above Submit for Approval. */
  publish: ['checkbox'],
  /** Work / Realm creation, beside its agreement. */
  workProjectCreation: ['inline', 'strip'],
  /** Artisan upgrade, beside its agreement. */
  artisanCreatorUpgrade: ['inline', 'strip'],
  /** Craft-skill upload, beside its agreement. */
  craftSkillUpload: ['inline', 'strip'],
  /** Square first post, beside its agreement. */
  squareStreetzFirstPost: ['inline', 'strip'],
  /** Guild invite agreements. */
  guildInviteAgreement: ['inline', 'strip'],
  /** Hall download, beside its acknowledgment. */
  hallDownload: ['inline', 'strip'],
  /** The Charter Season explainer. */
  charterExplainer: ['inline', 'card'],
  /** The landing page's founder section. */
  landingFounder: ['inline', 'card'],
  /** The landing page's fundraising section. */
  landingFundraising: ['inline', 'card'],
  /** Stake explanations. */
  stakeShareExplanation: ['inline', 'card'],
  /** Bouquet explanations. */
  bouquetAppreciationExplanation: ['inline', 'card'],
  /** The site footer. */
  footer: ['inline'],
} as const satisfies Record<string, LegalReviewNoticeVariantList>;

/** A named placement of the notice. */
export type LegalReviewNoticeContext = keyof typeof LEGAL_REVIEW_NOTICE_PLACEMENTS;

/** The variants a given placement may render. */
export type LegalReviewNoticeVariantFor<C extends LegalReviewNoticeContext> =
  (typeof LEGAL_REVIEW_NOTICE_PLACEMENTS)[C][number];

export const LEGAL_REVIEW_NOTICE_CONTEXTS = Object.keys(
  LEGAL_REVIEW_NOTICE_PLACEMENTS,
) as LegalReviewNoticeContext[];

const PUBLIC_DOCUMENT_CARRIES_NOTICE: Record<PublicDocumentId, boolean> = {
  [SPECIAL_DOCS.TERMS_PAGE]: true,
  [SPECIAL_DOCS.PRIVACY_PAGE]: true,
  [SPECIAL_DOCS.RULES_AND_AGREEMENTS]: true,
  [SPECIAL_DOCS.FUTURE_PLANS]: true,
  // Statutory processes run as built.
  [SPECIAL_DOCS.DMCA_POLICY]: false,
  [SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY]: false,
};

/**
 * Whether a public document's page (and its Admin editor preview) shows the `publicDocument`
 * notice strip. A placement fact only — the notice itself still renders nothing while off.
 */
export function publicDocumentCarriesLegalReviewNotice(documentId: PublicDocumentId): boolean {
  return PUBLIC_DOCUMENT_CARRIES_NOTICE[documentId];
}

// ── Plain text (backend-owned copy) ──────────────────────────────────────────

/** Flatten segments to plain text: text as written, a link as its label. */
export function legalReviewNoticeSegmentsText(segments: readonly LegalReviewNoticeSegment[]): string {
  return segments.map((segment) => (segment.kind === 'text' ? segment.text : segment.label)).join('');
}

/**
 * The notice as plain text for a placement, for backend-owned copy (a Stripe description, an
 * email). `null` while the notice is off. `variant` defaults to the placement's first variant;
 * a variant the placement does not render throws.
 */
export function legalReviewNoticePlainText<C extends LegalReviewNoticeContext>(
  context: C,
  variant?: LegalReviewNoticeVariantFor<C>,
): string | null {
  if (!LEGAL_REVIEW_NOTICE_ACTIVE) return null;
  const allowed: readonly LegalReviewNoticeVariant[] = LEGAL_REVIEW_NOTICE_PLACEMENTS[context];
  const chosen: LegalReviewNoticeVariant = variant ?? allowed[0];
  if (!allowed.includes(chosen)) {
    throw new Error(`The ${context} notice placement does not render the ${chosen} variant.`);
  }
  switch (chosen) {
    case 'inline':
    case 'strip':
      return legalReviewNoticeSegmentsText(LEGAL_REVIEW_NOTICE_SHORT_LINE);
    case 'card':
      return `${LEGAL_REVIEW_NOTICE_HEADING} ${LEGAL_REVIEW_NOTICE_BODY}`;
    case 'checkbox':
      return LEGAL_REVIEW_NOTICE_CHECKBOX;
  }
}

// ── What gets recorded ───────────────────────────────────────────────────────

/** The revision a server records with an acceptance or acknowledgment now; `null` while off. */
export function activeLegalReviewNoticeRevision(): string | null {
  return LEGAL_REVIEW_NOTICE_ACTIVE ? LEGAL_REVIEW_NOTICE_REVISION : null;
}

/**
 * The receipt a server records when a person acknowledges the notice (pledge evidence, the Hall
 * threshold item): the active revision and the server time. `null` while the notice is off —
 * nothing is required, so nothing is recorded.
 */
export function buildLegalReviewNoticeReceipt(acknowledgedAt: number): LegalReviewNoticeReceipt | null {
  const revision = activeLegalReviewNoticeRevision();
  return revision === null ? null : { revision, acknowledgedAt };
}
