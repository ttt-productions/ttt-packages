import { describe, it, expect } from 'vitest';
import { RegistrationCompletionResultV1Schema } from '../src/doc-schemas/safety/age.js';
import { RegistrationCompletionOutcomeSchema } from '../src/doc-schemas/safety/foundation.js';
import { RegisterUserResultSchema } from '../src/schemas/users.js';

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
  'registrationExpired',
] as const;

describe('RegistrationCompletionOutcomeSchema', () => {
  it('declares exactly the outcomes registration completion produces', () => {
    expect([...RegistrationCompletionOutcomeSchema.options].sort()).toEqual(
      [...PRODUCED_OUTCOMES].sort(),
    );
  });

  it('refuses an outcome no completion path produces', () => {
    for (const unproduced of [
      'reauthenticationRequired',
      'appCheckRetryRequired',
      'privateDataConflict',
    ]) {
      expect(RegistrationCompletionOutcomeSchema.safeParse(unproduced).success).toBe(false);
    }
  });

  it('is the outcome a completion result carries', () => {
    expect(
      RegistrationCompletionResultV1Schema.safeParse({ outcome: 'completed', uid: 'u1' }).success,
    ).toBe(true);
    expect(
      RegistrationCompletionResultV1Schema.safeParse({ outcome: 'privateDataConflict' }).success,
    ).toBe(false);
  });
});

describe('RegisterUserResultSchema', () => {
  it('answers a registration on a login the orphan cleanup claimed with registrationExpired', async () => {
    expect(RegisterUserResultSchema.safeParse({ status: 'registrationExpired' }).success).toBe(
      true,
    );
    expect(RegisterUserResultSchema.safeParse({ status: 'registered' }).success).toBe(true);
  });
});
