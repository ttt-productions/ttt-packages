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
import { LIVE_BY_CONSTRUCTION, type LiveByConstruction } from './live-by-construction.js';

const FIRESTORE_SDK = /^firebase\/firestore(?:\/|$)/;
const APP_SOURCE: Scope = { roots: ['app'], kinds: ['code'], tests: false };

function propertyName(node: ts.ObjectLiteralElementLike): string | null {
  if (ts.isShorthandPropertyAssignment(node)) return node.name.text;
  if (ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node))
    return ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
  return null;
}

// An object holding `read` beside `subscribe` is an external store source (query-core's
// `LiveSessionSource`); no Firestore read hook takes a `read` option.
function isStoreSource(object: ts.ObjectLiteralExpression): boolean {
  return object.properties.some((property) => propertyName(property) === 'read');
}

const liveDetail = ({ entry, export: name }: LiveByConstruction, reExported = false) =>
  `${name} (live by construction, from ${entry}${reExported ? ', re-exported' : ''})`;

function inTypePosition(node: ts.Node): boolean {
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent)
    if (ts.isTypeNode(up)) return true;
  return false;
}

// A local `export { X }` re-exports the binding it names; `export { X as Y }` names the binding X.
function isLocalReExport(node: ts.Node): boolean {
  const parent = node.parent;
  if (!ts.isExportSpecifier(parent)) return false;
  const declaration = parent.parent.parent;
  return (
    !declaration.moduleSpecifier &&
    !declaration.isTypeOnly &&
    !parent.isTypeOnly &&
    (parent.propertyName ?? parent.name) === node
  );
}

// A use of a live package export: a value reference to its local binding, or to the export through
// a namespace binding. A JSX closing tag repeats its opening tag and is not a second use.
function isUseSite(node: ts.Node): boolean {
  const parent = node.parent;
  if (ts.isJsxClosingElement(parent) || inTypePosition(node)) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent)) && parent.name === node)
    return false;
  if (ts.isExportSpecifier(parent)) return isLocalReExport(node);
  return !(
    ts.isImportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent)
  );
}

export function liveSubscriptionHits(file: FileView): Hit[] {
  const source = file.sourceFile;
  const snapshotNames = new Set(['onSnapshot']);
  const namespaces = new Set<string>();
  const liveLocals = new Map<string, LiveByConstruction>();
  const liveNamespaces = new Map<string, readonly LiveByConstruction[]>();
  const hits: Hit[] = [];
  const at = (node: ts.Node, detail: string) => hits.push({ index: node.getStart(source), detail });
  for (const site of moduleImports(source, ['import', 'export'])) {
    if (!site.topLevel) continue;
    if (site.kind === 'export') {
      const listed = LIVE_BY_CONSTRUCTION.filter(({ entry }) => entry === site.spec);
      if (site.typeOnly) continue;
      const reExported = site.star
        ? listed
        : listed.filter((l) => site.named.some((n) => !n.typeOnly && n.imported === l.export));
      for (const live of reExported) at(site.node, liveDetail(live, true));
      continue;
    }
    if (FIRESTORE_SDK.test(site.spec)) {
      if (site.namespace) namespaces.add(site.namespace);
      for (const name of site.named)
        if (name.imported === 'onSnapshot') snapshotNames.add(name.local);
      continue;
    }
    const listed = LIVE_BY_CONSTRUCTION.filter(({ entry }) => entry === site.spec);
    if (!listed.length || site.typeOnly) continue;
    if (site.namespace) liveNamespaces.set(site.namespace, listed);
    for (const name of site.named) {
      const live = listed.find((l) => l.export === name.imported);
      if (live && !name.typeOnly) liveLocals.set(name.local, live);
    }
  }
  forEachNode(source, (node) => {
    if (ts.isIdentifier(node) && liveLocals.has(node.text) && isUseSite(node))
      at(node, liveDetail(liveLocals.get(node.text)!, isLocalReExport(node)));
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      liveNamespaces.has(node.expression.text) &&
      isUseSite(node)
    ) {
      const live = liveNamespaces
        .get(node.expression.text)!
        .find((l) => l.export === node.name.text);
      if (live) at(node, liveDetail(live));
    }
    if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.parent)) {
      if (
        propertyName(node) === 'subscribe' &&
        node.initializer.kind !== ts.SyntaxKind.FalseKeyword &&
        !isStoreSource(node.parent)
      )
        at(node, `subscribe: ${node.initializer.getText(source)}`);
    } else if (
      ts.isShorthandPropertyAssignment(node) &&
      node.name.text === 'subscribe' &&
      !isStoreSource(node.parent)
    ) {
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
          "shorthand, or an onSnapshot call under any name the file bound the Firestore SDK's to — or that calls or " +
          'renders a package hook or component that always subscribes (it is imported from its package entry by name or ' +
          'through a namespace) or re-exports one — is on the reviewed list with why it needs real-time delivery. A file that ' +
          're-exports such an export is the reviewed one; the files that import it through that re-export are not followed. ' +
          'An object holding read beside subscribe is a store source (a ' +
          'session feed), not a read option, and is not live mode. Fix: read once and keep it fresh through the cache, or add the ' +
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
            "import { useActiveNotifications } from '@ttt-productions/notification-core/react';\nconst list = useActiveNotifications(options);",
            {
              path: 'src/sample.tsx',
              text: "import { NotificationList } from '@ttt-productions/notification-core/react';\nexport const Bell = () => <NotificationList {...props} />;",
            },
          ],
          passes: [
            "useBatchFirestoreDocs({ db, collectionPath, ids, transport: 'get' });",
            'useFirestoreDoc({ docPath, queryKey, subscribe: false });',
            'const unsubscribe = cache.subscribe((event) => handle(event));',
            'return useSyncExternalStore(subscribe, readValue, getServerValue);',
            'const LIVE_SESSION: LiveSessionSource = { read: liveUid, subscribe: subscribeSession };',
            '<MutationSessionProvider liveSession={{ read, subscribe }} />;',
            '// subscribe: true is a reviewed exception\nconst x = 1;',
            'const useActiveNotifications = () => [];\nconst list = useActiveNotifications();',
            "import type { useActiveNotifications } from '@ttt-productions/notification-core/react';\ntype List = ReturnType<typeof useActiveNotifications>;",
          ],
        },
      }),
    ];
  },
};

