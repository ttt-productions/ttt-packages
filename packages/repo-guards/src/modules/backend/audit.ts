import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding, Guard, GuardContext } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import type { Reviewed } from '../../node/layout.js';
import { ownerOnly, reviewedAllowlist, type Hit, type Matcher } from '../../shapes/shapes.js';
import { calleeName, forEachNode, isPlainString, lineOfNode, unwrap } from '../../support/ast.js';
import { namesProblem, reviewedProblems, textProblem } from '../../support/facts.js';
import { MODULE_LOADS, moduleImports, namesModule } from '../../support/imports.js';
import {
  serverZoneContext,
  serverZoneProblems,
  staleServerFolders,
  type ServerZone,
} from './shared.js';

const FUNCTIONS_CODE: Scope = { roots: ['functions'], kinds: ['code'], tests: false };

export interface AuditWriterFacts {
  writer: string;
  collectionName: string;
  collectionHandles: readonly string[];
  writerPackages: readonly string[];
  readers: readonly Reviewed[];
  personActor: { constructors: string; modeField: string; modes: readonly string[] };
  appServerZone: ServerZone;
}

const AUDIT_WRITER_SCOPE: Scope = {
  roots: ['functions', 'scripts', 'app'],
  optionalRoots: ['scripts'],
  kinds: ['code'],
  tests: false,
};

export function auditCollectionMatcher(
  facts: Pick<AuditWriterFacts, 'collectionName' | 'collectionHandles' | 'writerPackages'>,
): Matcher {
  const handles = new Set(facts.collectionHandles);
  const namesCollection = (text: string) =>
    text === facts.collectionName || text.startsWith(`${facts.collectionName}/`);
  return (file) => {
    const hits: Hit[] = [];
    const sf = file.sourceFile;
    const loads = new Map(moduleImports(sf, MODULE_LOADS).map((site) => [site.node, site.spec]));
    forEachNode(sf, (node) => {
      if (
        ts.isPropertyAccessExpression(node) &&
        handles.has(`${node.expression.getText(sf)}.${node.name.text}`)
      ) {
        hits.push({ index: node.getStart(sf), detail: node.getText(sf) });
      }
      const specifier = loads.get(node);
      if (specifier !== undefined && facts.writerPackages.some((p) => namesModule(specifier, p))) {
        hits.push({ index: node.getStart(sf), detail: `imports ${specifier}` });
        return;
      }
      const isSpecifier =
        !!node.parent &&
        (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent));
      if (isPlainString(node) && !isSpecifier && namesCollection(node.text)) {
        hits.push({ index: node.getStart(sf), detail: `'${node.text}'` });
      }
      if (ts.isTemplateExpression(node) && namesCollection(node.head.text)) {
        hits.push({ index: node.getStart(sf), detail: `${facts.collectionName} template path` });
      }
    });
    return hits;
  };
}

