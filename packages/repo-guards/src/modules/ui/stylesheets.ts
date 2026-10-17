// The stylesheets an app actually loads: its one entry stylesheet and everything it imports, in
// cascade order, each with the cascade layer it joins. A class only some unloaded sheet declares
// renders nothing, so the guards that ask "is this defined" or "which rule wins" read this set.

import type { Finding, GuardContext } from '../../guard.js';
import type { FileView } from '../../reader/view.js';
import { parseImport, topLevelStatements } from './css.js';
import { dirnameOf, normalizePath } from '../../support/paths.js';

export interface LoadedSheet {
  file: FileView;
  /** The outermost cascade layer the sheet joins, or null when it is unlayered. */
  layer: string | null;
  /** True for a sheet from an installed package rather than the app's own tree. */
  fromPackage: boolean;
}


/** Reads an installed package's manifest, or null when it is not installed. */
export function installedManifest(context: GuardContext, name: string): Record<string, unknown> | null {
  const manifest = `node_modules/${name}/package.json`;
  if (!context.reader.exists(manifest)) return null;
  return JSON.parse(context.file(manifest).text) as Record<string, unknown>;
}

/** A bare specifier split into its package name and subpath (`@a/b/x.css` → `@a/b`, `./x.css`). */
export function splitBareSpecifier(spec: string): { name: string; subpath: string } {
  const parts = spec.split('/');
  const nameParts = spec.startsWith('@') ? parts.slice(0, 2) : parts.slice(0, 1);
  const rest = parts.slice(nameParts.length).join('/');
  return { name: nameParts.join('/'), subpath: rest ? `./${rest}` : '.' };
}

function pickStyleTarget(entry: unknown): string | null {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    const conditions = entry as Record<string, unknown>;
    for (const key of ['style', 'default']) {
      const found = pickStyleTarget(conditions[key]);
      if (found) return found;
    }
  }
  return null;
}

/** Where a stylesheet `@import` lands, repo-relative, or null when it cannot be resolved. */
export function resolveStylesheetImport(context: GuardContext, fromSheet: string, spec: string): string | null {
  if (spec.startsWith('./') || spec.startsWith('../')) return normalizePath(`${dirnameOf(fromSheet)}/${spec}`).path;
  if (/^[a-z]+:/i.test(spec) || spec.startsWith('/')) return null;
  const { name, subpath } = splitBareSpecifier(spec);
  const manifest = installedManifest(context, name);
  if (!manifest) return null;
  const base = `node_modules/${name}`;
  const exportsField = manifest.exports;
  let target: string | null = null;
  if (exportsField !== undefined) {
    const map = exportsField as Record<string, unknown>;
    const keyed = typeof exportsField === 'object' && exportsField !== null && Object.keys(map).some((k) => k.startsWith('.'));
    if (keyed) target = pickStyleTarget(map[subpath]);
    else if (subpath === '.') target = pickStyleTarget(exportsField);
  } else if (subpath === '.') {
    target = typeof manifest.style === 'string' ? manifest.style : null;
  } else {
    target = subpath;
  }
  return target ? normalizePath(`${base}/${target}`).path : null;
}

/**
 * Every sheet the entry stylesheet loads, in cascade order (an imported sheet's rules sit where it
 * is imported, before the importing sheet's own rules). An import that cannot be resolved is a
 * finding: a sheet the guard cannot read is a sheet it cannot vouch for.
 */
export function loadedStylesheets(context: GuardContext, entry: string): { sheets: LoadedSheet[]; findings: Finding[] } {
  const sheets: LoadedSheet[] = [];
  const findings: Finding[] = [];
  const seen = new Set<string>();
  const visit = (sheetPath: string, layer: string | null) => {
    if (seen.has(sheetPath)) return;
    seen.add(sheetPath);
    const file = context.file(sheetPath);
    for (const statement of topLevelStatements(file.code)) {
      if (!statement.text.startsWith('@import')) continue;
      const parsed = parseImport(statement.text);
      const target = parsed && resolveStylesheetImport(context, sheetPath, parsed.spec);
      if (!parsed || !target || !context.reader.exists(target)) {
        findings.push({ file: sheetPath, line: file.lineOf(statement.index), detail: `cannot resolve the stylesheet import ${statement.text}` });
        continue;
      }
      visit(target, layer ?? (parsed.layer === null ? null : parsed.layer.split('.')[0] || '(anonymous)'));
    }
    sheets.push({ file, layer, fromPackage: sheetPath.startsWith('node_modules/') });
  };
  if (!context.reader.exists(entry)) return { sheets, findings: [{ file: entry, detail: 'the entry stylesheet does not exist' }] };
  visit(entry, null);
  return { sheets, findings };
}
