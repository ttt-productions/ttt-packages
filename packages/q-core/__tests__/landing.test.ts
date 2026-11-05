import { describe, it, expect } from 'vitest';
import { HERO_ROTATION_INTERVAL_MS, LANDING_OWNER_NAME } from '../src/constants/business.js';

describe('the landing page', () => {
  it('is owned by Q-Sports League, the name its photo band and default hero title carry', () => {
    expect(LANDING_OWNER_NAME).toBe('Q-Sports League');
  });

  it('rotates its hero photos every six seconds', () => {
    expect(HERO_ROTATION_INTERVAL_MS).toBe(6000);
  });
});
