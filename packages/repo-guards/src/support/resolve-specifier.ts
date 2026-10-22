import { kindOfFile } from '../node/layout.js';
import type { RepoReader } from '../node/reader.js';
import { normalizePath, resolveRelative } from './paths.js';

const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
// A specifier names a TypeScript file by its built extension: `./x.js` names `x.ts`.
const BUILT_TO_SOURCE: Readonly<Record<string, readonly string[]>> = {
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};

const nameOf = (p: string) => p.slice(p.lastIndexOf('/') + 1);
const extensionOf = (p: string) => {
  const name = nameOf(p);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot);
};

export const isLocalModule = (path: string): boolean => CODE_EXTENSIONS.includes(extensionOf(path));

// Longest prefix first, so `@/a/` wins over `@/`.
export const aliasList = (
  importAliases: Readonly<Record<string, string>>,
): Array<[string, string]> =>
  Object.entries(importAliases).sort((a, b) => b[0].length - a[0].length);

export function resolveSpecifier(
  reader: RepoReader,
  fromPath: string,
  spec: string,
  aliases: ReadonlyArray<[string, string]>,
): string {
  let base: string | null = null;
  for (const [prefix, folder] of aliases) {
    if (spec === prefix.replace(/\/$/, '') || spec.startsWith(prefix)) {
      base = normalizePath(`${folder}/${spec.slice(prefix.length)}`).path;
      break;
    }
  }
  base ??= resolveRelative(fromPath, spec)?.path ?? null;
  if (base === null) return spec;
  const candidates = [base];
  const ext = extensionOf(base);
  for (const source of BUILT_TO_SOURCE[ext] ?? [])
    candidates.push(base.slice(0, -ext.length) + source);
  for (const e of CODE_EXTENSIONS) candidates.push(base + e);
  for (const e of CODE_EXTENSIONS) candidates.push(`${base}/index${e}`);
  return candidates.find((c) => kindOfFile(nameOf(c)) === 'code' && reader.exists(c)) ?? base;
}
