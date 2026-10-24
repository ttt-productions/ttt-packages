import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding } from '../../guard.js';
import { FILE_KINDS, ROOT_ROLES, type RootRole } from '../../node/layout.js';
import type { Scope } from '../../node/reader.js';
import { takesNoFacts } from '../../support/facts.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';

const GITATTRIBUTES = '.gitattributes';
const LS_FILES_MAX_BUFFER = 256 * 1024 * 1024;

// A `*` line that turns text detection on and pins its checkout ending to LF.
export function gitattributesForcesLf(text: string): boolean {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .some(
      ([pattern, ...attributes]) =>
        pattern === '*' && attributes.includes('text=auto') && attributes.includes('eol=lf'),
    );
}

// Built output is never authored, so its endings are its compiler's.
const AUTHORED_ROOTS: readonly RootRole[] = ROOT_ROLES.filter((role) => role !== 'coreDist');

// Every authored file the reader reads, new and untracked ones included.
export const LINE_ENDINGS_SCOPE: Scope = {
  roots: AUTHORED_ROOTS,
  kinds: FILE_KINDS,
  tests: true,
  optionalRoots: AUTHORED_ROOTS.filter((role) => role !== 'app'),
};

export function crEndingOf(text: string): 'crlf' | 'mixed' | null {
  const crs = text.split('\r').length - 1;
  if (!crs) return null;
  const crlfs = text.split('\r\n').length - 1;
  const lfs = text.split('\n').length - 1;
  return crs === crlfs && crlfs === lfs ? 'crlf' : 'mixed';
}

// Reads `git ls-files --eol -z`: each entry is `i/<index> w/<worktree> attr/<attrs>\t<path>`.
export function crlfWorktreeFiles(lsFilesOutput: string): Array<{ file: string; ending: string }> {
  const out: Array<{ file: string; ending: string }> = [];
  for (const entry of lsFilesOutput.split('\0')) {
    const tab = entry.indexOf('\t');
    if (tab < 0) continue;
    const worktree = entry
      .slice(0, tab)
      .split(/\s+/)
      .find((field) => field.startsWith('w/'));
    if (worktree === 'w/crlf' || worktree === 'w/mixed')
      out.push({ file: entry.slice(tab + 1), ending: worktree.slice(2) });
  }
  return out;
}

export const LINE_ENDINGS_TITLE = 'every text file is LF';
export const LINE_ENDINGS_DESCRIPTION =
  'Git writes and stores every text file with LF: `.gitattributes` carries `* text=auto eol=lf`, so a checkout writes LF ' +
  'whatever core.autocrlf says, and no text file in the working tree holds a CR line ending — neither a tracked one ' +
  '(`git ls-files --eol` reports it w/crlf or w/mixed) nor any file the guard reader reads under a declared root, ' +
  'untracked ones included. Convert the file to LF; the editor or script that wrote it writes CRLF and is the source to fix.';

export type LineEndingFacts = Readonly<Record<string, never>>;

export const lineEndingGuard: GenericGuardDefinition<LineEndingFacts> = {
  id: 'lineEndings',
  absentWhen: false,
  factProblems: takesNoFacts,
  build() {
    return [
      {
        title: LINE_ENDINGS_TITLE,
        description: LINE_ENDINGS_DESCRIPTION,
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          const { repoRoot } = context.reader.layout;
          const findings: Finding[] = [];
          const attributes = context.reader.readOutside(path.join(repoRoot, GITATTRIBUTES));
          if (attributes === null || !gitattributesForcesLf(attributes))
            findings.push({
              file: GITATTRIBUTES,
              detail: 'no `* text=auto eol=lf` line, so a checkout can write CRLF',
            });
          const listed = execFileSync('git', ['ls-files', '--eol', '-z'], {
            cwd: repoRoot,
            encoding: 'utf8',
            maxBuffer: LS_FILES_MAX_BUFFER,
            shell: false,
          });
          const endings = new Map<string, string>();
          for (const { file, ending } of crlfWorktreeFiles(listed)) endings.set(file, ending);
          for (const file of context.files(LINE_ENDINGS_SCOPE)) {
            const ending = crEndingOf(file.text);
            if (ending && !endings.has(file.path)) endings.set(file.path, ending);
          }
          const sorted = [...endings].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
          for (const [file, ending] of sorted)
            findings.push({ file, detail: `${ending} line endings in the working tree` });
          return findings;
        },
      },
    ];
  },
};
