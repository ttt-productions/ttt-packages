import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO_ROOT } from './leak-utils';

function listTsx(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...listTsx(path));
    else if (entry.endsWith('.tsx')) files.push(path);
  }
  return files;
}

describe('boundary: canonical audio renderer', () => {
  it('allows a raw audio element only inside AudioViewer', () => {
    const allowed = 'packages/media-viewer/src/react/audio-viewer.tsx';
    const packagesDir = join(REPO_ROOT, 'packages');
    const sourceFiles = readdirSync(packagesDir)
      .flatMap((packageName) => listTsx(join(packagesDir, packageName, 'src')));
    const violations = sourceFiles
      .filter((file) => /<audio(?:\s|>)/i.test(readFileSync(file, 'utf8')))
      .map((file) => relative(REPO_ROOT, file).replace(/\\/g, '/'))
      .filter((file) => file !== allowed);

    expect(
      violations,
      `Raw <audio> elements bypass the canonical AudioViewer:\n  ${violations.join('\n  ')}`,
    ).toEqual([]);
  });
});
