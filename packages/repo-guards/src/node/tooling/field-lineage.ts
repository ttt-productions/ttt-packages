import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export interface FieldLineageConfig {
  aliasSets: Readonly<Record<string, readonly string[]>>;
  roots: readonly string[];
  optionalRoots?: readonly string[];
  extraFiles: readonly string[];
  notes?: readonly { terms: readonly string[]; text: string }[];
}

const SKIPPED_FOLDERS = new Set(['node_modules', 'dist', '.next']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs']);

function* walk(dir: string): Generator<string> {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIPPED_FOLDERS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) yield full;
  }
}

export function analyzeFieldLineage(
  config: FieldLineageConfig,
  arg: string,
): {
  terms: readonly string[];
  byFile: Map<string, number>;
  totalHits: number;
  skippedRoots: string[];
} {
  const terms = config.aliasSets[arg] ?? [arg];
  const re = new RegExp(`\\b(${terms.join('|')})\\b`);
  const files: string[] = [];
  const skippedRoots: string[] = [];
  for (const root of config.roots) {
    if (config.optionalRoots?.includes(root) && !existsSync(root)) {
      skippedRoots.push(root);
      continue;
    }
    files.push(...walk(root));
  }
  files.push(...config.extraFiles);

  const byFile = new Map<string, number>();
  let totalHits = 0;
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    let count = 0;
    for (const line of content.split('\n')) if (re.test(line)) count += 1;
    if (count) {
      byFile.set(file, count);
      totalHits += count;
    }
  }
  return { terms, byFile, totalHits, skippedRoots };
}

export function runFieldLineageCli(
  config: FieldLineageConfig,
  argv: readonly string[] = process.argv.slice(2),
): void {
  const arg = argv[0];
  if (!arg) {
    console.error(
      `Usage: node scripts/field-lineage.mjs <concept|field>\nConcepts: ${Object.keys(config.aliasSets).join(', ')}`,
    );
    process.exit(2);
  }
  const { terms, byFile, totalHits, skippedRoots } = analyzeFieldLineage(config, arg);
  console.log(
    `Field lineage: "${arg}" — ${terms.length} alias(es), ${totalHits} references in ${byFile.size} files`,
  );
  console.log(`aliases: ${terms.join(', ')}\n`);
  for (const root of skippedRoots) console.log(`NOT SCANNED (no checkout here): ${root}\n`);
  for (const [file, count] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${String(count).padStart(4)}  ${file}`);
  }
  for (const note of config.notes ?? []) {
    if (note.terms.some((t) => terms.includes(t))) console.log(`\nNote: ${note.text}`);
  }
}
