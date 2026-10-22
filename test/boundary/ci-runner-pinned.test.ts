import { describe, expect, it } from 'vitest';
import { filesOf, workflowsTree } from './workspace';

const WORKFLOW_FILE = /^\.github\/workflows\/[^/]+\.ya?ml$/;
const RUNS_ON = /^(\s*)(['"]?)runs-on\2\s*:(.*)$/;
const LATEST_LABEL = /-latest$/;

const indentOf = (line: string) => line.length - line.trimStart().length;
const stripComment = (line: string) => line.replace(/(^|\s)#.*$/, '');

// YAML allows a list under a mapping key at the key's own indent, not only deeper.
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
    const labels =
      value
        .map(stripComment)
        .join(' ')
        .match(/[\w.-]+/g) ?? [];
    if (labels.some((label) => LATEST_LABEL.test(label))) offenders.push(index + 1);
  });
  return offenders;
}

const job = (body: string) => `jobs:\n  build:\n${body}\n    steps:\n      - run: npm ci\n`;
const workflowFiles = filesOf(workflowsTree, ['config']).filter((file) =>
  WORKFLOW_FILE.test(file.path),
);

describe('boundary: CI jobs run on a pinned runner image', () => {
  it('flags a -latest label written inline, quoted, in a flow list, in a block list, or under labels', () => {
    expect(latestRunsOn(job('    runs-on: ubuntu-latest'))).toEqual([3]);
    expect(latestRunsOn(job("    runs-on: 'ubuntu-latest'"))).toEqual([3]);
    expect(latestRunsOn(job('    runs-on: [self-hosted, macos-latest]'))).toEqual([3]);
    expect(latestRunsOn(job('    runs-on:\n      - ubuntu-latest'))).toEqual([3]);
    expect(latestRunsOn(job('    runs-on:\n    - windows-latest'))).toEqual([3]);
    expect(
      latestRunsOn(job('    runs-on:\n      group: builders\n      labels: ubuntu-latest')),
    ).toEqual([3]);
    expect(latestRunsOn(job('    runs-on: ubuntu-latest').replace(/\n/g, '\r\n'))).toEqual([3]);
  });

  it('passes an explicit image, including one whose line or later steps mention a -latest label', () => {
    expect(latestRunsOn(job('    runs-on: ubuntu-24.04'))).toEqual([]);
    expect(latestRunsOn(job('    runs-on: [self-hosted, ubuntu-24.04]'))).toEqual([]);
    expect(latestRunsOn(job('    runs-on: ubuntu-24.04 # not ubuntu-latest'))).toEqual([]);
    expect(latestRunsOn(job('    # not ubuntu-latest\n    runs-on: ubuntu-24.04'))).toEqual([]);
    expect(
      latestRunsOn(job('    runs-on: ubuntu-24.04').replace('npm ci', 'echo ubuntu-latest')),
    ).toEqual([]);
  });

  it('scans at least one workflow file', () => {
    expect(workflowFiles.length).toBeGreaterThan(0);
  });

  it('pins every workflow job to an explicit runner image', () => {
    const offenders = workflowFiles.flatMap((file) =>
      latestRunsOn(file.text).map((line) => `${file.path}:${line}`),
    );
    expect(
      offenders,
      `name an explicit runner image (such as ubuntu-24.04) instead of a -latest label:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});
