import { describe, expect, it } from 'vitest';
import * as safety from '../src/schemas/safety';

// The safety case console is an endless list a console action must patch in place, never reload
// (FRONTEND-103). Its rows come from Functions-only collections the client cannot read, so every
// console action answers with what it changed: each changed, entering, or leaving row, plus the
// console's per-source totals and complete urgent set after it.

const tidRow = {
  requestId: 'tid1',
  requesterRole: 'depictedPerson' as const,
  targetLocatorSummary: { kind: 'mediaAsset' as const, surfaceLabel: 'Media', hasResolvedTarget: true },
  completenessStatus: 'complete' as const,
  validityStatus: 'valid' as const,
  publicStatus: 'validInProgress' as const,
  removalDeadlineAt: 2_000,
  receivedAt: 1_000,
  monitors: [],
};

const patch = (changes: unknown[]) => ({
  changes,
  totals: { childSafety: 3, ncii: 1, takeItDown: 0 },
  urgentProjection: [],
  generatedAt: 5_000,
});

describe('the console patch an action answers with', () => {
  it('carries a changed row, and a row that left the active console as null', () => {
    const parsed = safety.SafetyCaseConsolePatchSchema.parse(
      patch([
        { source: 'takeItDown', requestId: 'tid1', row: tidRow },
        { source: 'ncii', caseId: 'n1', row: null },
        { source: 'childSafety', caseId: 'c1', row: null },
      ]),
    );
    expect(parsed.changes.map((c) => [c.source, c.row === null])).toEqual([
      ['takeItDown', false],
      ['ncii', true],
      ['childSafety', true],
    ]);
  });

  it('carries the total of every source, so the console never derives a count from its pages', () => {
    const { totals: _omitted, ...withoutTotals } = patch([]);
    expect(safety.SafetyCaseConsolePatchSchema.safeParse(withoutTotals).success).toBe(false);
    expect(
      safety.SafetyCaseConsolePatchSchema.safeParse({ ...patch([]), totals: { childSafety: 1, ncii: 1 } }).success,
    ).toBe(false);
  });

  it('names a row by the id its source keys it by', () => {
    expect(safety.SafetyCaseConsoleRowChangeSchema.safeParse({ source: 'takeItDown', caseId: 'tid1', row: null }).success).toBe(false);
    expect(safety.SafetyCaseConsoleRowChangeSchema.safeParse({ source: 'ncii', requestId: 'n1', row: null }).success).toBe(false);
  });

  it('the console read and the patch share one urgent-entry shape', () => {
    const entry = { caseId: 'c1', lane: 'csam' as const, monitors: [] };
    expect(safety.SafetyCaseConsoleUrgentEntrySchema.parse(entry)).toEqual(entry);
    expect(safety.GetSafetyCaseConsoleResultSchema.shape.urgentProjection.element).toBe(safety.SafetyCaseConsoleUrgentEntrySchema);
  });
});

describe('every console action answers with its console patch', () => {
  const console = patch([]);

  it('the six console actions each require the patch', () => {
    const answers: [{ safeParse: (v: unknown) => { success: boolean } }, Record<string, unknown>][] = [
      [safety.DecideTakeItDownValidityResultSchema, { success: true, result: 'valid', alreadyDecided: false }],
      [safety.SetNciiMinorAssessmentResultSchema, { ok: true, caseId: 'n1', from: 'unknown', to: 'adult', servingDenied: false }],
      [safety.RefetchProtectedCaseContextResultSchema, { resolved: false, reason: 'no-epoch' }],
      [safety.MarkNcmecPortalCompleteResultSchema, { success: true, state: 'completed', alreadyCompleted: false }],
      [safety.ReopenSafetyCaseResultSchema, { success: true, reopened: true }],
      [safety.AdminReplayDeadLetterResultSchema, { collection: 'nciiRemovalJobs', docId: 'job1', replayed: true, resetTo: 'pending' }],
    ];
    for (const [schema, answer] of answers) {
      expect(schema.safeParse({ ...answer, console }).success).toBe(true);
      expect(schema.safeParse(answer).success).toBe(false);
    }
  });

  it('a replay carries the patch only when it replayed a safety lane', () => {
    const replay = safety.AdminReplayDeadLetterResultSchema;
    expect(replay.safeParse({ collection: 'quarantineSagaJobs', docId: 'j', replayed: true, resetTo: 'active', console }).success).toBe(true);
    expect(replay.safeParse({ collection: 'chatSyncEvents', docId: 'e', replayed: true, resetTo: 'pending' }).success).toBe(true);
    expect(replay.safeParse({ collection: 'chatSyncEvents', docId: 'e', replayed: true, console }).success).toBe(false);
    expect(replay.safeParse({ collection: 'nciiRemovalJobs', docId: 'j', dryRun: true, wouldResetTo: 'pending' }).success).toBe(true);
    expect(
      replay.safeParse({ collection: 'hallSubItemEdgeSync', hallItemId: 'h', workProjectType: 'Tales', subItemId: 's', replayed: true }).success,
    ).toBe(true);
  });
});
