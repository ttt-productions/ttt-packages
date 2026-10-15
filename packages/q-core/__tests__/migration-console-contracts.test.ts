// The migration console's contracts: the action ids every gate and callable names, the callable name
// each executable step is reached by, the page input the console's callables take, and the records
// the console keeps. Each test states the rule the shape carries.

import { describe, it, expect } from 'vitest';
import {
  GAME_SCOPED_STATS_BEACON_ACTION_KEYS,
  MAX_MIGRATION_PAGE_SIZE,
  MAX_MIGRATION_RUN_FINDINGS,
  MAX_REPAIR_REASON_LENGTH,
  MIGRATION_ACTION_IDS,
  MIGRATION_ACTION_ID_KEYS,
  MIGRATION_CUTOVER_MANIFEST,
  STATS_BEACON_ACTION_KEYS,
  TELEMETRY_CONTENT_POLICY,
  migrationActionCallableName,
} from '../src';
import {
  AuditEventSchema,
  MigrationActionRunSchema,
  MigrationConsoleLockSchema,
  MigrationConsoleSchema,
  migrationActionIdSchema,
} from '../src/doc-schemas';
import {
  AdminResolveUnrosteredStatLineInputSchema,
  RecordMigrationCheckpointInputSchema,
  RecordMigrationControlRunInputSchema,
  RunMigrationActionInputSchema,
} from '../src/schemas';

const REASON = 'Rehearse the cutover on a production copy.';
const page = (overrides: Record<string, unknown> = {}) => ({
  operationId: 'op-1',
  reason: REASON,
  dryRun: false,
  pageSize: 100,
  ...overrides,
});

