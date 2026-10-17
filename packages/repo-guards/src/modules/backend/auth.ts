// The authority guards over server code: the admin claim is read only by its resolver, a request's
// origin is read in one place, no sign-in waits on a blocking function, and every callable declares
// its App Check posture.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../config.js';
import type { Finding, Guard, GuardContext } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';
import { ownerOnly, reviewedAllowlist, type Hit, type Matcher } from '../../shapes/shapes.js';
import {
  calleeName,
  forEachNode,
  isUnder,
  lineOfNode,
  moduleSpecifiers,
  namesProblem,
  reviewedProblems,
  serverZoneContext,
  serverZoneProblems,
  staleServerFolders,
  textProblem,
  type ReviewedFile,
  type ServerZone,
} from './shared.js';

const FUNCTIONS_CODE: Scope = { roots: ['functions'], kinds: ['code'], tests: false };

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------------------------------------
// The admin claim is read only by its resolver.

export interface AdminClaimFacts {
  /** The token claims that say a caller is an admin (`isAdmin`). */
  claimKeys: readonly string[];
  /** The modules that may read the claim — the resolver, and metadata-only copies — each with its why. */
  readers: readonly ReviewedFile[];
  /** Server code in the app root, held to the same rule as the Functions tree. */
  appServerZone: ServerZone;
}

/** A claim-shaped receiver: the raw token or claims payload, never a role resolved upstream. */
const CLAIM_RECEIVER = String.raw`(?:[\w$]*[Tt]oken|[\w$]*[Cc]laims|decoded[\w$]*)`;

/** Every read of an admin claim off a token: member access, bracket access, or destructuring. */
export function adminClaimMatcher(claimKeys: readonly string[]): Matcher {
  const keys = claimKeys.map(escapeRegExp).join('|');
  const patterns = [
    new RegExp(String.raw`\b${CLAIM_RECEIVER}\s*(?:\?\.|\.)\s*(?:${keys})\b`, 'g'),
    new RegExp(String.raw`\b${CLAIM_RECEIVER}\s*(?:\?\.)?\s*\[\s*(['"\`])(?:${keys})\1\s*\]`, 'g'),
    new RegExp(String.raw`\{[^{}\n]*\b(?:${keys})\b[^{}\n]*\}\s*=\s*[^;\n]*${CLAIM_RECEIVER}\b`, 'g'),
  ];
  return (file) => {
    const hits: Hit[] = [];
    for (const re of patterns) {
      const g = new RegExp(re.source, re.flags);
      for (let m = g.exec(file.code); m; m = g.exec(file.code)) hits.push({ index: m.index, detail: m[0].trim().slice(0, 80) });
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
    reviewedProblems(facts?.readers, 'readers', problems);
    if (Array.isArray(facts?.readers) && !facts.readers.length) problems.push('readers is empty: name the resolver that answers the admin question');
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
      scope: { roots: ['functions', 'app'], optionalRoots: ['functions'], kinds: ['code'], tests: false },
      match: adminClaimMatcher(facts.claimKeys),
      allowlist: facts.readers,
      samples: {
        flags: [
          `if (request.auth.token.${facts.claimKeys[0]} === true) return all;`,
          `const a = decoded?.['${facts.claimKeys[0]}'];`,
          `const { uid, ${facts.claimKeys[0]} = false } = ctx.token;`,
        ],
        passes: [`await auth.setCustomUserClaims(uid, { ${facts.claimKeys[0]}: true });\nif (args.${facts.claimKeys[0]}) run();`],
      },
    });
    return [
      {
        ...guard,
        async run(context: GuardContext) {
          return [...staleServerFolders(context, facts.appServerZone), ...(await guard.run(serverZoneContext(context, facts.appServerZone)))];
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// One request-origin reader.

export interface RequestOriginFacts {
  /** The one module that derives where a request came from. */
  reader: string;
}

/** The raw request, its forwarded-address header, and the framework's own address. */
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
        description:
          `Where a request came from is read only in ${facts.reader}: nothing else in the Functions tree reads the raw ` +
          'request, its X-Forwarded-For header, or the framework\'s own `req.ip`. The one reader takes the last forwarded ' +
          'entry, never a caller-set one; everything else takes the origin the auth step derived. The reader must still ' +
          'hold the read.',
        scope: FUNCTIONS_CODE,
        match: (file) => {
          const re = new RegExp(ORIGIN_READ.source, ORIGIN_READ.flags);
          const hits: Hit[] = [];
          for (let m = re.exec(file.code); m; m = re.exec(file.code)) hits.push({ index: m.index, detail: m[0] });
          return hits;
        },
        owners: [facts.reader],
        samples: {
          flags: ['const ip = request.rawRequest?.ip ?? null;', "const hops = headers['x-forwarded-for'];", 'const caller = req.ip;', 'const { rawRequest } = request;'],
          passes: ['const facts = { ip: context.ip };\n// rawRequest is read only by the reader'],
        },
      }),
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// No Identity Platform blocking function.

export type NoBlockingFunctionFacts = Record<string, never>;

const BLOCKING_MODULE = /^firebase-functions\/(?:v2\/)?identity$/;
const BLOCKING_BUILDERS = new Set(['beforeCreate', 'beforeSignIn', 'beforeEmail', 'beforeSms']);

/** Every registration of a sign-up, sign-in, email, or SMS blocking function. */
export function blockingFunctionSites(file: FileView): Array<{ node: ts.Node; detail: string }> {
  const out: Array<{ node: ts.Node; detail: string }> = [];
  for (const { spec, node } of moduleSpecifiers(file)) if (BLOCKING_MODULE.test(spec)) out.push({ node, detail: `imports ${spec}` });
  forEachNode(file.sourceFile, (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && BLOCKING_BUILDERS.has(node.expression.name.text)) {
      out.push({ node, detail: `registers ${node.expression.name.text}` });
    }
  });
  return out;
}

export const noBlockingFunctionGuard: GenericGuardDefinition<NoBlockingFunctionFacts> = {
  id: 'noAuthBlockingFunction',
  absentWhen: false,
  factProblems(facts) {
    return facts && typeof facts === 'object' && !Object.keys(facts).length ? [] : ['this guard takes no facts: declare {}'];
  },
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
            blockingFunctionSites(file).map(({ node, detail }) => ({ file: file.path, line: lineOfNode(file, node), detail })),
          );
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// App Check posture.

export interface AppCheckFacts {
  /** Functions folders whose every callable spends its App Check token (money, safety, operator commands). */
  consumingFolders: readonly string[];
  /** The auth call whose option marks an admin callable (`{ call: 'assertAuth', option: 'admin' }`). */
  adminAuth: { call: string; option: string };
  /** Callables that keep the cached token although they would consume, by exported name, each with its why. */
  consumptionExempt: ReadonlyArray<{ callable: string; why: string }>;
}

interface Callable {
  name: string;
  node: ts.Node;
  options: ts.ObjectLiteralExpression | null;
}

const isOnCall = (node: ts.Node): node is ts.CallExpression => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'onCall';

/** A literal options object's boolean property, or false when it is absent or not literally `true`. */
const declaresTrue = (options: ts.ObjectLiteralExpression | null, key: string) =>
  !!options?.properties.some(
    (p) => ts.isPropertyAssignment(p) && p.name.getText().replace(/^['"]|['"]$/g, '') === key && p.initializer.kind === ts.SyntaxKind.TrueKeyword,
  );

/** Every callable a file defines: exported directly, or made by a module function that returns an `onCall`. */
export function callablesOf(file: FileView): Callable[] {
  const sf = file.sourceFile;
  const optionsOf = (call: ts.CallExpression) => (call.arguments[0] && ts.isObjectLiteralExpression(call.arguments[0]) ? call.arguments[0] : null);
  const factories = new Map<string, ts.CallExpression>();
  const named = new Set<ts.CallExpression>();
  const out: Callable[] = [];
  forEachNode(sf, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      forEachNode(node.body, (n) => {
        if (ts.isReturnStatement(n) && n.expression && isOnCall(n.expression)) factories.set(node.name!.text, n.expression);
      });
    }
  });
  forEachNode(sf, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer || !ts.isCallExpression(node.initializer)) return;
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
    if (isOnCall(node) && !named.has(node)) out.push({ name: `(onCall at line ${lineOfNode(file, node)})`, node, options: optionsOf(node) });
  });
  return out;
}

