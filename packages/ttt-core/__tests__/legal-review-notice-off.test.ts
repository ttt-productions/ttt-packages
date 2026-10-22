import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/constants/legal-review-notice-state.js', () => ({
  LEGAL_REVIEW_NOTICE_ACTIVE: false,
  LEGAL_REVIEW_NOTICE_REVISION: 'founder-note-v2',
}));

import {
  LEGAL_REVIEW_NOTICE_CONTEXTS,
  LEGAL_REVIEW_NOTICE_PLACEMENTS,
  legalReviewNoticePlainText,
  legalReviewNoticeSegmentsText,
  registrationTermsAgreementSegments,
  activeLegalReviewNoticeRevision,
  buildLegalReviewNoticeReceipt,
  type LegalReviewNoticeContext,
} from '../src/constants/legal-review-notice.js';

describe('founder legal-review notice — switched off', () => {
  it('returns no plain text for any placement or variant', () => {
    for (const context of LEGAL_REVIEW_NOTICE_CONTEXTS) {
      for (const variant of LEGAL_REVIEW_NOTICE_PLACEMENTS[context]) {
        const text = (
          legalReviewNoticePlainText as (c: LegalReviewNoticeContext, v: string) => string | null
        )(context, variant);
        expect(text, `${context}/${variant}`).toBeNull();
      }
    }
  });

  it('records no revision and builds no receipt', () => {
    expect(activeLegalReviewNoticeRevision()).toBeNull();
    expect(buildLegalReviewNoticeReceipt(1_760_000_000_000)).toBeNull();
  });

  it('reverts the registration Terms checkbox to the plain agreement', () => {
    expect(legalReviewNoticeSegmentsText(registrationTermsAgreementSegments())).toBe(
      "I've read and agree to the Terms of Service, Privacy Policy (including the essential cookies the site needs to run), and Rules & Agreements, and I've seen the Future Plans, DMCA Policy, and Take It Down pages.",
    );
  });
});
