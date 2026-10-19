// A dependency override exists only while it is needed: while the parent's declared range for the
// child can still resolve to an affected version. Once the parent's range can no longer reach one,
// the override is redundant and is removed; while it can, the override is present and its own range
// admits no affected version.

import semver from 'semver';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding } from '../../guard.js';
import { isText, reviewedProblems, textProblem } from '../../support/facts.js';

export interface DependencyOverride {
  /** The manifest holding the parent-scoped `overrides` entry, repo-relative. */
  manifest: string;
  /** The folder whose `node_modules` holds the installed parent ('' for the repository root). */
  installedUnder: string;
  parent: string;
  child: string;
  /** The child's affected versions, as a semver range. */
  affected: string;
  why: string;
}

export interface DependencyOverrideFacts {
  overrides: readonly DependencyOverride[];
}

/** Why the override is wrong for these ranges, or null when it is exactly as it must be. */
export function overrideProblem(o: Pick<DependencyOverride, 'parent' | 'child' | 'affected'>, parentRange: string | undefined, overrideRange: string | undefined): string | null {
  if (parentRange === undefined) return `${o.parent} no longer declares ${o.child}: remove the override`;
  if (semver.validRange(parentRange) !== null && !semver.intersects(parentRange, o.affected)) {
    return `${o.parent} now declares ${o.child} ${parentRange}, which reaches no affected version: remove the override`;
  }
  if (overrideRange === undefined) return `${o.parent} still declares ${o.child} ${parentRange}, which can reach an affected version, and no override pins it`;
  if (semver.validRange(overrideRange) === null || semver.intersects(overrideRange, o.affected)) {
    return `the override pins ${o.child} to ${overrideRange}, which admits an affected version (${o.affected})`;
  }
  return null;
}

export const dependencyOverrideGuard: GenericGuardDefinition<DependencyOverrideFacts> = {
  id: 'dependencyOverrides',
  absentWhen: 'the app carries no dependency override',
  factProblems(facts) {
    const problems: string[] = [];
    reviewedProblems(facts?.overrides, 'overrides', problems, {
      key: 'parent',
      // One override per manifest: each manifest that installs the parent carries its own copy.
      id: (o) => (isText(o.child) && isText(o.manifest) ? `${o.manifest}: ${o.parent} → ${o.child}` : undefined),
      idNames: 'manifest or child',
      nonEmpty: true,
      extra(o, label) {
        textProblem(o.manifest, `${label}'s manifest`, problems);
        if (typeof o.installedUnder !== 'string') problems.push(`${label}'s installedUnder is missing ('' for the repository root)`);
        if (!isText(o.affected) || semver.validRange(o.affected) === null) problems.push(`${label}'s affected is not a semver range`);
      },
    });
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'every dependency override exists exactly while its parent can still reach an affected version',
        description:
          "An override pins a child dependency under one parent because the parent's own range can resolve to an affected " +
          "version. Once it cannot, the override is redundant and is removed; while it can, the override's range admits no " +
          'affected version.',
        run(context) {
          const findings: Finding[] = [];
          for (const o of facts.overrides) {
            const manifest = JSON.parse(context.file(o.manifest).text) as { overrides?: Record<string, unknown> };
            const parentPath = `${o.installedUnder ? `${o.installedUnder}/` : ''}node_modules/${o.parent}/package.json`;
            if (!context.reader.exists(parentPath)) {
              findings.push({ file: o.manifest, detail: `${o.parent} is not installed under ${o.installedUnder || 'the root'}, so the override cannot be judged` });
              continue;
            }
            const parent = JSON.parse(context.file(parentPath).text) as { dependencies?: Record<string, string> };
            const scoped = manifest.overrides?.[o.parent];
            const pinned = scoped !== null && typeof scoped === 'object' ? (scoped as Record<string, unknown>)[o.child] : undefined;
            const problem = overrideProblem(o, parent.dependencies?.[o.child], typeof pinned === 'string' ? pinned : undefined);
            if (problem) findings.push({ file: o.manifest, detail: problem });
          }
          return findings;
        },
      },
    ];
  },
};
