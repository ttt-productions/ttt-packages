import { describe, it, expect } from 'vitest';
import {
  RegistrationCompletionOutcomeSchema,
  RegistrationCompletionResultV1Schema,
} from '../src/doc-schemas/safety/age';

// The domain outcomes registration completion can end in: the age fields are written (now or by an
// earlier run), a transient failure leaves the attestation retryable, or the attestation can never
// complete. An outcome nothing produces is a dead branch every consumer must still handle.
const PRODUCED_OUTCOMES = [
  'completed',
  'alreadyCompletedSameUid',
  'retryableInfrastructureFailure',
  'nonceExpired',
  'nonceUnknown',
  'nonceConsumedDifferentUid',
  'sessionHashMismatch',
  'attestationSignatureInvalid',
  'policyVersionRejected',
] as const;

describe('RegistrationCompletionOutcomeSchema', () => {
  it('declares exactly the outcomes registration completion produces', () => {
    expect([...RegistrationCompletionOutcomeSchema.options].sort()).toEqual([...PRODUCED_OUTCOMES].sort());
  });

  it('refuses an outcome no completion path produces', () => {
    for (const unproduced of ['reauthenticationRequired', 'appCheckRetryRequired', 'privateDataConflict']) {
      expect(RegistrationCompletionOutcomeSchema.safeParse(unproduced).success).toBe(false);
    }
  });

  it('is the outcome a completion result carries', () => {
    expect(RegistrationCompletionResultV1Schema.safeParse({ outcome: 'completed', uid: 'u1' }).success).toBe(true);
    expect(RegistrationCompletionResultV1Schema.safeParse({ outcome: 'privateDataConflict' }).success).toBe(false);
  });
});
