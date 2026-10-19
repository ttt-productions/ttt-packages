// No wildcard import of a scoped package. A consumer that takes a package's whole module (`import *
// as X`, `export * as X from`, `export * from`) names no definition, so nothing traces a name it uses
// to the entry that owns it, and a test's mock of one name stands in for every other name the
// wildcard reaches. Each name is imported by name instead.

import type { Finding, GuardContext } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import { textProblem } from '../../support/facts.js';

export interface PackageWildcardImportFacts {
  /** The npm scope whose packages the rule holds (`@ttt-productions`). */
  scope: string;
}

const SCOPE: Scope = {
  roots: ['app', 'functions', 'e2e', 'hostedE2e', 'scripts', 'workers'],
  kinds: ['code'],
  tests: true,
  optionalRoots: ['functions', 'e2e', 'hostedE2e', 'scripts', 'workers'],
};

export const packageWildcardImportsGuard: GenericGuardDefinition<PackageWildcardImportFacts> = {
  id: 'packageWildcardImports',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.scope, 'scope', problems);
    if (typeof facts?.scope === 'string' && !/^@[a-z0-9][a-z0-9._-]*$/.test(facts.scope))
      problems.push('scope must be an npm scope such as @acme');
    return problems;
  },
  build(facts) {
    const prefix = `${facts.scope}/`;
    return [
      {
        title: 'no code takes a scoped package whole through a wildcard import',
        description:
          "No code imports or re-exports a scoped package's whole module (`import * as X`, `export * as X from`, " +
          '`export * from`): a wildcard names no definition, so no name it uses is traced to the entry that owns it, and a ' +
          "test's mock of one name stands in for the rest. Import each name the code uses, by name.",
        run(context: GuardContext): Finding[] {
          const findings: Finding[] = [];
          for (const file of context.files(SCOPE)) {
            for (const imported of file.imports) {
              if (imported.kind !== 'import' && imported.kind !== 'export') continue;
              if (!imported.star || !imported.spec.startsWith(prefix)) continue;
              const form =
                imported.kind === 'import'
                  ? `import * as ${imported.namespace}`
                  : imported.namespace
                    ? `export * as ${imported.namespace}`
                    : 'export *';
              findings.push({
                file: file.path,
                line: file.lineOf(imported.node.getStart(file.sourceFile)),
                detail: `${form} from '${imported.spec}' takes the whole module; import each name it uses`,
              });
            }
          }
          return findings.sort((a, b) =>
            a.file === b.file ? (a.line ?? 0) - (b.line ?? 0) : a.file < b.file ? -1 : 1,
          );
        },
      },
    ];
  },
};
