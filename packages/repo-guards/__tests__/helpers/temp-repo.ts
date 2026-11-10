import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { TestRunner, afterAll, onTestFinished } from 'vitest';

export interface TempRepo {
  root: string;
  write(relPath: string, text?: string): void;
  remove(): void;
}

interface GitTemplate {
  folders: string[];
  files: Array<[string, Buffer]>;
}

let template: GitTemplate | undefined;

// One `git init` per test worker, written into each fixture: a process spawn per fixture costs
// more than the cases it serves.
function gitTemplate(): GitTemplate {
  if (template) return template;
  const dir = mkdtempSync(join(tmpdir(), 'repo-guards-git-'));
  try {
    execFileSync('git', ['init', '--quiet', '--template='], { cwd: dir, stdio: 'pipe' });
    const gitDir = join(dir, '.git');
    const folders: string[] = [];
    const files: Array<[string, Buffer]> = [];
    for (const entry of readdirSync(gitDir, { recursive: true, withFileTypes: true })) {
      const full = join(entry.parentPath, entry.name);
      if (entry.isDirectory()) folders.push(relative(gitDir, full));
      else files.push([relative(gitDir, full), readFileSync(full)]);
    }
    return (template = { folders, files });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const live = new Set<string>();
const removeFolder = (root: string) => {
  rmSync(root, { recursive: true, force: true });
  live.delete(root);
};

// Vitest evaluates this module once per test file, so this hook removes, when the file ends, every
// fixture built outside a test: at module scope, in a describe body, or in a beforeAll.
afterAll(() => {
  for (const root of [...live]) removeFolder(root);
});

// The reader walks only what git does not ignore, so a fixture is a git work tree unless a case
// proves what happens outside one. A fixture built inside a test is removed when that test ends,
// however it ends.
export function tempRepo(
  files: Record<string, string> = {},
  { git = true }: { git?: boolean } = {},
): TempRepo {
  const root = mkdtempSync(join(tmpdir(), 'repo-guards-'));
  live.add(root);
  if (TestRunner.getCurrentTest()) onTestFinished(() => removeFolder(root));
  const write = (relPath: string, text = 'export {};') => {
    mkdirSync(join(root, relPath, '..'), { recursive: true });
    writeFileSync(join(root, relPath), text);
  };
  for (const [relPath, text] of Object.entries(files)) write(relPath, text);
  if (git) {
    const gitDir = join(root, '.git');
    const { folders, files: gitFiles } = gitTemplate();
    for (const folder of folders) mkdirSync(join(gitDir, folder), { recursive: true });
    for (const [relPath, bytes] of gitFiles) writeFileSync(join(gitDir, relPath), bytes);
  }
  return { root, write, remove: () => removeFolder(root) };
}
