import { describe, it, expect } from 'vitest';
import { HERO_ROTATION_INTERVAL_MS, SITE_NAME } from '../src/constants/business.js';

describe('the site', () => {
  it('is named Q-Sports League', () => {
    expect(SITE_NAME).toBe('Q-Sports League');
  });
});

describe('the landing page', () => {
  it('rotates its hero photos every six seconds', () => {
    expect(HERO_ROTATION_INTERVAL_MS).toBe(6000);
  });
});
