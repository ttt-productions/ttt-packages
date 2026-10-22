import semver from 'semver';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding } from '../../guard.js';
import { isText, reviewedProblems, textProblem } from '../../support/facts.js';

export interface DependencyOverride {
  manifest: string;
  installedUnder: string;
  parent: string;
  child: string;
  affected: string;
  why: string;
}

export interface DependencyOverrideFacts {
  overrides: readonly DependencyOverride[];
}

export function overrideProblem(
  o: Pick<DependencyOverride, 'parent' | 'child' | 'affected'>,
  parentRange: string | undefined,
  overrideRange: string | undefined,
): string | null {
  if (parentRange === undefined)
    return `${o.parent} no longer declares ${o.child}: remove the override`;
  if (semver.validRange(parentRange) !== null && !semver.intersects(parentRange, o.affected)) {
    return `${o.parent} now declares ${o.child} ${parentRange}, which reaches no affected version: remove the override`;
  }
  if (overrideRange === undefined)
    return `${o.parent} still declares ${o.child} ${parentRange}, which can reach an affected version, and no override pins it`;
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
      id: (o) =>
        isText(o.child) && isText(o.manifest)
          ? `${o.manifest}: ${o.parent} → ${o.child}`
          : undefined,
      idNames: 'manifest or child',
      nonEmpty: true,
      extra(o, label) {
        textProblem(o.manifest, `${label}'s manifest`, problems);
        if (typeof o.installedUnder !== 'string')
          problems.push(`${label}'s installedUnder is missing ('' for the repository root)`);
        if (!isText(o.affected) || semver.validRange(o.affected) === null)
          problems.push(`${label}'s affected is not a semver range`);
      },
    });
    return problems;
  },
  build(facts) {
    return [
      {
        title:
          'every dependency override exists exactly while its parent can still reach an affected version',
        description:
          "An override pins a child dependency under one parent because the parent's own range can resolve to an affected " +
          "version. Once it cannot, the override is redundant and is removed; while it can, the override's range admits no " +
          'affected version.',
        run(context) {
          const findings: Finding[] = [];
          for (const o of facts.overrides) {
            const manifest = JSON.parse(context.file(o.manifest).text) as {
              overrides?: Record<string, unknown>;
            };
            // Read from the committed lockfile, never `node_modules`: a CI job may never install this folder.
            const lockPath = `${o.installedUnder ? `${o.installedUnder}/` : ''}package-lock.json`;
            if (!context.reader.exists(lockPath)) {
              findings.push({
                file: o.manifest,
                detail: `${lockPath} is missing, so the override cannot be judged`,
              });
              continue;
            }
            const lock = JSON.parse(context.file(lockPath).text) as {
              packages?: Record<string, { dependencies?: Record<string, string> } | undefined>;
            };
            const parent = lock.packages?.[`node_modules/${o.parent}`];
            if (!parent) {
              findings.push({
                file: o.manifest,
                detail: `${lockPath} records no installed ${o.parent}, so the override cannot be judged`,
              });
              continue;
            }
            const scoped = manifest.overrides?.[o.parent];
            const pinned =
              scoped !== null && typeof scoped === 'object'
                ? (scoped as Record<string, unknown>)[o.child]
                : undefined;
            const problem = overrideProblem(
              o,
              parent.dependencies?.[o.child],
              typeof pinned === 'string' ? pinned : undefined,
            );
            if (problem) findings.push({ file: o.manifest, detail: problem });
          }
          return findings;
        },
      },
    ];
  },
};