export function personActorMatcher(facts: AuditWriterFacts['personActor']): Matcher {
  const modes = new Set(facts.modes);
  return (file) => {
    const hits: Hit[] = [];
    const sf = file.sourceFile;
    forEachNode(sf, (node) => {
      if (!ts.isObjectLiteralExpression(node)) return;
      for (const prop of node.properties) {
        if (
          !ts.isPropertyAssignment(prop) ||
          prop.name.getText(sf).replace(/^['"]|['"]$/g, '') !== facts.modeField
        )
          continue;
        const init = unwrap(prop.initializer);
        if (ts.isStringLiteralLike(init) && modes.has(init.text)) {
          hits.push({ index: prop.getStart(sf), detail: `${facts.modeField}: '${init.text}'` });
        }
      }
    });
    return hits;
  };
}

export const auditWriterGuard: GenericGuardDefinition<AuditWriterFacts> = {
  id: 'auditWriter',
  absentWhen: 'the app records no audit events',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.writer, 'writer', problems);
    textProblem(facts?.collectionName, 'collectionName', problems);
    namesProblem(facts?.collectionHandles, 'collectionHandles', problems);
    for (const handle of facts?.collectionHandles ?? []) {
      if (typeof handle === 'string' && !/^[\w$]+\.[\w$]+$/.test(handle))
        problems.push(`collection handle ${handle} is not OWNER.member`);
    }
    namesProblem(facts?.writerPackages, 'writerPackages', problems, { nonEmpty: false });
    reviewedProblems(facts?.readers, 'readers', problems);
    if (facts?.readers?.some((r) => r?.path === facts.writer))
      problems.push('the writer is listed as a reader');
    textProblem(facts?.personActor?.constructors, 'personActor.constructors', problems);
    textProblem(facts?.personActor?.modeField, 'personActor.modeField', problems);
    namesProblem(facts?.personActor?.modes, 'personActor.modes', problems);
    serverZoneProblems(facts?.appServerZone, 'appServerZone', problems);
    return problems;
  },
  build(facts) {
    const collection = reviewedAllowlist({
      title: 'audit documents are written by the one audit writer',
      description:
        `Only ${facts.writer} names the audit collection (${facts.collectionName}, ${facts.collectionHandles.join(', ')}) ` +
        'or imports a package that writes it; a second writer would skip the attribution, the request origin, and the ' +
        'append-only rules the writer owns. Write audit events through the writer. A module that only READS the ' +
        'collection is a reviewed reader with its why; a reader that stops naming the collection is stale.',
      scope: AUDIT_WRITER_SCOPE,
      match: auditCollectionMatcher(facts),
      allowlist: [{ path: facts.writer, why: 'the one audit writer' }, ...facts.readers],
      samples: {
        flags: [
          `db.collection('${facts.collectionName}').add(event);`,
          `db.doc(\`${facts.collectionName}/\${id}\`).set(event);`,
          `db.collection(${facts.collectionHandles[0]}).doc(id).set(event);`,
        ],
        passes: [
          `// writes ${facts.collectionName} through ${facts.collectionHandles[0]}\nconst label = '${facts.collectionName}Count';`,
        ],
      },
    });
    const actors = ownerOnly({
      title: 'person-actors are built only by the actor constructors',
      description:
        `Only ${facts.personActor.constructors} writes an object whose ${facts.personActor.modeField} is a person mode ` +
        `(${facts.personActor.modes.join(', ')}). A person-actor carries the origin of the request it acted through; ` +
        'built by hand it can carry none, or a forged one. Build it with the actor constructors.',
      scope: AUDIT_WRITER_SCOPE,
      match: personActorMatcher(facts.personActor),
      owners: [facts.personActor.constructors],
      samples: {
        flags: [
          `const actor = { ${facts.personActor.modeField}: '${facts.personActor.modes[0]}' as const, uid };`,
        ],
        passes: [
          `type A = { ${facts.personActor.modeField}: '${facts.personActor.modes[0]}' };\nconst b = { other${facts.personActor.modeField}: '${facts.personActor.modes[0]}' };`,
        ],
      },
    });
    const inZone = (guard: Guard): Guard => ({
      ...guard,
      async run(context: GuardContext) {
        return [
          ...staleServerFolders(context, facts.appServerZone),
          ...(await guard.run(serverZoneContext(context, facts.appServerZone))),
        ];
      },
    });
    return [inZone(collection), inZone(actors)];
  },
};

export interface AuditPayloadFacts {
  entryPoints: readonly string[];
  payloadKey: string;
  forwardedPayloadKeys: readonly string[];
  operatorCopy: ReadonlyArray<{ site: string; why: string }>;
}

const PROSE_KEY =
  /(title|name|description|subject|body|text|message|content|caption|narrative|comment|bio|words)$/i;
const NAMES_NOT_TEXT = /(Lengths|Fields)$/;

