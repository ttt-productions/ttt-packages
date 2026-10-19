import { describe, it, expect } from 'vitest';
import { OPERATOR_STEP_UP_CODE_LENGTH } from '../src/constants/business-admin';
import * as constantsBarrel from '../src/constants/index';

describe('operator step-up code length', () => {
  it('is exported from the constants entry', () => {
    expect(constantsBarrel.OPERATOR_STEP_UP_CODE_LENGTH).toBe(OPERATOR_STEP_UP_CODE_LENGTH);
  });
});
