import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding, Guard, GuardContext } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { Reviewed } from '../../node/layout.js';
import type { FileView } from '../../reader/view.js';
import { ownerOnly, reviewedAllowlist, type Hit, type Matcher } from '../../shapes/shapes.js';
import { calleeName, forEachNode, lineOfNode } from '../../support/ast.js';
import {
  importAliasesProblem,
  isText,
  namesProblem,
  objectProblem,
  pathProblem,
  reviewedProblems,
  takesNoFacts,
  textProblem,
} from '../../support/facts.js';
import { MODULE_LOADS, moduleImports } from '../../support/imports.js';
import { aliasList, resolveSpecifier } from '../../support/resolve-specifier.js';
import { escapeRegExp, isUnder } from '../../support/text.js';
import {
  declarationFactProblems,
  readDeclarations,
  type CallableDeclarationFacts,
} from '../frontend-actions/declarations.js';
import {
  inServerZone,
  serverZoneContext,
  serverZoneProblems,
  staleServerFolders,
  type ServerZone,
} from './shared.js';

const FUNCTIONS_CODE: Scope = { roots: ['functions'], kinds: ['code'], tests: false };

export interface AdminClaimFacts {
  claimKeys: readonly string[];
  readers: readonly Reviewed[];
  appServerZone: ServerZone;
}

const CLAIM_RECEIVER = String.raw`(?:[\w$]*[Tt]oken|[\w$]*[Cc]laims|decoded[\w$]*)`;

export function adminClaimMatcher(claimKeys: readonly string[]): Matcher {
  const keys = claimKeys.map(escapeRegExp).join('|');
  const patterns = [
    new RegExp(String.raw`\b${CLAIM_RECEIVER}\s*(?:\?\.|\.)\s*(?:${keys})\b`, 'g'),
    new RegExp(String.raw`\b${CLAIM_RECEIVER}\s*(?:\?\.)?\s*\[\s*(['"\`])(?:${keys})\1\s*\]`, 'g'),
    new RegExp(
      String.raw`\{[^{}\n]*\b(?:${keys})\b[^{}\n]*\}\s*=\s*[^;\n]*${CLAIM_RECEIVER}\b`,
      'g',
    ),
  ];
  return (file) => {
    const hits: Hit[] = [];
    for (const re of patterns) {
      const g = new RegExp(re.source, re.flags);
      for (let m = g.exec(file.code); m; m = g.exec(file.code))
        hits.push({ index: m.index, detail: m[0].trim().slice(0, 80) });
    }
    return hits.sort((a, b) => a.index - b.index);
  };
}

export const adminClaimGuard: GenericGuardDefinition<AdminClaimFacts> = {
  id: 'adminClaimRead',
  absentWhen: 'the app has no admin claim',
  factProblems(facts) {
    const problems: string[] = [];
    namesProblem(facts?.claimKeys, 'claimKeys', problems);
    reviewedProblems(facts?.readers, 'readers', problems, { nonEmpty: true });
    serverZoneProblems(facts?.appServerZone, 'appServerZone', problems);
    return problems;
  },
  build(facts) {
    const guard = reviewedAllowlist({
      title: 'the admin claim is read only by its resolver',
      description:
        `No server module reads an admin claim (${facts.claimKeys.join(', ')}) off a token or claims payload — by member ` +
        'access, bracket access, or destructuring — outside the reviewed readers. The claim is metadata and stays true ' +
        'for up to an hour after a demotion, and anything signed from it outlives the revocation by its own lifetime. ' +
        "Resolve admin standing through the resolver's authoritative read, failing closed on a read failure. Writing the " +
        'claim is not a read. A reviewed reader that no longer reads the claim is stale.',
      scope: {
        roots: ['functions', 'app'],
        optionalRoots: ['functions'],
        kinds: ['code'],
        tests: false,
      },
      match: adminClaimMatcher(facts.claimKeys),
      allowlist: facts.readers,
      samples: {
        flags: [
          `if (request.auth.token.${facts.claimKeys[0]} === true) return all;`,
          `const a = decoded?.['${facts.claimKeys[0]}'];`,
          `const { uid, ${facts.claimKeys[0]} = false } = ctx.token;`,
        ],
        passes: [
          `await auth.setCustomUserClaims(uid, { ${facts.claimKeys[0]}: true });\nif (args.${facts.claimKeys[0]}) run();`,
        ],
      },
    });
    return [
      {
        ...guard,
        async run(context: GuardContext) {
          return [
            ...staleServerFolders(context, facts.appServerZone),
            ...(await guard.run(serverZoneContext(context, facts.appServerZone))),
          ];
        },
      },
    ];
  },
};

