// What the backend guards share: a call's dotted callee, and the app root's server zone (the files in
// the app root that run with server privilege).

import ts from 'typescript';
import type { Finding, GuardContext } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';
import { MODULE_LOADS, moduleImports, namesModule } from '../../support/imports.js';
import { namesProblem } from '../../support/facts.js';
import { isUnder } from '../../support/text.js';

/** `a` or `a.b` for a call whose callee is an identifier or one member of one. */
export function calleePath(call: ts.CallExpression): string | undefined {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) return `${callee.expression.text}.${callee.name.text}`;
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// The server zone of the app root.

/**
 * The files in the app root that run with server privilege: those under a declared server folder,
 * and any other that imports a declared server-only module (so a privileged module parked elsewhere
 * in the app root is still read). Everything else in the app root ships to the browser.
 */
export interface ServerZone {
  /** App-root folders that hold only server code, repo-relative. */
  folders: readonly string[];
  /** Module specifiers only server code imports (the Admin SDK, the app's own wrapper of it). */
  serverModules: readonly string[];
}

export function serverZoneProblems(zone: ServerZone | undefined, what: string, problems: string[]): void {
  if (!zone || typeof zone !== 'object') {
    problems.push(`${what} is missing (an app with no server code in its app root declares { folders: [], serverModules: [] })`);
    return;
  }
  namesProblem(zone.folders, `${what}.folders`, problems, { nonEmpty: false });
  namesProblem(zone.serverModules, `${what}.serverModules`, problems, { nonEmpty: false });
}

export function inServerZone(file: FileView, zone: ServerZone): boolean {
  if (zone.folders.some((folder) => isUnder(file.path, folder))) return true;
  return moduleImports(file.sourceFile, MODULE_LOADS).some(({ spec }) => zone.serverModules.some((m) => namesModule(spec, m)));
}

/** Each declared server folder that no longer exists. */
export function staleServerFolders(context: GuardContext, zone: ServerZone): Finding[] {
  return zone.folders
    .filter((folder) => !context.reader.exists(folder))
    .map((folder) => ({ file: folder, detail: 'stale server folder: it no longer exists' }));
}

/**
 * A context whose app-root files are only the server zone's. A guard built on a shape runs through
 * it, so the shape reads the server code of the app root and every file of the other roots.
 */
export function serverZoneContext(context: GuardContext, zone: ServerZone): GuardContext {
  return {
    reader: context.reader,
    file: (relPath) => context.file(relPath),
    files: (scope: Scope) => context.files(scope).filter((file) => file.role !== 'app' || inServerZone(file, zone)),
    rulesFiles: (service) => context.rulesFiles(service),
  };
}
