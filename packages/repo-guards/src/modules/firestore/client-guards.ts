// The guards over client Firestore access:
//   - a live subscription is a reviewed exception;
//   - no component or route imports the Firestore runtime; reads go through hooks, writes through
//     callables, apart from reviewed root providers.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../config.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';
import { reviewedAllowlist, type Hit } from '../../shapes/shapes.js';
import { eachNode, nameListProblems, reviewedListProblems } from './support.js';

const FIRESTORE_SDK = /^firebase\/firestore(?:\/|$)/;
const APP_SOURCE: Scope = { roots: ['app'], kinds: ['code'], tests: false };

const importedFrom = (node: ts.ImportDeclaration) =>
  ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : '';

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
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !FIRESTORE_SDK.test(importedFrom(statement))) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if ((element.propertyName ?? element.name).text === 'onSnapshot') snapshotNames.add(element.name.text);
      }
    }
  }
  const hits: Hit[] = [];
  const at = (node: ts.Node, detail: string) => hits.push({ index: node.getStart(source), detail });
  eachNode(source, (node) => {
    if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.parent)) {
      const key = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
      if (key === 'subscribe' && node.initializer.kind !== ts.SyntaxKind.FalseKeyword) at(node, `subscribe: ${node.initializer.getText(source)}`);
    } else if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'subscribe') {
      at(node, '{ subscribe }');
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && snapshotNames.has(callee.text)) at(node, `${callee.text}(…)`);
      else if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'onSnapshot') at(node, `${callee.getText(source)}(…)`);
    }
  });
  return hits;
}

export interface LiveSubscriptionFacts {
  /** App files reviewed to open a live Firestore subscription, each with why it needs real-time delivery. */
  allowlist: ReadonlyArray<{ path: string; why: string }>;
}

export const liveSubscriptionGuard: GenericGuardDefinition<LiveSubscriptionFacts> = {
  id: 'firestoreLiveSubscriptions',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems(facts) {
    return reviewedListProblems(facts?.allowlist, 'allowlist', 'path');
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
  sanctioned: ReadonlyArray<{ path: string; why: string }>;
}

/** Every runtime (not type-only) import of the Firestore SDK in one file. */
export function firestoreRuntimeImports(file: FileView): Hit[] {
  const source = file.sourceFile;
  const hits: Hit[] = [];
  eachNode(source, (node) => {
    if (ts.isImportDeclaration(node) && FIRESTORE_SDK.test(importedFrom(node))) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly =
        !!clause &&
        (clause.isTypeOnly ||
          (!clause.name && !!bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every((e) => e.isTypeOnly)));
      if (!typeOnly) hits.push({ index: node.getStart(source), detail: `import from '${importedFrom(node)}'` });
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      FIRESTORE_SDK.test(node.moduleSpecifier.text)
    ) {
      hits.push({ index: node.getStart(source), detail: `re-export from '${node.moduleSpecifier.text}'` });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      FIRESTORE_SDK.test(node.arguments[0].text)
    ) {
      hits.push({ index: node.getStart(source), detail: `import('${node.arguments[0].text}')` });
    }
  });
  return hits;
}

export const firestoreRuntimeInUiGuard: GenericGuardDefinition<FirestoreRuntimeInUiFacts> = {
  id: 'firestoreRuntimeInUi',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems(facts) {
    return [...nameListProblems(facts?.uiFolders, 'uiFolders'), ...reviewedListProblems(facts?.sanctioned, 'sanctioned', 'path')];
  },
  build(facts) {
    const inUi = (path: string) => facts.uiFolders.some((folder) => path.startsWith(`${folder.replace(/\/$/, '')}/`));
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
            { path: `${facts.uiFolders[0]}/probe.tsx`, text: "import { doc, getDoc } from 'firebase/firestore';" },
            { path: `${facts.uiFolders[0]}/probe.tsx`, text: 'import {\n  updateDoc,\n} from "firebase/firestore";' },
          ],
          passes: [
            { path: `${facts.uiFolders[0]}/typed.tsx`, text: "import type { Timestamp } from 'firebase/firestore';" },
            { path: `${facts.uiFolders[0]}/typed.tsx`, text: "import { type Timestamp } from 'firebase/firestore';" },
          ],
        },
      }),
    ];
  },
};