export interface RequestOriginFacts {
  reader: string;
}

const ORIGIN_READ = /\brawRequest\b|x-forwarded-for|\breq\s*\.\s*ip\b/gi;

export const requestOriginGuard: GenericGuardDefinition<RequestOriginFacts> = {
  id: 'requestOrigin',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.reader, 'reader', problems);
    return problems;
  },
  build(facts) {
    return [
      ownerOnly({
        title: "a request's origin is read in one place",
        description: `A request's origin is read only in ${facts.reader}, which must still hold the read.`,
        scope: FUNCTIONS_CODE,
        match: (file) => {
          const re = new RegExp(ORIGIN_READ.source, ORIGIN_READ.flags);
          const hits: Hit[] = [];
          for (let m = re.exec(file.code); m; m = re.exec(file.code))
            hits.push({ index: m.index, detail: m[0] });
          return hits;
        },
        owners: [facts.reader],
        samples: {
          flags: [
            'const ip = request.rawRequest?.ip ?? null;',
            "const hops = headers['x-forwarded-for'];",
            'const caller = req.ip;',
            'const { rawRequest } = request;',
          ],
          passes: ['const facts = { ip: context.ip };\n// rawRequest is read only by the reader'],
        },
      }),
    ];
  },
};

export type NoBlockingFunctionFacts = Record<string, never>;

const BLOCKING_MODULE = /^firebase-functions\/(?:v2\/)?identity$/;
const BLOCKING_BUILDERS = new Set(['beforeCreate', 'beforeSignIn', 'beforeEmail', 'beforeSms']);

export function blockingFunctionSites(file: FileView): Array<{ node: ts.Node; detail: string }> {
  const out: Array<{ node: ts.Node; detail: string }> = [];
  for (const { spec, node } of moduleImports(file.sourceFile, MODULE_LOADS))
    if (BLOCKING_MODULE.test(spec)) out.push({ node, detail: `imports ${spec}` });
  forEachNode(file.sourceFile, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      BLOCKING_BUILDERS.has(node.expression.name.text)
    ) {
      out.push({ node, detail: `registers ${node.expression.name.text}` });
    }
  });
  return out;
}

export const noBlockingFunctionGuard: GenericGuardDefinition<NoBlockingFunctionFacts> = {
  id: 'noAuthBlockingFunction',
  absentWhen: false,
  factProblems: takesNoFacts,
  build() {
    return [
      {
        title: 'no sign-in waits on a blocking function',
        description:
          'No Functions source registers an Identity Platform blocking function (the identity module, or a v1 ' +
          'beforeCreate / beforeSignIn / beforeEmail / beforeSms builder). Identity Platform refuses a sign-up or ' +
          'sign-in whose blocking function has not answered within seconds, and a cold instance can take longer than ' +
          'that to start, so a blocking function refuses members at random. Do the work after the fact instead.',
        run(context) {
          return context.files(FUNCTIONS_CODE).flatMap((file) =>
            blockingFunctionSites(file).map(({ node, detail }) => ({
              file: file.path,
              line: lineOfNode(file, node),
              detail,
            })),
          );
        },
      },
    ];
  },
};

