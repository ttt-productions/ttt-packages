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

const isZod = (node: ts.Node) => ts.isIdentifier(node) && node.text === 'z';

/**
 * Every zod schema a file builds in place: a builder called on `z` (`z.object(…)`, `z.string()`) or
 * a schema class constructed. `z.ZodError` checks and type positions (`z.infer`, `z.ZodType`) build
 * nothing.
 */
export function zodSchemaBuilds(file: FileView): Finding[] {
  const findings: Finding[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && isZod(node.expression.expression)) {
      const name = node.expression.name.text;
      if (/^[a-z]/.test(name)) findings.push({ file: file.path, line: lineOfNode(file, node), detail: `builds a zod schema: z.${name}(…)` });
    } else if (ts.isNewExpression(node) && ts.isPropertyAccessExpression(node.expression) && isZod(node.expression.expression)) {
      findings.push({ file: file.path, line: lineOfNode(file, node), detail: `constructs a zod schema: new z.${node.expression.name.text}(…)` });
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
          'backend module imports it instead of building one. Using zod for types (z.infer, z.ZodType) or for an ' +
          'instanceof z.ZodError check builds nothing and is allowed. Move the schema into the core, released first.',
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
