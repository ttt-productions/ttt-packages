import { describe, it, expect } from 'vitest';
import { AgePolicyConfigV1Schema, DEFAULT_AGE_POLICY_CONFIG_V1 } from '../src/doc-schemas/safety/age';

describe('the age policy config', () => {
  it('parses its own pinned default', () => {
    expect(AgePolicyConfigV1Schema.safeParse(DEFAULT_AGE_POLICY_CONFIG_V1).success).toBe(true);
  });

  it('names no registration outcome that deletes the login being completed', () => {
    expect(Object.keys(AgePolicyConfigV1Schema.shape)).not.toContain('terminalDeletableOutcomes');
    expect(Object.keys(AgePolicyConfigV1Schema.shape)).not.toContain('noDeleteOutcomes');
    expect(
      AgePolicyConfigV1Schema.safeParse({ ...DEFAULT_AGE_POLICY_CONFIG_V1, terminalDeletableOutcomes: ['nonceExpired'] })
        .success,
    ).toBe(false);
  });
});
