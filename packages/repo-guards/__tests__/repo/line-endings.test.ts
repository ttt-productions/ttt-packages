import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  crEndingOf,
  crlfWorktreeFiles,
  gitattributesForcesLf,
  lineEndingGuard,
} from '../../src/modules/repo/line-endings.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

const git = (root: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: root, stdio: 'pipe' });

// A real checkout: the guard reads git's own list of tracked files.
async function findingsOf(files: Record<string, string>) {
  repo?.remove();
  repo = tempRepo({ 'src/index.ts': 'export {};\n', ...files });
  git(repo.root, 'init', '--quiet');
  git(repo.root, 'add', '--all');
  const [guard] = lineEndingGuard.build({});
  const reader = createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: 'src', anchor: 'src/index.ts' } },
  });
  const findings = await guard.run(contextOf(reader));
  return findings.map((f) => `${f.file} ${f.detail}`);
}

const LF_ATTRIBUTES = '* text=auto eol=lf\n';

describe('the .gitattributes LF line', () => {
  it('accepts a * line that sets text=auto and eol=lf, in either order and among other lines', () => {
    expect(gitattributesForcesLf('* text=auto eol=lf')).toBe(true);
    expect(gitattributesForcesLf('*.png binary\r\n*   eol=lf   text=auto\n')).toBe(true);
  });

  it('rejects a line that leaves the checkout ending to core.autocrlf, or covers only some files', () => {
    expect(gitattributesForcesLf('* text=auto')).toBe(false);
    expect(gitattributesForcesLf('* text=auto eol=crlf')).toBe(false);
    expect(gitattributesForcesLf('*.ts text=auto eol=lf')).toBe(false);
    expect(gitattributesForcesLf('# * text=auto eol=lf')).toBe(false);
    expect(gitattributesForcesLf('')).toBe(false);
  });
});

describe('reading git ls-files --eol', () => {
  it('names each tracked file whose working-tree copy is CRLF or mixed, paths with spaces included', () => {
    const output = [
      'i/lf    w/crlf  attr/text=auto         \tdocs/a doc.md',
      'i/lf    w/mixed attr/text=auto         \tnotes.md',
      'i/lf    w/lf    attr/text=auto         \tsrc/index.ts',
      'i/-text w/-text attr/                  \timage.png',
      '',
    ].join('\0');
    expect(crlfWorktreeFiles(output)).toEqual([
      { file: 'docs/a doc.md', ending: 'crlf' },
      { file: 'notes.md', ending: 'mixed' },
    ]);
  });
});

describe('reading a file text for CR line endings', () => {
  it('tells all-CRLF from mixed, and counts a lone CR as mixed', () => {
    expect(crEndingOf('one\ntwo\n')).toBeNull();
    expect(crEndingOf('one\r\ntwo\r\n')).toBe('crlf');
    expect(crEndingOf('one\r\ntwo\n')).toBe('mixed');
    expect(crEndingOf('one\rtwo\r\n')).toBe('mixed');
  });
});

describe('every text file is LF', () => {
  it('passes an LF checkout whose .gitattributes forces LF', async () => {
    expect(
      await findingsOf({ '.gitattributes': LF_ATTRIBUTES, 'docs/guide.md': 'one\ntwo\n' }),
    ).toEqual([]);
  });

  it('flags a CRLF and a mixed file anywhere in the checkout, outside every declared root', async () => {
    expect(
      await findingsOf({
        '.gitattributes': LF_ATTRIBUTES,
        'docs/guide.md': 'one\r\ntwo\r\n',
        'firestore.rules': 'one\ntwo\r\n',
      }),
    ).toEqual([
      'docs/guide.md crlf line endings in the working tree',
      'firestore.rules mixed line endings in the working tree',
    ]);
  });

  it('flags a CRLF file a tool just wrote under a declared root, before git tracks it', async () => {
    const findings = await findingsOf({ '.gitattributes': LF_ATTRIBUTES });
    expect(findings).toEqual([]);
    repo?.write('src/new.ts', 'export {};\r\n');
    const [guard] = lineEndingGuard.build({});
    const reader = createRepoReader({
      repoRoot: repo!.root,
      roots: { app: { path: 'src', anchor: 'src/index.ts' } },
    });
    expect((await guard.run(contextOf(reader))).map((f) => `${f.file} ${f.detail}`)).toEqual([
      'src/new.ts crlf line endings in the working tree',
    ]);
  });

  it('flags a missing .gitattributes, and one that does not force LF', async () => {
    expect(await findingsOf({})).toEqual([
      '.gitattributes no `* text=auto eol=lf` line, so a checkout can write CRLF',
    ]);
    expect(await findingsOf({ '.gitattributes': '* text=auto\n' })).toEqual([
      '.gitattributes no `* text=auto eol=lf` line, so a checkout can write CRLF',
    ]);
  });
});
