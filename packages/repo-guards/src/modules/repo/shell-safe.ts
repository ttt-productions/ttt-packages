import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import { viewOfText, type FileView } from '../../reader/view.js';
import { calleeName, forEachNode, unwrap } from '../../support/ast.js';
import { takesNoFacts } from '../../support/facts.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';

const CALLEES: ReadonlySet<string> = new Set(['spawn', 'spawnSync', 'execFile', 'execFileSync']);

const propertyName = (name: ts.PropertyName): string | null =>
  ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : null;

function turnsOnShell(options: ts.ObjectLiteralExpression): boolean {
  return options.properties.some((property) => {
    if (ts.isShorthandPropertyAssignment(property)) return property.name.text === 'shell';
    if (!ts.isPropertyAssignment(property) || propertyName(property.name) !== 'shell') return false;
    return unwrap(property.initializer).kind !== ts.SyntaxKind.FalseKeyword;
  });
}

export function shellWithArgsArray(source: FileView | string): number[] {
  const file = typeof source === 'string' ? viewOfText('sample.ts', source) : source;
  const sf = file.sourceFile;
  const hits: number[] = [];
  forEachNode(sf, (node) => {
    if (!ts.isCallExpression(node) || !CALLEES.has(calleeName(node) ?? '')) return;
    const options = node.arguments[2];
    if (options && ts.isObjectLiteralExpression(options) && turnsOnShell(options)) {
      const callee = node.expression;
      hits.push((ts.isPropertyAccessExpression(callee) ? callee.name : callee).getStart(sf));
    }
  });
  return hits;
}

export function shellArgsFindings(file: FileView): Finding[] {
  return shellWithArgsArray(file).map((index) => ({
    file: file.path,
    line: file.lineOf(index),
    detail: 'an args array is handed to a shell',
  }));
}

export const SHELL_SAFE_SCOPE: Scope = {
  roots: ['app', 'functions', 'scripts', 'workers', 'e2e', 'hostedE2e'],
  kinds: ['code'],
  tests: true,
  optionalRoots: ['functions', 'scripts', 'workers', 'e2e', 'hostedE2e'],
};

export const SHELL_SAFE_TITLE = 'no child process gets an args array together with a shell';
export const SHELL_SAFE_DESCRIPTION =
  'spawn, spawnSync, execFile and execFileSync never take an args array together with options that turn a shell on ' +
  '(shell: true, a shell path, or the shell shorthand): Node joins that array with spaces, unescaped. Drop the shell ' +
  'and keep the args array, or build one command string and pass it with the options.';

export type ShellSafeFacts = Readonly<Record<string, never>>;

export const shellSafeGuard: GenericGuardDefinition<ShellSafeFacts> = {
  id: 'shellSafeChildProcesses',
  absentWhen: false,
  factProblems: takesNoFacts,
  build() {
    return [
      {
        title: SHELL_SAFE_TITLE,
        description: SHELL_SAFE_DESCRIPTION,
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run: (context) => context.files(SHELL_SAFE_SCOPE).flatMap(shellArgsFindings),
      },
    ];
  },
};
