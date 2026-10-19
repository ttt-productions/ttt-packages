import { describe, it, expect } from 'vitest';
import { AUTH_FULL_SCAN_EXAMINED_PER_RUN } from '../src/constants/scheduled-jobs.js';
import * as constants from '../src/constants/index.js';

describe('Auth full-scan budget', () => {
  it('is exported from the constants entry, beside the admin self-revoke refusal', () => {
    expect(constants.AUTH_FULL_SCAN_EXAMINED_PER_RUN).toBe(AUTH_FULL_SCAN_EXAMINED_PER_RUN);
    expect(constants.ADMIN_SELF_REVOKE_REFUSAL).toMatch(/another full admin/);
  });
});
