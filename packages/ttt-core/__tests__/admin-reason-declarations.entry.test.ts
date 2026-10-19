import { describe, it, expect } from 'vitest';
import {
  APP_MODE_FLIP_EVIDENCE_INPUT,
  CLOSE_UNDER_13_REASON_INPUT,
} from '../src/constants/text-fields';
import {
  MAX_INTERNAL_REASON_LENGTH,
  MAX_UNDER_13_CLOSE_REASON_LENGTH,
} from '../src/constants/business-admin';
import * as constantsBarrel from '../src/constants/index';

describe('app-mode flip milestone evidence', () => {
  it('is optional free text up to the internal reason length', () => {
    expect(APP_MODE_FLIP_EVIDENCE_INPUT).toMatchObject({ format: 'none', min: 0, max: MAX_INTERNAL_REASON_LENGTH });
    expect(MAX_INTERNAL_REASON_LENGTH).toBe(2000);
    expect(constantsBarrel.APP_MODE_FLIP_EVIDENCE_INPUT).toBe(APP_MODE_FLIP_EVIDENCE_INPUT);
  });
});

describe('under-13 account close reason', () => {
  it('is required free text up to its own named length', () => {
    expect(CLOSE_UNDER_13_REASON_INPUT).toMatchObject({ format: 'none', min: 1, max: MAX_UNDER_13_CLOSE_REASON_LENGTH });
    expect(MAX_UNDER_13_CLOSE_REASON_LENGTH).toBe(1000);
    expect(constantsBarrel.CLOSE_UNDER_13_REASON_INPUT).toBe(CLOSE_UNDER_13_REASON_INPUT);
  });
});
