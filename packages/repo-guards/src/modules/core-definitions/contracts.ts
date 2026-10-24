import ts from 'typescript';
import type { Finding } from '../../guard.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import { ROOT_ROLES, type RootRole } from '../../node/layout.js';
import type { FileView } from '../../reader/view.js';
import { lineOfNode } from '../../support/ast.js';
import { namesProblem, textProblem } from '../../support/facts.js';
import { moduleImports } from '../../support/imports.js';
import { escapeRegExp } from '../../support/text.js';
import { APP_SOURCE } from './shared.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';

export interface CoreContractFacts {
  corePackage: string;
  backendRoots: readonly RootRole[];
}

const ZOD_MODULE = /^zod(?:\/|$)/;

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

const BUILDER_GROUPS: ReadonlySet<string> = new Set(['coerce', 'iso']);

function zodBindings(sf: ts.SourceFile): { namespaces: Set<string>; named: Map<string, string> } {
  const namespaces = new Set(['z']);
  const named = new Map<string, string>();
  for (const site of moduleImports(sf, ['import'])) {
    if (!site.topLevel || site.sideEffect || site.typeOnly || !ZOD_MODULE.test(site.spec)) continue;
    if (site.defaultName) namespaces.add(site.defaultName);
    if (site.namespace) namespaces.add(site.namespace);
    for (const name of site.named) {
      if (name.typeOnly) continue;
      if (name.imported === 'z') namespaces.add(name.local);
      else named.set(name.local, name.imported);
    }
  }
  return { namespaces, named };
}

export function zodSchemaBuilds(file: FileView): Finding[] {
  const findings: Finding[] = [];
  const { namespaces, named } = zodBindings(file.sourceFile);
  const builder = (callee: ts.Expression): string | null => {
    if (
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      namespaces.has(callee.expression.text)
    ) {
      return `${callee.expression.text}.${callee.name.text}`;
    }
    if (ts.isPropertyAccessExpression(callee)) {
      const group = callee.expression;
      const viaNamespace =
        ts.isPropertyAccessExpression(group) &&
        ts.isIdentifier(group.expression) &&
        namespaces.has(group.expression.text) &&
        BUILDER_GROUPS.has(group.name.text);
      const viaName = ts.isIdentifier(group) && BUILDER_GROUPS.has(named.get(group.text) ?? '');
      if (viaNamespace || viaName) return `${group.getText(file.sourceFile)}.${callee.name.text}`;
    }
    if (ts.isIdentifier(callee) && named.has(callee.text)) return callee.text;
    return null;
  };
  const exportedName = (callee: ts.Expression): string =>
    ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : (named.get((callee as ts.Identifier).text) ?? '');
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = builder(node.expression);
      const exported = exportedName(node.expression);
      if (name && /^[a-z]/.test(exported) && !BUILDS_NOTHING.has(exported)) {
        findings.push({
          file: file.path,
          line: lineOfNode(file, node),
          detail: `builds a zod schema: ${name}(…)`,
        });
      }
    } else if (ts.isNewExpression(node)) {
      const name = builder(node.expression);
      if (name && !/Error$/.test(exportedName(node.expression)))
        findings.push({
          file: file.path,
          line: lineOfNode(file, node),
          detail: `constructs a zod schema: new ${name}(…)`,
        });
    }
    ts.forEachChild(node, visit);
  };
  visit(file.sourceFile);
  return findings;
}

export function publishAvoidancePattern(corePackage: string): RegExp {
  const names = [
    corePackage,
    corePackage.slice(corePackage.lastIndexOf('/') + 1),
    'package',
    'core',
  ]
    .map(escapeRegExp)
    .join('|');
  return new RegExp(
    `\\b(?:avoid|avoids|avoiding|skip|skips|skipping|save|saves|saving)\\s+(?:a\\s+|an\\s+|the\\s+)?(?:(?:${names})\\s+)?(?:publish|release)\\b`,
    'gi',
  );
}

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
    textProblem(facts?.corePackage, 'corePackage', problems);
    namesProblem(facts?.backendRoots, 'backendRoots', problems);
    for (const role of Array.isArray(facts?.backendRoots) ? facts.backendRoots : []) {
      if (!ROOT_ROLES.includes(role) || role === 'coreDist')
        problems.push(`backendRoots names ${String(role)}, which is no source root role`);
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
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          return context
            .files({ roots: facts.backendRoots, kinds: ['code'], tests: false })
            .flatMap(zodSchemaBuilds);
        },
      },
      {
        title: 'no source gives avoiding a publish as a reason',
        description:
          '"To avoid a publish" is never a reason for where a definition lives, in code or in a comment. Put the ' +
          'definition in the package that owns it, released packages-first, and delete the local copy and its reason.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          const pattern = publishAvoidancePattern(facts.corePackage);
          return context.files(APP_SOURCE).flatMap((file) => publishAvoidance(file, pattern));
        },
      },
    ];
  },
};
