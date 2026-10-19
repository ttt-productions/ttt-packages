import { describe, it, expect } from 'vitest';
import {
  CHILD_SAFETY_ACTIVE_WORK_STATUSES,
  NCII_ACTIVE_INTERNAL_STATUSES,
  TAKE_IT_DOWN_ACTIVE_PUBLIC_STATUSES,
  isActiveSafetyCaseStatus,
} from '../src/constants/safety-active-statuses.js';
import { SafetyCaseByIdResultSchema } from '../src/schemas/safety.js';
import * as constants from '../src/constants/index.js';
import * as schemasBarrel from '../src/schemas/index.js';

describe('active safety statuses', () => {
  it('is importable from the server-safe constants entry, where both trees read it', () => {
    expect(constants.CHILD_SAFETY_ACTIVE_WORK_STATUSES).toBe(CHILD_SAFETY_ACTIVE_WORK_STATUSES);
    expect(constants.NCII_ACTIVE_INTERNAL_STATUSES).toBe(NCII_ACTIVE_INTERNAL_STATUSES);
    expect(constants.TAKE_IT_DOWN_ACTIVE_PUBLIC_STATUSES).toBe(TAKE_IT_DOWN_ACTIVE_PUBLIC_STATUSES);
    expect(constants.isActiveSafetyCaseStatus).toBe(isActiveSafetyCaseStatus);
  });
});

describe('SafetyCaseByIdResultSchema', () => {
  it('is exported with the case-lookup input from the schemas entry point', () => {
    expect(schemasBarrel.SafetyCaseByIdResultSchema).toBe(SafetyCaseByIdResultSchema);
    expect(schemasBarrel.GetSafetyCaseByIdInputSchema).toBeDefined();
  });
});
