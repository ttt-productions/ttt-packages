import { describe, it, expect } from 'vitest';
import {
  CHILD_SAFETY_RETAINED_PRESERVATION_STATUSES,
  GetSafetyCaseConsoleResultSchema,
  ListRetainedEvidenceInventoryResultSchema,
  SafetyCaseFailedJobRefSchema,
  SafetyCaseLaneSchema,
  TakeItDownRequestConsoleRowSchema,
  GetSafetyCaseConsoleInputSchema,
  ListRetainedChildSafetyCasesInputSchema,
  ListRetainedChildSafetyCasesResultSchema,
  ListRetainedEvidenceInventoryInputSchema,
  RetainedChildSafetyCaseRowSchema,
  SafetyCaseConsoleSourceSchema,
} from '../src/schemas/safety';
import { ChildSafetyPreservationStatusSchema } from '../src/doc-schemas/safety/case';
import * as schemasBarrel from '../src/schemas';
import * as docSchemasBarrel from '../src/doc-schemas';
import { SafetyCaseInputSchema, ReopenSafetyCaseInputSchema } from '../src/schemas/admin';

const caseListRow = {
  schemaVersion: 1,
  caseId: 'case-1',
  revision: 3,
  canonicalIncidentKey: 'incident-1',
  incidentClass: 'apparentCsam',
  sourceSignalSummary: { count: 1, latestKind: 'report', latestAt: 1 },
  workStatus: 'operationallyResolved',
  preservationStatus: 'statutoryHold',
  ncmecStatus: 'awaitingManualFiling',
  accountActionStatus: 'noAccountActionRequired',
  reportDisposition: 'undetermined',
  reviewDueAt: 10,
  openHoldCount: 1,
  createdAt: 1,
  updatedAt: 2,
};

describe('safety console — per-source exhaustion', () => {
  it('names the sources whose last page the console already holds', () => {
    expect(GetSafetyCaseConsoleInputSchema.safeParse({ exhaustedSources: ['ncii'] }).success).toBe(true);
    expect(
      GetSafetyCaseConsoleInputSchema.safeParse({
        childSafetyCursor: { v: 5, id: 'c1' },
        exhaustedSources: ['ncii', 'takeItDown'],
      }).success,
    ).toBe(true);
    expect(GetSafetyCaseConsoleInputSchema.safeParse({}).success).toBe(true);
  });

  it('names each known source at most once', () => {
    expect(GetSafetyCaseConsoleInputSchema.safeParse({ exhaustedSources: ['ncii', 'ncii'] }).success).toBe(false);
    expect(GetSafetyCaseConsoleInputSchema.safeParse({ exhaustedSources: ['monitors'] }).success).toBe(false);
    expect(SafetyCaseConsoleSourceSchema.options).toEqual(['childSafety', 'ncii', 'takeItDown']);
  });
});

describe('retained child-safety case list', () => {
  it('keeps a closed case in the list until its evidence is destroyed', () => {
    expect([...CHILD_SAFETY_RETAINED_PRESERVATION_STATUSES].sort()).toEqual(
      ChildSafetyPreservationStatusSchema.options.filter((status) => status !== 'destroyed').sort(),
    );
  });

  it('pages by a createdAt cursor, or looks one case up by id', () => {
    expect(ListRetainedChildSafetyCasesInputSchema.safeParse(undefined).success).toBe(true);
    expect(
      ListRetainedChildSafetyCasesInputSchema.safeParse({ pageSize: 50, cursor: { createdAt: 1, id: 'case-1' } })
        .success,
    ).toBe(true);
    expect(ListRetainedChildSafetyCasesInputSchema.safeParse({ exactId: 'case-1' }).success).toBe(true);
    expect(ListRetainedChildSafetyCasesInputSchema.safeParse({ pageSize: 0 }).success).toBe(false);
    expect(ListRetainedChildSafetyCasesInputSchema.safeParse({ caseType: 'csam' }).success).toBe(false);
  });

  it('shares its page cap with the retained-evidence inventory', () => {
    const cap = 200;
    expect(ListRetainedChildSafetyCasesInputSchema.safeParse({ pageSize: cap }).success).toBe(true);
    expect(ListRetainedChildSafetyCasesInputSchema.safeParse({ pageSize: cap + 1 }).success).toBe(false);
    expect(ListRetainedEvidenceInventoryInputSchema.safeParse({ pageSize: cap + 1 }).success).toBe(false);
  });

  it('answers each case with its own evidence jobs, a cursor, and the total', () => {
    const row = { case: caseListRow, evidenceJobs: [] };
    expect(RetainedChildSafetyCaseRowSchema.safeParse(row).success).toBe(true);
    expect(
      ListRetainedChildSafetyCasesResultSchema.safeParse({ rows: [row], nextCursor: null, total: 1 }).success,
    ).toBe(true);
    expect(
      ListRetainedChildSafetyCasesResultSchema.safeParse({
        rows: [row],
        nextCursor: { createdAt: 1, id: 'case-1' },
        total: 7,
      }).success,
    ).toBe(true);
    expect(ListRetainedChildSafetyCasesResultSchema.safeParse({ rows: [row], total: 1 }).success).toBe(false);
  });

  it('is exported from the schemas entry point', () => {
    expect(schemasBarrel.ListRetainedChildSafetyCasesInputSchema).toBe(ListRetainedChildSafetyCasesInputSchema);
  });
});

