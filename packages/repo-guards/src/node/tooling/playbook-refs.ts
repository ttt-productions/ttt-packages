import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export interface PlaybookRefsConfig {
  repoRoot: string;
  folders: readonly {
    dir: string;
    refsRoot: string;
    pathPrefixes: readonly string[];
    rootFiles: readonly string[];
    minChecked: number;
  }[];
}

export interface PlaybookMiss {
  file: string;
  line: number;
  token: string;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PLACEHOLDER = /<[A-Z][A-Z0-9_]*>/;

const SIBLING_MD = /^[^\s/\\*?{}<>|[\]()]+\.md$/;
const SIBLING_LINK = /^[^\s/\\*?{}<>|[\]()]+\.[A-Za-z0-9]+$/;

function normalize(token: string): string {
  return token
    .trim()
    .replace(/[.,;:)\]]+$/, '')
    .replace(/#[^\s/]*$/, '')
    .replace(/:\d+(?::\d+|-\d+)?$/, '');
}

function checkFolder(
  repoRoot: string,
  folder: PlaybookRefsConfig['folders'][number],
): { checked: number; misses: PlaybookMiss[] } {
  // No prefix means no prefixed path counts: an empty alternation would match every path that
  // starts with `/`.
  const prefixes = folder.pathPrefixes.map(escapeRe).join('|');
  const pathRef =
    prefixes === '' ? null : new RegExp(`^(?:${prefixes})\\/[^\\s*?{}]+\\.[A-Za-z0-9]+$`);
  const bare = prefixes === '' ? null : new RegExp(`(?:^|\\s)((?:${prefixes})\\/[^\\s)\`,]+)`, 'g');
  const rootFiles = new Set(folder.rootFiles);
  const dir = path.join(repoRoot, folder.dir);
  const refsRoot = path.join(repoRoot, folder.refsRoot);
  const misses: PlaybookMiss[] = [];
  let checked = 0;

  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.md'))) {
    const seen = new Set<string>();
    readFileSync(path.join(dir, name), 'utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (line.includes('<!-- no-check -->')) return;
        const prose = line.replace(/`[^`]*`/g, '');
        const candidates: { token: string; link: boolean }[] = [
          ...[...line.matchAll(/`([^`]+)`/g)].map((m) => ({ token: m[1]!, link: false })),
          ...(bare ? [...line.matchAll(bare)].map((m) => ({ token: m[1]!, link: false })) : []),
          ...[...prose.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => ({ token: m[1]!, link: true })),
        ];
        for (const candidate of candidates) {
          const token = normalize(candidate.token);
          if (/[*?{}]/.test(token) || PLACEHOLDER.test(token)) continue;
          let root: string;
          if (candidate.link) {
            if (!SIBLING_LINK.test(token)) continue;
            root = dir;
          } else if (rootFiles.has(token) || pathRef?.test(token)) root = refsRoot;
          else if (SIBLING_MD.test(token)) root = dir;
          else continue;
          const key = `${root === dir ? 'sibling' : 'root'}:${token}`;
          if (seen.has(key)) continue;
          seen.add(key);
          checked += 1;
          const target = path.join(root, ...token.split('/'));
          if (!existsSync(target) || !statSync(target).isFile()) {
            misses.push({ file: `${folder.dir}/${name}`, line: index + 1, token });
          }
        }
      });
  }
  return { checked, misses };
}

export function checkPlaybookRefs(config: PlaybookRefsConfig): {
  folders: { dir: string; checked: number; minChecked: number }[];
  misses: PlaybookMiss[];
  shortfalls: { dir: string; checked: number; minChecked: number }[];
} {
  if (config.folders.length === 0)
    throw new Error('playbook-refs: no playbook folder is configured.');
  const folders: { dir: string; checked: number; minChecked: number }[] = [];
  const misses: PlaybookMiss[] = [];
  for (const folder of config.folders) {
    if (!Number.isInteger(folder.minChecked) || folder.minChecked < 1) {
      throw new Error(`playbook-refs: ${folder.dir} needs a minChecked of at least 1.`);
    }
    let result;
    try {
      result = checkFolder(config.repoRoot, folder);
    } catch (error) {
      throw new Error(
        `playbook-refs: cannot read the playbook folder ${folder.dir}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    folders.push({ dir: folder.dir, checked: result.checked, minChecked: folder.minChecked });
    misses.push(...result.misses);
  }
  return {
    folders,
    misses,
    shortfalls: folders.filter((folder) => folder.checked < folder.minChecked),
  };
}

export function runPlaybookRefsCli(config: PlaybookRefsConfig): void {
  let result;
  try {
    result = checkPlaybookRefs(config);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  const { folders, misses, shortfalls } = result;
  const checked = folders.reduce((sum, folder) => sum + folder.checked, 0);
  for (const folder of shortfalls) {
    console.error(
      `✖ ${folder.dir}: ${folder.checked} file reference(s) checked, fewer than its floor of ${folder.minChecked}; the scan read too little, or the floor is set above the folder.`,
    );
  }
  if (misses.length > 0) {
    console.error(`✖ ${misses.length} stale playbook path reference(s) (of ${checked} checked):\n`);
    for (const miss of misses) console.error(`  ${miss.file}:${miss.line}  →  ${miss.token}`);
    console.error(
      '\nFix the path, delete the reference, or add `<!-- no-check -->` to the line if it is intentionally hypothetical.',
    );
  }
  if (shortfalls.length > 0 || misses.length > 0) process.exit(1);
  console.log(`✓ All ${checked} playbook file references exist on disk.`);
}
