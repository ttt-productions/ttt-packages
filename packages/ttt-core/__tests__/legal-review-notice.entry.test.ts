import { describe, it, expect } from 'vitest';
import {
  LEGAL_REVIEW_NOTICE_ACTIVE,
  LEGAL_REVIEW_NOTICE_REVISION,
} from '../src/constants/legal-review-notice-state.js';
import { LEGAL_REVIEW_NOTICE_BODY } from '../src/constants/legal-review-notice.js';
import * as constants from '../src/constants/index.js';

describe('founder legal-review notice — the switch', () => {
  it('lives in the server-safe constants entry', () => {
    expect(constants.LEGAL_REVIEW_NOTICE_ACTIVE).toBe(LEGAL_REVIEW_NOTICE_ACTIVE);
    expect(constants.LEGAL_REVIEW_NOTICE_REVISION).toBe(LEGAL_REVIEW_NOTICE_REVISION);
    expect(constants.LEGAL_REVIEW_NOTICE_BODY).toBe(LEGAL_REVIEW_NOTICE_BODY);
    expect(typeof constants.legalReviewNoticePlainText).toBe('function');
  });
});
