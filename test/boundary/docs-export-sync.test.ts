// Docs/export sync audit.
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
//
// A package with no root entry is still named in prose by its bare name; that
// names the package, not an entry. Only a quoted specifier of it (an import
// written in a doc) is a reference to a root it does not have.

import { describe, it, expect } from 'vitest';
import { docsTree, filesOf, packagesTree, workspacePackages } from './workspace';

/** Map @ttt-productions/<name> -> Set of exports keys (".", "./react", …). */
function loadExportsByName(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const { manifest } of workspacePackages<{ name?: string; exports?: Record<string, unknown> }>()) {
    if (!manifest.name) continue;
    map.set(manifest.name, new Set<string>(Object.keys(manifest.exports ?? { '.': true })));
  }
  return map;
}

const FULL_SPEC_RE = /@ttt-productions\/([a-z0-9-]+)((?:\/[A-Za-z0-9._-]+)*)/g;
const ENTRY_DECL_RE = /^\s*-\s*`(\.[A-Za-z0-9._/-]*)`/gm;

/** Every full specifier in `text` naming an entry its package does not export. */
function staleSpecifiers(path: string, text: string, exportsByName: Map<string, Set<string>>): string[] {
  const violations: string[] = [];
  let m: RegExpExecArray | null;
  FULL_SPEC_RE.lastIndex = 0;
  while ((m = FULL_SPEC_RE.exec(text)) !== null) {
    const pkg = `@ttt-productions/${m[1]}`;
    const subpath = m[2] ? `.${m[2]}` : '.';
    const keys = exportsByName.get(pkg);
    if (!keys) continue; // unknown package — out of scope for this audit
    if (keys.has(subpath)) continue;
    const quoted = /['"]/.test(text.charAt(m.index - 1));
    if (subpath === '.' && !quoted) continue;
    violations.push(`${path}: "${pkg}${m[2]}" — subpath "${subpath}" not in ${pkg} exports`);
  }
  return violations;
}

describe('boundary: docs/export sync audit', () => {
  const exportsByName = loadExportsByName();
  const violations: string[] = [];

  it('every documented package subpath exists in that package exports', () => {
    // (A) Full specifiers across docs/ and package READMEs.
    const docs = filesOf(docsTree, ['markdown']);
    const readmes = filesOf(packagesTree, ['markdown']).filter((file) => /^packages\/[^/]+\/README\.md$/.test(file.path));

    for (const file of [...docs, ...readmes]) {
      violations.push(...staleSpecifiers(file.path, file.text, exportsByName));
    }

    // (B) Entry-point declarations in docs/packages/<folder>.md.
    const docsByPath = new Map(docs.map((file) => [file.path, file]));
    for (const { dir } of workspacePackages()) {
      const doc = docsByPath.get(`docs/packages/${dir}.md`);
      if (!doc) continue;
      const pkg = `@ttt-productions/${dir}`;
      const keys = exportsByName.get(pkg);
      if (!keys) continue;
      let m: RegExpExecArray | null;
      ENTRY_DECL_RE.lastIndex = 0;
      while ((m = ENTRY_DECL_RE.exec(doc.text)) !== null) {
        const subpath = m[1];
        if (!keys.has(subpath)) {
          violations.push(`docs/packages/${dir}.md: declared entry "${subpath}" not in ${pkg} exports`);
        }
      }
    }

    expect(violations, `Stale subpath references:\n  ${violations.join('\n  ')}`).toEqual([]);
  });
});

describe('boundary: a package with no root entry', () => {
  const exportsByName = new Map([['@ttt-productions/rootless', new Set(['./react'])]]);

  it('fails a quoted specifier of the root it does not have', () => {
    expect(staleSpecifiers('doc.md', "import { X } from '@ttt-productions/rootless';", exportsByName)).toHaveLength(1);
    expect(staleSpecifiers('doc.md', 'import { X } from "@ttt-productions/rootless";', exportsByName)).toHaveLength(1);
  });

  it('passes the bare package name in prose and a quoted entry it exports', () => {
    expect(staleSpecifiers('doc.md', '# @ttt-productions/rootless\n\nReports (`@ttt-productions/rootless`).', exportsByName)).toEqual([]);
    expect(staleSpecifiers('doc.md', "import { X } from '@ttt-productions/rootless/react';", exportsByName)).toEqual([]);
  });

  it('still fails a subpath the package does not export, quoted or not', () => {
    expect(staleSpecifiers('doc.md', 'see `@ttt-productions/rootless/server`', exportsByName)).toHaveLength(1);
  });
});
