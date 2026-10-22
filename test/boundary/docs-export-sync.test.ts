import { describe, it, expect } from 'vitest';
import { docsTree, filesOf, packagesTree, workspacePackages } from './workspace';

function loadExportsByName(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const { manifest } of workspacePackages<{
    name?: string;
    exports?: Record<string, unknown>;
  }>()) {
    if (!manifest.name) continue;
    map.set(manifest.name, new Set<string>(Object.keys(manifest.exports ?? { '.': true })));
  }
  return map;
}

const FULL_SPEC_RE = /@ttt-productions\/([a-z0-9-]+)((?:\/[A-Za-z0-9._-]+)*)/g;
const ENTRY_DECL_RE = /^\s*-\s*`(\.[A-Za-z0-9._/-]*)`/gm;

function staleSpecifiers(
  path: string,
  text: string,
  exportsByName: Map<string, Set<string>>,
): string[] {
  const violations: string[] = [];
  let m: RegExpExecArray | null;
  FULL_SPEC_RE.lastIndex = 0;
  while ((m = FULL_SPEC_RE.exec(text)) !== null) {
    const pkg = `@ttt-productions/${m[1]}`;
    const subpath = m[2] ? `.${m[2]}` : '.';
    const keys = exportsByName.get(pkg);
    if (!keys) continue;
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
    const docs = filesOf(docsTree, ['markdown']);
    const readmes = filesOf(packagesTree, ['markdown']).filter((file) =>
      /^packages\/[^/]+\/README\.md$/.test(file.path),
    );

    for (const file of [...docs, ...readmes]) {
      violations.push(...staleSpecifiers(file.path, file.text, exportsByName));
    }

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
          violations.push(
            `docs/packages/${dir}.md: declared entry "${subpath}" not in ${pkg} exports`,
          );
        }
      }
    }

    expect(violations, `Stale subpath references:\n  ${violations.join('\n  ')}`).toEqual([]);
  });
});

describe('boundary: a package with no root entry', () => {
  const exportsByName = new Map([['@ttt-productions/rootless', new Set(['./react'])]]);

  it('fails a quoted specifier of the root it does not have', () => {
    expect(
      staleSpecifiers('doc.md', "import { X } from '@ttt-productions/rootless';", exportsByName),
    ).toHaveLength(1);
    expect(
      staleSpecifiers('doc.md', 'import { X } from "@ttt-productions/rootless";', exportsByName),
    ).toHaveLength(1);
  });

  it('passes the bare package name in prose and a quoted entry it exports', () => {
    expect(
      staleSpecifiers(
        'doc.md',
        '# @ttt-productions/rootless\n\nReports (`@ttt-productions/rootless`).',
        exportsByName,
      ),
    ).toEqual([]);
    expect(
      staleSpecifiers(
        'doc.md',
        "import { X } from '@ttt-productions/rootless/react';",
        exportsByName,
      ),
    ).toEqual([]);
  });

  it('still fails a subpath the package does not export, quoted or not', () => {
    expect(
      staleSpecifiers('doc.md', 'see `@ttt-productions/rootless/server`', exportsByName),
    ).toHaveLength(1);
  });
});
