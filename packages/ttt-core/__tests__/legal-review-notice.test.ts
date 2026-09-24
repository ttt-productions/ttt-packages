import { describe, it, expect, expectTypeOf } from 'vitest';
import { createHash } from 'node:crypto';
import {
  LEGAL_REVIEW_NOTICE_ACTIVE,
  LEGAL_REVIEW_NOTICE_REVISION,
} from '../src/constants/legal-review-notice-state';
import {
  LEGAL_REVIEW_NOTICE_HEADING,
  LEGAL_REVIEW_NOTICE_BODY,
  LEGAL_REVIEW_NOTICE_SHORT_LINE,
  LEGAL_REVIEW_NOTICE_CHECKBOX,
  LEGAL_REVIEW_NOTICE_VARIANTS,
  LEGAL_REVIEW_NOTICE_PLACEMENTS,
  LEGAL_REVIEW_NOTICE_CONTEXTS,
  registrationTermsAgreementSegments,
  legalReviewNoticeSegmentsText,
  legalReviewNoticePlainText,
  publicDocumentCarriesLegalReviewNotice,
  activeLegalReviewNoticeRevision,
  buildLegalReviewNoticeReceipt,
  type LegalReviewNoticeContext,
  type LegalReviewNoticeVariantFor,
} from '../src/constants/legal-review-notice';
import { PUBLIC_DOCUMENT_IDS } from '../src/constants/public-documents';
import { SPECIAL_DOCS } from '../src/paths/collections';
import { LegalReviewNoticeReceiptSchema } from '../src/doc-schemas/legal-review-notice';
import * as root from '../src/index';

// The settled copy, verbatim from the design (CODE_CHANGE_no_legal_review_warnings.md).
const FULL_NOTE =
  "A note from DJ, TTT's founder. These pages describe how I intend TTT to work: my principles and what I'm trying to build. I wrote them myself, with help from AI tools, before I could afford a lawyer, so none of it has had legal review, and I honestly don't know whether all of it is legally sound. Charter Season support keeps TTT running first; after that, it's how I'll get a lawyer to turn this into real, reviewed legal wording. The words may change when that happens. My intentions won't. If a change needs your agreement, I'll ask you before it applies.";
const SHORT_LINE =
  "TTT's terms are my intentions, written by me and not yet reviewed by a lawyer. Read the founder's note.";
const CHECKBOX =
  "I understand TTT's terms express the founder's intentions, have not had legal review, and will be updated once Charter Season support makes that possible.";
const REGISTRATION_TERMS =
  "I have read and agree to the Terms of Service and Privacy Policy, and I understand they express the founder's intentions and have not had legal review.";

// Each revision names exactly one wording. Changing any notice copy without minting a new
// revision id (and pinning it here) fails this table — recorded receipts must keep meaning
// the words the person saw.
const PINNED_COPY_SHA256: Record<string, string> = {
  'founder-note-v1': 'c8c625441937dbde5e83627e8486cd1a7923a6747431cc68d6062de5296c8f1c',
};

function copyFingerprint(): string {
  const copy = {
    heading: LEGAL_REVIEW_NOTICE_HEADING,
    body: LEGAL_REVIEW_NOTICE_BODY,
    shortLine: LEGAL_REVIEW_NOTICE_SHORT_LINE,
    checkbox: LEGAL_REVIEW_NOTICE_CHECKBOX,
    registrationTerms: registrationTermsAgreementSegments(),
  };
  return createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}

