// The guards over the client's auth boundary: one place that answers "who is this", auth failures
// that reach monitoring, sign-out liveness through its owner, and editors no permission read can drop.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../suite/config.js';
import type { Finding, Guard } from '../../guard.js';
import type { Reviewed } from '../../node/layout.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { calleeName, forEachNode } from '../../support/ast.js';
import { namesProblem, objectProblem, reviewedProblems, textProblem } from '../../support/facts.js';
import { fromStatements, moduleImports, namesModule } from '../../support/imports.js';
import { escapeRegExp, isUnder } from '../../support/text.js';
import { memberOrBareCalls, throughNamespace } from './text.js';

const APP_CODE: Scope = { roots: ['app'], kinds: ['code'], tests: false };

/** The keywords that declare a name a module can export: a function, a binding, or a class. */
const DECLARATION_KEYWORDS = '(?:function|const|let|class)';
const declares = (code: string, name: string) => new RegExp(`\\b${DECLARATION_KEYWORDS}\\s+${escapeRegExp(name)}\\b`).test(code);

// ---------------------------------------------------------------------------------------------
// Client auth boundary: one derivation of identity and claims, and one auth context and accessor.
// Where a signed-out visitor is sent is business: an app browsable signed out shows a sign-in gate in
// place, an app that requires sign-in sends the visitor to its sign-in route. It is not checked here.

export interface ClientAuthBoundaryFacts {
  /** The modules that ARE the boundary — the provider mount, its configuration, the accessor — each with why. */
  boundaryModules: readonly Reviewed[];
  /** The one accessor every other module reads auth through. */
  accessor: { file: string; name: string };
  /** Symbols that derive identity, claims, or auth loading state. */
  derivationSymbols: readonly string[];
  /** Modules those symbols can be reached through as a namespace (a module covers its subpaths). */
  authSourceModules: readonly string[];
  /** Names only an auth context holds; a `createContext` beside one is a second auth context. */
  authContextVocabulary: readonly string[];
}

/**
 * Each place outside the boundary that derives identity, claims, or auth loading itself. A call is
 * matched bare or as a member (`auth.onAuthStateChanged(cb)`, `getAuth().onIdTokenChanged(cb)`),
 * since the SDK hands out the same derivations as instance methods.
 */
export function boundaryDerivations(file: FileView, facts: Pick<ClientAuthBoundaryFacts, 'derivationSymbols' | 'authSourceModules'>): Array<{ index: number; detail: string }> {
  const { code, sourceFile } = file;
  const out: Array<{ index: number; detail: string }> = [];
  for (const site of moduleImports(sourceFile, ['import'])) {
    if (site.typeOnly) continue;
    for (const { imported, typeOnly } of site.named) {
      if (!typeOnly && facts.derivationSymbols.includes(imported)) out.push({ index: site.node.getStart(sourceFile), detail: `imports ${imported}` });
    }
  }
  const namespaces: string[] = [];
  for (const site of fromStatements(sourceFile)) {
    if (site.namespace && facts.authSourceModules.some((m) => namesModule(site.spec, m))) namespaces.push(site.namespace);
  }
  for (const namespace of namespaces) {
    for (const symbol of facts.derivationSymbols) {
      const m = new RegExp(`\\b${escapeRegExp(namespace)}\\s*\\.\\s*${escapeRegExp(symbol)}\\b`).exec(code);
      if (m) out.push({ index: m.index, detail: `reaches ${namespace}.${symbol}` });
    }
  }
  for (const symbol of facts.derivationSymbols) {
    const call = memberOrBareCalls(code, symbol).find((index) => !throughNamespace(code, index, namespaces));
    if (call !== undefined) out.push({ index: call, detail: `calls ${symbol}(` });
  }
  return out;
}

