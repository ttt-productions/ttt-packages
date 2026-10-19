// A document kept word for word identical across sibling repositories: this checkout's copy is
// compared with each sibling's. CI checks out one repository, so a sibling checkout that is not beside
// this one shows the comparison SKIPPED with that reason — never passed. A sibling checkout that is
// there but has lost its copy fails: that is drift, not an absent repository.

import path from 'node:path';
import type { GenericGuardDefinition } from '../../suite/config.js';
import type { Guard } from '../../guard.js';
import { isText, pathProblem, textProblem } from '../../support/facts.js';

export interface DocumentDriftFacts {
  /** The shared document, repo-relative (the same path in every copy). */
  file: string;
  /** The sibling checkouts holding the other copies, each a folder relative to this repository's root. */
  copies: ReadonlyArray<{ name: string; checkout: string }>;
}

/** The first line on which two texts differ, 1-based, or null when they are identical. */
export function firstDifferingLine(ours: string, theirs: string): number | null {
  if (ours === theirs) return null;
  const a = ours.split('\n');
  const b = theirs.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) if (a[i] !== b[i]) return i + 1;
  return null;
}

export const documentDriftGuard: GenericGuardDefinition<DocumentDriftFacts> = {
  id: 'documentDrift',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    pathProblem(facts?.file, 'file', problems);
    if (!Array.isArray(facts?.copies) || !facts.copies.length) problems.push(Array.isArray(facts?.copies) ? 'copies is empty' : 'copies is missing');
    else {
      const names = new Set<string>();
      for (const copy of facts.copies) {
        if (!isText(copy?.name)) problems.push('an entry of copies names no name');
        else if (names.has(copy.name)) problems.push(`copies lists ${copy.name} twice`);
        else names.add(copy.name);
        if (isText(copy?.name)) textProblem(copy.checkout, `copies entry ${copy.name}'s checkout`, problems);
      }
    }
    return problems;
  },
  build(facts) {
    return facts.copies.map(
      (copy): Guard => {
        const checkout = (repoRoot: string) => path.resolve(repoRoot, copy.checkout);
        const theirs = (repoRoot: string) => path.resolve(checkout(repoRoot), facts.file);
        return {
          title: `${facts.file} matches ${copy.name}'s copy word for word`,
          description:
            `${facts.file} is one text kept identical in every repository that holds it. Make the same edit in every copy ` +
            'in the same change.',
          skipReason: (reader) =>
            reader.existsOutside(checkout(reader.layout.repoRoot))
              ? null
              : `${copy.name} is not checked out beside this repository (CI checks out one repository)`,
          run(context) {
            const ours = context.file(facts.file).text;
            const other = context.reader.readOutside(theirs(context.reader.layout.repoRoot));
            if (other === null) return [{ file: facts.file, detail: `${copy.name} is checked out here but holds no copy of ${facts.file}` }];
            const line = firstDifferingLine(ours, other);
            return line === null ? [] : [{ file: facts.file, line, detail: `differs from ${copy.name}'s copy from this line on` }];
          },
        };
      },
    );
  },
};
