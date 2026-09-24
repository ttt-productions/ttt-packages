import { describe, it, expect } from 'vitest';
import {
  BOUQUET_APPRECIATION_AND_PAYOUTS_PLANNED_COPY,
  PLEDGE_BADGE_RECOGNITION_COPY,
} from '../src/constants/pledge-and-bouquet-copy';
import { BOUQUET_STAGE_1_LIVE, BOUQUET_STAGE_3_LIVE } from '../src/constants/release-flags';
import * as root from '../src/index';
import * as constants from '../src/constants';

describe('pledge badge recognition copy', () => {
  it('is the settled wording, verbatim', () => {
    expect(PLEDGE_BADGE_RECOGNITION_COPY).toBe(
      'When your pledges reach a certain total, you earn a badge on your profile. Badges and other Charter honors are thank-you recognition, never something a pledge buys.',
    );
  });
});

describe('Bouquets and payouts planned-not-built copy', () => {
  it('is the settled wording, verbatim', () => {
    expect(BOUQUET_APPRECIATION_AND_PAYOUTS_PLANNED_COPY).toBe('Bouquets and artisan payouts are planned, not built yet.');
  });

  it('is only true while neither Bouquet purchasing nor payouts is live', () => {
    expect(BOUQUET_STAGE_1_LIVE).toBe(false);
    expect(BOUQUET_STAGE_3_LIVE).toBe(false);
  });
});

describe('pledge and Bouquet copy exports', () => {
  it('ship on the server-safe root and the constants subpath, so every consumer shares one sentence', () => {
    expect(root.PLEDGE_BADGE_RECOGNITION_COPY).toBe(PLEDGE_BADGE_RECOGNITION_COPY);
    expect(root.BOUQUET_APPRECIATION_AND_PAYOUTS_PLANNED_COPY).toBe(BOUQUET_APPRECIATION_AND_PAYOUTS_PLANNED_COPY);
    expect(constants.PLEDGE_BADGE_RECOGNITION_COPY).toBe(PLEDGE_BADGE_RECOGNITION_COPY);
    expect(constants.BOUQUET_APPRECIATION_AND_PAYOUTS_PLANNED_COPY).toBe(BOUQUET_APPRECIATION_AND_PAYOUTS_PLANNED_COPY);
  });
});
