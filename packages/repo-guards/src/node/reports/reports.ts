// Reports run by hand, never in the gate: what they list is a judgment call, not a boundary.

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
