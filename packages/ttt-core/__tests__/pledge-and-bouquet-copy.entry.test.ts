import { describe, it, expect } from 'vitest';
import {
  BOUQUET_APPRECIATION_AND_PAYOUTS_PLANNED_COPY,
  PLEDGE_BADGE_RECOGNITION_COPY,
} from '../src/constants/pledge-and-bouquet-copy.js';
import * as constants from '../src/constants/index.js';

describe('pledge and Bouquet copy exports', () => {
  it('ship on the server-safe constants entry, so every consumer shares one sentence', () => {
    expect(constants.PLEDGE_BADGE_RECOGNITION_COPY).toBe(PLEDGE_BADGE_RECOGNITION_COPY);
    expect(constants.BOUQUET_APPRECIATION_AND_PAYOUTS_PLANNED_COPY).toBe(BOUQUET_APPRECIATION_AND_PAYOUTS_PLANNED_COPY);
  });
});