describe('the action ids', () => {
  it('are unique and each one is a manifest step', () => {
    expect(new Set(MIGRATION_ACTION_ID_KEYS).size).toBe(MIGRATION_ACTION_ID_KEYS.length);
    expect(MIGRATION_CUTOVER_MANIFEST.map((step) => step.id).sort()).toEqual([...MIGRATION_ACTION_ID_KEYS].sort());
  });

  it('a wire schema accepts a declared id and refuses any other', () => {
    expect(migrationActionIdSchema.safeParse(MIGRATION_ACTION_IDS.copyUserProfiles).success).toBe(true);
    expect(migrationActionIdSchema.safeParse('copy.everything').success).toBe(false);
  });

  it('name the callable of an executable step as admin, its verb, and its object', () => {
    expect(migrationActionCallableName(MIGRATION_ACTION_IDS.copyUserProfiles)).toBe('adminCopyUserProfiles');
    expect(migrationActionCallableName(MIGRATION_ACTION_IDS.deleteV1LeagueGames)).toBe('adminDeleteV1LeagueGames');
    expect(migrationActionCallableName(MIGRATION_ACTION_IDS.resolveUnrosteredStatLine)).toBe('adminResolveUnrosteredStatLine');
  });

  it('give every executable step a callable name no other step shares', () => {
    const names = MIGRATION_CUTOVER_MANIFEST.flatMap((step) => (step.kind === 'executable' ? [step.callable] : []));
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('RunMigrationActionInputSchema — one page of an action', () => {
  it('takes an operation id, a reason, a preview switch, and a bounded page size', () => {
    expect(RunMigrationActionInputSchema.safeParse(page()).success).toBe(true);
    expect(RunMigrationActionInputSchema.safeParse(page({ expectEmptySource: true })).success).toBe(true);
  });

  it('takes no cursor: the console holds each run\'s resume key itself', () => {
    expect(RunMigrationActionInputSchema.safeParse(page({ resumeAfter: 'doc-9' })).success).toBe(false);
  });

  it('takes no destination state: the console resolves it from its own cutover marker', () => {
    expect(RunMigrationActionInputSchema.safeParse(page({ destinationState: 'preCutover' })).success).toBe(false);
  });

  it('requires a reason with text in it, within the repair-reason bound', () => {
    expect(RunMigrationActionInputSchema.safeParse(page({ reason: '   ' })).success).toBe(false);
    expect(RunMigrationActionInputSchema.safeParse(page({ reason: 'x'.repeat(MAX_REPAIR_REASON_LENGTH + 1) })).success).toBe(false);
  });

  it('refuses a page of nothing and a page past the bound', () => {
    expect(RunMigrationActionInputSchema.safeParse(page({ pageSize: 0 })).success).toBe(false);
    expect(RunMigrationActionInputSchema.safeParse(page({ pageSize: MAX_MIGRATION_PAGE_SIZE + 1 })).success).toBe(false);
  });

  it('refuses an operation id that is not one document id', () => {
    expect(RunMigrationActionInputSchema.safeParse(page({ operationId: 'op/1' })).success).toBe(false);
  });
});

describe('the record inputs', () => {
  it('a control run names its action and its operations, with a reason', () => {
    expect(
      RecordMigrationControlRunInputSchema.safeParse({
        actionId: MIGRATION_ACTION_IDS.rebuildLeagueStats,
        operationIds: ['rebuild-1'],
        reason: REASON,
      }).success,
    ).toBe(true);
  });

  it('a checkpoint carries the operator\'s evidence, never blank', () => {
    const evidence = (value: string) =>
      RecordMigrationCheckpointInputSchema.safeParse({ actionId: MIGRATION_ACTION_IDS.checkpointV1FirestoreExport, evidence: value });
    expect(evidence('projects/q-sports-prod/operations/export-1').success).toBe(true);
    expect(evidence('  ').success).toBe(false);
  });

  it('the line resolution may be previewed', () => {
    const line = { gameId: 'g1', userId: 'u1', teamId: 't1', reason: REASON };
    expect(AdminResolveUnrosteredStatLineInputSchema.safeParse({ ...line, dryRun: true }).success).toBe(true);
    expect(AdminResolveUnrosteredStatLineInputSchema.safeParse(line).success).toBe(true);
  });
});

describe('the console\'s records', () => {
  it('a console before any record holds the migration\'s destinations and no lock', () => {
    expect(MigrationConsoleSchema.safeParse({ destinationState: 'preCutover', lock: null, updatedAt: 0 }).success).toBe(true);
    expect(MigrationConsoleSchema.safeParse({ destinationState: 'paused', lock: null, updatedAt: 0 }).success).toBe(false);
  });

  it('a lock carries the claim token of the page in flight, and a lock stored without one still reads', () => {
    const lock = { actionId: MIGRATION_ACTION_IDS.copyUserProfiles, operationId: 'op-1', heldByUserId: 'uid-admin', expiresAt: 10 };
    expect(MigrationConsoleLockSchema.safeParse(lock).success).toBe(true);
    expect(MigrationConsoleLockSchema.safeParse({ ...lock, pageClaimedAt: 5 }).success).toBe(true);
    expect(MigrationConsoleLockSchema.safeParse({ ...lock, pageClaimedAt: -1 }).success).toBe(false);
    expect(MigrationConsoleLockSchema.safeParse({ ...lock, pageClaimedAt: 1.5 }).success).toBe(false);
    expect(MigrationConsoleSchema.safeParse({ destinationState: 'preCutover', lock: { ...lock, pageClaimedAt: 5 }, updatedAt: 0 }).success).toBe(true);
  });

  it('a run keeps no more findings than its bound', () => {
    const run = {
      operationId: 'op-1',
      dryRun: false,
      reason: REASON,
      startedByUserId: 'uid-admin',
      startedAt: 1,
      updatedAt: 2,
      status: 'running',
      pages: 1,
      nextResumeAfter: 'doc-1',
      counts: { read: 1, written: 1, skipped: 0, checked: 0, missing: 0, mismatched: 0 },
      details: {},
      findings: Array.from({ length: MAX_MIGRATION_RUN_FINDINGS + 1 }, (_, index) => ({
        category: 'skipped',
        id: `doc-${index}`,
        field: '(document)',
        reason: 'fails its V2 schema',
      })),
      findingsNotKept: 0,
      expectEmptySource: false,
    };
    expect(MigrationActionRunSchema.safeParse({ actionId: MIGRATION_ACTION_IDS.copyUserProfiles, run }).success).toBe(false);
    expect(
      MigrationActionRunSchema.safeParse({
        actionId: MIGRATION_ACTION_IDS.copyUserProfiles,
        run: { ...run, findings: run.findings.slice(0, MAX_MIGRATION_RUN_FINDINGS) },
      }).success,
    ).toBe(true);
  });
});

describe('the console\'s audit vocabulary', () => {
  it('an action core records the documents it wrote and removed as its own event, committed with them', () => {
    const event = {
      id: 'a1',
      type: 'migrationAction.writesCommitted',
      schemaVersion: 1,
      actor: { uid: 'uid-admin', isAdmin: true, actorMode: 'adminReview', systemRole: 'admin' },
      target: null,
      timestamp: 1,
      ip: null,
      userAgent: null,
      region: null,
      metadata: {
        actionId: MIGRATION_ACTION_IDS.deleteV1LeagueGames,
        operationId: 'op-1',
        writtenIds: [],
        removedIds: ['g1', 'g2'],
      },
      result: 'success',
      failureReason: null,
      correlationId: null,
    };
    expect(AuditEventSchema.safeParse(event).success).toBe(true);
    expect(AuditEventSchema.safeParse({ ...event, type: 'migrationAction.pageRun' }).success).toBe(true);
  });
});

describe('the subsets declared beside their unions', () => {
  it('the game-scoped beacon actions are beacon actions', () => {
    for (const action of GAME_SCOPED_STATS_BEACON_ACTION_KEYS) expect(STATS_BEACON_ACTION_KEYS).toContain(action);
  });
});

describe('the telemetry content policy', () => {
  it('admits no key that holds a person\'s words or a stored document', () => {
    for (const key of ['message', 'note', 'displayName', 'email', 'data', 'path', 'name', 'teamName']) {
      expect(TELEMETRY_CONTENT_POLICY.diagnosticKeys as readonly string[]).not.toContain(key);
      expect(TELEMETRY_CONTENT_POLICY.diagnosticKeySuffixes.some((suffix) => key.endsWith(suffix) && key !== suffix)).toBe(false);
    }
  });
});