export function proseKeysInAuditPayloads(
  file: FileView,
  facts: AuditPayloadFacts,
): Array<{ key: string; node: ts.Node }> {
  const sf = file.sourceFile;
  const entryPoints = new Set(facts.entryPoints);
  const forwarded = new Set(facts.forwardedPayloadKeys);
  const hits: Array<{ key: string; node: ts.Node }> = [];
  const keyOf = (prop: ts.ObjectLiteralElementLike) =>
    prop.name?.getText(sf).replace(/^['"`]|['"`]$/g, '') ?? '';
  const walkPayload = (obj: ts.ObjectLiteralExpression) => {
    for (const prop of obj.properties) {
      if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) continue;
      const key = keyOf(prop);
      if (PROSE_KEY.test(key)) hits.push({ key, node: prop });
      if (ts.isPropertyAssignment(prop) && !NAMES_NOT_TEXT.test(key)) {
        const value = unwrap(prop.initializer);
        if (ts.isObjectLiteralExpression(value)) walkPayload(value);
      }
    }
  };
  const payloadOf = (details: ts.ObjectLiteralExpression, keys: ReadonlySet<string>) => {
    for (const prop of details.properties) {
      if (!ts.isPropertyAssignment(prop) || !keys.has(keyOf(prop))) continue;
      const value = unwrap(prop.initializer);
      if (ts.isObjectLiteralExpression(value)) walkPayload(value);
    }
  };
  const payloadKeys = new Set([facts.payloadKey]);
  forEachNode(sf, (node) => {
    if (ts.isCallExpression(node) && entryPoints.has(calleeName(node) ?? '')) {
      for (const arg of node.arguments) {
        const value = unwrap(arg);
        if (ts.isObjectLiteralExpression(value)) payloadOf(value, payloadKeys);
      }
    }
    if (ts.isObjectLiteralExpression(node)) payloadOf(node, forwarded);
  });
  return hits;
}

export const auditPayloadGuard: GenericGuardDefinition<AuditPayloadFacts> = {
  id: 'auditPayload',
  absentWhen: 'the app records no audit events',
  factProblems(facts) {
    const problems: string[] = [];
    namesProblem(facts?.entryPoints, 'entryPoints', problems);
    textProblem(facts?.payloadKey, 'payloadKey', problems);
    namesProblem(facts?.forwardedPayloadKeys, 'forwardedPayloadKeys', problems, {
      nonEmpty: false,
    });
    reviewedProblems(facts?.operatorCopy, 'operatorCopy', problems, { key: 'site' });
    for (const entry of facts?.operatorCopy ?? []) {
      if (typeof entry?.site === 'string' && !/^[^#]+#[^#]+$/.test(entry.site))
        problems.push(`operatorCopy site ${entry.site} is not file#key`);
    }
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'no member-written text is copied into an audit payload',
        description:
          'An audit payload records identifiers, field names, lengths, and decisions — never member-written text. An audit ' +
          'event outlives every edit and every erasure, so a title, name, description, subject, body, or message copied ' +
          "into one survives the member's own change and their account's deletion. Record the changed field names and " +
          'their lengths instead. A key under a `…Lengths` or `…Fields` map names fields and is exempt; text an operator ' +
          'writes is a reviewed `file#key` entry with its why, and an entry that no longer occurs is stale.',
        run(context) {
          const findings: Finding[] = [];
          const reviewed = new Set(facts.operatorCopy.map((e) => e.site));
          const seen = new Set<string>();
          for (const file of context.files(FUNCTIONS_CODE)) {
            for (const { key, node } of proseKeysInAuditPayloads(file, facts)) {
              const site = `${file.path}#${key}`;
              seen.add(site);
              if (!reviewed.has(site))
                findings.push({
                  file: file.path,
                  line: lineOfNode(file, node),
                  detail: `prose-named payload key ${key}`,
                });
            }
          }
          for (const site of reviewed)
            if (!seen.has(site))
              findings.push({
                file: site,
                detail: 'stale operator-copy entry: the key no longer occurs',
              });
          return findings;
        },
      },
    ];
  },
};

export interface FailureAuditFacts {
  failureEntryPoints: readonly string[];
}

export function chainedFailureAudits(
  file: FileView,
  names: ReadonlySet<string>,
): Array<{ node: ts.Node; detail: string; name?: string }> {
  const sf = file.sourceFile;
  const hits: Array<{ node: ts.Node; detail: string; name?: string }> = [];
  forEachNode(sf, (node) => {
    if (
      ts.isImportSpecifier(node) &&
      node.propertyName &&
      names.has(node.propertyName.text) &&
      node.propertyName.text !== node.name.text
    ) {
      hits.push({ node, detail: `imports ${node.propertyName.text} under another name` });
    }
    const name = ts.isCallExpression(node) ? calleeName(node) : undefined;
    if (ts.isCallExpression(node) && name && names.has(name)) {
      const parent = node.parent;
      const chained =
        ts.isPropertyAccessExpression(parent) &&
        parent.expression === node &&
        ['catch', 'then', 'finally'].includes(parent.name.text);
      hits.push({
        node,
        name,
        detail: chained
          ? `chains .${(parent as ts.PropertyAccessExpression).name.text} onto ${name}`
          : '',
      });
    }
  });
  return hits;
}

export const failureAuditGuard: GenericGuardDefinition<FailureAuditFacts> = {
  id: 'failureAuditChain',
  absentWhen: 'the app records no audit events',
  factProblems(facts) {
    const problems: string[] = [];
    namesProblem(facts?.failureEntryPoints, 'failureEntryPoints', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'no handler is chained onto a failure-audit entry point',
        description:
          `The failure-audit entry points (${facts.failureEntryPoints.join(', ')}) never throw — each logs and captures a ` +
          'write that failed — so a `.catch`, `.then`, or `.finally` chained onto one is dead code that hides the contract, ' +
          'and an aliased import hides the call from this check. Import each under its own name and call it bare. Every ' +
          'declared entry point must still be called somewhere: one renamed away would pass unchecked.',
        run(context) {
          const names = new Set(facts.failureEntryPoints);
          const called = new Set<string>();
          const findings: Finding[] = [];
          for (const file of context.files(FUNCTIONS_CODE)) {
            for (const hit of chainedFailureAudits(file, names)) {
              if (hit.name) called.add(hit.name);
              if (hit.detail)
                findings.push({
                  file: file.path,
                  line: lineOfNode(file, hit.node),
                  detail: hit.detail,
                });
            }
          }
          for (const name of names)
            if (!called.has(name))
              findings.push({ file: '(failureEntryPoints)', detail: `${name} is called nowhere` });
          return findings;
        },
      },
    ];
  },
};