describe('founder legal-review notice — the switch', () => {
  it('is active, with an immutable revision id', () => {
    expect(LEGAL_REVIEW_NOTICE_ACTIVE).toBe(true);
    expect(LEGAL_REVIEW_NOTICE_REVISION).toBe('founder-note-v1');
  });

  it('lives in the server-safe root entry', () => {
    expect(root.LEGAL_REVIEW_NOTICE_ACTIVE).toBe(LEGAL_REVIEW_NOTICE_ACTIVE);
    expect(root.LEGAL_REVIEW_NOTICE_REVISION).toBe(LEGAL_REVIEW_NOTICE_REVISION);
    expect(root.LEGAL_REVIEW_NOTICE_BODY).toBe(LEGAL_REVIEW_NOTICE_BODY);
    expect(typeof root.legalReviewNoticePlainText).toBe('function');
  });

  it('pins the active revision to its exact copy', () => {
    expect(PINNED_COPY_SHA256[LEGAL_REVIEW_NOTICE_REVISION]).toBe(copyFingerprint());
  });
});

describe('founder legal-review notice — the settled copy, verbatim', () => {
  it('full note = heading + body', () => {
    expect(`${LEGAL_REVIEW_NOTICE_HEADING} ${LEGAL_REVIEW_NOTICE_BODY}`).toBe(FULL_NOTE);
  });

  it('short line, whose closing sentence links to the full note', () => {
    expect(legalReviewNoticeSegmentsText(LEGAL_REVIEW_NOTICE_SHORT_LINE)).toBe(SHORT_LINE);
    expect(LEGAL_REVIEW_NOTICE_SHORT_LINE.at(-1)).toEqual({
      kind: 'link',
      label: "Read the founder's note.",
      target: 'founderNote',
    });
  });

  it('checkbox sentence', () => {
    expect(LEGAL_REVIEW_NOTICE_CHECKBOX).toBe(CHECKBOX);
  });

  it('registration Terms checkbox carries the notice clause and links both documents', () => {
    const segments = registrationTermsAgreementSegments();
    expect(legalReviewNoticeSegmentsText(segments)).toBe(REGISTRATION_TERMS);
    const links = segments.filter((segment) => segment.kind === 'link');
    expect(links.map((link) => link.target)).toEqual([SPECIAL_DOCS.TERMS_PAGE, SPECIAL_DOCS.PRIVACY_PAGE]);
  });
});

describe('founder legal-review notice — placements', () => {
  it('names every placement in the design table as a typed context', () => {
    expect(LEGAL_REVIEW_NOTICE_CONTEXTS).toEqual(
      expect.arrayContaining([
        'publicDocument',
        'registration',
        'reacceptance',
        'pledge',
        'publish',
        'workProjectCreation',
        'artisanCreatorUpgrade',
        'craftSkillUpload',
        'auditionEntrySubmission',
        'squareStreetzFirstPost',
        'guildInviteAgreement',
        'hallDownload',
        'charterExplainer',
        'landingFounder',
        'landingFundraising',
        'stakeShareExplanation',
        'bouquetAppreciationExplanation',
        'footer',
      ]),
    );
  });

  it('gives every placement at least one known variant', () => {
    for (const context of LEGAL_REVIEW_NOTICE_CONTEXTS) {
      const variants = LEGAL_REVIEW_NOTICE_PLACEMENTS[context];
      expect(variants.length, context).toBeGreaterThan(0);
      for (const variant of variants) expect(LEGAL_REVIEW_NOTICE_VARIANTS).toContain(variant);
    }
  });

  it('pledge gets a compact explanation plus a separate checkbox; Hall submission gets the checkbox', () => {
    expect(LEGAL_REVIEW_NOTICE_PLACEMENTS.pledge).toEqual(['strip', 'checkbox']);
    expect(LEGAL_REVIEW_NOTICE_PLACEMENTS.publish).toEqual(['checkbox']);
  });

  it('registration and the re-acceptance prompt show the full note', () => {
    expect(LEGAL_REVIEW_NOTICE_PLACEMENTS.registration).toEqual(['card']);
    expect(LEGAL_REVIEW_NOTICE_PLACEMENTS.reacceptance).toEqual(['card']);
  });

  it('an Audition entry submission shows the compact strip', () => {
    expect(LEGAL_REVIEW_NOTICE_PLACEMENTS.auditionEntrySubmission).toEqual(['strip']);
    expect(legalReviewNoticePlainText('auditionEntrySubmission')).toBe(SHORT_LINE);
  });

  it('types each placement to the variants it renders', () => {
    expectTypeOf<LegalReviewNoticeVariantFor<'publish'>>().toEqualTypeOf<'checkbox'>();
    expectTypeOf<LegalReviewNoticeVariantFor<'pledge'>>().toEqualTypeOf<'strip' | 'checkbox'>();
    expectTypeOf<LegalReviewNoticeVariantFor<'auditionEntrySubmission'>>().toEqualTypeOf<'strip'>();
    expectTypeOf<'publicDocument'>().toMatchTypeOf<LegalReviewNoticeContext>();
  });

  it('shows the strip on Terms, Privacy, Rules & Agreements, and Future Plans — never on the statutory pages', () => {
    const carrying = PUBLIC_DOCUMENT_IDS.filter((id) => publicDocumentCarriesLegalReviewNotice(id));
    expect(carrying).toEqual([
      SPECIAL_DOCS.TERMS_PAGE,
      SPECIAL_DOCS.PRIVACY_PAGE,
      SPECIAL_DOCS.RULES_AND_AGREEMENTS,
      SPECIAL_DOCS.FUTURE_PLANS,
    ]);
    expect(publicDocumentCarriesLegalReviewNotice(SPECIAL_DOCS.DMCA_POLICY)).toBe(false);
    expect(publicDocumentCarriesLegalReviewNotice(SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY)).toBe(false);
  });
});

