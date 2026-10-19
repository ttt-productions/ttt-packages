// The definition re-declaration guards: a definition the core package owns is written once.
//   - guarded members: each guarded literal appears in the core build only in its owners and the
//     reviewed `module#declaration` uses, and every owner still holds it;
//   - constants: no app module declares, at module scope, a constant under a name the core exports;
//   - unions: no app module spells two or more members of a core literal union itself.
// The core is read as the installed build: its compiled modules for values, and its declarations
// for the type aliases and interfaces it wrote and for the constants and unions it exports.

import ts from 'typescript';
import type { Finding, GuardContext } from '../../guard.js';
import type { GenericGuardDefinition } from '../../suite/config.js';
import type { FileView } from '../../reader/view.js';
import { isPlainString, lineOfNode } from '../../support/ast.js';
import { isText, namesProblem, reviewedProblems } from '../../support/facts.js';
import { APP_SOURCE, CORE_CODE_AND_DECLARATIONS, declarationNameOf, moduleOf } from './shared.js';

export interface GuardedLiteral {
  /** The member's text, as its union declares it. */
  literal: string;
  /**
   * The modules that declare it (repo-relative compiled paths; a module's type declaration counts
   * as the module). More than one owner means two different unions share the spelling.
   */
  owners: readonly string[];
  /** Compiler-checked uses elsewhere, each one top-level declaration of one module, with its why. */
  allowed: ReadonlyArray<{ file: string; declaration: string; why: string }>;
}

export interface DefinitionRedeclarationFacts {
  /** The most distinctive member of each canonical union the core owns. */
  guardedLiterals: readonly GuardedLiteral[];
}

/** One string literal written in code, with the top-level declaration it sits in. */
export interface CodeLiteral {
  value: string;
  declaration: string;
  line: number;
}

/**
 * Every whole string literal written in a file's code (an interpolated template builds a string and
 * declares nothing). In a type declaration file only the type aliases and interfaces count: the
 * compiler writes every other declaration's inferred type out in full, so a schema that merely
 * derives from a union carries its members there without restating anything.
 */
export function codeLiterals(file: FileView): CodeLiteral[] {
  const found: CodeLiteral[] = [];
  const declarations = file.kind === 'declarations';
  for (const statement of file.sourceFile.statements) {
    if (declarations && !ts.isTypeAliasDeclaration(statement) && !ts.isInterfaceDeclaration(statement)) continue;
    const declaration = declarationNameOf(statement);
    const visit = (node: ts.Node): void => {
      if (isPlainString(node)) found.push({ value: node.text, declaration, line: lineOfNode(file, node) });
      ts.forEachChild(node, visit);
    };
    visit(statement);
  }
  return found;
}

function guardedMembersRun(facts: DefinitionRedeclarationFacts) {
  return (context: GuardContext): Finding[] => {
    const findings: Finding[] = [];
    const wanted = new Map(facts.guardedLiterals.map((g) => [g.literal, g]));
    const matched = new Set<string>();
    for (const file of context.files(CORE_CODE_AND_DECLARATIONS)) {
      const module = moduleOf(file.path);
      for (const hit of codeLiterals(file)) {
        const guarded = wanted.get(hit.value);
        if (!guarded || guarded.owners.includes(module)) continue;
        const entry = guarded.allowed.find((a) => a.file === module && a.declaration === hit.declaration);
        if (entry) matched.add(`${hit.value}\u0000${entry.file}#${entry.declaration}`);
        else {
          findings.push({
            file: file.path,
            line: hit.line,
            detail: `'${hit.value}' re-declared in ${hit.declaration} — import it from its owner (${guarded.owners.join(' / ')})`,
          });
        }
      }
    }
    for (const guarded of facts.guardedLiterals) {
      for (const owner of guarded.owners) {
        const present = [...new Set([owner, owner.replace(/\.([cm]?)js$/, '.d.$1ts')])].filter((p) => context.reader.exists(p));
        if (!present.length) {
          findings.push({ file: owner, detail: `stale owner of '${guarded.literal}': the module no longer exists` });
        } else if (!present.some((p) => codeLiterals(context.file(p)).some((hit) => hit.value === guarded.literal))) {
          findings.push({ file: owner, detail: `stale owner of '${guarded.literal}': the module no longer declares it` });
        }
      }
      for (const entry of guarded.allowed) {
        if (!matched.has(`${guarded.literal}\u0000${entry.file}#${entry.declaration}`)) {
          findings.push({ file: entry.file, detail: `stale allowance for '${guarded.literal}' in ${entry.declaration}: the use it excuses is gone` });
        }
      }
    }
    return findings;
  };
}

