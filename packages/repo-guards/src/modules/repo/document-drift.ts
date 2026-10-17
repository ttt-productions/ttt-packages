// A document kept word for word identical across sibling repositories: this checkout's copy is
// compared with each sibling's. CI checks out one repository, so a sibling that is not beside this
// checkout shows the comparison SKIPPED with that reason — never passed.

import path from 'node:path';
import type { GenericGuardDefinition } from '../../config.js';
import type { Guard } from '../../guard.js';

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
    if (typeof facts?.file !== 'string' || !facts.file.trim()) problems.push('file names no document');
    if (!Array.isArray(facts?.copies) || !facts.copies.length) problems.push('copies names no sibling checkout');
    else {
      const names = new Set<string>();
      for (const copy of facts.copies) {
        if (!copy?.name?.trim() || !copy?.checkout?.trim()) problems.push('a copy needs its name and its checkout folder');
        else if (names.has(copy.name)) problems.push(`copy ${copy.name} is listed twice`);
        else names.add(copy.name);
      }
    }
    return problems;
  },
  build(facts) {
    return facts.copies.map(
      (copy): Guard => {
        const theirs = (repoRoot: string) => path.resolve(repoRoot, copy.checkout, facts.file);
        return {
          title: `${facts.file} matches ${copy.name}'s copy word for word`,
          description:
            `${facts.file} is one text kept identical in every repository that holds it. Make the same edit in every copy ` +
            'in the same change.',
          skipReason: (reader) =>
            reader.readOutside(theirs(reader.layout.repoRoot)) === null
              ? `${copy.name} is not checked out beside this repository (CI checks out one repository)`
              : null,
          run(context) {
            const ours = context.file(facts.file).text;
            const other = context.reader.readOutside(theirs(context.reader.layout.repoRoot));
            if (other === null) return [{ file: facts.file, detail: `${copy.name}'s copy is gone` }];
            const line = firstDifferingLine(ours, other);
            return line === null ? [] : [{ file: facts.file, line, detail: `differs from ${copy.name}'s copy from this line on` }];
          },
        };
      },
    );
  },
};