describe('legalReviewNoticePlainText (backend-owned copy)', () => {
  it('returns the short line for a strip or inline placement', () => {
    expect(legalReviewNoticePlainText('publicDocument')).toBe(SHORT_LINE);
    expect(legalReviewNoticePlainText('pledge', 'strip')).toBe(SHORT_LINE);
    expect(legalReviewNoticePlainText('footer', 'inline')).toBe(SHORT_LINE);
  });

  it('returns the full note for a card', () => {
    expect(legalReviewNoticePlainText('registration')).toBe(FULL_NOTE);
    expect(legalReviewNoticePlainText('landingFounder', 'card')).toBe(FULL_NOTE);
  });

  it('returns the checkbox sentence for a checkbox', () => {
    expect(legalReviewNoticePlainText('publish')).toBe(CHECKBOX);
    expect(legalReviewNoticePlainText('pledge', 'checkbox')).toBe(CHECKBOX);
  });

  it('defaults to the placement\'s first variant', () => {
    expect(legalReviewNoticePlainText('pledge')).toBe(SHORT_LINE);
    expect(legalReviewNoticePlainText('charterExplainer')).toBe(SHORT_LINE);
  });

  it('refuses a variant the placement does not render (an untyped caller)', () => {
    const untyped = legalReviewNoticePlainText as (context: string, variant?: string) => string | null;
    expect(() => untyped('publish', 'card')).toThrow(/does not render/);
  });
});

describe('what gets recorded', () => {
  it('records the active revision', () => {
    expect(activeLegalReviewNoticeRevision()).toBe(LEGAL_REVIEW_NOTICE_REVISION);
  });

  it('builds a receipt of the active revision and the server time, in the persisted shape', () => {
    const receipt = buildLegalReviewNoticeReceipt(1_760_000_000_000);
    expect(receipt).toEqual({ revision: LEGAL_REVIEW_NOTICE_REVISION, acknowledgedAt: 1_760_000_000_000 });
    expect(LegalReviewNoticeReceiptSchema.safeParse(receipt).success).toBe(true);
  });

  it('the receipt shape is strict — a client-style extra field is rejected', () => {
    expect(
      LegalReviewNoticeReceiptSchema.safeParse({ revision: 'founder-note-v1', acknowledgedAt: 1, ip: 'x' }).success,
    ).toBe(false);
    expect(LegalReviewNoticeReceiptSchema.safeParse({ revision: '', acknowledgedAt: 1 }).success).toBe(false);
  });
});
