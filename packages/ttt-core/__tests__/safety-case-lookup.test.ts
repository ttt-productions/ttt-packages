import { describe, it, expect } from 'vitest';
import {
  CHILD_SAFETY_ACTIVE_WORK_STATUSES,
  NCII_ACTIVE_INTERNAL_STATUSES,
  TAKE_IT_DOWN_ACTIVE_PUBLIC_STATUSES,
  isActiveSafetyCaseStatus,
} from '../src/constants/safety-active-statuses';
import { SafetyCaseByIdResultSchema } from '../src/schemas/safety';
import { ChildSafetyWorkStatusSchema, SafetyCaseLaneSchema } from '../src/doc-schemas/safety/case';
import { NciiInternalStatusSchema, TakeItDownPublicStatusSchema } from '../src/doc-schemas/safety/foundation';
import * as root from '../src/index';
import * as schemasBarrel from '../src/schemas';

describe('active safety statuses', () => {
  // A case stays active — on the console and in the Legal-Clocks count — until its worker verifies
  // a terminal status: a close in progress (`processing`) and a worker out of retries (`failed`)
  // are still open work.
  it('a child-safety case is active until it is operationally resolved', () => {
    expect([...CHILD_SAFETY_ACTIVE_WORK_STATUSES].sort()).toEqual(
      ['new', 'triaged', 'reporting', 'actioning', 'processing', 'failed'].sort(),
    );
  });

  it('an NCII case is active until it is removed, rejected, or closed', () => {
    expect([...NCII_ACTIVE_INTERNAL_STATUSES].sort()).toEqual(['open', 'removalInProgress', 'processing', 'failed'].sort());
  });

  it('a take-it-down request is active until it is completed, unable to locate, or found invalid', () => {
    expect([...TAKE_IT_DOWN_ACTIVE_PUBLIC_STATUSES].sort()).toEqual(['received', 'needsMoreInfo', 'validInProgress'].sort());
  });

  it('every active status is a member of its own status union, each once', () => {
    const sets = [
      [CHILD_SAFETY_ACTIVE_WORK_STATUSES, ChildSafetyWorkStatusSchema],
      [NCII_ACTIVE_INTERNAL_STATUSES, NciiInternalStatusSchema],
      [TAKE_IT_DOWN_ACTIVE_PUBLIC_STATUSES, TakeItDownPublicStatusSchema],
    ] as const;
    for (const [statuses, schema] of sets) {
      expect(new Set(statuses).size).toBe(statuses.length);
      for (const status of statuses) expect(schema.safeParse(status).success, status).toBe(true);
    }
  });

  it('answers whether a case is active by its own lane', () => {
    expect(isActiveSafetyCaseStatus({ caseType: 'csam', status: 'processing' })).toBe(true);
    expect(isActiveSafetyCaseStatus({ caseType: 'csam', status: 'operationallyResolved' })).toBe(false);
    expect(isActiveSafetyCaseStatus({ caseType: 'ncii', status: 'removalInProgress' })).toBe(true);
    expect(isActiveSafetyCaseStatus({ caseType: 'ncii', status: 'closed' })).toBe(false);
    // @ts-expect-error a child-safety case never carries an NCII status
    isActiveSafetyCaseStatus({ caseType: 'csam', status: 'removed' });
  });

  it('is importable from the server-safe root, where both trees read it', () => {
    expect(root.CHILD_SAFETY_ACTIVE_WORK_STATUSES).toBe(CHILD_SAFETY_ACTIVE_WORK_STATUSES);
    expect(root.NCII_ACTIVE_INTERNAL_STATUSES).toBe(NCII_ACTIVE_INTERNAL_STATUSES);
    expect(root.TAKE_IT_DOWN_ACTIVE_PUBLIC_STATUSES).toBe(TAKE_IT_DOWN_ACTIVE_PUBLIC_STATUSES);
    expect(root.isActiveSafetyCaseStatus).toBe(isActiveSafetyCaseStatus);
  });
});

