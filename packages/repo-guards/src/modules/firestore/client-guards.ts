// The guards over client Firestore access:
//   - a live subscription is a reviewed exception;
//   - no component or route imports the Firestore runtime; reads go through hooks, writes through
//     callables, apart from reviewed root providers.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Scope } from '../../node/reader.js';
import type { Reviewed } from '../../node/layout.js';
import type { FileView } from '../../reader/view.js';
import { reviewedAllowlist, type Hit } from '../../shapes/shapes.js';
import { forEachNode } from '../../support/ast.js';
import { namesProblem, reviewedProblems } from '../../support/facts.js';
import { moduleImports } from '../../support/imports.js';
import { isUnder } from '../../support/text.js';

const FIRESTORE_SDK = /^firebase\/firestore(?:\/|$)/;
const APP_SOURCE: Scope = { roots: ['app'], kinds: ['code'], tests: false };

/**
 * Every live-subscription declaration in one file: a `subscribe` option whose value is anything but a
 * literal `false` (a variable is still live mode), the shorthand `{ subscribe }`, and a call of
 * `onSnapshot` under any name the file bound the Firestore SDK's to — a renamed import or a namespace
 * import included.
 */
export function liveSubscriptionHits(file: FileView): Hit[] {
  const source = file.sourceFile;
  const snapshotNames = new Set(['onSnapshot']);
  const namespaces = new Set<string>();
  for (const site of moduleImports(source, ['import'])) {
    if (!site.topLevel || !FIRESTORE_SDK.test(site.spec)) continue;
    if (site.namespace) namespaces.add(site.namespace);
    for (const name of site.named)
      if (name.imported === 'onSnapshot') snapshotNames.add(name.local);
  }
  const hits: Hit[] = [];
  const at = (node: ts.Node, detail: string) => hits.push({ index: node.getStart(source), detail });
  forEachNode(source, (node) => {
    if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.parent)) {
      const key =
        ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
      if (key === 'subscribe' && node.initializer.kind !== ts.SyntaxKind.FalseKeyword)
        at(node, `subscribe: ${node.initializer.getText(source)}`);
    } else if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'subscribe') {
      at(node, '{ subscribe }');
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && snapshotNames.has(callee.text)) at(node, `${callee.text}(…)`);
      else if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'onSnapshot')
        at(node, `${callee.getText(source)}(…)`);
    }
  });
  return hits;
}

export interface LiveSubscriptionFacts {
  /** App files reviewed to open a live Firestore subscription, each with why it needs real-time delivery. */
  allowlist: readonly Reviewed[];
}

export const liveSubscriptionGuard: GenericGuardDefinition<LiveSubscriptionFacts> = {
  id: 'firestoreLiveSubscriptions',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems(facts) {
    const problems: string[] = [];
    reviewedProblems(facts?.allowlist, 'allowlist', problems);
    return problems;
  },
  build(facts) {
    return [
      reviewedAllowlist({
        title: 'every live Firestore subscription is on the reviewed list',
        description:
          'A live read bills a document read on every change for as long as it is mounted, so it is a reviewed exception: ' +
          'a file that declares live mode — a subscribe option set to anything but a literal false, the { subscribe } ' +
          "shorthand, or an onSnapshot call under any name the file bound the Firestore SDK's to — is on the reviewed " +
          'list with why it needs real-time delivery. Fix: read once and keep it fresh through the cache, or add the ' +
          'reviewed entry. An entry whose file no longer subscribes is stale.',
        scope: APP_SOURCE,
        match: liveSubscriptionHits,
        allowlist: facts.allowlist,
        samples: {
          flags: [
            'useFirestoreDoc({ docPath, queryKey, subscribe: true });',
            'useBatchFirestoreDocs({ ids, subscribe: isLive });',
            'useFirestoreCollection({ collectionPath, subscribe, enabled });',
            "import { doc, onSnapshot as listen } from 'firebase/firestore';\nconst stop = listen(doc(db, p), render);",
            "import * as fs from 'firebase/firestore';\nconst stop = fs.onSnapshot(ref, handle);",
          ],
          passes: [
            "useBatchFirestoreDocs({ db, collectionPath, ids, transport: 'get' });",
            'useFirestoreDoc({ docPath, queryKey, subscribe: false });',
            'const unsubscribe = cache.subscribe((event) => handle(event));',
            'return useSyncExternalStore(subscribe, readValue, getServerValue);',
            '// subscribe: true is a reviewed exception\nconst x = 1;',
          ],
        },
      }),
    ];
  },
};

export interface FirestoreRuntimeInUiFacts {
  /** Repo-relative folders that hold components and routes (`src/components`, `src/app`). */
  uiFolders: readonly string[];
  /** Root providers reviewed to read Firestore directly, each with its why. */
  sanctioned: readonly Reviewed[];
}

/** Every runtime (not type-only) import of the Firestore SDK in one file. */
export function firestoreRuntimeImports(file: FileView): Hit[] {
  const source = file.sourceFile;
  const hits: Hit[] = [];
  for (const site of moduleImports(source, ['import', 'export', 'dynamic'])) {
    if (!FIRESTORE_SDK.test(site.spec)) continue;
    const at = site.node.getStart(source);
    if (site.kind === 'import') {
      const typeOnly =
        !site.sideEffect &&
        (site.typeOnly ||
          (!site.defaultName &&
            !site.namespace &&
            site.named.length > 0 &&
            site.named.every((n) => n.typeOnly)));
      if (!typeOnly) hits.push({ index: at, detail: `import from '${site.spec}'` });
    } else if (site.kind === 'export') {
      if (!site.typeOnly) hits.push({ index: at, detail: `re-export from '${site.spec}'` });
    } else hits.push({ index: at, detail: `import('${site.spec}')` });
  }
  return hits;
}

export const firestoreRuntimeInUiGuard: GenericGuardDefinition<FirestoreRuntimeInUiFacts> = {
  id: 'firestoreRuntimeInUi',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems(facts) {
    const problems: string[] = [];
    namesProblem(facts?.uiFolders, 'uiFolders', problems);
    reviewedProblems(facts?.sanctioned, 'sanctioned', problems);
    return problems;
  },
  build(facts) {
    const inUi = (path: string) => facts.uiFolders.some((folder) => isUnder(path, folder));
    return [
      reviewedAllowlist({
        title: 'no component or route imports the Firestore runtime',
        description:
          'A component or route that reaches into Firestore bypasses the cache, the query keys, and every server check ' +
          'at once. Flagged: a runtime import, re-export, or dynamic import of the Firestore SDK (a type-only import ' +
          'passes) in the UI folders. Fix: read through a hook, write through a callable. A sanctioned root provider is ' +
          'a reviewed entry with its why; one that no longer imports the runtime is stale.',
        scope: APP_SOURCE,
        match: (file) => (inUi(file.path) ? firestoreRuntimeImports(file) : []),
        allowlist: facts.sanctioned,
        samples: {
          flags: [
            {
              path: `${facts.uiFolders[0]}/probe.tsx`,
              text: "import { doc, getDoc } from 'firebase/firestore';",
            },
            {
              path: `${facts.uiFolders[0]}/probe.tsx`,
              text: 'import {\n  updateDoc,\n} from "firebase/firestore";',
            },
          ],
          passes: [
            {
              path: `${facts.uiFolders[0]}/typed.tsx`,
              text: "import type { Timestamp } from 'firebase/firestore';",
            },
            {
              path: `${facts.uiFolders[0]}/typed.tsx`,
              text: "import { type Timestamp } from 'firebase/firestore';",
            },
          ],
        },
      }),
    ];
  },
};
