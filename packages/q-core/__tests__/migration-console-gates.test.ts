import { describe, expect, it } from 'vitest';
import type {
  MigrationActionRun,
  MigrationConsole,
  MigrationRunRecord,
} from '../src/doc-schemas/migration-console.js';
import { MIGRATION_ACTION_IDS as A } from '../src/migration-console/action-ids.js';
import type { MigrationActionId } from '../src/migration-console/action-ids.js';
import {
  currentLock,
  lockedByAnother,
  pageInFlight,
} from '../src/migration-console/console-lock.js';
import { sourceConsumedBy } from '../src/migration-console/consumed-source.js';
import {
  MIGRATION_CUTOVER_MANIFEST,
  MIGRATION_STEP_BY_ID,
  migrationStepsOfKind,
} from '../src/migration-console/manifest.js';
import type { ExecutableMigrationStep } from '../src/migration-console/manifest.js';
import {
  MAX_MIGRATION_PAGE_SIZE,
  MIGRATION_COMMIT_WRITE_LIMIT,
} from '../src/migration-console/run-state.js';
import { migrationPageSizeSchema } from '../src/schemas/migration-console.js';

const NOW = 1_800_000_000_000;

const consoleWith = (lock: MigrationConsole['lock']): MigrationConsole => ({
  destinationState: 'preCutover',
  lock,
  updatedAt: NOW,
});

const lock = (
  overrides: Partial<NonNullable<MigrationConsole['lock']>> = {},
): NonNullable<MigrationConsole['lock']> => ({
  actionId: A.copySportGames,
  operationId: 'op-1',
  heldByUserId: 'admin-1',
  expiresAt: NOW + 1,
  ...overrides,
});

describe('the console lock', () => {
  it('is current until the moment its lease expires', () => {
    expect(currentLock(consoleWith(lock()), NOW)).toEqual(lock());
    expect(currentLock(consoleWith(lock({ expiresAt: NOW })), NOW)).toBeNull();
    expect(currentLock(consoleWith(null), NOW)).toBeNull();
  });

  it('holds off another action and another run of the same action, never the run holding it', () => {
    const state = consoleWith(lock());
    expect(lockedByAnother(state, { actionId: A.copySportGames, operationId: 'op-1' }, NOW)).toBe(
      false,
    );
    expect(lockedByAnother(state, { actionId: A.copySportGames, operationId: 'op-2' }, NOW)).toBe(
      true,
    );
    expect(lockedByAnother(state, { actionId: A.copySportLeagues, operationId: 'op-1' }, NOW)).toBe(
      true,
    );
  });

  it('holds off a caller holding no run yet, and nobody once it expires', () => {
    expect(
      lockedByAnother(consoleWith(lock()), { actionId: A.copySportGames, operationId: null }, NOW),
    ).toBe(true);
    expect(
      lockedByAnother(
        consoleWith(lock({ expiresAt: NOW })),
        { actionId: A.copySportLeagues, operationId: null },
        NOW,
      ),
    ).toBe(false);
  });

  it('has a page in flight only while a current lock carries its claim', () => {
    expect(pageInFlight(consoleWith(lock({ pageClaimedAt: NOW - 5 })), NOW)).toBe(true);
    expect(pageInFlight(consoleWith(lock()), NOW)).toBe(false);
    expect(pageInFlight(consoleWith(lock({ pageClaimedAt: NOW - 5, expiresAt: NOW })), NOW)).toBe(
      false,
    );
  });
});

const executables = migrationStepsOfKind('executable');
const executable = (id: MigrationActionId): ExecutableMigrationStep => {
  const step = MIGRATION_STEP_BY_ID.get(id);
  if (step?.kind !== 'executable') throw new Error(`${id} is not an executable step.`);
  return step;
};

describe("each action's page ceiling", () => {
  it('fits every default page inside a ceiling no larger than the wire bound', () => {
    for (const step of executables) {
      expect(step.maxPageSize, step.id).toBeLessThanOrEqual(MAX_MIGRATION_PAGE_SIZE);
      expect(step.defaultPageSize, step.id).toBeGreaterThanOrEqual(1);
      expect(step.defaultPageSize, step.id).toBeLessThanOrEqual(step.maxPageSize);
    }
  });

  it('keeps the ceilings each action core holds today', () => {
    expect(executable(A.copySportGames).maxPageSize).toBe(25);
    expect(executable(A.verifyGameStats).maxPageSize).toBe(25);
    expect(executable(A.copyWaiverTemplates).maxPageSize).toBe(200);
    expect(executable(A.copyUserProfiles).maxPageSize).toBe(
      Math.floor(MIGRATION_COMMIT_WRITE_LIMIT / 2),
    );
    expect(executable(A.copySportLeagues).maxPageSize).toBe(MIGRATION_COMMIT_WRITE_LIMIT);
    expect(executable(A.verifySportGames).maxPageSize).toBe(MAX_MIGRATION_PAGE_SIZE);
  });

  it('accepts 1 to the chosen action’s ceiling and refuses one more', () => {
    for (const step of executables) {
      const schema = migrationPageSizeSchema(step);
      expect(schema.safeParse(1).success, step.id).toBe(true);
      expect(schema.safeParse(step.maxPageSize).success, step.id).toBe(true);
      expect(schema.safeParse(step.maxPageSize + 1).success, step.id).toBe(false);
      expect(schema.safeParse(0).success, step.id).toBe(false);
    }
  });
});

