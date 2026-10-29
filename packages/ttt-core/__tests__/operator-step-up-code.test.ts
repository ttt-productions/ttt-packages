import { describe, it, expect } from 'vitest';
import { OPERATOR_STEP_UP_CODE_LENGTH } from '../src/constants/business-admin.js';
import {
  EnrollOperatorStepUpInputSchema,
  OperatorStepUpCodeInputSchema,
} from '../src/schemas/safety.js';

describe('operator step-up code length', () => {
  it('is six digits', () => {
    expect(OPERATOR_STEP_UP_CODE_LENGTH).toBe(6);
  });

  it('the callable input accepts exactly that many digits, surrounding spaces trimmed', () => {
    const digits = '1'.repeat(OPERATOR_STEP_UP_CODE_LENGTH);
    expect(OperatorStepUpCodeInputSchema.parse({ code: ` ${digits} ` })).toEqual({ code: digits });
    expect(OperatorStepUpCodeInputSchema.safeParse({ code: digits.slice(1) }).success).toBe(false);
    expect(OperatorStepUpCodeInputSchema.safeParse({ code: `${digits}1` }).success).toBe(false);
    expect(OperatorStepUpCodeInputSchema.safeParse({ code: `${digits.slice(1)}a` }).success).toBe(
      false,
    );
  });

  it('refuses with a sentence naming the code length', () => {
    const result = OperatorStepUpCodeInputSchema.safeParse({ code: '12' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Enter the ${OPERATOR_STEP_UP_CODE_LENGTH}-digit code.`,
    );
  });
});

describe('enrolling the operator step-up takes at most one proof', () => {
  it('a first enrollment sends no proof', () => {
    expect(EnrollOperatorStepUpInputSchema.parse({})).toEqual({});
  });

  it('a re-enroll proves the current authenticator with its code', () => {
    expect(EnrollOperatorStepUpInputSchema.parse({ currentCode: ' 123456 ' })).toEqual({
      currentCode: '123456',
    });
    expect(EnrollOperatorStepUpInputSchema.safeParse({ currentCode: '12345' }).success).toBe(false);
  });

  it('a recovery code is read without case, spaces, or the group dash', () => {
    expect(EnrollOperatorStepUpInputSchema.parse({ recoveryCode: 'abcde-12345' })).toEqual({
      recoveryCode: 'ABCDE12345',
    });
    expect(EnrollOperatorStepUpInputSchema.safeParse({ recoveryCode: 'ABCDE-1234' }).success).toBe(
      false,
    );
    expect(EnrollOperatorStepUpInputSchema.safeParse({ recoveryCode: 'ABCDE-1234U' }).success).toBe(
      false,
    );
  });

  it('refuses two proofs at once and any other field', () => {
    expect(
      EnrollOperatorStepUpInputSchema.safeParse({
        currentCode: '123456',
        recoveryCode: 'ABCDE12345',
      }).success,
    ).toBe(false);
    expect(EnrollOperatorStepUpInputSchema.safeParse({ uid: 'someone-else' }).success).toBe(false);
  });
});