export interface RefusalAuditFacts {
  plainWriter: string;
  failureEntryPoints: readonly string[];
  systemActorBuilders: readonly string[];
  systemActorMode: { field: string; value: string };
  callableFactories: readonly string[];
}

function functionName(node: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(node)) return node.name?.text;
  if (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    ts.isVariableDeclaration(node.parent) &&
    ts.isIdentifier(node.parent.name)
  )
    return node.parent.name.text;
  return undefined;
}

export function refusalAuditShapes(
  file: FileView,
  facts: RefusalAuditFacts,
): { hits: Array<{ node: ts.Node; detail: string }>; called: Set<string> } {
  const sf = file.sourceFile;
  const failureNames = new Set(facts.failureEntryPoints);
  const builders = new Set(facts.systemActorBuilders);
  const factories = new Set(facts.callableFactories);
  const keyOf = (prop: ts.ObjectLiteralElementLike) =>
    prop.name?.getText(sf).replace(/^['"`]|['"`]$/g, '') ?? '';
  const called = new Set<string>();
  const systemLocals = new Set<string>();
  const isSystemActor = (expression: ts.Expression | undefined): boolean => {
    if (!expression) return false;
    const e = unwrap(expression);
    if (ts.isCallExpression(e)) return builders.has(calleeName(e) ?? '');
    if (ts.isIdentifier(e)) return systemLocals.has(e.text);
    if (!ts.isObjectLiteralExpression(e)) return false;
    return e.properties.some((prop) => {
      if (!ts.isPropertyAssignment(prop) || keyOf(prop) !== facts.systemActorMode.field)
        return false;
      const value = unwrap(prop.initializer);
      return ts.isStringLiteralLike(value) && value.text === facts.systemActorMode.value;
    });
  };
  let definesCallable = false;
  forEachNode(sf, (node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node) ?? '';
      if (factories.has(name)) definesCallable = true;
      if (name === facts.plainWriter || builders.has(name) || factories.has(name)) called.add(name);
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isSystemActor(node.initializer)
    )
      systemLocals.add(node.name.text);
  });
  const hits: Array<{ node: ts.Node; detail: string }> = [];
  if (!definesCallable) return { hits, called };
  const failureEvent = (call: ts.CallExpression) => {
    for (const arg of call.arguments) {
      const details = unwrap(arg);
      if (!ts.isObjectLiteralExpression(details)) continue;
      const result = details.properties.find(
        (prop): prop is ts.PropertyAssignment =>
          ts.isPropertyAssignment(prop) && keyOf(prop) === 'result',
      );
      const value = result && unwrap(result.initializer);
      if (value && ts.isStringLiteralLike(value) && value.text === 'failure')
        return { inTransaction: details.properties.some((prop) => keyOf(prop) === 'transaction') };
    }
    return undefined;
  };
  const walk = (node: ts.Node): void => {
    if (failureNames.has(functionName(node) ?? '')) return;
    if (ts.isCallExpression(node)) {
      const name = calleeName(node) ?? '';
      if (name === facts.plainWriter) {
        const event = failureEvent(node);
        if (event && !event.inTransaction)
          hits.push({
            node,
            detail: `${name} writes a failure event outside a transaction`,
          });
        if (event && isSystemActor(node.arguments[0]))
          hits.push({ node, detail: `${name} records a failure as the system` });
      }
      if (failureNames.has(name) && isSystemActor(node.arguments[0]))
        hits.push({ node, detail: `${name} records a refusal as the system` });
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return { hits, called };
}

export const refusalAuditGuard: GenericGuardDefinition<RefusalAuditFacts> = {
  id: 'refusalAudit',
  absentWhen: 'the app records no audit events',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.plainWriter, 'plainWriter', problems);
    namesProblem(facts?.failureEntryPoints, 'failureEntryPoints', problems);
    namesProblem(facts?.systemActorBuilders, 'systemActorBuilders', problems);
    textProblem(facts?.systemActorMode?.field, 'systemActorMode.field', problems);
    textProblem(facts?.systemActorMode?.value, 'systemActorMode.value', problems);
    namesProblem(facts?.callableFactories, 'callableFactories', problems);
    if (facts?.failureEntryPoints?.includes(facts?.plainWriter))
      problems.push('the plain writer is listed as a failure entry point');
    return problems;
  },
  build(facts) {
    return [
      {
        title: "a refusal's failure event goes through the failure entry points, as the caller",
        description:
          `In a module that defines a callable (${facts.callableFactories.join(', ')}), a failure event the plain writer ` +
          `${facts.plainWriter} writes outside a transaction is a refusal's record, and the plain writer throws when that ` +
          `write fails, so a failed record masks the refusal itself. Record it through a failure entry point ` +
          `(${facts.failureEntryPoints.join(', ')}), which never throws; only a failure event committed with the state it ` +
          'explains, in that transaction, uses the plain writer. A refusal is attributed to the person who was refused, ' +
          `with the request's origin, never to the system (${facts.systemActorBuilders.join(', ')}, or an actor whose ` +
          `${facts.systemActorMode.field} is '${facts.systemActorMode.value}'): use the operator's actor once they are ` +
          'authorized and the request-bound entry point before. Every declared writer, builder, and factory must still ' +
          'be called somewhere: one renamed away would pass unchecked.',
        run(context) {
          const findings: Finding[] = [];
          const called = new Set<string>();
          for (const file of context.files(FUNCTIONS_CODE)) {
            const shapes = refusalAuditShapes(file, facts);
            shapes.called.forEach((name) => called.add(name));
            for (const hit of shapes.hits)
              findings.push({
                file: file.path,
                line: lineOfNode(file, hit.node),
                detail: hit.detail,
              });
          }
          for (const name of [
            facts.plainWriter,
            ...facts.systemActorBuilders,
            ...facts.callableFactories,
          ])
            if (!called.has(name))
              findings.push({ file: '(refusalAudit)', detail: `${name} is called nowhere` });
          return findings;
        },
      },
    ];
  },
};

