import { SPECIAL_DOCS } from '../paths/collections.js';
import { PUBLIC_DOCUMENT_LABELS, type PublicDocumentId } from './public-documents.js';
import {
  LEGAL_REVIEW_NOTICE_ACTIVE,
  LEGAL_REVIEW_NOTICE_REVISION,
} from './legal-review-notice-state.js';
import type { LegalReviewNoticeReceipt } from '../doc-schemas/legal-review-notice.js';

export type LegalReviewNoticeLinkTarget = PublicDocumentId | 'founderNote';

export type LegalReviewNoticeSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'link'; readonly label: string; readonly target: LegalReviewNoticeLinkTarget };

export const LEGAL_REVIEW_NOTICE_HEADING = "A note from DJ, TTT's founder.";

export const LEGAL_REVIEW_NOTICE_BODY =
  "These pages describe how I intend TTT to work: my principles and what I'm trying to build. " +
  'I wrote them myself, with help from AI tools, before I could afford a lawyer, so none of it ' +
  "has had legal review, and I honestly don't know whether all of it is legally sound. Charter " +
  "Season support keeps TTT running first; after that, it's how I'll get a lawyer to turn this " +
  'into real, reviewed legal wording. The words may change when that happens. My intentions ' +
  "won't. If a change needs your agreement, I'll ask you before it applies.";

export const LEGAL_REVIEW_NOTICE_SHORT_LINE: readonly LegalReviewNoticeSegment[] = [
  {
    kind: 'text',
    text: "TTT's terms are my intentions, written by me and not yet reviewed by a lawyer. ",
  },
  { kind: 'link', label: "Read the founder's note.", target: 'founderNote' },
];

export const LEGAL_REVIEW_NOTICE_CHECKBOX =
  "I understand TTT's terms express the founder's intentions, have not had legal review, and " +
  'will be updated once Charter Season support makes that possible.';

function documentLink(target: PublicDocumentId): LegalReviewNoticeSegment {
  return { kind: 'link', label: PUBLIC_DOCUMENT_LABELS[target], target };
}

const REGISTRATION_TERMS_AGREEMENT_LEAD: readonly LegalReviewNoticeSegment[] = [
  { kind: 'text', text: "I've read and agree to the " },
  documentLink(SPECIAL_DOCS.TERMS_PAGE),
  { kind: 'text', text: ', ' },
  documentLink(SPECIAL_DOCS.PRIVACY_PAGE),
  { kind: 'text', text: ' (including the essential cookies the site needs to run), and ' },
  documentLink(SPECIAL_DOCS.RULES_AND_AGREEMENTS),
  { kind: 'text', text: ", and I've seen the " },
  documentLink(SPECIAL_DOCS.FUTURE_PLANS),
  { kind: 'text', text: ', ' },
  documentLink(SPECIAL_DOCS.DMCA_POLICY),
  { kind: 'text', text: ', and ' },
  documentLink(SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY),
  { kind: 'text', text: ' pages.' },
];

const REGISTRATION_TERMS_AGREEMENT_WITH_NOTICE: readonly LegalReviewNoticeSegment[] = [
  ...REGISTRATION_TERMS_AGREEMENT_LEAD,
  {
    kind: 'text',
    text: " I understand these express the founder's intentions and have not had legal review.",
  },
];

const REGISTRATION_TERMS_AGREEMENT_WITHOUT_NOTICE = REGISTRATION_TERMS_AGREEMENT_LEAD;

export function registrationTermsAgreementSegments(): readonly LegalReviewNoticeSegment[] {
  return LEGAL_REVIEW_NOTICE_ACTIVE
    ? REGISTRATION_TERMS_AGREEMENT_WITH_NOTICE
    : REGISTRATION_TERMS_AGREEMENT_WITHOUT_NOTICE;
}

export const LEGAL_REVIEW_NOTICE_VARIANTS = ['inline', 'strip', 'card', 'checkbox'] as const;
export type LegalReviewNoticeVariant = (typeof LEGAL_REVIEW_NOTICE_VARIANTS)[number];

type LegalReviewNoticeVariantList = readonly [
  LegalReviewNoticeVariant,
  ...LegalReviewNoticeVariant[],
];

export const LEGAL_REVIEW_NOTICE_PLACEMENTS = {
  publicDocument: ['strip'],
  registration: ['card'],
  reacceptance: ['card'],
  pledge: ['strip', 'checkbox'],
  publish: ['checkbox'],
  workProjectCreation: ['inline', 'strip'],
  artisanCreatorUpgrade: ['inline', 'strip'],
  craftSkillUpload: ['inline', 'strip'],
  auditionEntrySubmission: ['strip'],
  squareStreetzFirstPost: ['inline', 'strip'],
  guildInviteAgreement: ['inline', 'strip'],
  hallDownload: ['inline', 'strip'],
  charterExplainer: ['inline', 'card'],
  landingFounder: ['inline', 'card'],
  landingFundraising: ['inline', 'card'],
  stakeShareExplanation: ['inline', 'card'],
  bouquetAppreciationExplanation: ['inline', 'card'],
  footer: ['inline'],
} as const satisfies Record<string, LegalReviewNoticeVariantList>;

export type LegalReviewNoticeContext = keyof typeof LEGAL_REVIEW_NOTICE_PLACEMENTS;

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
  [SPECIAL_DOCS.DMCA_POLICY]: false,
  [SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY]: false,
};

export function publicDocumentCarriesLegalReviewNotice(documentId: PublicDocumentId): boolean {
  return PUBLIC_DOCUMENT_CARRIES_NOTICE[documentId];
}

export function legalReviewNoticeSegmentsText(
  segments: readonly LegalReviewNoticeSegment[],
): string {
  return segments
    .map((segment) => (segment.kind === 'text' ? segment.text : segment.label))
    .join('');
}

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

export function activeLegalReviewNoticeRevision(): string | null {
  return LEGAL_REVIEW_NOTICE_ACTIVE ? LEGAL_REVIEW_NOTICE_REVISION : null;
}

export function buildLegalReviewNoticeReceipt(
  acknowledgedAt: number,
): LegalReviewNoticeReceipt | null {
  const revision = activeLegalReviewNoticeRevision();
  return revision === null ? null : { revision, acknowledgedAt };
}
