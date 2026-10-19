import { describe, it, expect } from 'vitest';
import { APP_MODE_FLIP_EVIDENCE_INPUT, CLOSE_UNDER_13_REASON_INPUT } from '../src/constants/text-fields';
import * as constantsBarrel from '../src/constants/index';

describe('app-mode flip milestone evidence', () => {
  it('is exported from the constants entry', () => {
    expect(constantsBarrel.APP_MODE_FLIP_EVIDENCE_INPUT).toBe(APP_MODE_FLIP_EVIDENCE_INPUT);
  });
});

describe('under-13 account close reason', () => {
  it('is exported from the constants entry', () => {
    expect(constantsBarrel.CLOSE_UNDER_13_REASON_INPUT).toBe(CLOSE_UNDER_13_REASON_INPUT);
  });
});