export interface FirestoreRuntimeInUiFacts {
  uiFolders: readonly string[];
  sanctioned: readonly Reviewed[];
}

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

const CLIENT_WRITES = new Set([
  'setDoc',
  'updateDoc',
  'deleteDoc',
  'addDoc',
  'writeBatch',
  'runTransaction',
]);

export interface FirestoreClientWritesFacts {
  sanctioned: readonly Reviewed[];
}

export function firestoreClientWriteHits(file: FileView): Hit[] {
  const source = file.sourceFile;
  const hits: Hit[] = [];
  const namespaces = new Set<string>();
  for (const site of moduleImports(source, ['import', 'export'])) {
    if (!FIRESTORE_SDK.test(site.spec) || site.typeOnly) continue;
    if (site.namespace) namespaces.add(site.namespace);
    for (const name of site.named)
      if (!name.typeOnly && CLIENT_WRITES.has(name.imported))
        hits.push({
          index: site.node.getStart(source),
          detail: `${name.imported} from '${site.spec}'`,
        });
  }
  forEachNode(source, (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      namespaces.has(node.expression.text) &&
      CLIENT_WRITES.has(node.name.text)
    )
      hits.push({ index: node.getStart(source), detail: node.getText(source) });
  });
  return hits;
}

export const firestoreClientWritesGuard: GenericGuardDefinition<FirestoreClientWritesFacts> = {
  id: 'firestoreClientWrites',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems(facts) {
    const problems: string[] = [];
    reviewedProblems(facts?.sanctioned, 'sanctioned', problems);
    return problems;
  },
  build(facts) {
    return [
      reviewedAllowlist({
        title: 'the client never writes Firestore',
        description:
          'Every write goes through a callable that checks it on the server; a client SDK write skips that check and ' +
          'every rule the callable enforces. Flagged: a runtime import of a Firestore write function (' +
          `${[...CLIENT_WRITES].join(', ')}) from the Firestore SDK, or a call to one through a namespace import, in ` +
          "the app's client source. Fix: call the callable that owns the write. A sanctioned site is a reviewed entry " +
          'with its why; one that no longer writes is stale.',
        scope: APP_SOURCE,
        match: firestoreClientWriteHits,
        allowlist: facts.sanctioned,
        samples: {
          flags: [
            "import { doc, setDoc } from 'firebase/firestore';",
            "import { writeBatch as batchOf } from 'firebase/firestore';",
            "import * as fs from 'firebase/firestore';\nawait fs.updateDoc(ref, patch);",
          ],
          passes: [
            "import { doc, getDoc, onSnapshot } from 'firebase/firestore';",
            "import { type WriteBatch } from 'firebase/firestore';",
            'await callable({ id });',
          ],
        },
      }),
    ];
  },
};
