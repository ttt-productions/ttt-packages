// Schema length literals: a business text or count limit is declared once as a named core constant,
// and every zod bound that enforces it derives from that constant — `.max(MAX_X)`, never `.max(2500)`.
// Only reviewed structural bounds (opaque-id caps, fan-out counts, address lengths, calendar days)
// stay literal, each file's exact set reviewed with its why. A text minimum always derives.

import type { Finding } from '../../guard.js';
import type { GenericGuardDefinition } from '../../config.js';
import type { FileView } from '../../reader/view.js';
import { CORE_CODE, filesIn, reviewedProblems, stringListProblems } from './shared.js';

export interface SchemaLengthLiteralFacts {
  /** The core build folders that hold schemas (repo-relative). */
  schemaFolders: readonly string[];
  /** Each core build module's reviewed literal `.max()` bounds — the exact values — with why. */
  reviewedMaxLiterals: ReadonlyArray<{ file: string; values: readonly number[]; why: string }>;
}

const MAX_LITERAL = /\.max\(\s*(\d[\d_]*)\s*\)/g;
const MIN_LITERAL = /\.min\(\s*(\d[\d_]*)\s*[,)]/g;

const numberOf = (digits: string) => Number(digits.replace(/_/g, ''));

/** Every literal bound of one kind in a file's code, with where it sits. */
export function literalBounds(file: FileView, pattern: RegExp): Array<{ value: number; index: number }> {
  return [...file.code.matchAll(new RegExp(pattern.source, pattern.flags))].map((m) => ({ value: numberOf(m[1]), index: m.index ?? 0 }));
}

export const schemaLengthLiteralGuard: GenericGuardDefinition<SchemaLengthLiteralFacts> = {
  id: 'schemaLengthLiterals',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    stringListProblems(facts?.schemaFolders, 'schemaFolders', problems);
    reviewedProblems(facts?.reviewedMaxLiterals, 'reviewedMaxLiterals', 'file', problems, (entry, label) => {
      const values = entry.values;
      if (!Array.isArray(values) || !values.length || !values.every((v) => Number.isInteger(v) && (v as number) >= 0)) {
        problems.push(`${label} needs its reviewed values, each a whole number`);
      }
    });
    return problems;
  },
  build(facts) {
    const schemaFiles = (files: FileView[], findings: Finding[]) => filesIn(files, facts.schemaFolders, findings);
    return [
      {
        title: 'every core schema bound derives from a named constant outside the reviewed structural bounds',
        description:
          'A business text or count limit is declared once as a named core constant and every zod .max() that enforces ' +
          'it derives from that constant. Only reviewed structural bounds stay literal; each file lists its exact literal ' +
          'values with why. A new literal fails — declare the limit and derive from it, or review it as structural — and ' +
          'a reviewed value no longer present is stale.',
        timeoutMs: 120_000,
        run(context) {
          const findings: Finding[] = [];
          const files = schemaFiles(context.files(CORE_CODE), findings);
          const reviewed = new Map(facts.reviewedMaxLiterals.map((e) => [e.file, e]));
          const seen = new Set<string>();
          for (const file of files) {
            const bounds = literalBounds(file, MAX_LITERAL);
            const remaining = [...(reviewed.get(file.path)?.values ?? [])];
            if (reviewed.has(file.path)) seen.add(file.path);
            for (const bound of bounds) {
              const at = remaining.indexOf(bound.value);
              if (at === -1) findings.push({ file: file.path, line: file.lineOf(bound.index), detail: `.max(${bound.value}) is a literal bound not on the reviewed list` });
              else remaining.splice(at, 1);
            }
            for (const value of remaining) findings.push({ file: file.path, detail: `stale reviewed bound: .max(${value}) is no longer in the file` });
          }
          for (const entry of facts.reviewedMaxLiterals) {
            if (!seen.has(entry.file)) findings.push({ file: entry.file, detail: 'stale reviewed entry: the module is gone or outside the schema folders' });
          }
          return findings;
        },
      },
      {
        title: 'no core schema sets a literal minimum above 1',
        description:
          "A text minimum comes from the field's declaration, never a bare number: a zod .min() above 1 in a core schema " +
          'is a second declaration of the field. Derive it from the named declaration.',
        timeoutMs: 120_000,
        run(context) {
          const findings: Finding[] = [];
          for (const file of schemaFiles(context.files(CORE_CODE), findings)) {
            for (const bound of literalBounds(file, MIN_LITERAL)) {
              if (bound.value > 1) findings.push({ file: file.path, line: file.lineOf(bound.index), detail: `.min(${bound.value}) is a literal minimum` });
            }
          }
          return findings;
        },
      },
    ];
  },
};
