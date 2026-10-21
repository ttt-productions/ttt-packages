// Cross-platform deletion of an app's disposable build and cache output. The targets are a fixed,
// repository-relative list — never arguments, never globs — so this can only ever delete known
// output, and a target that resolves outside the repository stops the command.

import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

export function runCleanup({
  repoRoot,
  targets,
}: {
  repoRoot: string;
  targets: readonly string[];
}): void {
  const root = path.resolve(repoRoot);
  let removed = 0;
  for (const target of targets) {
    const absolute = path.join(root, ...target.split('/'));
    if (!absolute.startsWith(`${root}${path.sep}`)) {
      console.error(`cleanup: refusing to delete outside the repository: ${absolute}`);
      process.exit(1);
    }
    if (existsSync(absolute)) {
      rmSync(absolute, { recursive: true, force: true });
      removed += 1;
    }
  }
  console.log(`cleanup: removed ${removed} path(s); ${targets.length - removed} already absent.`);
}
