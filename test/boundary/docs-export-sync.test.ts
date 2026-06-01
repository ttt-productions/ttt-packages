// Check #3 — Docs/export sync audit.
//
// Fail if any doc under docs/ or a package README.md references a package
// subpath that is not present in that package's package.json `exports`.
// This is what catches a stale `chat-core/schemas` / `./schemas` reference
// after the concept has moved or the subpath has been removed.
//
// Two reference shapes are validated:
//   (A) Full import specifiers `@ttt-productions/<pkg>/<subpath>` in any
//       markdown under docs/ and in package READMEs.
//   (B) Entry-point declarations in docs/packages/<pkg>.md — markdown list
//       items that LEAD with a backtick-quoted dot-path, e.g. "- `./react` — …".
//       (Prose mentions like "the historical `./react` subpath was removed"
//       do not lead with the path and are intentionally not matched.)

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO_ROOT } from './leak-utils';

function listMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...listMarkdown(p));
    else if (entry.endsWith('.md')) out.push(p);
  }
  return out;
}

/** Map @ttt-productions/<name> -> Set of exports keys (".", "./react", …). */
function loadExportsByName(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const pkgsDir = join(REPO_ROOT, 'packages');
  for (const folder of readdirSync(pkgsDir)) {
    const pj = join(pkgsDir, folder, 'package.json');
    if (!existsSync(pj)) continue;
    const json = JSON.parse(readFileSync(pj, 'utf8'));
    if (!json.name) continue;
    const keys = new Set<string>(Object.keys(json.exports ?? { '.': true }));
    map.set(json.name, keys);
  }
  return map;
}

const FULL_SPEC_RE = /@ttt-productions\/([a-z0-9-]+)((?:\/[A-Za-z0-9._-]+)*)/g;
const ENTRY_DECL_RE = /^\s*-\s*`(\.[A-Za-z0-9._/-]*)`/gm;

describe('boundary: docs/export sync audit', () => {
  const exportsByName = loadExportsByName();
  const violations: string[] = [];

  it('every documented package subpath exists in that package exports', () => {
    // (A) Full specifiers across docs/ and package READMEs.
    const pkgsDir = join(REPO_ROOT, 'packages');
    const readmes = readdirSync(pkgsDir)
      .map((folder) => join(pkgsDir, folder, 'README.md'))
      .filter((p) => existsSync(p));
    const mdFiles = [...listMarkdown(join(REPO_ROOT, 'docs')), ...readmes];

    for (const file of mdFiles) {
      const text = readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      FULL_SPEC_RE.lastIndex = 0;
      while ((m = FULL_SPEC_RE.exec(text)) !== null) {
        const pkg = `@ttt-productions/${m[1]}`;
        const subpath = m[2] ? `.${m[2]}` : '.';
        const keys = exportsByName.get(pkg);
        if (!keys) continue; // unknown package — out of scope for this audit
        if (!keys.has(subpath)) {
          violations.push(
            `${relative(REPO_ROOT, file).replace(/\\/g, '/')}: "${pkg}${m[2]}" — subpath "${subpath}" not in ${pkg} exports`,
          );
        }
      }
    }

    // (B) Entry-point declarations in docs/packages/<folder>.md.
    const pkgDocsDir = join(REPO_ROOT, 'docs', 'packages');
    for (const folder of readdirSync(pkgsDir)) {
      const doc = join(pkgDocsDir, `${folder}.md`);
      if (!existsSync(doc)) continue;
      const pkg = `@ttt-productions/${folder}`;
      const keys = exportsByName.get(pkg);
      if (!keys) continue;
      const text = readFileSync(doc, 'utf8');
      let m: RegExpExecArray | null;
      ENTRY_DECL_RE.lastIndex = 0;
      while ((m = ENTRY_DECL_RE.exec(text)) !== null) {
        const subpath = m[1];
        if (!keys.has(subpath)) {
          violations.push(
            `docs/packages/${folder}.md: declared entry "${subpath}" not in ${pkg} exports`,
          );
        }
      }
    }

    expect(violations, `Stale subpath references:\n  ${violations.join('\n  ')}`).toEqual([]);
  });
});
