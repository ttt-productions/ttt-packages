import ts from 'typescript';
import type { Finding, GuardContext } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { MODULE_LOADS, moduleImports, namesModule } from '../../support/imports.js';
import { namesProblem } from '../../support/facts.js';
import { isUnder } from '../../support/text.js';

export function calleePath(call: ts.CallExpression): string | undefined {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression))
    return `${callee.expression.text}.${callee.name.text}`;
  return undefined;
}

export interface ServerZone {
  folders: readonly string[];
  serverModules: readonly string[];
}

export function serverZoneProblems(
  zone: ServerZone | undefined,
  what: string,
  problems: string[],
): void {
  if (!zone || typeof zone !== 'object') {
    problems.push(
      `${what} is missing (an app with no server code in its app root declares { folders: [], serverModules: [] })`,
    );
    return;
  }
  namesProblem(zone.folders, `${what}.folders`, problems, { nonEmpty: false });
  namesProblem(zone.serverModules, `${what}.serverModules`, problems, { nonEmpty: false });
}

export function inServerZone(file: FileView, zone: ServerZone): boolean {
  if (zone.folders.some((folder) => isUnder(file.path, folder))) return true;
  return moduleImports(file.sourceFile, MODULE_LOADS).some(({ spec }) =>
    zone.serverModules.some((m) => namesModule(spec, m)),
  );
}

export function staleServerFolders(context: GuardContext, zone: ServerZone): Finding[] {
  return zone.folders
    .filter((folder) => !context.reader.exists(folder))
    .map((folder) => ({ file: folder, detail: 'stale server folder: it no longer exists' }));
}

export function serverZoneContext(context: GuardContext, zone: ServerZone): GuardContext {
  return {
    reader: context.reader,
    file: (relPath) => context.file(relPath),
    files: (scope: Scope) =>
      context.files(scope).filter((file) => file.role !== 'app' || inServerZone(file, zone)),
    rulesFiles: (service) => context.rulesFiles(service),
  };
}
