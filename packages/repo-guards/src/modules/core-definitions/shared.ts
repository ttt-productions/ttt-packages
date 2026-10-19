// What every core-definition guard shares: the installed core build as the reader sees it, the
// top-level declaration a node sits in, and the checks on the facts an app supplies.

import ts from 'typescript';
import type { Finding, GuardContext } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { isUnder } from '../../support/text.js';

/** The installed core build's compiled modules. */
export const CORE_CODE: Scope = { roots: ['coreDist'], kinds: ['code'], tests: false };

/** The installed core build's compiled modules and their type declarations. */
export const CORE_CODE_AND_DECLARATIONS: Scope = {
  roots: ['coreDist'],
  kinds: ['code', 'declarations'],
  tests: false,
};

/** The app's own source, where a restated core definition would live. */
export const APP_SOURCE: Scope = {
  roots: ['app', 'functions'],
  kinds: ['code'],
  tests: false,
  optionalRoots: ['functions'],
};

/**
 * The core build's modules. A guard that checks values the app loads from its core reads the build
 * too, so a run against a layout with no installed core fails instead of passing on nothing.
 */
export function coreBuild(context: GuardContext, findings: Finding[]): FileView[] {
  const files = context.files(CORE_CODE);
  if (!files.length)
    findings.push({
      file: '(core build)',
      detail: 'the installed core build holds no compiled module',
    });
  return files;
}

/** The module a file belongs to: a type declaration counts as the compiled module beside it. */
export function moduleOf(path: string): string {
  return path.replace(/\.d\.([cm]?)ts$/, '.$1js');
}

/** The files of `files` inside one of `folders` (repo-relative), each folder reported when it is empty. */
export function filesIn(
  files: readonly FileView[],
  folders: readonly string[],
  findings: Finding[],
): FileView[] {
  const out: FileView[] = [];
  for (const folder of folders) {
    const inside = files.filter((f) => isUnder(f.path, folder));
    if (!inside.length)
      findings.push({
        file: folder,
        detail:
          'the folder holds no compiled module of the core build (moved, or outside the core build root)',
      });
    out.push(...inside);
  }
  return out;
}

/** The name of the top-level statement a node sits in, or `<module>` when it has none. */
export function topLevelDeclaration(node: ts.Node): string {
  let current: ts.Node = node;
  while (current.parent && !ts.isSourceFile(current.parent)) current = current.parent;
  return declarationNameOf(current);
}

export function declarationNameOf(statement: ts.Node): string {
  if (ts.isVariableStatement(statement)) {
    const names = statement.declarationList.declarations.flatMap((d) =>
      ts.isIdentifier(d.name) ? [d.name.text] : [],
    );
    return names.length ? names.join(', ') : '<module>';
  }
  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)) &&
    statement.name &&
    ts.isIdentifier(statement.name)
  ) {
    return statement.name.text;
  }
  return '<module>';
}

/** A positive whole number, as a reviewed count must be. */
export const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0;
