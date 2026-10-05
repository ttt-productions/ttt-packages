import { describe, it, expect } from 'vitest';
import { OPERATOR_STEP_UP_CODE_LENGTH } from '../src/index';
import * as constantsBarrel from '../src/constants/index';
import { OperatorStepUpCodeInputSchema } from '../src/schemas/index';

describe('operator step-up code length', () => {
  it('is six digits, exported from the root and the constants barrel', () => {
    expect(OPERATOR_STEP_UP_CODE_LENGTH).toBe(6);
    expect(constantsBarrel.OPERATOR_STEP_UP_CODE_LENGTH).toBe(OPERATOR_STEP_UP_CODE_LENGTH);
  });

  it('the callable input accepts exactly that many digits, surrounding spaces trimmed', () => {
    const digits = '1'.repeat(OPERATOR_STEP_UP_CODE_LENGTH);
    expect(OperatorStepUpCodeInputSchema.parse({ code: ` ${digits} ` })).toEqual({ code: digits });
    expect(OperatorStepUpCodeInputSchema.safeParse({ code: digits.slice(1) }).success).toBe(false);
    expect(OperatorStepUpCodeInputSchema.safeParse({ code: `${digits}1` }).success).toBe(false);
    expect(OperatorStepUpCodeInputSchema.safeParse({ code: `${digits.slice(1)}a` }).success).toBe(false);
  });

  it('refuses with a sentence naming the code length', () => {
    const result = OperatorStepUpCodeInputSchema.safeParse({ code: '12' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(`Enter the ${OPERATOR_STEP_UP_CODE_LENGTH}-digit code.`);
  });
});