describe('SafetyCaseByIdResultSchema', () => {
  const closure = {
    eventId: 'decision-1',
    closedAt: 1_700_000_000_000,
    closedByUid: 'admin-1',
    outcome: 'founded',
    resolutionSummary: 'Confirmed and reported.',
  };
  const csamCase = {
    caseType: 'csam',
    caseId: 'case-1',
    revision: 4,
    status: 'operationallyResolved',
    meta: {
      incidentClass: 'apparentCsam',
      createdAt: 1_690_000_000_000,
      actualKnowledgeAt: 1_690_000_000_100,
      preserveUntil: 1_720_000_000_000,
      reportDisposition: 'reportRequired',
    },
    closureHistory: [closure],
  } as const;
  const nciiCase = {
    caseType: 'ncii',
    caseId: 'ncii-1',
    revision: 2,
    status: 'closed',
    meta: { lane: 'ncii', createdAt: 1_690_000_000_000 },
    closureHistory: [
      { eventId: 'embedded', closedAt: 1, closedByUid: 'admin-1', outcome: 'unfounded', resolutionSummary: 'Not NCII.', adminNote: 'n' },
    ],
  } as const;

  it('answers a child-safety case with its work status and an NCII case with its internal status', () => {
    expect(SafetyCaseByIdResultSchema.parse(csamCase)).toEqual(csamCase);
    expect(SafetyCaseByIdResultSchema.parse(nciiCase)).toEqual(nciiCase);
  });

  it("refuses a status from the other lane's set", () => {
    expect(SafetyCaseByIdResultSchema.safeParse({ ...csamCase, status: 'removed' }).success).toBe(false);
    expect(SafetyCaseByIdResultSchema.safeParse({ ...nciiCase, status: 'triaged' }).success).toBe(false);
  });

  it('types the metadata by its canonical unions', () => {
    expect(
      SafetyCaseByIdResultSchema.safeParse({ ...csamCase, meta: { ...csamCase.meta, incidentClass: 'somethingElse' } })
        .success,
    ).toBe(false);
    expect(SafetyCaseByIdResultSchema.safeParse({ ...nciiCase, meta: { lane: 'other' } }).success).toBe(false);
    expect(
      SafetyCaseByIdResultSchema.safeParse({ ...csamCase, meta: { ...csamCase.meta, reportDisposition: 'maybe' } })
        .success,
    ).toBe(false);
  });

  it('carries no field beyond the lookup projection — no evidence, no reporter identity', () => {
    expect(SafetyCaseByIdResultSchema.safeParse({ ...csamCase, reporterUid: 'user-9' }).success).toBe(false);
    expect(SafetyCaseByIdResultSchema.safeParse({ ...csamCase, meta: { ...csamCase.meta, evidenceUrl: 'x' } }).success).toBe(
      false,
    );
    expect(
      SafetyCaseByIdResultSchema.safeParse({ ...csamCase, closureHistory: [{ ...closure, reporterNote: 'x' }] }).success,
    ).toBe(false);
  });

  it("carries each close as the closure record it wrote: a closure outcome, a summary, and who closed it", () => {
    const withRow = (row: Record<string, unknown>) => ({ ...csamCase, closureHistory: [row] });
    expect(SafetyCaseByIdResultSchema.safeParse(withRow({ ...closure, outcome: 'unfounded' })).success).toBe(true);
    // A work or case status is never a closure outcome.
    expect(SafetyCaseByIdResultSchema.safeParse(withRow({ ...closure, outcome: 'operationallyResolved' })).success).toBe(false);
    expect(SafetyCaseByIdResultSchema.safeParse(withRow({ ...closure, outcome: 'removed' })).success).toBe(false);
    const { resolutionSummary: _summary, ...withoutSummary } = closure;
    expect(SafetyCaseByIdResultSchema.safeParse(withRow(withoutSummary)).success).toBe(false);
    expect(SafetyCaseByIdResultSchema.safeParse(withRow({ ...closure, closedByUid: '' })).success).toBe(false);
    expect(SafetyCaseByIdResultSchema.safeParse(withRow({ ...closure, eventId: '' })).success).toBe(false);
  });

  it('takes its case types from the canonical lane union', () => {
    const answered = SafetyCaseByIdResultSchema.options.map((arm) => arm.shape.caseType.value);
    expect(answered.sort()).toEqual([...SafetyCaseLaneSchema.options].sort());
  });

  it('is exported with the case-lookup input from the schemas entry point', () => {
    expect(schemasBarrel.SafetyCaseByIdResultSchema).toBe(SafetyCaseByIdResultSchema);
    expect(schemasBarrel.GetSafetyCaseByIdInputSchema).toBeDefined();
  });
});
