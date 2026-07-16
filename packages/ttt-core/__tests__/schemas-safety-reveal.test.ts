// revealCaseEvidence input — the operator's child-safety warning acknowledgement is carried on the
// reveal input so the backend can persist it in the reveal audit trail. The schema serves only the
// console reveal-under-reauth flow, so the acknowledgement is a required `true` (matching the
// existing explicit-confirmation style).

import { describe, it, expect } from 'vitest';
import { RevealCaseEvidenceInputSchema } from '../src/schemas/safety';

const CONFIRMATION = 'I confirm I am revealing case evidence under reauth';

describe('RevealCaseEvidenceInputSchema — warningAcknowledged', () => {
  it('accepts a fully-acknowledged reveal', () => {
    const result = RevealCaseEvidenceInputSchema.safeParse({
      caseId: 'case-1',
      confirmation: CONFIRMATION,
      warningAcknowledged: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects when warningAcknowledged is missing', () => {
    const result = RevealCaseEvidenceInputSchema.safeParse({
      caseId: 'case-1',
      confirmation: CONFIRMATION,
    });
    expect(result.success).toBe(false);
  });

  it('rejects warningAcknowledged: false (must be an explicit true)', () => {
    const result = RevealCaseEvidenceInputSchema.safeParse({
      caseId: 'case-1',
      confirmation: CONFIRMATION,
      warningAcknowledged: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (strict)', () => {
    const result = RevealCaseEvidenceInputSchema.safeParse({
      caseId: 'case-1',
      confirmation: CONFIRMATION,
      warningAcknowledged: true,
      extra: 'nope',
    });
    expect(result.success).toBe(false);
  });
});
