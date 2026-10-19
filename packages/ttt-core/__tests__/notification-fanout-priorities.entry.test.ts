import { describe, it, expect } from 'vitest';
import { NOTIFICATION_FANOUT_PRIORITIES } from '../src/constants/business-platform.js';
import * as constantsBarrel from '../src/constants/index.js';

describe('notification fanout priority tiers', () => {
  it('are exported from the constants entry', () => {
    expect(constantsBarrel.NOTIFICATION_FANOUT_PRIORITIES).toBe(NOTIFICATION_FANOUT_PRIORITIES);
  });
});