const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/;
const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);

/** The constants and literal unions the core's declarations export. */
export function coreVocabulary(declarationFiles: readonly FileView[]) {
  const constants = new Set<string>();
  const unions: Array<{ name: string; members: ReadonlySet<string> }> = [];
  for (const file of declarationFiles) {
    for (const statement of file.sourceFile.statements) {
      if (!ts.isVariableStatement(statement) || !hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !CONSTANT_NAME.test(declaration.name.text)) continue;
        const name = declaration.name.text;
        constants.add(name);
        const type = declaration.type;
        // An `as const` array declares a readonly tuple of its literal members.
        if (type && ts.isTypeOperatorNode(type) && type.operator === ts.SyntaxKind.ReadonlyKeyword && ts.isTupleTypeNode(type.type)) {
          const members = type.type.elements.map((e) => (ts.isLiteralTypeNode(e) && ts.isStringLiteral(e.literal) ? e.literal.text : null));
          if (members.length >= 2 && members.every((m) => m !== null)) unions.push({ name, members: new Set(members as string[]) });
        }
      }
    }
  }
  return { constants, unions };
}

function coreDeclarations(context: GuardContext): FileView[] {
  return context.files({ roots: ['coreDist'], kinds: ['declarations'], tests: false });
}

/** Module-scope constants an app module declares under a name the core exports. */
export function redeclaredConstants(file: FileView, constants: ReadonlySet<string>): Finding[] {
  const findings: Finding[] = [];
  for (const statement of file.sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && constants.has(declaration.name.text)) {
        findings.push({
          file: file.path,
          line: lineOfNode(file, declaration),
          detail: `${declaration.name.text} is declared here under the core's own name — import it from the core and delete this copy`,
        });
      }
    }
  }
  return findings;
}

const stringMembers = (nodes: readonly ts.Node[]) =>
  nodes.flatMap((n) => (isPlainString(n) ? [n.text] : ts.isLiteralTypeNode(n) && isPlainString(n.literal) ? [n.literal.text] : []));

const unwrapValue = (node: ts.Node): ts.Node => {
  let current = node;
  while (current.parent && (ts.isAsExpression(current.parent) || ts.isSatisfiesExpression(current.parent) || ts.isParenthesizedExpression(current.parent))) {
    current = current.parent;
  }
  return current;
};

/** A value bound with `=`: a variable, parameter, property or binding default, or an assignment. */
function isBound(array: ts.ArrayLiteralExpression): boolean {
  const value = unwrapValue(array);
  const parent = value.parent;
  if (!parent) return false;
  if (ts.isBinaryExpression(parent)) return parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.right === value;
  return (
    (ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isPropertyDeclaration(parent) || ts.isBindingElement(parent)) &&
    parent.initializer === value
  );
}

const isZodEnum = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  node.expression.name.text === 'enum' &&
  ts.isIdentifier(node.expression.expression) &&
  node.expression.expression.text === 'z';

/**
 * The places an app module spells members of a core union itself: a union type of string literals,
 * a `z.enum([...])` of quoted members, or an array literal of nothing but quoted members bound with
 * `=`. A place restates a union when it names two or more members and every one belongs to it.
 */
