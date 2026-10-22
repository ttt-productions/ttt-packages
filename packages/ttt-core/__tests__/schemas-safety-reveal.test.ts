import { describe, it, expect } from 'vitest';
import { RevealCaseEvidenceInputSchema } from '../src/schemas/safety.js';

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
