// §A9 report-disposition reason codes + the ONE canonical disposition↔reason cross-field rule.
//
// The reason enum now carries the two report-required codes (apparentCsamConfirmed /
// hashMatchValidated) alongside the original five not-required/exception codes. The pairing is
// declared ONCE in foundation.ts (REPORT_DISPOSITION_ALLOWED_REASON_CODES +
// refineReportDispositionReasonCode) and applied by the setReportDisposition input schemas
// (case.ts) and the SafetyStagedAction console command (admin.ts) — never re-declared.

import { describe, it, expect } from 'vitest';
import {
  ReportDispositionReasonCodeSchema,
  REPORT_REQUIRED_DISPOSITION_REASON_CODES,
  NOT_REQUIRED_DISPOSITION_REASON_CODES,
  REPORT_DISPOSITION_ALLOWED_REASON_CODES,
} from '../src/doc-schemas/safety/foundation';
import {
  SetReportDispositionInputV1Schema,
  SetReportDispositionCallableInputSchema,
} from '../src/doc-schemas/safety/case';
import { SafetyStagedActionSchema } from '../src/schemas/admin';

describe('ReportDispositionReasonCode enum + pairing map', () => {
  it('includes the two new report-required reason codes', () => {
    expect(ReportDispositionReasonCodeSchema.safeParse('apparentCsamConfirmed').success).toBe(true);
    expect(ReportDispositionReasonCodeSchema.safeParse('hashMatchValidated').success).toBe(true);
  });

  it('still includes the original five not-required/exception codes', () => {
    for (const code of NOT_REQUIRED_DISPOSITION_REASON_CODES) {
      expect(ReportDispositionReasonCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it('maps each disposition to its permitted reason codes', () => {
    expect(REPORT_DISPOSITION_ALLOWED_REASON_CODES.reportRequired).toEqual(
      REPORT_REQUIRED_DISPOSITION_REASON_CODES,
    );
    expect(REPORT_DISPOSITION_ALLOWED_REASON_CODES.notRequired).toEqual(
      NOT_REQUIRED_DISPOSITION_REASON_CODES,
    );
    expect(REPORT_DISPOSITION_ALLOWED_REASON_CODES.correctedNoApparentViolation).toEqual(
      NOT_REQUIRED_DISPOSITION_REASON_CODES,
    );
    // 'undetermined' is the initial state, never operator-set — permits no reason code.
    expect(REPORT_DISPOSITION_ALLOWED_REASON_CODES.undetermined).toEqual([]);
  });

  it('the report-required and not-required subsets are disjoint', () => {
    for (const code of REPORT_REQUIRED_DISPOSITION_REASON_CODES) {
      expect(NOT_REQUIRED_DISPOSITION_REASON_CODES).not.toContain(code);
    }
  });
});

const baseInput = {
  caseId: 'case-1',
  expectedRevision: 3,
  evidenceRefs: ['ev-1'],
};

describe('SetReportDispositionInputV1Schema cross-field refinement', () => {
  it('accepts legal report-required pairings', () => {
    expect(
      SetReportDispositionInputV1Schema.safeParse({
        ...baseInput,
        disposition: 'reportRequired',
        dispositionReasonCode: 'apparentCsamConfirmed',
      }).success,
    ).toBe(true);
    expect(
      SetReportDispositionInputV1Schema.safeParse({
        ...baseInput,
        disposition: 'reportRequired',
        dispositionReasonCode: 'hashMatchValidated',
      }).success,
    ).toBe(true);
  });

  it('accepts legal not-required / exception pairings', () => {
    expect(
      SetReportDispositionInputV1Schema.safeParse({
        ...baseInput,
        disposition: 'notRequired',
        dispositionReasonCode: 'nonReportableSafetyConfirmed',
      }).success,
    ).toBe(true);
    expect(
      SetReportDispositionInputV1Schema.safeParse({
        ...baseInput,
        disposition: 'correctedNoApparentViolation',
        dispositionReasonCode: 'basisInvalidatedFalseMatch',
      }).success,
    ).toBe(true);
  });

  it('rejects the contradictory pair reportRequired + a not-required reason', () => {
    const result = SetReportDispositionInputV1Schema.safeParse({
      ...baseInput,
      disposition: 'reportRequired',
      dispositionReasonCode: 'nonReportableSafetyConfirmed',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['dispositionReasonCode']);
    }
  });

  it('rejects the contradictory pair notRequired + a report-required reason', () => {
    expect(
      SetReportDispositionInputV1Schema.safeParse({
        ...baseInput,
        disposition: 'notRequired',
        dispositionReasonCode: 'apparentCsamConfirmed',
      }).success,
    ).toBe(false);
  });
});

describe('SetReportDispositionCallableInputSchema cross-field refinement', () => {
  const callableBase = { ...baseInput, confirmation: 'I confirm this legal reporting disposition' };

  it('accepts a legal pairing with confirmation', () => {
    expect(
      SetReportDispositionCallableInputSchema.safeParse({
        ...callableBase,
        disposition: 'reportRequired',
        dispositionReasonCode: 'hashMatchValidated',
      }).success,
    ).toBe(true);
  });

  it('rejects a contradictory pairing even with confirmation', () => {
    expect(
      SetReportDispositionCallableInputSchema.safeParse({
        ...callableBase,
        disposition: 'correctedNoApparentViolation',
        dispositionReasonCode: 'apparentCsamConfirmed',
      }).success,
    ).toBe(false);
  });
});

describe('SafetyStagedActionSchema derives the same pairing (setReportDisposition arm)', () => {
  const dispositionArm = {
    button: 'setReportDisposition' as const,
    evidenceRefs: ['ev-1'],
    expectedRevision: 0,
  };

  it('accepts a legal setReportDisposition action', () => {
    expect(
      SafetyStagedActionSchema.safeParse({
        ...dispositionArm,
        disposition: 'reportRequired',
        dispositionReasonCode: 'apparentCsamConfirmed',
      }).success,
    ).toBe(true);
  });

  it('rejects a contradictory setReportDisposition action', () => {
    expect(
      SafetyStagedActionSchema.safeParse({
        ...dispositionArm,
        disposition: 'notRequired',
        dispositionReasonCode: 'hashMatchValidated',
      }).success,
    ).toBe(false);
  });

  it('leaves non-disposition arms unaffected by the refinement', () => {
    expect(SafetyStagedActionSchema.safeParse({ button: 'quarantinePreserveFile' }).success).toBe(true);
    expect(SafetyStagedActionSchema.safeParse({ button: 'hashRemoveFile' }).success).toBe(true);
  });
});
