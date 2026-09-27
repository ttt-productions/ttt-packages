import { describe, it, expect } from 'vitest';
import {
  NciiPolicyConfigV1Schema,
  DEFAULT_NCII_POLICY_CONFIG_V1,
  NCII_EVIDENCE_MAX_FILE_BYTES,
  NCII_EVIDENCE_MAX_FILES_PER_REQUEST,
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

describe('NCII evidence size caps', () => {
  it('allows per request exactly the per-request file count times the per-file cap', () => {
    expect(DEFAULT_NCII_POLICY_CONFIG_V1.maxEvidenceFileBytes).toBe(NCII_EVIDENCE_MAX_FILE_BYTES);
    expect(DEFAULT_NCII_POLICY_CONFIG_V1.maxEvidenceFilesPerRequest).toBe(NCII_EVIDENCE_MAX_FILES_PER_REQUEST);
    expect(DEFAULT_NCII_POLICY_CONFIG_V1.maxEvidenceTotalBytesPerRequest).toBe(
      NCII_EVIDENCE_MAX_FILES_PER_REQUEST * NCII_EVIDENCE_MAX_FILE_BYTES,
    );
    expect(NCII_EVIDENCE_MAX_FILE_BYTES).toBe(100 * 1024 * 1024);
    expect(NCII_EVIDENCE_MAX_FILES_PER_REQUEST).toBe(3);
  });
});