export interface AppCheckFacts {
  consumingFolders: readonly string[];
  adminAuth: { call: string; option: string };
  consumptionExempt: ReadonlyArray<{ callable: string; why: string }>;
  clientDeclarations: CallableDeclarationFacts;
  noClientDeclaration: ReadonlyArray<{ callable: string; why: string }>;
}

interface Callable {
  name: string;
  node: ts.Node;
  options: ts.ObjectLiteralExpression | null;
}

const isOnCall = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === 'onCall';

const declaresTrue = (options: ts.ObjectLiteralExpression | null, key: string) =>
  !!options?.properties.some(
    (p) =>
      ts.isPropertyAssignment(p) &&
      p.name.getText().replace(/^['"]|['"]$/g, '') === key &&
      p.initializer.kind === ts.SyntaxKind.TrueKeyword,
  );

export function callablesOf(file: FileView): Callable[] {
  const sf = file.sourceFile;
  const optionsOf = (call: ts.CallExpression) =>
    call.arguments[0] && ts.isObjectLiteralExpression(call.arguments[0]) ? call.arguments[0] : null;
  const factories = new Map<string, ts.CallExpression>();
  const named = new Set<ts.CallExpression>();
  const out: Callable[] = [];
  forEachNode(sf, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      forEachNode(node.body, (n) => {
        if (ts.isReturnStatement(n) && n.expression && isOnCall(n.expression))
          factories.set(node.name!.text, n.expression);
      });
    }
  });
  forEachNode(sf, (node) => {
    if (
      !ts.isVariableDeclaration(node) ||
      !ts.isIdentifier(node.name) ||
      !node.initializer ||
      !ts.isCallExpression(node.initializer)
    )
      return;
    const init: ts.CallExpression = node.initializer;
    if (isOnCall(init as ts.Node)) {
      named.add(init);
      out.push({ name: node.name.text, node: init, options: optionsOf(init) });
    } else if (ts.isIdentifier(init.expression) && factories.has(init.expression.text)) {
      const made = factories.get(init.expression.text)!;
      named.add(made);
      out.push({ name: node.name.text, node: init, options: optionsOf(made) });
    }
  });
  forEachNode(sf, (node) => {
    if (isOnCall(node) && !named.has(node))
      out.push({
        name: `(onCall at line ${lineOfNode(file, node)})`,
        node,
        options: optionsOf(node),
      });
  });
  return out;
}

