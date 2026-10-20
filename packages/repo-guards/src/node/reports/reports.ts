// Reports run by hand, never in the gate: what they list is a judgment call, not a boundary.

import fs from 'node:fs';
import { createRepoReader } from '../reader.js';
import type { RepoLayout } from '../layout.js';
import { formatReport as formatWriteGuardReport } from '../../modules/firestore/analyzer.js';
import { runWriteGuard, type WriteGuardFacts } from '../../modules/firestore/guard.js';
import { unusedIndexMembers, type ImportPathFacts } from '../../modules/import-paths/guard.js';
import {
  duplicateExportsReport as runDuplicateExports,
  type DuplicateExportFacts,
} from '../../modules/repo/duplicate-exports.js';
import {
  sharedFakeReport as runSharedFakeReport,
  type SharedFakeFacts,
} from '../../modules/repo/shared-fakes.js';
import {
  slowTestReport as runSlowTestReport,
  type TestTimeoutFacts,
} from '../../modules/repo/test-timeouts.js';

/** Folder index members nothing outside the folder imports — candidates to drop from the index. */
export function unusedIndexMemberReport(layout: RepoLayout, facts: ImportPathFacts): string {
  const report = unusedIndexMembers(createRepoReader(layout), facts);
  if (!report.length)
    return 'unused index members: none — every index member is imported from outside its folder.';
  return [
    'unused index members (report only):',
    ...report.map((r) => `  ${r.file}: ${r.unused.join(', ')}`),
  ].join('\n');
}

/**
 * Modules faked, and helpers declared, in several test files of one tree with no shared owner there —
 * candidates for a shared fake or helper. Never a gate failure.
 */
export function sharedFakeReport(layout: RepoLayout, facts: SharedFakeFacts): string {
  const { modules, helpers } = runSharedFakeReport(createRepoReader(layout), facts);
  if (!modules.length && !helpers.length)
    return 'shared fakes: none — no module or helper is copied across test files without an owner.';
  const lines = ['shared fakes (report only):'];
  if (modules.length) {
    lines.push('  modules faked in several test files with no shared fake:');
    for (const m of modules) lines.push(`    ${m.root}: ${m.module} — ${m.files.length} files`);
  }
  if (helpers.length) {
    lines.push('  helpers declared in several test files with no shared owner:');
    for (const h of helpers) lines.push(`    ${h.root}: ${h.name} — ${h.files.length} files`);
  }
  return lines.join('\n');
}

/**
 * Test cases at or over `thresholdMs` in files that name no timeout budget — the ones a busier
 * machine pushes past the default limit — read from the test runner's JSON results files
 * (`--reporter=json --outputFile=…`, absolute paths). Never a gate failure.
 */
export function slowTestReport(
  layout: RepoLayout,
  facts: TestTimeoutFacts,
  resultFiles: readonly string[],
  thresholdMs = 1000,
): string {
  const results = resultFiles.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
  const slow = runSlowTestReport(createRepoReader(layout), facts, results, thresholdMs);
  if (!slow.length)
    return `slow tests: none — every case at or over ${thresholdMs} ms names a timeout budget.`;
  return [
    `slow tests (report only) — cases at or over ${thresholdMs} ms whose file names no timeout budget:`,
    ...slow.map((c) => `  ${Math.round(c.durationMs)} ms  ${c.file} > ${c.name}`),
  ].join('\n');
}

/**
 * The write guard's full coverage table — writes seen, targets resolved, payloads parsed and
 * verified, exceptions applied, violations — per writer root. `failed` is what the gate would say.
 */
export async function writeGuardCoverageReport(
  layout: RepoLayout,
  facts: WriteGuardFacts,
): Promise<{ text: string; failed: boolean }> {
  const result = await runWriteGuard(createRepoReader(layout), facts);
  return {
    text: formatWriteGuardReport(result),
    failed: result.violations.length > 0 || result.staleExceptions.length > 0,
  };
}

/**
 * Exported names declared in more than one module, outside the reviewed legitimate ones. Whether two
 * exports are one concept is a judgment, so this never fails a gate: each listed name is either
 * consolidated onto its owner or added to the reviewed list with its why.
 */
export function duplicateExportsReport(
  layout: RepoLayout,
  facts: DuplicateExportFacts,
): { text: string; clean: boolean } {
  const { text, result } = runDuplicateExports(createRepoReader(layout), facts);
  const groups = [
    result.appValues,
    result.functionsValues,
    result.appTypes,
    result.functionsTypes,
    result.crossTree,
  ];
  return { text, clean: groups.every((g) => g.length === 0) };
}
