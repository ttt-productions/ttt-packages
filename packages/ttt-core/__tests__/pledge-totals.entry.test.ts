import { describe, it, expect } from 'vitest';
import {
  isPledgePaymentCounted,
  pledgePaymentContributionOf,
  pledgePaymentTotalsOf,
} from '../src/utils/pledge-totals';
import * as utils from '../src/utils/index';

describe('the pledge-totals formula', () => {
  it('is exported from the utils entry', () => {
    expect(utils.pledgePaymentTotalsOf).toBe(pledgePaymentTotalsOf);
    expect(utils.isPledgePaymentCounted).toBe(isPledgePaymentCounted);
    expect(utils.pledgePaymentContributionOf).toBe(pledgePaymentContributionOf);
  });
});
