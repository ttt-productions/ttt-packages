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
