import { describe, it, expect } from 'vitest';
import { GetSafetyCaseByIdInputSchema } from '../src/schemas/safety.js';
import { FIRESTORE_DOCUMENT_ID_MAX_BYTES } from '../src/constants/business-platform.js';

describe('GetSafetyCaseByIdInputSchema takes any case id Firestore can hold', () => {
  const lookup = (caseId: string) =>
    GetSafetyCaseByIdInputSchema.safeParse({ caseType: 'csam', caseId }).success;

  it('accepts a case id of exactly the Firestore id limit, the closed-case box limit', () => {
    expect(lookup('a'.repeat(FIRESTORE_DOCUMENT_ID_MAX_BYTES))).toBe(true);
  });

  it('refuses a case id one byte over the Firestore id limit', () => {
    expect(lookup('a'.repeat(FIRESTORE_DOCUMENT_ID_MAX_BYTES + 1))).toBe(false);
  });
});