export interface FireAndForgetFacts {
  auditWrites: readonly string[];
  voidSites: readonly Reviewed[];
}

export function fireAndForgetShapes(file: FileView, auditWrites: ReadonlySet<string>) {
  const sf = file.sourceFile;
  const voided: ts.Node[] = [];
  const swallowed: Array<{ node: ts.Node; name: string }> = [];
  const writes: string[] = [];
  forEachNode(sf, (node) => {
    if (ts.isVoidExpression(node) && ts.isCallExpression(unwrap(node.expression)))
      voided.push(node);
    if (!ts.isCallExpression(node)) return;
    const name = calleeName(node);
    if (name && auditWrites.has(name)) writes.push(name);
    if (
      name === 'catch' &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isCallExpression(node.expression.expression)
    ) {
      const inner = calleeName(node.expression.expression);
      if (inner && auditWrites.has(inner)) swallowed.push({ node, name: inner });
    }
  });
  return { voided, swallowed, writes };
}

export const fireAndForgetGuard: GenericGuardDefinition<FireAndForgetFacts> = {
  id: 'fireAndForget',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    namesProblem(facts?.auditWrites, 'auditWrites', problems, { nonEmpty: false });
    reviewedProblems(facts?.voidSites, 'voidSites', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'no backend work is fired and forgotten, and no audit write is swallowed',
        description:
          'A `void`-ed call in a callable, trigger, or worker is never awaited and never has its failure captured, and the ' +
          'runtime throttles the instance once it has answered, so the work may never run. Await it inside its own ' +
          'try/catch with a capture, commit it in the primary transaction, or enqueue it to a durable outbox — a write ' +
          "composed into a caller's transaction is awaited like any other. A `.catch` chained onto an audit write is a " +
          'second, silent owner of a failure the best-effort failure-audit entry points already own. A reviewed `void` ' +
          'site is a file with its why; one with no `void`-ed call left is stale, and each declared audit write must still ' +
          'be called somewhere.',
        run(context) {
          const auditWrites = new Set(facts.auditWrites);
          const reviewed = new Set(facts.voidSites.map((s) => s.path));
          const voidFiles = new Set<string>();
          const called = new Set<string>();
          const findings: Finding[] = [];
          for (const file of context.files(FUNCTIONS_CODE)) {
            const { voided, swallowed, writes } = fireAndForgetShapes(file, auditWrites);
            writes.forEach((w) => called.add(w));
            if (voided.length) voidFiles.add(file.path);
            if (!reviewed.has(file.path)) {
              for (const node of voided)
                findings.push({
                  file: file.path,
                  line: lineOfNode(file, node),
                  detail: `fire-and-forget: ${node.getText(file.sourceFile).slice(0, 80)}`,
                });
            }
            for (const { node, name } of swallowed)
              findings.push({
                file: file.path,
                line: lineOfNode(file, node),
                detail: `${name}(…).catch(…) swallows an audit write`,
              });
          }
          for (const path of reviewed)
            if (!voidFiles.has(path))
              findings.push({
                file: path,
                detail: 'stale void site: the file has no void-ed call',
              });
          for (const name of auditWrites)
            if (!called.has(name))
              findings.push({ file: '(auditWrites)', detail: `${name} is called nowhere` });
          return findings;
        },
      },
    ];
  },
};
