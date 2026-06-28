import { describe, it, expect } from 'vitest';
import {
  AuthorityProofScanStatusSchema,
  AuthorityProofScanStateV1Schema,
  TakeItDownAuthorizedRepresentativeV1Schema,
  REQUIRED_FIELD_CODES_DEPICTED_PERSON,
  REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE,
  computeCompleteness,
  requiredFieldCodes,
} from '../src/doc-schemas/ncii/requests';
import type { TakeItDownFieldCode } from '../src/doc-schemas/safety/foundation';

// ---------------------------------------------------------------------------
// H-03 — authorized-rep field requirements
// ---------------------------------------------------------------------------

describe('REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE (H-03)', () => {
  it('includes authorityBasis', () => {
    expect(REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE).toContain('authorityBasis');
  });

  it('includes authorityCertification', () => {
    expect(REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE).toContain('authorityCertification');
  });

  it('does NOT include authorityEvidence', () => {
    expect(REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE).not.toContain('authorityEvidence');
  });

  it('is a superset of the depictedPerson required codes', () => {
    for (const code of REQUIRED_FIELD_CODES_DEPICTED_PERSON) {
      expect(REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE).toContain(code);
    }
  });
});

describe('TakeItDownAuthorizedRepresentativeV1Schema (H-03)', () => {
  const base = {
    representedPersonName: 'Jane Smith',
    authorityBasis: 'Power of attorney',
    authorityCertification: true,
  };

  it('accepts the minimal shape (no photo)', () => {
    expect(TakeItDownAuthorizedRepresentativeV1Schema.parse(base)).toEqual(base);
  });

  it('accepts shape with optional authorityEvidenceRef', () => {
    const withRef = { ...base, authorityEvidenceRef: 'nciiAuthorityEvidence/abc/file1' };
    expect(TakeItDownAuthorizedRepresentativeV1Schema.parse(withRef)).toEqual(withRef);
  });

  it('accepts shape with optional authorityProofScan', () => {
    const withScan = {
      ...base,
      authorityProofScan: {
        scanStatus: 'clean' as const,
        objectGeneration: 'gen-1',
        objectHash: 'sha256-abc',
        scannedAt: 1_000_000,
      },
    };
    expect(TakeItDownAuthorizedRepresentativeV1Schema.parse(withScan)).toEqual(withScan);
  });

  it('rejects missing authorityCertification', () => {
    const { authorityCertification: _drop, ...nocert } = base;
    expect(() =>
      TakeItDownAuthorizedRepresentativeV1Schema.parse(nocert),
    ).toThrow();
  });

  it('rejects unknown keys (.strict)', () => {
    expect(() =>
      TakeItDownAuthorizedRepresentativeV1Schema.parse({ ...base, extra: 'nope' }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// H-02 — authority-proof scan state
// ---------------------------------------------------------------------------

describe('AuthorityProofScanStatusSchema (H-02)', () => {
  const validStatuses = ['pending', 'clean', 'matched', 'rejected', 'unavailable'] as const;

  for (const status of validStatuses) {
    it(`accepts '${status}'`, () => {
      expect(AuthorityProofScanStatusSchema.parse(status)).toBe(status);
    });
  }

  it('rejects unknown status', () => {
    expect(() => AuthorityProofScanStatusSchema.parse('approved')).toThrow();
  });
});

describe('AuthorityProofScanStateV1Schema (H-02)', () => {
  const base = {
    scanStatus: 'pending' as const,
    objectGeneration: 'gen-abc',
    objectHash: 'sha256-deadbeef',
  };

  it('accepts without optional scannedAt', () => {
    expect(AuthorityProofScanStateV1Schema.parse(base)).toEqual(base);
  });

  it('accepts with scannedAt', () => {
    const full = { ...base, scannedAt: 1_234_567 };
    expect(AuthorityProofScanStateV1Schema.parse(full)).toEqual(full);
  });

  it('rejects empty objectGeneration', () => {
    expect(() =>
      AuthorityProofScanStateV1Schema.parse({ ...base, objectGeneration: '' }),
    ).toThrow();
  });

  it('rejects empty objectHash', () => {
    expect(() =>
      AuthorityProofScanStateV1Schema.parse({ ...base, objectHash: '' }),
    ).toThrow();
  });

  it('rejects unknown keys (.strict)', () => {
    expect(() =>
      AuthorityProofScanStateV1Schema.parse({ ...base, extra: 'nope' }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// computeCompleteness — depictedPerson role
// ---------------------------------------------------------------------------

describe('computeCompleteness — depictedPerson', () => {
  const depictedPersonComplete = [
    'requesterName',
    'requesterRole',
    'electronicSignature',
    'targetLocator',
    'nonconsentStatement',
    'goodFaithCertification',
    'contactEmail',
  ] as const;

  it('returns complete when all required fields + contact supplied', () => {
    const result = computeCompleteness({
      requesterRole: 'depictedPerson',
      suppliedFieldCodes: [...depictedPersonComplete],
    });
    expect(result.status).toBe('complete');
    expect(result.missingFieldCodes).toHaveLength(0);
  });

  it('returns complete with contactPhone instead of contactEmail', () => {
    const codes: TakeItDownFieldCode[] = [
      ...depictedPersonComplete.filter((c) => c !== 'contactEmail'),
      'contactPhone',
    ];
    const result = computeCompleteness({
      requesterRole: 'depictedPerson',
      suppliedFieldCodes: codes,
    });
    expect(result.status).toBe('complete');
  });

  it('returns incomplete when goodFaithCertification missing', () => {
    const codes = depictedPersonComplete.filter((c) => c !== 'goodFaithCertification');
    const result = computeCompleteness({
      requesterRole: 'depictedPerson',
      suppliedFieldCodes: [...codes],
    });
    expect(result.status).toBe('incomplete');
    expect(result.missingFieldCodes).toContain('goodFaithCertification');
  });

  it('returns incomplete with contactEmail in missing codes when no contact supplied', () => {
    const codes = depictedPersonComplete.filter(
      (c): c is (typeof depictedPersonComplete)[number] =>
        (c as string) !== 'contactEmail' && (c as string) !== 'contactPhone',
    );
    const result = computeCompleteness({
      requesterRole: 'depictedPerson',
      suppliedFieldCodes: [...codes],
    });
    expect(result.status).toBe('incomplete');
    expect(result.missingFieldCodes).toContain('contactEmail');
  });
});

// ---------------------------------------------------------------------------
// computeCompleteness — authorizedRepresentative (H-03 + H-02)
// ---------------------------------------------------------------------------

describe('computeCompleteness — authorizedRepresentative (H-03 / H-02)', () => {
  const authRepComplete = [
    'requesterName',
    'requesterRole',
    'electronicSignature',
    'targetLocator',
    'nonconsentStatement',
    'goodFaithCertification',
    'authorityBasis',
    'authorityCertification',
    'contactEmail',
  ] as const;

  it('returns complete with written elements + authorityCertification (no photo)', () => {
    const result = computeCompleteness({
      requesterRole: 'authorizedRepresentative',
      suppliedFieldCodes: [...authRepComplete],
    });
    expect(result.status).toBe('complete');
    expect(result.missingFieldCodes).toHaveLength(0);
  });

  it('authorityEvidence (photo) does NOT affect completeness when absent (H-03)', () => {
    // authRepComplete never includes 'authorityEvidence'; pass it as-is to assert
    // that completeness holds without the photo (the photo is purely optional).
    const result = computeCompleteness({
      requesterRole: 'authorizedRepresentative',
      suppliedFieldCodes: [...authRepComplete],
    });
    expect(result.status).toBe('complete');
    expect(result.missingFieldCodes).not.toContain('authorityEvidence');
  });

  it('authorityEvidence present does NOT affect completeness (photo is purely optional)', () => {
    const withPhoto: TakeItDownFieldCode[] = [...authRepComplete, 'authorityEvidence'];
    const result = computeCompleteness({
      requesterRole: 'authorizedRepresentative',
      suppliedFieldCodes: withPhoto,
    });
    expect(result.status).toBe('complete');
  });

  it('returns incomplete when authorityCertification missing', () => {
    const codes = authRepComplete.filter((c) => c !== 'authorityCertification');
    const result = computeCompleteness({
      requesterRole: 'authorizedRepresentative',
      suppliedFieldCodes: [...codes],
    });
    expect(result.status).toBe('incomplete');
    expect(result.missingFieldCodes).toContain('authorityCertification');
  });

  it('returns incomplete when authorityBasis missing', () => {
    const codes = authRepComplete.filter((c) => c !== 'authorityBasis');
    const result = computeCompleteness({
      requesterRole: 'authorizedRepresentative',
      suppliedFieldCodes: [...codes],
    });
    expect(result.status).toBe('incomplete');
    expect(result.missingFieldCodes).toContain('authorityBasis');
  });

  it('pending scan on optional photo does NOT block completeness (H-02)', () => {
    // suppliedFieldCodes never contains a scan-status token — scan state lives on
    // AuthorityProofScanStateV1, not in the field-code set. Completeness sees only
    // the written statutory elements; a pending/unavailable scan is invisible here.
    const result = computeCompleteness({
      requesterRole: 'authorizedRepresentative',
      suppliedFieldCodes: [...authRepComplete],
    });
    expect(result.status).toBe('complete');
  });
});

// ---------------------------------------------------------------------------
// requiredFieldCodes — role dispatch
// ---------------------------------------------------------------------------

describe('requiredFieldCodes', () => {
  it('returns the depictedPerson set for depictedPerson role', () => {
    expect(requiredFieldCodes('depictedPerson')).toEqual(REQUIRED_FIELD_CODES_DEPICTED_PERSON);
  });

  it('returns the authorizedRepresentative set for authorizedRepresentative role', () => {
    expect(requiredFieldCodes('authorizedRepresentative')).toEqual(
      REQUIRED_FIELD_CODES_AUTHORIZED_REPRESENTATIVE,
    );
  });
});
