// The audit guards: one writer of the audit collection, one builder of person-actors, no
// member-written text in an audit payload, and no handler wrapped around an audit write.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../config.js';
import type { Finding, Guard, GuardContext } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';
import { ownerOnly, reviewedAllowlist, type Hit, type Matcher } from '../../shapes/shapes.js';
import {
  calleeName,
  forEachNode,
  lineOfNode,
  namesProblem,
  reviewedProblems,
  serverZoneContext,
  serverZoneProblems,
  staleServerFolders,
  textProblem,
  unwrap,
  type ReviewedFile,
  type ServerZone,
} from './shared.js';

const FUNCTIONS_CODE: Scope = { roots: ['functions'], kinds: ['code'], tests: false };

// ---------------------------------------------------------------------------------------------
// One audit writer.

export interface AuditWriterFacts {
  /** The one module that writes audit documents. */
  writer: string;
  /** The audit collection's name as stored (`auditEvents`). */
  collectionName: string;
  /** The core's handles on the collection, as `OWNER.member` (`COLLECTIONS.AUDIT_EVENTS`). */
  collectionHandles: readonly string[];
  /** Packages that write audit documents themselves; only the writer imports them. */
  writerPackages: readonly string[];
  /** Modules that name the collection to READ it, never to write; a stale entry fails. */
  readers: readonly ReviewedFile[];
  /** The one module that builds a person-actor, the field that says an actor's mode, and the person modes. */
  personActor: { constructors: string; modeField: string; modes: readonly string[] };
  /** Server code in the app root, held to the same rules as the Functions tree. */
  appServerZone: ServerZone;
}

const AUDIT_WRITER_SCOPE: Scope = {
  roots: ['functions', 'scripts', 'app'],
  optionalRoots: ['scripts'],
  kinds: ['code'],
  tests: false,
};

/** Every place a file names the audit collection or imports a package that writes it. */
export function auditCollectionMatcher(facts: Pick<AuditWriterFacts, 'collectionName' | 'collectionHandles' | 'writerPackages'>): Matcher {
  const handles = new Set(facts.collectionHandles);
  const namesCollection = (text: string) => text === facts.collectionName || text.startsWith(`${facts.collectionName}/`);
  return (file) => {
    const hits: Hit[] = [];
    const sf = file.sourceFile;
    forEachNode(sf, (node) => {
      if (ts.isPropertyAccessExpression(node) && handles.has(`${node.expression.getText(sf)}.${node.name.text}`)) {
        hits.push({ index: node.getStart(sf), detail: node.getText(sf) });
      }
      const specifier =
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : ts.isCallExpression(node) &&
              (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
              node.arguments[0] &&
              ts.isStringLiteralLike(node.arguments[0])
            ? node.arguments[0].text
            : undefined;
      if (specifier !== undefined && facts.writerPackages.some((p) => specifier === p || specifier.startsWith(`${p}/`))) {
        hits.push({ index: node.getStart(sf), detail: `imports ${specifier}` });
        return;
      }
      const isSpecifier = !!node.parent && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent));
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isSpecifier && namesCollection(node.text)) {
        hits.push({ index: node.getStart(sf), detail: `'${node.text}'` });
      }
      if (ts.isTemplateExpression(node) && namesCollection(node.head.text)) {
        hits.push({ index: node.getStart(sf), detail: `${facts.collectionName} template path` });
      }
    });
    return hits;
  };
}

/** Every object literal that builds a person-actor by hand: its mode field set to a person mode. */
export function personActorMatcher(facts: AuditWriterFacts['personActor']): Matcher {
  const modes = new Set(facts.modes);
  return (file) => {
    const hits: Hit[] = [];
    const sf = file.sourceFile;
    forEachNode(sf, (node) => {
      if (!ts.isObjectLiteralExpression(node)) return;
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop) || prop.name.getText(sf).replace(/^['"]|['"]$/g, '') !== facts.modeField) continue;
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
      if (typeof handle === 'string' && !/^[\w$]+\.[\w$]+$/.test(handle)) problems.push(`collection handle ${handle} is not OWNER.member`);
    }
    namesProblem(facts?.writerPackages, 'writerPackages', problems, { nonEmpty: false });
    reviewedProblems(facts?.readers, 'readers', problems);
    if (facts?.readers?.some((r) => r?.path === facts.writer)) problems.push('the writer is listed as a reader');
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
        passes: [`// writes ${facts.collectionName} through ${facts.collectionHandles[0]}\nconst label = '${facts.collectionName}Count';`],
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
        flags: [`const actor = { ${facts.personActor.modeField}: '${facts.personActor.modes[0]}' as const, uid };`],
        passes: [`type A = { ${facts.personActor.modeField}: '${facts.personActor.modes[0]}' };\nconst b = { other${facts.personActor.modeField}: '${facts.personActor.modes[0]}' };`],
      },
    });
    const inZone = (guard: Guard): Guard => ({
      ...guard,
      async run(context: GuardContext) {
        return [...staleServerFolders(context, facts.appServerZone), ...(await guard.run(serverZoneContext(context, facts.appServerZone)))];
      },
    });
    return [inZone(collection), inZone(actors)];
  },
};

// ---------------------------------------------------------------------------------------------
// No member-written text in an audit payload.

