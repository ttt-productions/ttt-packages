// A Functions test locates source from its own module URL, never from `process.cwd()`. The working
// folder is wherever the runner was started, so a cwd-rooted test reads a different tree depending
// on how it was launched, and can pass while checking nothing.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';

/** Every `process.cwd()` call in a file — a mention in a comment or a string is not one. */
export function cwdCalls(file: FileView): number[] {
  const sourceFile = file.sourceFile;
  const hits: number[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'cwd' &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'process'
    ) {
      hits.push(node.getStart(sourceFile));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return hits;
}

const SCOPE: Scope = { roots: ['functions'], kinds: ['code'], tests: 'only' };

/** Takes no facts: it reads the test code of the Functions root the layout declares. */
export type TestSourceRootFacts = Readonly<Record<string, never>>;

export const testSourceRootGuard: GenericGuardDefinition<TestSourceRootFacts> = {
  id: 'testSourceRoot',
  absentWhen: 'the app has no Cloud Functions tree',
  absentOnlyWithoutRoot: 'functions',
  factProblems(facts) {
    if (!facts || typeof facts !== 'object') return ['the facts are missing (this guard takes {})'];
    return Object.keys(facts).length ? ['this guard takes no facts ({})'] : [];
  },
  build() {
    return [
      {
        title: 'Functions tests resolve source from their own location, never process.cwd()',
        description:
          'No Functions test module or test helper calls process.cwd(): the working folder depends on where the runner ' +
          'was started, so the test reads a different tree per launch. Resolve from the module itself — ' +
          'dirname(fileURLToPath(import.meta.url)).',
        run(context) {
          const findings: Finding[] = [];
          for (const file of context.files(SCOPE)) {
            for (const index of cwdCalls(file)) findings.push({ file: file.path, line: file.lineOf(index), detail: 'calls process.cwd()' });
          }
          return findings;
        },
      },
    ];
  },
};