const run = (dryRun: boolean): MigrationRunRecord => ({
  operationId: 'op-1',
  dryRun,
  reason: 'Rehearse the cutover.',
  startedByUserId: 'admin-1',
  startedAt: NOW,
  updatedAt: NOW,
  status: 'complete',
  pages: 1,
  nextResumeAfter: null,
  counts: { read: 0, written: 0, skipped: 0, checked: 0, missing: 0, mismatched: 0 },
  details: {},
  findings: [],
  findingsNotKept: 0,
  expectEmptySource: false,
});

const runsOf = (
  ...records: MigrationActionRun[]
): ReadonlyMap<MigrationActionId, MigrationActionRun> =>
  new Map(records.map((record) => [record.actionId, record]));

describe('the consumed-source fence', () => {
  it('names the copies and verifications of the V1 source each delete removes', () => {
    for (const step of executables) {
      if (!step.destructive) {
        expect(step.consumes, step.id).toEqual([]);
        continue;
      }
      for (const consumer of step.consumes) {
        const consumed = executable(consumer);
        expect(consumed.destructive, `${step.id} → ${consumer}`).toBe(false);
      }
    }
    expect(executable(A.deleteV1AdminRoles).consumes).toEqual([A.copyAdminList, A.verifyAdminList]);
    expect(executable(A.deleteV1Users).consumes).toContain(A.migratePublicUsers);
    expect(executable(A.deleteV1GameRosters).consumes).toContain(A.copySportGames);
  });

  it('fences a copy once any real run of a delete that removes its source exists', () => {
    expect(sourceConsumedBy(A.copyAdminList, runsOf())).toEqual([]);
    const deleted = runsOf({ actionId: A.deleteV1AdminRoles, run: run(false) });
    expect(sourceConsumedBy(A.copyAdminList, deleted)).toEqual([A.deleteV1AdminRoles]);
    expect(sourceConsumedBy(A.verifyAdminList, deleted)).toEqual([A.deleteV1AdminRoles]);
    expect(sourceConsumedBy(A.copyAppConfig, deleted)).toEqual([]);
  });

  it('stays fenced after a later real run of the delete that wrote nothing', () => {
    const rerun = { ...run(false), operationId: 'op-2' };
    expect(
      sourceConsumedBy(A.migratePublicUsers, runsOf({ actionId: A.deleteV1Users, run: rerun })),
    ).toEqual([A.deleteV1Users]);
  });

  it('is not moved by a preview', () => {
    expect(
      sourceConsumedBy(
        A.copySportGames,
        runsOf({ actionId: A.deleteV1GameRosters, preview: run(true) }),
      ),
    ).toEqual([]);
  });

  it('fences a copy whose source several deletes remove once any of them ran', () => {
    expect(
      sourceConsumedBy(
        A.carryV1Pictures,
        runsOf({ actionId: A.deleteV1GameLocations, run: run(false) }),
      ),
    ).toEqual([A.deleteV1GameLocations]);
  });
});

describe('the pre-copy V1 data checks', () => {
  const CHECKS = [
    A.verifyV1DisplayNamesUnique,
    A.verifyV1TextFitsLimits,
    A.verifyV1LeagueCapacity,
    A.verifyV1HardwareContractIdsUnique,
  ] as const;

  it('are read-only verifications that gate what they cover', () => {
    for (const id of CHECKS) {
      const step = executable(id);
      expect(step.resultKind).toBe('verification');
      expect(step.destructive).toBe(false);
      expect(step.informational).toBe(false);
    }
  });

  it('run before every copy they cover, which waits on them', () => {
    const dependsOn = (id: MigrationActionId) => MIGRATION_STEP_BY_ID.get(id)?.dependsOn ?? [];
    expect(dependsOn(A.copyUserProfiles)).toContain(A.verifyV1DisplayNamesUnique);
    expect(dependsOn(A.deriveReservedDisplayNames)).toContain(A.verifyV1DisplayNamesUnique);
    for (const copy of [
      A.copyAppConfig,
      A.copyLandingPageConfig,
      A.copyAwardDefinitions,
      A.copySportLeagues,
      A.copyLeagueTeams,
      A.copyGameLocations,
      A.copyWaiverTemplates,
      A.copyUserProfiles,
    ]) {
      expect(dependsOn(copy), copy).toContain(A.verifyV1TextFitsLimits);
    }
    for (const copy of [A.copySportLeagues, A.copyLeagueTeams, A.copySportGames]) {
      expect(dependsOn(copy), copy).toContain(A.verifyV1LeagueCapacity);
    }
    expect(dependsOn(A.copyHardwareLoanContracts)).toContain(A.verifyV1HardwareContractIdsUnique);
  });

  it('come before the copies in the manifest, so the screen lists them first', () => {
    const position = (id: MigrationActionId) =>
      MIGRATION_CUTOVER_MANIFEST.findIndex((step) => step.id === id);
    const firstCopy = Math.min(
      ...executables.filter((step) => step.id.startsWith('copy.')).map((step) => position(step.id)),
    );
    for (const id of CHECKS) expect(position(id)).toBeLessThan(firstCopy);
  });
});