export function restatedUnions(file: FileView, unions: ReadonlyArray<{ name: string; members: ReadonlySet<string> }>): Finding[] {
  const findings: Finding[] = [];
  const report = (node: ts.Node, members: string[]) => {
    if (members.length < 2) return;
    const union = unions.find((u) => members.every((m) => u.members.has(m)));
    if (union) {
      findings.push({
        file: file.path,
        line: lineOfNode(file, node),
        detail: `${members.map((m) => `'${m}'`).join(' | ')} restates ${union.name} — derive from the core's declaration`,
      });
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isUnionTypeNode(node)) report(node, stringMembers(node.types));
    else if (isZodEnum(node)) {
      const [first] = node.arguments;
      if (first && ts.isArrayLiteralExpression(first)) report(node, stringMembers(first.elements));
    } else if (ts.isArrayLiteralExpression(node) && node.elements.every(isPlainString) && isBound(node)) {
      report(node, stringMembers(node.elements));
    }
    ts.forEachChild(node, visit);
  };
  visit(file.sourceFile);
  return findings;
}

export const definitionRedeclarationGuard: GenericGuardDefinition<DefinitionRedeclarationFacts> = {
  id: 'definitionRedeclaration',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    const guarded = facts?.guardedLiterals;
    namesProblem(Array.isArray(guarded) ? guarded.map((g) => g?.literal) : guarded, 'guardedLiterals', problems);
    for (const g of Array.isArray(guarded) ? guarded : []) {
      if (!isText(g?.literal)) continue;
      namesProblem(g.owners, `the owners of '${g.literal}'`, problems);
      reviewedProblems(g.allowed, `the allowed uses of '${g.literal}'`, problems, {
        key: 'file',
        id: (e) => (typeof e.declaration === 'string' && e.declaration.trim() ? `${e.file}#${e.declaration}` : undefined),
        idNames: 'declaration',
      });
    }
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'each guarded core definition member is declared only by its owner',
        description:
          "A canonical union's member is written as a literal only in the core module that declares the union. Any other " +
          'core module imports the union (its schema, type, or array) instead of quoting the member. A compiler-checked use ' +
          'elsewhere is a reviewed allowance naming its module and top-level declaration with why; an allowance whose use ' +
          'is gone, and an owner that no longer declares the member, are stale and fail.',
        timeoutMs: 120_000,
        run: guardedMembersRun(facts),
      },
      {
        title: 'no app module re-declares a constant the core package exports',
        description:
          "No module in the app's source declares, at module scope, a constant under a name the installed core package " +
          'exports — that is a second copy of a cross-boundary definition. Import it from the core and delete the local ' +
          'declaration; a definition the core lacks is added to the core first.',
        timeoutMs: 120_000,
        run(context) {
          const { constants } = coreVocabulary(coreDeclarations(context));
          const findings: Finding[] = constants.size
            ? []
            : [{ file: '(core build)', detail: 'the installed core declares no exported constant, so the check compares nothing' }];
          for (const file of context.files(APP_SOURCE)) findings.push(...redeclaredConstants(file, constants));
          return findings;
        },
      },
      {
        title: 'no app module restates a core literal union',
        description:
          "No module in the app's source spells two or more members of one of the core package's literal unions itself — " +
          'a string-literal union type, a z.enum of quoted members, or an array literal of them. Derive from the core ' +
          "declaration instead: the union's type, its array, Extract over a named member constant, or a subset the core " +
          'declares beside the union.',
        timeoutMs: 120_000,
        run(context) {
          const { unions } = coreVocabulary(coreDeclarations(context));
          const findings: Finding[] = unions.length
            ? []
            : [{ file: '(core build)', detail: 'the installed core declares no literal union, so the check compares nothing' }];
          for (const file of context.files(APP_SOURCE)) findings.push(...restatedUnions(file, unions));
          return findings;
        },
      },
    ];
  },
};