/** A second export of the accessor's name, or a context holding auth vocabulary, in one file. */
export function secondAuthAccessors(
  path: string,
  code: string,
  sourceFile: ts.SourceFile,
  facts: Pick<ClientAuthBoundaryFacts, 'accessor' | 'authContextVocabulary' | 'boundaryModules'>,
): Array<{ index: number; detail: string }> {
  const out: Array<{ index: number; detail: string }> = [];
  const name = escapeRegExp(facts.accessor.name);
  if (path !== facts.accessor.file) {
    const exported =
      new RegExp(`\\bexport\\s+function\\s+${name}\\s*[(<]`).exec(code) ??
      new RegExp(`\\bexport\\s+(?:const|let|var)\\s+${name}\\b`).exec(code) ??
      new RegExp(`\\bexport\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).exec(code);
    if (exported) out.push({ index: exported.index, detail: `a second export of ${facts.accessor.name}` });
  }
  if (!facts.boundaryModules.some((m) => m.path === path)) {
    const vocabulary = new RegExp(`\\b(?:${facts.authContextVocabulary.map(escapeRegExp).join('|')})\\b`);
    for (const call of contextCreations(sourceFile)) {
      if (contextShapeTexts(call, sourceFile, code).some((text) => vocabulary.test(text))) {
        out.push({ index: call.getStart(sourceFile), detail: 'a second auth context' });
      }
    }
  }
  return out;
}

/** Every `createContext(…)` call in a file, bare or through a namespace. */
function contextCreations(sourceFile: ts.SourceFile): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  forEachNode(sourceFile, (node) => {
    if (ts.isCallExpression(node) && calleeName(node) === 'createContext') calls.push(node);
  });
  return calls;
}

/**
 * The comment-free text of what a context holds: its type argument, the same-file interface or type
 * alias that argument names, its default value, and the same-file constant that value names. Only
 * these say whether the context carries auth state; the rest of the file does not.
 */
function contextShapeTexts(call: ts.CallExpression, sourceFile: ts.SourceFile, code: string): string[] {
  const textOf = (node: ts.Node) => code.slice(node.getStart(sourceFile), node.getEnd());
  const declared = (name: string): ts.Node[] => {
    const found: ts.Node[] = [];
    forEachNode(sourceFile, (node) => {
      if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name.text === name) found.push(node);
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) found.push(node.initializer);
    });
    return found;
  };
  const texts: string[] = [];
  for (const typeArg of call.typeArguments ?? []) {
    texts.push(textOf(typeArg));
    forEachNode(typeArg, (node) => {
      if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) texts.push(...declared(node.typeName.text).map(textOf));
    });
  }
  const initial = call.arguments[0];
  if (initial) {
    texts.push(textOf(initial));
    if (ts.isIdentifier(initial)) texts.push(...declared(initial.text).map(textOf));
  }
  return texts;
}

export const clientAuthBoundaryGuard: GenericGuardDefinition<ClientAuthBoundaryFacts> = {
  id: 'clientAuthBoundary',
  absentWhen: 'the app has no signed-in users',
  factProblems(facts) {
    const problems: string[] = [];
    reviewedProblems(facts?.boundaryModules, 'boundaryModules', problems);
    if (objectProblem(facts?.accessor, 'accessor', problems)) {
      textProblem(facts.accessor.file, 'accessor.file', problems);
      textProblem(facts.accessor.name, 'accessor.name', problems);
      if (Array.isArray(facts.boundaryModules) && !facts.boundaryModules.some((m) => m?.path === facts.accessor.file)) {
        problems.push(`the accessor ${facts.accessor.file} is not one of the boundaryModules`);
      }
    }
    namesProblem(facts?.derivationSymbols, 'derivationSymbols', problems);
    namesProblem(facts?.authSourceModules, 'authSourceModules', problems);
    namesProblem(facts?.authContextVocabulary, 'authContextVocabulary', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'the client has one auth boundary',
        description:
          `Identity, claims, and auth loading state come from one provider, read through \`${facts.accessor.name}\` ` +
          `(${facts.accessor.file}). Outside the boundary modules nothing imports, reaches, or calls ` +
          `${facts.derivationSymbols.join(', ')}; no other module exports \`${facts.accessor.name}\` or creates a ` +
          'context holding auth state. Read the accessor.',
        run(context) {
          const findings: Finding[] = [];
          for (const file of context.files(APP_CODE)) {
            const inBoundary = facts.boundaryModules.some((m) => m.path === file.path);
            const hits = [
              ...(inBoundary ? [] : boundaryDerivations(file, facts)),
              ...secondAuthAccessors(file.path, file.code, file.sourceFile, facts),
            ];
            for (const hit of hits) findings.push({ file: file.path, line: file.lineOf(hit.index), detail: hit.detail });
          }
          for (const module of facts.boundaryModules) {
            if (!context.reader.exists(module.path)) findings.push({ file: module.path, detail: 'stale boundary module: it no longer exists' });
          }
          if (context.reader.exists(facts.accessor.file)) {
            const code = context.file(facts.accessor.file).code;
            if (!new RegExp(`\\bexport\\s+(?:function|const)\\s+${escapeRegExp(facts.accessor.name)}\\b`).test(code)) {
              findings.push({ file: facts.accessor.file, detail: `the accessor no longer exports ${facts.accessor.name}` });
            }
          }
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Banned auth calls: a call the auth surfaces must never make.

export interface BannedAuthCallFacts {
  /** The folders and files that make up the auth surfaces. */
  surfaces: readonly string[];
  /** Each banned call and why it is banned. */
  banned: ReadonlyArray<{ name: string; why: string }>;
  /** A long-lived auth surface the scan must reach. */
  anchor: string;
}

export const bannedAuthCallGuard: GenericGuardDefinition<BannedAuthCallFacts> = {
  id: 'bannedAuthCalls',
  absentWhen: 'the app has no signed-in users',
  factProblems(facts) {
    const problems: string[] = [];
    namesProblem(facts?.surfaces, 'surfaces', problems);
    if (!Array.isArray(facts?.banned) || !facts.banned.length) problems.push('banned is missing or empty');
    else for (const b of facts.banned) {
      textProblem(b?.name, 'a banned call', problems);
      textProblem(b?.why, `banned call ${String(b?.name)}'s why`, problems);
    }
    textProblem(facts?.anchor, 'anchor', problems);
    if (typeof facts?.anchor === 'string' && Array.isArray(facts?.surfaces) && !facts.surfaces.some((s) => isUnder(facts.anchor, s))) {
      problems.push(`the anchor ${facts.anchor} is not inside any surface`);
    }
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'the auth surfaces never name a banned auth call',
        description:
          `No file under ${facts.surfaces.join(', ')} imports or calls ` +
          facts.banned.map((b) => `\`${b.name}\` (${b.why})`).join('; ') +
          '. The symbol must not be reachable from these modules at all.',
        run(context) {
          const findings: Finding[] = [];
          const files = context.files(APP_CODE).filter((f) => facts.surfaces.some((s) => isUnder(f.path, s)));
          if (!files.some((f) => f.path === facts.anchor)) findings.push({ file: facts.anchor, detail: 'the anchor surface was not reached (gone, or outside the surfaces)' });
          for (const file of files) {
            for (const { name, why } of facts.banned) {
              const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g');
              for (let m = re.exec(file.code); m; m = re.exec(file.code)) {
                findings.push({ file: file.path, line: file.lineOf(m.index), detail: `names ${name}: ${why}` });
              }
            }
          }
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Auth failure capture: every source calling a Firebase Auth operation that can fail reports it.

export interface AuthFailureCaptureFacts {
  /** The function every auth failure is reported through. */
  reporter: string;
  /** Sources that leave the report to the code that catches their failure, each with why and the file that reports it. */
  reportedElsewhere: ReadonlyArray<{ path: string; why: string; reportedBy: string }>;
}

/** The Firebase Auth operations that reach the service and can fail. */
const FAILING_AUTH_OPERATION =
  /^(?:createUserWithEmailAndPassword|signInWith\w+|signOut|sendPasswordResetEmail|confirmPasswordReset|verifyPasswordResetCode|checkActionCode|applyActionCode|sendEmailVerification|reauthenticateWith\w+|updatePassword|updateEmail|verifyBeforeUpdateEmail|linkWith\w+|deleteUser)$/;

/** The failing operations a source imports as values from the Firebase Auth SDK. */
export function failingAuthImports(file: FileView): string[] {
  const names: string[] = [];
  for (const site of moduleImports(file.sourceFile, ['import'])) {
    if (site.typeOnly || site.spec !== 'firebase/auth') continue;
    for (const { imported, typeOnly } of site.named) if (!typeOnly && FAILING_AUTH_OPERATION.test(imported)) names.push(imported);
  }
  return names;
}

export const authFailureCaptureGuard: GenericGuardDefinition<AuthFailureCaptureFacts> = {
  id: 'authFailureCapture',
  absentWhen: 'the app has no signed-in users',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.reporter, 'reporter', problems);
    reviewedProblems(facts?.reportedElsewhere, 'reportedElsewhere', problems);
    for (const e of Array.isArray(facts?.reportedElsewhere) ? facts.reportedElsewhere : []) {
      if (e && (typeof e.reportedBy !== 'string' || !e.reportedBy.trim())) {
        problems.push(`reportedElsewhere entry ${e.path} names no reportedBy file (the file that reports its failures)`);
      }
    }
    return problems;
  },
  build(facts) {
    const reports = new RegExp(`\\b${escapeRegExp(facts.reporter)}\\s*\\(`);
    return [
      {
        title: 'every Firebase Auth failure reaches monitoring',
        description:
          `A source that calls a Firebase Auth operation that can fail reports its failure through \`${facts.reporter}\`; ` +
          'a catch that only shows a message leaves a broken sign-up or sign-in invisible to monitoring. A source that ' +
          'never catches the failure itself is a reviewed entry naming who reports for it; an entry that no longer calls ' +
          'a failing operation, now reports itself, or whose reporter no longer reports is stale.',
        run(context) {
          const findings: Finding[] = [];
          const callers = context.files(APP_CODE).map((f) => ({ file: f, ops: failingAuthImports(f) })).filter((c) => c.ops.length);
          if (!callers.length) findings.push({ file: '(app)', detail: 'no source imports a failing Firebase Auth operation — the scan found no auth surface' });
          const reviewed = new Map(facts.reportedElsewhere.map((e) => [e.path, e]));
          for (const { file, ops } of callers) {
            if (!reports.test(file.code) && !reviewed.has(file.path)) findings.push({ file: file.path, detail: `calls ${ops.join(', ')} and never reports a failure` });
          }
          for (const entry of facts.reportedElsewhere) {
            const caller = callers.find((c) => c.file.path === entry.path);
            if (!caller) findings.push({ file: entry.path, detail: 'stale entry: it no longer calls a failing auth operation' });
            else if (reports.test(caller.file.code)) findings.push({ file: entry.path, detail: 'stale entry: it reports its own failures now' });
            if (!context.reader.exists(entry.reportedBy)) findings.push({ file: entry.reportedBy, detail: `the reporter named for ${entry.path} no longer exists` });
            else if (!reports.test(context.file(entry.reportedBy).code)) findings.push({ file: entry.reportedBy, detail: `the reporter named for ${entry.path} no longer reports` });
          }
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Sign-out liveness: the "still signed in" check has one owner.

export interface SignOutLivenessFacts {
  /** The module that owns the liveness check. */
  owner: string;
  /** The names the owner exports for it. */
  ownerExports: readonly string[];
  /** The function that returns the client auth instance. */
  authAccessor: string;
}

export const signOutLivenessGuard: GenericGuardDefinition<SignOutLivenessFacts> = {
  id: 'signOutLiveness',
  absentWhen: 'the app has no signed-in users',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.owner, 'owner', problems);
    namesProblem(facts?.ownerExports, 'ownerExports', problems);
    textProblem(facts?.authAccessor, 'authAccessor', problems);
    return problems;
  },
  build(facts) {
    const redeclared = new RegExp(`\\b${DECLARATION_KEYWORDS}\\s+(?:${facts.ownerExports.map(escapeRegExp).join('|')})\\b`, 'g');
    const negatedSkip = new RegExp(`!\\s*${escapeRegExp(facts.authAccessor)}\\(\\)\\s*\\??\\.\\s*currentUser`, 'g');
    return [
      {
        title: 'the signed-in check before an awaited call has one owner',
        description:
          `A check that the user is still signed in, made across an awaited hop before a call, is ${facts.owner}'s ` +
          `(${facts.ownerExports.join(', ')}). Nothing else re-declares those names or hand-rolls a negated ` +
          `\`${facts.authAccessor}().currentUser\` skip guard: import the owner.`,
        run(context) {
          const findings: Finding[] = [];
          for (const file of context.files(APP_CODE)) {
            if (file.path === facts.owner) continue;
            for (const re of [redeclared, negatedSkip]) {
              re.lastIndex = 0;
              for (let m = re.exec(file.code); m; m = re.exec(file.code)) {
                findings.push({ file: file.path, line: file.lineOf(m.index), detail: re === redeclared ? `re-declares ${m[0].split(/\s+/).pop()}` : 'hand-rolls a negated currentUser skip guard' });
              }
            }
          }
          if (!context.reader.exists(facts.owner)) findings.push({ file: facts.owner, detail: 'the owner no longer exists' });
          else {
            const code = context.file(facts.owner).code;
            for (const name of facts.ownerExports) if (!declares(code, name)) findings.push({ file: facts.owner, detail: `the owner no longer declares ${name}` });
          }
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Editor permission gate: an editor holding typed input is never mounted under a permission read.

export interface EditorPermissionGateFacts {
  /** The hook an editor calls to guard its unsaved input: a file calling it holds an editor. */
  editorMarker: string;
  /** The element the editor mounts in. */
  editorElement: string;
  /** Permission reads: identifiers starting with this prefix and a capital letter. */
  permissionNamePrefix: string;
  /** Permission reads: calls to these functions (declare [] when none). */
  permissionCalls: readonly string[];
}

/** Each editor element with an ancestor `{<permission read> && …}`. */
export function permissionGatedEditors(sf: ts.SourceFile, facts: Omit<EditorPermissionGateFacts, 'editorMarker'>): ts.Node[] {
  const prefix = new RegExp(`^${escapeRegExp(facts.permissionNamePrefix)}[A-Z]`);
  const readsPermission = (expr: ts.Expression) => {
    let found = false;
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && prefix.test(node.text)) found = true;
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && facts.permissionCalls.includes(node.expression.text)) found = true;
      ts.forEachChild(node, visit);
    };
    visit(expr);
    return found;
  };
  const out: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(sf) === facts.editorElement) {
      for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
        if (
          ts.isJsxExpression(p) &&
          p.expression &&
          ts.isBinaryExpression(p.expression) &&
          p.expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
          readsPermission(p.expression.left)
        ) {
          out.push(node);
          break;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

export const editorPermissionGateGuard: GenericGuardDefinition<EditorPermissionGateFacts> = {
  id: 'editorPermissionGate',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.editorMarker, 'editorMarker', problems);
    textProblem(facts?.editorElement, 'editorElement', problems);
    textProblem(facts?.permissionNamePrefix, 'permissionNamePrefix', problems);
    namesProblem(facts?.permissionCalls, 'permissionCalls', problems, { nonEmpty: false });
    return problems;
  },
  build(facts): Guard[] {
    return [
      {
        title: 'an editor holding typed input is never mounted under a permission gate',
        description:
          `A component that guards its unsaved input (\`${facts.editorMarker}\`) gates only the control that opens its ` +
          `editor on a permission; its \`<${facts.editorElement}>\` stays mounted, so a permission read that changes or ` +
          'fails while it is open can never unmount it and drop what was typed. Gate the trigger, and key the editor to ' +
          'the account that opened it.',
        run(context) {
          const findings: Finding[] = [];
          const marker = new RegExp(`\\b${escapeRegExp(facts.editorMarker)}\\s*\\(`);
          const editors = context.files(APP_CODE).filter((f) => marker.test(f.code));
          if (!editors.length) findings.push({ file: '(app)', detail: `no component calls ${facts.editorMarker} — the scan found no editor to check` });
          for (const file of editors) {
            for (const node of permissionGatedEditors(file.sourceFile, facts)) {
              findings.push({ file: file.path, line: file.lineOf(node.getStart(file.sourceFile)), detail: `<${facts.editorElement}> mounted under a permission gate` });
            }
          }
          return findings;
        },
      },
    ];
  },
};
