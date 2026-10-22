import ts from 'typescript';
import type { Finding, GuardContext } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { isUnder } from '../../support/text.js';

export const CORE_CODE: Scope = { roots: ['coreDist'], kinds: ['code'], tests: false };

export const CORE_CODE_AND_DECLARATIONS: Scope = {
  roots: ['coreDist'],
  kinds: ['code', 'declarations'],
  tests: false,
};

export const APP_SOURCE: Scope = {
  roots: ['app', 'functions'],
  kinds: ['code'],
  tests: false,
  optionalRoots: ['functions'],
};

export function coreBuild(context: GuardContext, findings: Finding[]): FileView[] {
  const files = context.files(CORE_CODE);
  if (!files.length)
    findings.push({
      file: '(core build)',
      detail: 'the installed core build holds no compiled module',
    });
  return files;
}

export function moduleOf(path: string): string {
  return path.replace(/\.d\.([cm]?)ts$/, '.$1js');
}

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

export const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0;
