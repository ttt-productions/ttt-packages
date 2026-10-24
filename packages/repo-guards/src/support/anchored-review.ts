import type { Finding } from '../guard.js';
import type { FileView } from '../reader/view.js';
import { isText, reviewedProblems } from './facts.js';

export interface AnchoredEntry {
  path: string;
  anchor: string;
  why: string;
}

export interface Occurrence {
  start: number;
  end: number;
  detail: string;
}

export function anchoredProblems(value: unknown, what: string, problems: string[]): void {
  reviewedProblems(value, what, problems, {
    id: (entry) => (isText(entry.anchor) ? `${String(entry.path)} ${entry.anchor}` : undefined),
    idNames: 'anchor (the source text naming the one occurrence it excuses)',
  });
}

// An entry excuses exactly the one occurrence whose source text holds its anchor, so a second
// occurrence in the same file is never covered by it.
export function anchoredFindings(
  hitsByFile: ReadonlyArray<{ file: FileView; hits: readonly Occurrence[] }>,
  reviewed: readonly AnchoredEntry[],
  staleDetail: string,
): Finding[] {
  const findings: Finding[] = [];
  const byPath = new Map<string, AnchoredEntry[]>();
  for (const entry of reviewed) byPath.set(entry.path, [...(byPath.get(entry.path) ?? []), entry]);
  const matched = new Set<AnchoredEntry>();
  for (const { file, hits } of hitsByFile) {
    const entries = byPath.get(file.path) ?? [];
    for (const hit of hits) {
      const text = file.text.slice(hit.start, hit.end);
      const owners = entries.filter((entry) => text.includes(entry.anchor));
      if (owners.length === 1 && !matched.has(owners[0])) {
        matched.add(owners[0]);
        continue;
      }
      const line = file.lineOf(hit.start);
      if (owners.length > 1)
        findings.push({
          file: file.path,
          line,
          detail: `${hit.detail}, and ${owners.length} reviewed anchors match it — make each anchor name one occurrence`,
        });
      else if (owners.length === 1)
        findings.push({
          file: file.path,
          line,
          detail: `${hit.detail}, and its reviewed anchor "${owners[0].anchor}" already excuses another occurrence — make each anchor name one occurrence`,
        });
      else findings.push({ file: file.path, line, detail: hit.detail });
    }
  }
  for (const entry of reviewed)
    if (!matched.has(entry))
      findings.push({
        file: entry.path,
        detail: `stale reviewed entry "${entry.anchor}": ${staleDetail}`,
      });
  return findings;
}
