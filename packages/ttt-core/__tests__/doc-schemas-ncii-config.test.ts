import { describe, it, expect } from 'vitest';
import {
  NciiPolicyConfigV1Schema,
  DEFAULT_NCII_POLICY_CONFIG_V1,
} from '../src/doc-schemas/ncii/config';

describe('NciiPolicyConfigV1Schema (`_serverData/nciiPolicy`)', () => {
  it('accepts the frozen launch default', () => {
    expect(NciiPolicyConfigV1Schema.safeParse(DEFAULT_NCII_POLICY_CONFIG_V1).success).toBe(true);
  });

  it('carries no counsel-approval gate: nothing reads one, and uploads are not blocked on it', () => {
    expect('counselApproved' in DEFAULT_NCII_POLICY_CONFIG_V1).toBe(false);
    expect(Object.keys(NciiPolicyConfigV1Schema.shape)).not.toContain('counselApproved');
    // Strict: a config write reintroducing the field is rejected, not silently stripped.
    expect(
      NciiPolicyConfigV1Schema.safeParse({ ...DEFAULT_NCII_POLICY_CONFIG_V1, counselApproved: false }).success,
    ).toBe(false);
  });
});