export function asksForAdmin(file: FileView, adminAuth: AppCheckFacts['adminAuth']): boolean {
  let found = false;
  forEachNode(file.sourceFile, (node) => {
    if (found || !ts.isCallExpression(node) || calleeName(node) !== adminAuth.call) return;
    found = node.arguments.some(
      (arg) =>
        ts.isObjectLiteralExpression(arg) &&
        arg.properties.some(
          (p) => p.name?.getText().replace(/^['"]|['"]$/g, '') === adminAuth.option,
        ),
    );
  });
  return found;
}

export const appCheckGuard: GenericGuardDefinition<AppCheckFacts> = {
  id: 'appCheck',
  absentWhen: 'the app has no callable functions',
  factProblems(facts) {
    const problems: string[] = [];
    namesProblem(facts?.consumingFolders, 'consumingFolders', problems, { nonEmpty: false });
    textProblem(facts?.adminAuth?.call, 'adminAuth.call', problems);
    textProblem(facts?.adminAuth?.option, 'adminAuth.option', problems);
    reviewedProblems(facts?.consumptionExempt, 'consumptionExempt', problems, { key: 'callable' });
    declarationFactProblems(facts?.clientDeclarations, 'clientDeclarations', problems);
    reviewedProblems(facts?.noClientDeclaration, 'noClientDeclaration', problems, {
      key: 'callable',
    });
    return problems;
  },
  build(facts) {
    const posture: Guard = {
      title: 'every callable declares its App Check posture',
      description:
        'Every `onCall` opens with a literal options object (one this check cannot read fails, never passes) that ' +
        'declares `enforceAppCheck: true`: attestation sits beneath auth and neither substitutes for the other. A ' +
        `callable in a consuming folder (${facts.consumingFolders.join(', ') || 'none declared'}), and every callable in a ` +
        `file whose ${facts.adminAuth.call} asks for ${facts.adminAuth.option}, also declares \`consumeAppCheckToken: true\`, ` +
        'so its attestation token is spent instead of reusable for its whole lifetime. A callable that keeps the cached ' +
        'token is a reviewed exemption with its why; an exemption whose callable is gone or now consumes is stale.',
      run(context) {
        const findings: Finding[] = [];
        const exempt = new Map(facts.consumptionExempt.map((e) => [e.callable, e]));
        const exemptSeen = new Set<string>();
        const foldersWithCallables = new Set<string>();
        let callables = 0;
        for (const file of context.files(FUNCTIONS_CODE)) {
          const list = callablesOf(file);
          if (!list.length) continue;
          callables += list.length;
          const folder = facts.consumingFolders.find((f) => isUnder(file.path, f));
          if (folder) foldersWithCallables.add(folder);
          const mustConsume = !!folder || asksForAdmin(file, facts.adminAuth);
          for (const callable of list) {
            const line = lineOfNode(file, callable.node);
            if (!callable.options) {
              findings.push({
                file: file.path,
                line,
                detail: `${callable.name}: the onCall options are not an object literal, so the posture cannot be read`,
              });
              continue;
            }
            if (!declaresTrue(callable.options, 'enforceAppCheck'))
              findings.push({
                file: file.path,
                line,
                detail: `${callable.name}: no enforceAppCheck: true`,
              });
            const consumes = declaresTrue(callable.options, 'consumeAppCheckToken');
            if (exempt.has(callable.name)) {
              exemptSeen.add(callable.name);
              if (consumes)
                findings.push({
                  file: file.path,
                  line,
                  detail: `stale exemption: ${callable.name} now consumes its token`,
                });
              else if (!mustConsume)
                findings.push({
                  file: file.path,
                  line,
                  detail: `stale exemption: ${callable.name} is not a consuming callable`,
                });
            } else if (mustConsume && !consumes) {
              findings.push({
                file: file.path,
                line,
                detail: `${callable.name}: no consumeAppCheckToken: true`,
              });
            }
          }
        }
        if (!callables)
          findings.push({
            file: '(functions)',
            detail: 'no onCall found, so the guard checks nothing',
          });
        for (const folder of facts.consumingFolders)
          if (!foldersWithCallables.has(folder))
            findings.push({ file: folder, detail: 'stale consuming folder: it holds no callable' });
        for (const name of exempt.keys())
          if (!exemptSeen.has(name))
            findings.push({
              file: '(consumptionExempt)',
              detail: `stale exemption: no callable is named ${name}`,
            });
        return findings;
      },
    };
    const client: Guard = {
      title: "a consuming callable's client declaration presents a limited-use token",
      description:
        'Every callable whose options declare `consumeAppCheckToken: true` has a client declaration in ' +
        `${facts.clientDeclarations.modules.join(', ')} carrying \`limitedUseAppCheck: true\`, so the token the server ` +
        'spends is a single-use one rather than the cached token every other call reuses. A declaration carrying it names ' +
        'a callable that consumes: one that names no callable, or a callable that keeps the cached token (an exempt one ' +
        'included), mints a token per call for nothing. A consuming callable no client calls is a reviewed entry with ' +
        'its why; an entry that is no longer a consuming callable, or that a declaration now names, is stale.',
      run(context) {
        const { declared, findings } = readDeclarations(context, facts.clientDeclarations);
        const servers = new Map<string, { consumes: boolean; file: string; line: number }>();
        for (const file of context.files(FUNCTIONS_CODE)) {
          for (const callable of callablesOf(file)) {
            servers.set(callable.name, {
              consumes: declaresTrue(callable.options, 'consumeAppCheckToken'),
              file: file.path,
              line: lineOfNode(file, callable.node),
            });
          }
        }
        if (!servers.size)
          findings.push({
            file: '(functions)',
            detail: 'no onCall found, so the guard checks nothing',
          });
        const byName = new Map(
          declared.filter((d) => d.callable !== null).map((d) => [d.callable!, d]),
        );
        const exempt = new Set(facts.consumptionExempt.map((e) => e.callable));
        const undeclared = new Set(facts.noClientDeclaration.map((e) => e.callable));
        for (const [name, server] of servers) {
          if (!server.consumes) continue;
          const declaration = byName.get(name);
          if (!declaration) {
            if (!undeclared.has(name))
              findings.push({
                file: server.file,
                line: server.line,
                detail: `${name} consumes its token, but no client declaration names it`,
              });
          } else if (!declaration.limitedUse) {
            findings.push({
              file: declaration.file,
              line: declaration.line,
              detail: `${declaration.hook} declares ${name}, which consumes its token, without limitedUseAppCheck: true`,
            });
          }
        }
        for (const declaration of declared) {
          if (!declaration.limitedUse || declaration.callable === null) continue;
          const server = servers.get(declaration.callable);
          const where = { file: declaration.file, line: declaration.line };
          if (!server)
            findings.push({
              ...where,
              detail: `${declaration.hook} declares ${declaration.callable} limited-use, but no callable of that name exists`,
            });
          else if (exempt.has(declaration.callable))
            findings.push({
              ...where,
              detail: `${declaration.hook} declares ${declaration.callable} limited-use, but it is exempt from consumption`,
            });
          else if (!server.consumes)
            findings.push({
              ...where,
              detail: `${declaration.hook} declares ${declaration.callable} limited-use, but it does not consume its token`,
            });
        }
        for (const name of undeclared) {
          if (byName.has(name))
            findings.push({
              file: '(noClientDeclaration)',
              detail: `stale entry: a client declaration names ${name} now`,
            });
          else if (!servers.get(name)?.consumes)
            findings.push({
              file: '(noClientDeclaration)',
              detail: `stale entry: ${name} is not a consuming callable`,
            });
        }
        return findings;
      },
    };
    return [posture, client];
  },
};

export interface AdminActionSurfaceFacts {
  adminAuth: { call: string; option: string };
  adminCheckers: readonly string[];
  checkerReaders: readonly Reviewed[];
  adminDeclarations: CallableDeclarationFacts;
  clientDeclarations: CallableDeclarationFacts;
  claimKeys: readonly string[];
  adminHooks: readonly string[];
  adminAreaRoots: readonly string[];
  affordanceOwner: string;
  reviewed: ReadonlyArray<{ path: string; symbol?: string; why: string }>;
  importAliases: Readonly<Record<string, string>>;
  appServerZone: ServerZone;
}

const APP_CLIENT_CODE: Scope = { roots: ['app'], kinds: ['code'], tests: false };

function authCallsIn(root: ts.Node, adminAuth: AdminActionSurfaceFacts['adminAuth']) {
  const calls: Array<{ admin: boolean }> = [];
  forEachNode(root, (node) => {
    if (!ts.isCallExpression(node) || calleeName(node) !== adminAuth.call) return;
    calls.push({
      admin: node.arguments.some(
        (arg) =>
          ts.isObjectLiteralExpression(arg) &&
          arg.properties.some(
            (p) =>
              p.name?.getText().replace(/^['"]|['"]$/g, '') === adminAuth.option &&
              !(ts.isPropertyAssignment(p) && isOffLiteral(p.initializer)),
          ),
      ),
    });
  });
  return calls;
}

const isOffLiteral = (value: ts.Expression): boolean =>
  value.kind === ts.SyntaxKind.FalseKeyword ||
  value.kind === ts.SyntaxKind.NullKeyword ||
  (ts.isIdentifier(value) && value.text === 'undefined');

export function adminOnlyCallables(
  file: FileView,
  adminAuth: AdminActionSurfaceFacts['adminAuth'],
): string[] {
  const moduleCalls = authCallsIn(file.sourceFile, adminAuth);
  return callablesOf(file)
    .filter((callable) => {
      const own = authCallsIn(callable.node, adminAuth);
      const calls = own.length ? own : moduleCalls;
      return calls.length > 0 && calls.every((c) => c.admin);
    })
    .map((callable) => callable.name);
}

interface ClientAdminUse {
  index: number;
  symbol: string;
  detail: string;
}

export function clientAdminUses(
  file: FileView,
  facts: Pick<AdminActionSurfaceFacts, 'claimKeys' | 'adminHooks'>,
  declarationModuleOf: (spec: string) => string | null,
  areaModuleOf: (spec: string) => string | null = () => null,
): ClientAdminUse[] {
  const out: ClientAdminUse[] = [];
  const keys = new RegExp(`\\b(${facts.claimKeys.map(escapeRegExp).join('|')})\\b`);
  for (const hit of adminClaimMatcher(facts.claimKeys)(file))
    out.push({
      index: hit.index,
      symbol: keys.exec(hit.detail ?? '')?.[1] ?? '',
      detail: `reads the admin claim (${hit.detail})`,
    });
  const hooks = new Set(facts.adminHooks);
  for (const site of moduleImports(file.sourceFile, MODULE_LOADS)) {
    const index = site.node.getStart(file.sourceFile);
    const module = declarationModuleOf(site.spec);
    if (module) {
      const names = site.named.map((n) => n.imported);
      for (const symbol of names.length ? names : ['*'])
        out.push({
          index,
          symbol,
          detail: `imports ${symbol} from the admin declarations ${module}`,
        });
      continue;
    }
    const area = site.typeOnly ? null : areaModuleOf(site.spec);
    if (area) {
      const names = site.named.filter((n) => !n.typeOnly).map((n) => n.imported);
      for (const symbol of site.named.length ? names : ['*'])
        out.push({
          index,
          symbol,
          detail: `imports ${symbol} from the admin area ${area}`,
        });
      continue;
    }
    for (const name of site.named)
      if (hooks.has(name.imported))
        out.push({
          index,
          symbol: name.imported,
          detail: `imports the admin hook ${name.imported}`,
        });
  }
  return out.sort((a, b) => a.index - b.index);
}

function adminAreaProblems(facts: AdminActionSurfaceFacts | undefined, problems: string[]): void {
  if (!Array.isArray(facts?.adminAreaRoots) || !facts.adminAreaRoots.length)
    problems.push('adminAreaRoots is missing');
  else facts.adminAreaRoots.forEach((r, i) => pathProblem(r, `adminAreaRoots[${i}]`, problems));
  pathProblem(facts?.affordanceOwner, 'affordanceOwner', problems);
  reviewedProblems(facts?.reviewed, 'reviewed', problems, {
    id: (e) =>
      typeof e.path === 'string' ? `${e.path}${isText(e.symbol) ? ` ${e.symbol}` : ''}` : undefined,
    extra(entry, label) {
      if (entry.symbol !== undefined && !isText(entry.symbol))
        problems.push(`${label}'s symbol is empty`);
    },
  });
}

export const adminActionSurfaceGuard: GenericGuardDefinition<AdminActionSurfaceFacts> = {
  id: 'adminActionSurface',
  absentWhen: 'the app has no admin actions',
  factProblems(facts) {
    const problems: string[] = [];
    if (objectProblem(facts?.adminAuth, 'adminAuth', problems)) {
      textProblem(facts.adminAuth.call, 'adminAuth.call', problems);
      textProblem(facts.adminAuth.option, 'adminAuth.option', problems);
    }
    namesProblem(facts?.adminCheckers, 'adminCheckers', problems);
    reviewedProblems(facts?.checkerReaders, 'checkerReaders', problems);
    declarationFactProblems(facts?.adminDeclarations, 'adminDeclarations', problems);
    declarationFactProblems(facts?.clientDeclarations, 'clientDeclarations', problems);
    namesProblem(facts?.claimKeys, 'claimKeys', problems);
    namesProblem(facts?.adminHooks, 'adminHooks', problems, { nonEmpty: false });
    adminAreaProblems(facts, problems);
    importAliasesProblem(facts?.importAliases, 'importAliases', problems);
    serverZoneProblems(facts?.appServerZone, 'appServerZone', problems);
    return problems;
  },
  build(facts) {
    const declarationModules = new Set(facts.adminDeclarations.modules);
    const probePath = `${facts.affordanceOwner.slice(0, facts.affordanceOwner.lastIndexOf('/') + 1)}probe.tsx`;
    return [
      {
        title: 'admin actions outside the admin area go through the admin-actions affordance',
        description:
          `The admin-only callables are every callable whose ${facts.adminAuth.call} calls all carry ` +
          `${facts.adminAuth.option}, read from the Functions source each run. Inside a callable module, admin standing ` +
          `is checked only through that auth call: ${facts.adminCheckers.join(', ')} is called only by the reviewed ` +
          `readers. ${facts.adminDeclarations.modules.join(', ')} declares only admin-only callables, and every admin-only ` +
          `callable the client declares (${facts.clientDeclarations.modules.join(', ')}) is declared there; one with no ` +
          `client declaration has no client caller. Outside the admin area (${facts.adminAreaRoots.join(', ')}) and the ` +
          `admin-actions affordance (${facts.affordanceOwner}), client code never reads the admin claim, imports an admin ` +
          'declaration, imports a module of the admin area, or imports an admin hook: an admin action there goes through ' +
          'the affordance, and any other admin-standing read is a ' +
          'reviewed entry ({ path, symbol?, why }). A reviewed reader or entry that no longer matches is stale.',
        samples: {
          flags: [
            { path: probePath, text: `if (claims?.${facts.claimKeys[0]}) show();` },
            ...facts.adminHooks
              .slice(0, 1)
              .map((hook) => ({ path: probePath, text: `import { ${hook} } from './hooks';` })),
          ],
          passes: [
            { path: probePath, text: `const label = '${facts.claimKeys[0]}';` },
            { path: probePath, text: "import { useRows } from './hooks';" },
          ],
          probe: (view) => clientAdminUses(view, facts, () => null),
        },
        run(context) {
          const findings: Finding[] = [];
          const adminCallables = new Map<string, { file: string; line: number }>();
          const readers = new Map(facts.checkerReaders.map((r) => [r.path, false]));
          const checkers = new Set(facts.adminCheckers);
          for (const file of context.files(FUNCTIONS_CODE)) {
            const callables = callablesOf(file);
            if (!callables.length) continue;
            for (const name of adminOnlyCallables(file, facts.adminAuth)) {
              const callable = callables.find((c) => c.name === name)!;
              adminCallables.set(name, { file: file.path, line: lineOfNode(file, callable.node) });
            }
            forEachNode(file.sourceFile, (node) => {
              if (!ts.isCallExpression(node)) return;
              const name = calleeName(node);
              if (!name || !checkers.has(name)) return;
              if (readers.has(file.path)) readers.set(file.path, true);
              else
                findings.push({
                  file: file.path,
                  line: lineOfNode(file, node),
                  detail: `a callable module checks admin standing through ${name} instead of its ${facts.adminAuth.call}`,
                });
            });
          }
          for (const [path, used] of readers)
            if (!used)
              findings.push({
                file: path,
                detail: 'stale reader: it no longer calls an admin checker in a callable module',
              });
          if (!adminCallables.size)
            findings.push({
              file: '(functions)',
              detail: `no callable asks ${facts.adminAuth.call} for ${facts.adminAuth.option}, so no admin-only callable was found`,
            });

          const { declared, findings: declarationFindings } = readDeclarations(
            context,
            facts.adminDeclarations,
          );
          findings.push(...declarationFindings);
          const clientRead = readDeclarations(context, {
            ...facts.clientDeclarations,
            modules: facts.clientDeclarations.modules.filter((m) => !declarationModules.has(m)),
          });
          findings.push(...clientRead.findings);
          const clientDeclared = new Set(
            [...declared, ...clientRead.declared]
              .map((d) => d.callable)
              .filter((c): c is string => c !== null),
          );
          const declaredNames = new Set<string>();
          for (const d of declared) {
            if (d.callable === null) continue;
            declaredNames.add(d.callable);
            if (!adminCallables.has(d.callable))
              findings.push({
                file: d.file,
                line: d.line,
                detail: `${d.hook} declares ${d.callable}, which is not an admin-only callable`,
              });
          }
          for (const [name, where] of adminCallables)
            if (clientDeclared.has(name) && !declaredNames.has(name))
              findings.push({
                ...where,
                detail: `${name} is admin-only, but the client declares it outside ${facts.adminDeclarations.modules.join(', ')}`,
              });

          for (const root of facts.adminAreaRoots)
            if (!context.reader.exists(root))
              findings.push({ file: root, detail: 'stale admin-area root: it no longer exists' });
          const ownerExists = context.reader.exists(facts.affordanceOwner);
          if (!ownerExists)
            findings.push({
              file: facts.affordanceOwner,
              detail: 'the admin-actions affordance no longer exists',
            });
          const aliases = aliasList(facts.importAliases);
          const reviewedKey = (e: { path: string; symbol?: string }) =>
            `${e.path}${e.symbol ? ` ${e.symbol}` : ''}`;
          const reviewedSeen = new Set<string>();
          let ownerHolds = false;
          for (const file of context.files(APP_CLIENT_CODE)) {
            if (inServerZone(file, facts.appServerZone)) continue;
            if (facts.adminAreaRoots.some((root) => isUnder(file.path, root))) continue;
            const resolve = (spec: string) =>
              resolveSpecifier(context.reader, file.path, spec, aliases);
            const uses = clientAdminUses(
              file,
              facts,
              (spec) => {
                const resolved = resolve(spec);
                return declarationModules.has(resolved) ? resolved : null;
              },
              (spec) => {
                const resolved = resolve(spec);
                return facts.adminAreaRoots.some((root) => isUnder(resolved, root))
                  ? resolved
                  : null;
              },
            );
            if (file.path === facts.affordanceOwner) {
              ownerHolds ||= uses.length > 0;
              continue;
            }
            for (const use of uses) {
              const entry = facts.reviewed.find(
                (e) => e.path === file.path && (e.symbol === undefined || e.symbol === use.symbol),
              );
              if (entry) reviewedSeen.add(reviewedKey(entry));
              else
                findings.push({
                  file: file.path,
                  line: file.lineOf(use.index),
                  detail: `outside the admin area: ${use.detail}`,
                });
            }
          }
          if (ownerExists && !ownerHolds)
            findings.push({
              file: facts.affordanceOwner,
              detail:
                'stale affordance owner: it reads no admin standing and imports no admin declaration or hook',
            });
          for (const entry of facts.reviewed)
            if (!reviewedSeen.has(reviewedKey(entry)))
              findings.push({
                file: entry.path,
                detail: `stale entry: it no longer reads admin standing${entry.symbol ? ` through ${entry.symbol}` : ''}`,
              });
          return findings;
        },
      },
    ];
  },
};