/** True when a file asks its auth call for the admin option. */
export function asksForAdmin(file: FileView, adminAuth: AppCheckFacts['adminAuth']): boolean {
  let found = false;
  forEachNode(file.sourceFile, (node) => {
    if (found || !ts.isCallExpression(node) || calleeName(node) !== adminAuth.call) return;
    found = node.arguments.some(
      (arg) => ts.isObjectLiteralExpression(arg) && arg.properties.some((p) => p.name?.getText().replace(/^['"]|['"]$/g, '') === adminAuth.option),
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
    reviewedProblems(facts?.consumptionExempt, 'consumptionExempt', problems, 'callable');
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
              findings.push({ file: file.path, line, detail: `${callable.name}: the onCall options are not an object literal, so the posture cannot be read` });
              continue;
            }
            if (!declaresTrue(callable.options, 'enforceAppCheck')) findings.push({ file: file.path, line, detail: `${callable.name}: no enforceAppCheck: true` });
            const consumes = declaresTrue(callable.options, 'consumeAppCheckToken');
            if (exempt.has(callable.name)) {
              exemptSeen.add(callable.name);
              if (consumes) findings.push({ file: file.path, line, detail: `stale exemption: ${callable.name} now consumes its token` });
              else if (!mustConsume) findings.push({ file: file.path, line, detail: `stale exemption: ${callable.name} is not a consuming callable` });
            } else if (mustConsume && !consumes) {
              findings.push({ file: file.path, line, detail: `${callable.name}: no consumeAppCheckToken: true` });
            }
          }
        }
        if (!callables) findings.push({ file: '(functions)', detail: 'no onCall found, so the guard checks nothing' });
        for (const folder of facts.consumingFolders) if (!foldersWithCallables.has(folder)) findings.push({ file: folder, detail: 'stale consuming folder: it holds no callable' });
        for (const name of exempt.keys()) if (!exemptSeen.has(name)) findings.push({ file: '(consumptionExempt)', detail: `stale exemption: no callable is named ${name}` });
        return findings;
      },
    };
    return [posture];
  },
};