export interface AuditPayloadFacts {
  /** The audit writer's entry points (`writeAuditEventAs`, the failure entry points). */
  entryPoints: readonly string[];
  /** The key under which an entry point takes its payload (`payload`). */
  payloadKey: string;
  /** Keys elsewhere whose object literal is handed to an entry point as its payload (`auditPayload`). */
  forwardedPayloadKeys: readonly string[];
  /** Prose-named keys an operator (never a member) writes, as `file#key`, each with its why. */
  operatorCopy: ReadonlyArray<{ site: string; why: string }>;
}

/** A key named like prose: a title, a name, a body of text. */
const PROSE_KEY = /(title|name|description|subject|body|text|message|content|caption|narrative|comment|bio|words)$/i;
/** A map whose keys NAME fields rather than carry their text (`changedFieldLengths`). */
const NAMES_NOT_TEXT = /(Lengths|Fields)$/;

/** Every prose-named key, at any depth, of the payload literals a file hands to an audit entry point. */
export function proseKeysInAuditPayloads(file: FileView, facts: AuditPayloadFacts): Array<{ key: string; node: ts.Node }> {
  const sf = file.sourceFile;
  const entryPoints = new Set(facts.entryPoints);
  const forwarded = new Set(facts.forwardedPayloadKeys);
  const hits: Array<{ key: string; node: ts.Node }> = [];
  const keyOf = (prop: ts.ObjectLiteralElementLike) => prop.name?.getText(sf).replace(/^['"`]|['"`]$/g, '') ?? '';
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
    namesProblem(facts?.forwardedPayloadKeys, 'forwardedPayloadKeys', problems, { nonEmpty: false });
    reviewedProblems(facts?.operatorCopy, 'operatorCopy', problems, 'site');
    for (const entry of facts?.operatorCopy ?? []) {
      if (typeof entry?.site === 'string' && !/^[^#]+#[^#]+$/.test(entry.site)) problems.push(`operatorCopy site ${entry.site} is not file#key`);
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
              if (!reviewed.has(site)) findings.push({ file: file.path, line: lineOfNode(file, node), detail: `prose-named payload key ${key}` });
            }
          }
          for (const site of reviewed) if (!seen.has(site)) findings.push({ file: site, detail: 'stale operator-copy entry: the key no longer occurs' });
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// No handler chained onto a failure-audit entry point.

export interface FailureAuditFacts {
  /** The audit writer's best-effort failure entry points, which log and capture and never throw. */
  failureEntryPoints: readonly string[];
}

/** Each aliased import of a failure entry point, and each call with a handler chained onto it. */
export function chainedFailureAudits(file: FileView, names: ReadonlySet<string>): Array<{ node: ts.Node; detail: string; name?: string }> {
  const sf = file.sourceFile;
  const hits: Array<{ node: ts.Node; detail: string; name?: string }> = [];
  forEachNode(sf, (node) => {
    if (ts.isImportSpecifier(node) && node.propertyName && names.has(node.propertyName.text) && node.propertyName.text !== node.name.text) {
      hits.push({ node, detail: `imports ${node.propertyName.text} under another name` });
    }
    const name = ts.isCallExpression(node) ? calleeName(node) : undefined;
    if (ts.isCallExpression(node) && name && names.has(name)) {
      const parent = node.parent;
      const chained = ts.isPropertyAccessExpression(parent) && parent.expression === node && ['catch', 'then', 'finally'].includes(parent.name.text);
      hits.push({ node, name, detail: chained ? `chains .${(parent as ts.PropertyAccessExpression).name.text} onto ${name}` : '' });
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
              if (hit.detail) findings.push({ file: file.path, line: lineOfNode(file, hit.node), detail: hit.detail });
            }
          }
          for (const name of names) if (!called.has(name)) findings.push({ file: '(failureEntryPoints)', detail: `${name} is called nowhere` });
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// No fire-and-forget work and no swallowed audit write.

export interface FireAndForgetFacts {
  /** The audit writer's success entry points, whose failure is never swallowed by a `.catch`. */
  auditWrites: readonly string[];
  /** Files whose `void`-ed calls are reviewed, each with its why; a file that no longer has one is stale. */
  voidSites: readonly ReviewedFile[];
}

/** Every `void`-ed call, every `.catch` chained onto an audit write, and every audit write call. */
export function fireAndForgetShapes(file: FileView, auditWrites: ReadonlySet<string>) {
  const sf = file.sourceFile;
  const voided: ts.Node[] = [];
  const swallowed: Array<{ node: ts.Node; name: string }> = [];
  const writes: string[] = [];
  forEachNode(sf, (node) => {
    if (ts.isVoidExpression(node) && ts.isCallExpression(unwrap(node.expression))) voided.push(node);
    if (!ts.isCallExpression(node)) return;
    const name = calleeName(node);
    if (name && auditWrites.has(name)) writes.push(name);
    if (name === 'catch' && ts.isPropertyAccessExpression(node.expression) && ts.isCallExpression(node.expression.expression)) {
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
              for (const node of voided) findings.push({ file: file.path, line: lineOfNode(file, node), detail: `fire-and-forget: ${node.getText(file.sourceFile).slice(0, 80)}` });
            }
            for (const { node, name } of swallowed) findings.push({ file: file.path, line: lineOfNode(file, node), detail: `${name}(…).catch(…) swallows an audit write` });
          }
          for (const path of reviewed) if (!voidFiles.has(path)) findings.push({ file: path, detail: 'stale void site: the file has no void-ed call' });
          for (const name of auditWrites) if (!called.has(name)) findings.push({ file: '(auditWrites)', detail: `${name} is called nowhere` });
          return findings;
        },
      },
    ];
  },
};
