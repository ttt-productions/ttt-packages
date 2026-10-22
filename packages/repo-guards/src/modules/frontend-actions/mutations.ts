import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding, GuardContext } from '../../guard.js';
import type { Reviewed } from '../../node/layout.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { reviewedAllowlist, type Hit } from '../../shapes/shapes.js';
import {
  identifierProblem,
  objectProblem,
  reviewedProblems,
  textProblem,
} from '../../support/facts.js';
import { moduleImports } from '../../support/imports.js';
import { rawMutations } from './raw-mutations.js';

const APP_CODE: Scope = { roots: ['app'], kinds: ['code'], tests: false };

export interface MutationOwnerFacts {
  ownerImport: { module: string; name: string };
  exceptions: readonly Reviewed[];
}

export function shadowedOwners(file: FileView, owner: MutationOwnerFacts['ownerImport']): Hit[] {
  const hits: Hit[] = [];
  for (const site of moduleImports(file.sourceFile, ['import', 'export'])) {
    if (site.spec === owner.module || site.typeOnly) continue;
    for (const name of site.named)
      if (name.imported === owner.name && !name.typeOnly)
        hits.push({
          index: site.node.getStart(file.sourceFile),
          detail: `${owner.name} from ${site.spec}, which is not ${owner.module}`,
        });
  }
  return hits;
}

function ownerImported(context: GuardContext, owner: MutationOwnerFacts['ownerImport']): boolean {
  return context
    .files(APP_CODE)
    .some((file) =>
      moduleImports(file.sourceFile, ['import']).some(
        (site) =>
          site.spec === owner.module &&
          site.named.some((n) => n.imported === owner.name && !n.typeOnly),
      ),
    );
}

export const mutationOwnerGuard: GenericGuardDefinition<MutationOwnerFacts> = {
  id: 'mutationOwner',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (objectProblem(facts?.ownerImport, 'ownerImport', problems)) {
      textProblem(facts.ownerImport.module, 'ownerImport.module', problems);
      identifierProblem(facts.ownerImport.name, 'ownerImport.name', problems);
    }
    reviewedProblems(facts?.exceptions, 'exceptions', problems);
    return problems;
  },
  build(facts) {
    const { module, name } = facts.ownerImport;
    const guard = reviewedAllowlist({
      title: 'every mutation goes through the mutation owner',
      description:
        `App code builds every mutation with \`${name}\` from ${module}, never with TanStack's raw \`useMutation\` — ` +
        'imported by name, read off a namespace by member, bracket, or destructuring, re-exported by name or with a ' +
        'whole-module `export *`, or taken from a run-time load — and never with a hook of the same name from another module. The owner ties each action to the session ' +
        'that started it, so an answer that lands after the session changed runs none of its callbacks, toasts, or ' +
        'cache writes; a raw mutation has no such fence. Build the mutation with ' +
        `\`${name}\`, or add a reviewed exception with its why. An exception that no longer holds a raw mutation is stale.`,
      scope: APP_CODE,
      match: (file) =>
        [...rawMutations(file), ...shadowedOwners(file, facts.ownerImport)].sort(
          (a, b) => a.index - b.index,
        ),
      allowlist: facts.exceptions,
      samples: {
        flags: [
          "import { useMutation } from '@tanstack/react-query';",
          "import { useMutation as useRaw, useQuery } from '@tanstack/react-query';",
          "import * as RQ from '@tanstack/react-query';\nconst m = RQ.useMutation({ mutationFn });",
          "export { useMutation } from '@tanstack/react-query';",
          "export * from '@tanstack/react-query';",
          "export * as RQ from '@tanstack/react-query';",
          "import * as RQ from '@tanstack/react-query';\nconst { useMutation: raw } = RQ;",
          "import * as RQ from '@tanstack/react-query';\nconst m = RQ['useMutation']({ mutationFn });",
          `import { ${name} } from './local-owner';`,
        ],
        passes: [
          `import { ${name} } from '${module}';\nconst m = ${name}({ mutationFn });`,
          "import { useQuery, type UseMutationResult } from '@tanstack/react-query';",
          "import type { useMutation } from '@tanstack/react-query';",
        ],
      },
    });
    return [
      {
        ...guard,
        async run(context) {
          const findings: Finding[] = [...(await guard.run(context))];
          if (!ownerImported(context, facts.ownerImport))
            findings.push({
              file: module,
              detail: `no app file imports ${name} from ${module}: the owner import is stale`,
            });
          return findings;
        },
      },
    ];
  },
};