describe('safety console — the one result shape both trees read', () => {
  const page = { total: 0, hasMore: false, nextCursor: null };
  const emptyResult = {
    childSafetyCases: [],
    nciiCases: [],
    takeItDownRequests: [],
    pagination: { childSafety: page, ncii: page, takeItDown: page },
    urgentProjection: [],
    generatedAt: 1,
  };
  const takeItDownRow = {
    requestId: 'req-1',
    requesterRole: 'depictedPerson',
    targetLocatorSummary: { kind: 'url', surfaceLabel: 'External link', hasResolvedTarget: false },
    completenessStatus: 'complete',
    validityStatus: 'pending',
    publicStatus: 'received',
    receivedAt: 1,
    monitors: [],
  };

  it('pages every source and projects the urgent cases', () => {
    expect(GetSafetyCaseConsoleResultSchema.safeParse(emptyResult).success).toBe(true);
    expect(
      GetSafetyCaseConsoleResultSchema.safeParse({
        ...emptyResult,
        childSafetyCases: [{ case: caseListRow, monitors: [], evidenceJobs: [] }],
        takeItDownRequests: [takeItDownRow],
        pagination: { ...emptyResult.pagination, ncii: { total: 3, hasMore: true, nextCursor: { v: 5, id: 'n1' } } },
        urgentProjection: [{ caseId: 'case-1', lane: 'csam', monitors: [] }],
      }).success,
    ).toBe(true);
    const { takeItDown: _missing, ...twoSources } = emptyResult.pagination;
    expect(GetSafetyCaseConsoleResultSchema.safeParse({ ...emptyResult, pagination: twoSources }).success).toBe(false);
  });

  it('keeps a take-it-down row to the request root\'s non-sensitive fields', () => {
    expect(TakeItDownRequestConsoleRowSchema.safeParse(takeItDownRow).success).toBe(true);
    expect(TakeItDownRequestConsoleRowSchema.safeParse({ ...takeItDownRow, contactEmail: 'a@b.c' }).success).toBe(false);
  });

  it('restarts only the two enforcement lanes a failed case can have', () => {
    expect(SafetyCaseFailedJobRefSchema.safeParse({ collection: 'nciiRemovalJobs', docId: 'j1', label: 'Removal' }).success).toBe(true);
    expect(SafetyCaseFailedJobRefSchema.safeParse({ collection: 'mediaAssets', docId: 'j1', label: 'x' }).success).toBe(false);
  });

  it('answers the retained-evidence inventory with rows, a cursor, and the total', () => {
    expect(ListRetainedEvidenceInventoryResultSchema.safeParse({ rows: [], nextCursor: null, total: 0 }).success).toBe(true);
    expect(
      ListRetainedEvidenceInventoryResultSchema.safeParse({ rows: [], nextCursor: { createdAt: 1, id: 'i1' }, total: 4 })
        .success,
    ).toBe(true);
    expect(ListRetainedEvidenceInventoryResultSchema.safeParse({ rows: [], total: 0 }).success).toBe(false);
  });
});

describe('the safety-case lane', () => {
  it('is one declaration every case input takes — a third lane is refused everywhere', () => {
    expect(SafetyCaseLaneSchema.options).toEqual(['csam', 'ncii']);
    expect(schemasBarrel.SafetyCaseLaneSchema).toBe(docSchemasBarrel.SafetyCaseLaneSchema);
    expect(SafetyCaseInputSchema.shape.caseType).toBe(SafetyCaseLaneSchema);
    expect(ReopenSafetyCaseInputSchema.shape.caseType).toBe(SafetyCaseLaneSchema);
    expect(ReopenSafetyCaseInputSchema.safeParse({ caseType: 'dmca', caseId: 'c1', reasonInternal: 'reason' }).success).toBe(false);
    expect(SafetyCaseInputSchema.shape.caseType.safeParse('dmca').success).toBe(false);
  });
});
