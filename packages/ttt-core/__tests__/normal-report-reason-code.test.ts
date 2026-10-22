import { describe, it, expect } from 'vitest';
import { NormalReportInputSchema } from '../src/schemas/admin.js';
import { USER_FACING_REASON_OPTIONS } from '../src/constants/admin-labels.js';

describe("a report close-out's user-facing reason code is a canonical code only", () => {
  const close = { taskId: 'task-1', outcome: 'founded', resolutionSummary: 'Founded' } as const;

  it('accepts every code the picklist owns', () => {
    for (const { code } of USER_FACING_REASON_OPTIONS) {
      expect(
        NormalReportInputSchema.safeParse({ ...close, userFacingReasonCode: code }).success,
      ).toBe(true);
    }
  });

  it('refuses an unknown, re-cased, or padded code', () => {
    for (const code of [
      'made-up',
      'Harassment',
      ' harassment',
      'harassment ',
      'Harassment or bullying',
    ]) {
      expect(
        NormalReportInputSchema.safeParse({ ...close, userFacingReasonCode: code }).success,
      ).toBe(false);
    }
  });

  it('still lets a close-out name no reason code', () => {
    expect(NormalReportInputSchema.safeParse(close).success).toBe(true);
  });
});
