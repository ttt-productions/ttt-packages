import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { REPO_ROOT } from './leak-utils';

// GitHub moves a `-latest` runner label to a new OS image on its own schedule, so every job on one
// silently starts running on an image nobody has verified. Workflows name an explicit image, which
// makes a runner OS change a deliberate edit. This guard reads each `runs-on` value as written, so a
// label supplied through an expression such as a matrix variable is not seen.

const WORKFLOWS_DIR = join(REPO_ROOT, '.github', 'workflows');
const WORKFLOW_FILE = /\.ya?ml$/;
const RUNS_ON = /^(\s*)(['"]?)runs-on\2\s*:(.*)$/;
const LATEST_LABEL = /-latest$/;

const indentOf = (line: string) => line.length - line.trimStart().length;
const stripComment = (line: string) => line.replace(/(^|\s)#.*$/, '');

// Line numbers of every `runs-on` whose value names a runner label ending in `-latest`. The value is
// the rest of the key's line (a scalar or a flow list) plus the block below it: deeper-indented
// lines, or list items at the key's own indent, which YAML allows for a list under a mapping key.
function latestRunsOn(source: string): number[] {
  const lines = source.split(/\r?\n/);
  const offenders: number[] = [];
  lines.forEach((line, index) => {
    const key = RUNS_ON.exec(line);
    if (!key) return;
    const keyIndent = key[1].length;
    const value = [key[3]];
    for (const next of lines.slice(index + 1)) {
      const content = stripComment(next).trim();
      if (content === '') continue;
      const indent = indentOf(next);
      if (indent < keyIndent || (indent === keyIndent && !content.startsWith('-'))) break;
      value.push(next);
    }
    const labels = value.map(stripComment).join(' ').match(/[\w.-]+/g) ?? [];
    if (labels.some((label) => LATEST_LABEL.test(label))) offenders.push(index + 1);
  });
  return offenders;
}

const job = (body: string) => `jobs:\n  build:\n${body}\n    steps:\n      - run: npm ci\n`;
const rel = (file: string) => relative(REPO_ROOT, file).split(sep).join('/');
const workflowFiles = existsSync(WORKFLOWS_DIR)
  ? readdirSync(WORKFLOWS_DIR)
      .filter((name) => WORKFLOW_FILE.test(name))
      .map((name) => join(WORKFLOWS_DIR, name))
  : [];

describe('boundary: CI jobs run on a pinned runner image', () => {
  it('flags a -latest label written inline, quoted, in a flow list, in a block list, or under labels', () => {
    expect(latestRunsOn(job('    runs-on: ubuntu-latest'))).toEqual([3]);
    expect(latestRunsOn(job("    runs-on: 'ubuntu-latest'"))).toEqual([3]);
    expect(latestRunsOn(job('    runs-on: [self-hosted, macos-latest]'))).toEqual([3]);
    expect(latestRunsOn(job('    runs-on:\n      - ubuntu-latest'))).toEqual([3]);
    expect(latestRunsOn(job('    runs-on:\n    - windows-latest'))).toEqual([3]);
    expect(latestRunsOn(job('    runs-on:\n      group: builders\n      labels: ubuntu-latest'))).toEqual([3]);
    expect(latestRunsOn(job('    runs-on: ubuntu-latest').replace(/\n/g, '\r\n'))).toEqual([3]);
  });

  it('passes an explicit image, including one whose line or later steps mention a -latest label', () => {
    expect(latestRunsOn(job('    runs-on: ubuntu-24.04'))).toEqual([]);
    expect(latestRunsOn(job('    runs-on: [self-hosted, ubuntu-24.04]'))).toEqual([]);
    expect(latestRunsOn(job('    runs-on: ubuntu-24.04 # not ubuntu-latest'))).toEqual([]);
    expect(latestRunsOn(job('    # not ubuntu-latest\n    runs-on: ubuntu-24.04'))).toEqual([]);
    expect(latestRunsOn(job('    runs-on: ubuntu-24.04').replace('npm ci', 'echo ubuntu-latest'))).toEqual([]);
  });

  it('scans at least one workflow file', () => {
    expect(workflowFiles.length).toBeGreaterThan(0);
  });

  it('pins every workflow job to an explicit runner image', () => {
    const offenders = workflowFiles.flatMap((file) =>
      latestRunsOn(readFileSync(file, 'utf8')).map((line) => `${rel(file)}:${line}`),
    );
    expect(
      offenders,
      `name an explicit runner image (such as ubuntu-24.04) instead of a -latest label:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});
