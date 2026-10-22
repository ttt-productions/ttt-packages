import type { RulesService } from './node/layout.js';
import type { RepoReader, Scope } from './node/reader.js';
import type { FileView } from './reader/view.js';

export interface Finding {
  file: string;
  line?: number;
  detail: string;
}

export interface GuardContext {
  readonly reader: RepoReader;
  files(scope: Scope): FileView[];
  file(relPath: string): FileView;
  rulesFiles(service?: RulesService): FileView[];
}

export type Sample = string | { path: string; text: string };

export interface Guard {
  readonly title: string;
  readonly description: string;
  prepare?(): Promise<void>;
  run(context: GuardContext): Finding[] | Promise<Finding[]>;
  readonly samples?: {
    flags: readonly Sample[];
    passes: readonly Sample[];
    probe(sample: FileView): readonly unknown[];
  };
  readonly timeoutMs?: number;
  skipReason?(reader: RepoReader): string | null;
}

export function formatFindings(
  guard: Pick<Guard, 'title' | 'description'>,
  findings: readonly Finding[],
): string {
  const lines = [`${guard.title}: ${findings.length} finding(s)`, '', guard.description, ''];
  for (const f of findings) lines.push(`  ${f.file}${f.line ? `:${f.line}` : ''} — ${f.detail}`);
  return lines.join('\n');
}
