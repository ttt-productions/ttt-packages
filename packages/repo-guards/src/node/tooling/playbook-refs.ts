// Every concrete repository file a playbook cites must still exist: a dead path sends the next
// audit down a dead end. Glob patterns and lines marked `<!-- no-check -->` are audit inputs, not
// file references, and are skipped. A trailing line anchor (`:12`, `:12:4`, `:4-9`, `#L12`,
// `#L4-L9`) is stripped.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export interface PlaybookRefsConfig {
  repoRoot: string;
  /** The playbooks folder, relative to the repository root. */
  playbooksDir: string;
  /** Top-level folders whose paths count as file references. */
  pathPrefixes: readonly string[];
  /** Root-level files whose bare names count as file references. */
  rootFiles: readonly string[];
}

export interface PlaybookMiss {
  file: string;
  line: number;
  token: string;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function normalize(token: string): string {
  return token
    .trim()
    .replace(/[.,;:)\]]+$/, '')
    .replace(/#L\d+(?:-L?\d+)?$/, '')
    .replace(/:\d+(?::\d+|-\d+)?$/, '');
}

/** Scan every playbook for file references and check each exists. Never throws on a miss. */
export function checkPlaybookRefs(config: PlaybookRefsConfig): {
  checked: number;
  misses: PlaybookMiss[];
} {
  const prefixes = config.pathPrefixes.map(escapeRe).join('|');
  const pathRef = new RegExp(`^(?:${prefixes})\\/[^\\s*?{}]+\\.[A-Za-z0-9]+$`);
  const bare = new RegExp(`(?:^|\\s)((?:${prefixes})\\/[^\\s)\`,]+)`, 'g');
  const rootFiles = new Set(config.rootFiles);
  const dir = path.join(config.repoRoot, config.playbooksDir);
  const misses: PlaybookMiss[] = [];
  let checked = 0;

  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.md'))) {
    const seen = new Set<string>();
    readFileSync(path.join(dir, name), 'utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (line.includes('<!-- no-check -->')) return;
        const candidates = [
          ...[...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]!),
          ...[...line.matchAll(bare)].map((m) => m[1]!),
        ];
        for (const raw of candidates) {
          const token = normalize(raw);
          if (/[*?{}]/.test(token)) continue;
          if (!pathRef.test(token) && !rootFiles.has(token)) continue;
          if (seen.has(token)) continue;
          seen.add(token);
          checked += 1;
          const target = path.join(config.repoRoot, ...token.split('/'));
          if (!existsSync(target) || !statSync(target).isFile()) {
            misses.push({ file: `${config.playbooksDir}/${name}`, line: index + 1, token });
          }
        }
      });
  }
  return { checked, misses };
}

/** Run the check and exit non-zero on a miss. */
export function runPlaybookRefsCli(config: PlaybookRefsConfig): void {
  let result;
  try {
    result = checkPlaybookRefs(config);
  } catch (error) {
    console.error(
      `No playbook folder at ${config.playbooksDir}: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(2);
  }
  const { checked, misses } = result;
  // Zero references checked means the scan read nothing, which would otherwise print as a pass.
  if (checked === 0) {
    console.error('playbook-refs: no concrete file references were checked.');
    process.exit(1);
  }
  if (misses.length > 0) {
    console.error(`✖ ${misses.length} stale playbook path reference(s) (of ${checked} checked):\n`);
    for (const miss of misses) console.error(`  ${miss.file}:${miss.line}  →  ${miss.token}`);
    console.error(
      '\nFix the path, delete the reference, or add `<!-- no-check -->` to the line if it is intentionally hypothetical.',
    );
    process.exit(1);
  }
  console.log(`✓ All ${checked} playbook file references exist on disk.`);
}
