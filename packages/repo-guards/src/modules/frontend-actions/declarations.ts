// Reads an app's callable declarations: the named hooks its declarations modules build through the
// shared callable factories, each with its kind, the callable it names, and whether it presents a
// limited-use App Check token. The client callable guards and the App Check guard read them here.

import ts from 'typescript';
import type { Finding, GuardContext } from '../../guard.js';
import type { FileView } from '../../reader/view.js';
import { namesProblem, objectProblem, textProblem } from '../../support/facts.js';
import { isPlainString, lineOfNode } from '../../support/ast.js';

/** The four callable kinds: an action, a reader, an invoker, and a resumable action. */
export type CallableKind = 'action' | 'reader' | 'invoker' | 'resumable';

export const CALLABLE_KINDS: readonly CallableKind[] = ['action', 'reader', 'invoker', 'resumable'];

export interface CallableDeclarationFacts {
  /** The modules that declare the app's callables. */
  modules: readonly string[];
  /** The name each kind's factory is bound to in those modules. */
  factories: Readonly<Record<CallableKind, string>>;
}

export interface DeclaredCallable {
  /** The exported hook the declaration builds. */
  hook: string;
  kind: CallableKind;
  /** The callable's name, or null when the declaration names it through an expression. */
  callable: string | null;
  /** The declaration carries `limitedUseAppCheck: true`. */
  limitedUse: boolean;
  file: string;
  line: number;
}

/** Problems with a declarations fact: its modules, and a distinct factory name for each kind. */
export function declarationFactProblems(value: unknown, what: string, problems: string[]): void {
  if (!objectProblem(value, what, problems)) return;
  const facts = value as Partial<CallableDeclarationFacts>;
  namesProblem(facts.modules, `${what}.modules`, problems);
  if (!objectProblem(facts.factories, `${what}.factories`, problems)) return;
  const factories = facts.factories as Record<string, unknown>;
  for (const kind of CALLABLE_KINDS)
    textProblem(factories[kind], `${what}.factories.${kind}`, problems);
  const names = CALLABLE_KINDS.map((kind) => factories[kind]).filter(
    (n) => typeof n === 'string' && n.trim(),
  );
  if (new Set(names).size !== names.length)
    problems.push(`${what}.factories names one factory for two kinds`);
}

const HOOK = /^use[A-Z]/;

function declarationsIn(
  file: FileView,
  kindOf: ReadonlyMap<string, CallableKind>,
): { declared: DeclaredCallable[]; findings: Finding[] } {
  const sf = file.sourceFile;
  const declared: DeclaredCallable[] = [];
  const findings: Finding[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      kindOf.has(node.expression.text)
    ) {
      const kind = kindOf.get(node.expression.text)!;
      const holder = node.parent;
      const statement =
        holder && ts.isVariableDeclaration(holder) ? holder.parent?.parent : undefined;
      const exported =
        !!statement &&
        ts.isVariableStatement(statement) &&
        !!statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (
        !exported ||
        !ts.isVariableDeclaration(holder) ||
        !ts.isIdentifier(holder.name) ||
        !HOOK.test(holder.name.text)
      ) {
        findings.push({
          file: file.path,
          line: lineOfNode(file, node),
          detail: `a ${node.expression.text} call that is not an exported named hook (\`export const useX = ${node.expression.text}(…)\`)`,
        });
      } else {
        const hook = holder.name.text;
        const first = node.arguments[0];
        const callable = isPlainString(first) ? first.text : null;
        if (callable === null) {
          findings.push({
            file: file.path,
            line: lineOfNode(file, node),
            detail: `${hook} names its callable through an expression this check cannot read: write the name as a string literal`,
          });
        }
        const options = node.arguments[kind === 'resumable' ? 2 : 1];
        let limitedUse = false;
        if (options && !ts.isObjectLiteralExpression(options)) {
          findings.push({
            file: file.path,
            line: lineOfNode(file, node),
            detail: `${hook}'s declaration options are not an object literal, so its App Check posture cannot be read`,
          });
        } else if (options) {
          limitedUse = options.properties.some(
            (p) =>
              ts.isPropertyAssignment(p) &&
              p.name.getText(sf).replace(/^['"]|['"]$/g, '') === 'limitedUseAppCheck' &&
              p.initializer.kind === ts.SyntaxKind.TrueKeyword,
          );
        }
        declared.push({
          hook,
          kind,
          callable,
          limitedUse,
          file: file.path,
          line: lineOfNode(file, node),
        });
      }
    } else if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const d of node.declarationList.declarations) {
        const init = d.initializer;
        if (
          !ts.isIdentifier(d.name) ||
          !HOOK.test(d.name.text) ||
          !init ||
          !ts.isCallExpression(init)
        )
          continue;
        if (!ts.isIdentifier(init.expression) || !kindOf.has(init.expression.text)) {
          findings.push({
            file: file.path,
            line: lineOfNode(file, d),
            detail: `${d.name.text} is built by none of the declared factories (${[...kindOf.keys()].join(', ')})`,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { declared, findings };
}

/**
 * Every declaration in the app's declarations modules, with every reason a declaration cannot be
 * read: a module that is gone, a module that declares nothing, a factory call that is not an
 * exported named hook, a hook built by something other than a declared factory, a callable named
 * through an expression, and options that are not an object literal.
 */
export function readDeclarations(
  context: GuardContext,
  facts: CallableDeclarationFacts,
): { declared: DeclaredCallable[]; findings: Finding[] } {
  const kindOf = new Map(CALLABLE_KINDS.map((kind) => [facts.factories[kind], kind] as const));
  const declared: DeclaredCallable[] = [];
  const findings: Finding[] = [];
  for (const module of facts.modules) {
    if (!context.reader.exists(module)) {
      findings.push({ file: module, detail: 'the callable declarations module no longer exists' });
      continue;
    }
    const read = declarationsIn(context.file(module), kindOf);
    if (!read.declared.length)
      findings.push({ file: module, detail: 'stale declarations module: it declares no callable' });
    declared.push(...read.declared);
    findings.push(...read.findings);
  }
  const byName = new Map<string, DeclaredCallable>();
  for (const d of declared) {
    if (d.callable === null) continue;
    const first = byName.get(d.callable);
    if (first)
      findings.push({
        file: d.file,
        line: d.line,
        detail: `${d.hook} declares ${d.callable} a second time (first as ${first.hook})`,
      });
    else byName.set(d.callable, d);
  }
  return { declared, findings };
}
