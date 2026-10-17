// Cross-boundary contracts live in the core package, never beside it:
//   - a backend tree builds no zod schema of its own: every input and document it parses is a core
//     schema, so it uses zod for types and error checks alone;
//   - no source gives avoiding a package publish or release as the reason a definition lives where
//     it does.

import ts from 'typescript';
import type { Finding } from '../../guard.js';
import type { GenericGuardDefinition } from '../../config.js';
import { ROOT_ROLES, type RootRole } from '../../reader/layout.js';
import type { FileView } from '../../reader/view.js';
import { APP_SOURCE, lineOfNode } from './shared.js';

export interface CoreContractFacts {
  /** The app's core package specifier (`@scope/name`), as a publish-avoidance reason names it. */
  corePackage: string;
  /** The roots whose code parses only the core's schemas (an app's Cloud Functions tree). */
  backendRoots: readonly RootRole[];
}

const ZOD_MODULE = /^zod(?:\/|$)/;

/**
 * zod's functions that build no schema: the error formatters, the global config, JSON Schema output,
 * and the top-level parse functions, which only run a schema built elsewhere.
 */
const BUILDS_NOTHING: ReadonlySet<string> = new Set([
  'prettifyError',
  'treeifyError',
  'flattenError',
  'formatError',
  'config',
  'toJSONSchema',
  'parse',
  'safeParse',
  'parseAsync',
  'safeParseAsync',
  'encode',
  'decode',
  'safeEncode',
  'safeDecode',
]);

/**
 * The names a file binds zod under: `z` (by convention, wherever it comes from), every namespace or
 * default import of a zod module, and each named import of one, by its local name with the name zod
 * exports it as.
 */
function zodBindings(sf: ts.SourceFile): { namespaces: Set<string>; named: Map<string, string> } {
  const namespaces = new Set(['z']);
  const named = new Map<string, string>();
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !ZOD_MODULE.test(statement.moduleSpecifier.text)) continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;
    if (clause.name) namespaces.add(clause.name.text);
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    else if (bindings) {
      for (const element of bindings.elements) {
        if (element.isTypeOnly) continue;
        const exported = (element.propertyName ?? element.name).text;
        if (exported === 'z') namespaces.add(element.name.text);
        else named.set(element.name.text, exported);
      }
    }
  }
  return { namespaces, named };
}

/**
 * Every zod schema a file builds in place: a builder called on zod (`z.object(…)`, `zod.string()`), a
 * builder imported by name (`object(…)` from `zod`), or a schema class constructed. `z.ZodError`
 * checks, type positions (`z.infer`, `z.ZodType`), and the functions that build nothing (an error
 * formatter, a parse of a schema built elsewhere) are allowed.
 */
export function zodSchemaBuilds(file: FileView): Finding[] {
  const findings: Finding[] = [];
  const { namespaces, named } = zodBindings(file.sourceFile);
  const builder = (callee: ts.Expression): string | null => {
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && namespaces.has(callee.expression.text)) {
      return `${callee.expression.text}.${callee.name.text}`;
    }
    if (ts.isIdentifier(callee) && named.has(callee.text)) return callee.text;
    return null;
  };
  const exportedName = (callee: ts.Expression): string =>
    ts.isPropertyAccessExpression(callee) ? callee.name.text : (named.get((callee as ts.Identifier).text) ?? '');
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = builder(node.expression);
      const exported = exportedName(node.expression);
      if (name && /^[a-z]/.test(exported) && !BUILDS_NOTHING.has(exported)) {
        findings.push({ file: file.path, line: lineOfNode(file, node), detail: `builds a zod schema: ${name}(…)` });
      }
    } else if (ts.isNewExpression(node)) {
      const name = builder(node.expression);
      if (name && !/Error$/.test(exportedName(node.expression))) findings.push({ file: file.path, line: lineOfNode(file, node), detail: `constructs a zod schema: new ${name}(…)` });
    }
    ts.forEachChild(node, visit);
  };
  visit(file.sourceFile);
  return findings;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The justification itself, wherever it is written — a comment is where it usually sits: avoiding,
 * skipping, or saving a publish or release, bare or of a package, the core, or the core package by
 * name. Another kind of publish (a media asset's) is no package release and is not matched.
 */
export function publishAvoidancePattern(corePackage: string): RegExp {
  const names = [corePackage, corePackage.slice(corePackage.lastIndexOf('/') + 1), 'package', 'core'].map(escapeRegExp).join('|');
  return new RegExp(
    `\\b(?:avoid|avoids|avoiding|skip|skips|skipping|save|saves|saving)\\s+(?:a\\s+|an\\s+|the\\s+)?(?:(?:${names})\\s+)?(?:publish|release)\\b`,
    'gi',
  );
}

/** Every place a file names avoiding a publish or release as a reason, comments included. */
export function publishAvoidance(file: FileView, pattern: RegExp): Finding[] {
  return [...file.text.matchAll(new RegExp(pattern.source, pattern.flags))].map((m) => ({
    file: file.path,
    line: file.lineOf(m.index ?? 0),
    detail: `names avoiding a publish as a reason: "${m[0]}"`,
  }));
}

export const coreContractsGuard: GenericGuardDefinition<CoreContractFacts> = {
  id: 'coreContracts',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (typeof facts?.corePackage !== 'string' || !facts.corePackage.trim()) problems.push('corePackage is missing');
    if (!Array.isArray(facts?.backendRoots) || !facts.backendRoots.length) problems.push('backendRoots is missing or empty');
    else {
      for (const role of facts.backendRoots) {
        if (!ROOT_ROLES.includes(role) || role === 'coreDist') problems.push(`backendRoots names ${String(role)}, which is no source root role`);
      }
    }
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'no backend module builds a zod schema of its own',
        description:
          'Every callable input and every document the backend parses is a schema the core package declares, so a ' +
          'backend module imports it instead of building one — on z, on any zod namespace, or through a builder ' +
          'imported by name. Using zod for types (z.infer, z.ZodType), for an instanceof z.ZodError check, to format ' +
          'an error (z.prettifyError), or to parse with a core schema builds nothing and is allowed. Move the schema ' +
          'into the core, released first.',
        timeoutMs: 120_000,
        run(context) {
          return context.files({ roots: facts.backendRoots, kinds: ['code'], tests: false }).flatMap(zodSchemaBuilds);
        },
      },
      {
        title: 'no source gives avoiding a publish as a reason',
        description:
          '"To avoid a publish" is never a reason for where a definition lives, in code or in a comment. Put the ' +
          'definition in the package that owns it, released packages-first, and delete the local copy and its reason.',
        timeoutMs: 120_000,
        run(context) {
          const pattern = publishAvoidancePattern(facts.corePackage);
          return context.files(APP_SOURCE).flatMap((file) => publishAvoidance(file, pattern));
        },
      },
    ];
  },
};
