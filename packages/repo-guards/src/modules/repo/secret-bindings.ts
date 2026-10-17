// A Cloud Function only receives a secret it declares in its own `secrets: [...]` option; an unbound
// secret is undefined at runtime, and the call it feeds fails, or silently degrades, in deployed
// environments only. What this proves:
//
//   direct binding    An entry point whose own handler or options consume a secret (`X.value()`,
//                     `process.env.NAME`) binds it in its own `secrets` array — read from the parse,
//                     so an import or a mention proves nothing. An entry whose options cannot be
//                     resolved statically (a spread, a non-literal) is held to every `secrets` array in
//                     its module; consumption at module scope is held to the same module-wide set.
//   pinned binders    Each safety-critical secret the facts pin is bound by exactly its pinned entry
//                     modules: a new binder or a lost binder of a pinned secret fails, forcing review
//                     of exactly the change that matters. Every other secret is held by the direct
//                     binding check alone.
//   over-declaration  An entry declaring a secret nothing in its static or lazy import closure
//                     consumes is needless exposure. The closure over-approximates reachability, so
//                     the check is sound only in this negative direction; a secret read by an
//                     installed package is a reviewed exception.
//   indirect hops     A secret consumed behind a helper (a client factory, a rate limiter, a removal
//                     chokepoint) is registered with the helper's exports: an entry module importing
//                     one binds the secrets, a helper module importing one registers an export of its
//                     own, and every registered export is live.
//   one declaration   Each secret is declared by exactly one module.
//
// Deep transitive reachability is NOT proven: importing a helper that imports a client is not
// calling it, and proving the call needs a call graph dependency injection defeats.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';

export interface SecretBindingFacts {
  /** Entry-point factory names, each mapped to the argument index holding its options object. */
  entryFactories: Readonly<Record<string, number>>;
  /**
   * The safety-critical secrets only, each mapped to exactly the entry modules that bind it, with
   * why. Every other secret is held by the bind-what-you-consume check alone: pinning every secret
   * would be a hand-kept inventory that breaks on each ordinary new consumer.
   */
  pinnedBinders: Readonly<Record<string, ReadonlyArray<{ module: string; why: string }>>>;
  /** An entry declaring a secret its closure never consumes, for a reviewed reason. */
  deliberateOverDeclarations: ReadonlyArray<{ module: string; entry: string; secrets: readonly string[]; why: string }>;
  /** Secrets consumed behind helper exports, and the registry of exports that reach them. */
  indirectConsumers: ReadonlyArray<{
    secrets: readonly string[];
    /** The module defining the chokepoints, whose own code consumes the secrets. */
    definer: string;
    /** The definer's exports that consume the secrets. */
    chokepoints: readonly string[];
    /** Exports of other modules that reach a chokepoint, each with why. */
    reachingExports: ReadonlyArray<{ name: string; why: string }>;
    why: string;
  }>;
}

export type SecretViolation =
  | { kind: 'unbound-direct'; entry: string; entryName: string | null; env: string }
  | { kind: 'over-declared'; entry: string; entryName: string | null; env: string }
  | { kind: 'lost-pinned-binder' | 'new-pinned-binder'; entry: string; env: string };

export interface EntryPoint {
  entry: string;
  name: string | null;
  factory: string;
}

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function asArrayLiteral(node: ts.Node | undefined): ts.ArrayLiteralExpression | null {
  let n = node;
  while (n && (ts.isAsExpression(n) || ts.isParenthesizedExpression(n) || ts.isSatisfiesExpression(n))) n = n.expression;
  return n && ts.isArrayLiteralExpression(n) ? n : null;
}

const nameText = (name: ts.PropertyName) => (ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null);

function propertyOf(obj: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | null {
  for (const p of obj.properties) if (ts.isPropertyAssignment(p) && nameText(p.name) === name) return p;
  return null;
}

/** An options literal that may carry secrets the scan cannot see: a spread, or a non-literal `secrets`. */
function hasUnseenSecrets(obj: ts.ObjectLiteralExpression): boolean {
  for (const p of obj.properties) {
    if (ts.isSpreadAssignment(p)) return true;
    if (ts.isShorthandPropertyAssignment(p) && p.name.text === 'secrets') return true;
  }
  const secrets = propertyOf(obj, 'secrets');
  return !!secrets && !asArrayLiteral(secrets.initializer);
}

/** The analysis over a set of non-test Functions modules. */
export function analyzeSecretBindings(
  files: readonly FileView[],
  facts: Pick<SecretBindingFacts, 'entryFactories' | 'pinnedBinders' | 'deliberateOverDeclarations'>,
) {
  const asts = new Map(files.map((f) => [f.path, f.sourceFile] as const));

  const identToEnv = new Map<string, string>();
  for (const sf of asts.values()) {
    walk(sf, (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text === 'defineSecret' &&
        node.initializer.arguments.length > 0 &&
        ts.isStringLiteralLike(node.initializer.arguments[0])
      ) {
        identToEnv.set(node.name.text, node.initializer.arguments[0].text);
      }
    });
  }
  const envNames = new Set(identToEnv.values());

  const groupToEnvs = new Map<string, Set<string>>();
  for (const sf of asts.values()) {
    walk(sf, (node) => {
      if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) return;
      const arr = asArrayLiteral(node.initializer);
      if (!arr || arr.elements.length === 0) return;
      const envs: string[] = [];
      for (const el of arr.elements) {
        if (!ts.isIdentifier(el) || !identToEnv.has(el.text)) return;
        envs.push(identToEnv.get(el.text)!);
      }
      groupToEnvs.set(node.name.text, new Set(envs));
    });
  }

  const envsFromSecretsArray = (arr: ts.ArrayLiteralExpression) => {
    const out = new Set<string>();
    for (const el of arr.elements) {
      if (ts.isIdentifier(el) && identToEnv.has(el.text)) out.add(identToEnv.get(el.text)!);
      else if (ts.isSpreadElement(el) && ts.isIdentifier(el.expression)) {
        for (const e of groupToEnvs.get(el.expression.text) ?? []) out.add(e);
      } else if (ts.isStringLiteralLike(el) && envNames.has(el.text)) out.add(el.text);
    }
    return out;
  };

  const consumedEnvOf = (node: ts.Node): string | null => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'value' &&
      ts.isIdentifier(node.expression.expression) &&
      identToEnv.has(node.expression.expression.text)
    ) {
      return identToEnv.get(node.expression.expression.text)!;
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'process' &&
      node.expression.name.text === 'env' &&
      envNames.has(node.name.text)
    ) {
      return node.name.text;
    }
    return null;
  };

  const consumesIn = (root: ts.Node) => {
    const out = new Set<string>();
    walk(root, (node) => {
      const env = consumedEnvOf(node);
      if (env) out.add(env);
    });
    return out;
  };

  const entryFactoryOf = (node: ts.Node): string | null => {
    if (!ts.isCallExpression(node)) return null;
    const callee = ts.isIdentifier(node.expression)
      ? node.expression.text
      : ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text
        : null;
    return callee && Object.hasOwn(facts.entryFactories, callee) ? callee : null;
  };

  const resolveImport = (fromPath: string, spec: string): string | null => {
    if (!spec.startsWith('.')) return null;
    const stack = fromPath.split('/').slice(0, -1);
    for (const part of spec.split('/')) {
      if (part === '' || part === '.') continue;
      if (part === '..') stack.pop();
      else stack.push(part);
    }
    const base = stack.join('/').replace(/\.(?:js|mjs|cjs|ts|mts|cts)$/, '');
    for (const candidate of [`${base}.ts`, `${base}.mts`, `${base}/index.ts`, `${base}.js`, `${base}.mjs`, `${base}/index.js`]) {
      if (asts.has(candidate)) return candidate;
    }
    return null;
  };

  const importsOf = new Map<string, Set<string>>();
  const consumesOf = new Map<string, Set<string>>();
  for (const [path, sf] of asts) {
    const imports = new Set<string>();
    walk(sf, (node) => {
      let spec: string | null = null;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
        spec = node.moduleSpecifier.text;
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length > 0 &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        spec = node.arguments[0].text;
      }
      const resolved = spec === null ? null : resolveImport(path, spec);
      if (resolved) imports.add(resolved);
    });
    importsOf.set(path, imports);
    consumesOf.set(path, consumesIn(sf));
  }

  const closureConsumes = (start: string) => {
    const seen = new Set([start]);
    const queue = [start];
    const out = new Set<string>();
    while (queue.length) {
      const current = queue.shift()!;
      for (const env of consumesOf.get(current) ?? []) out.add(env);
      for (const next of importsOf.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return out;
  };

  const exemptions = new Map<string, Set<string>>();
  for (const e of facts.deliberateOverDeclarations) exemptions.set(`${e.module}#${e.entry}`, new Set(e.secrets));
  const exemptionsUsed = new Set<string>();

  const violations: SecretViolation[] = [];
  const binderSets = new Map<string, Set<string>>();
  const fileBinds = new Map<string, Set<string>>();
  const entryPoints: EntryPoint[] = [];

  for (const [path, sf] of asts) {
    const binds = new Set<string>();
    const optionConstEnvs = new Map<string, Set<string> | null>();
    walk(sf, (node) => {
      if (ts.isPropertyAssignment(node) && nameText(node.name) === 'secrets') {
        const arr = asArrayLiteral(node.initializer);
        if (arr) for (const e of envsFromSecretsArray(arr)) binds.add(e);
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        let init: ts.Expression = node.initializer;
        while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init) || ts.isSatisfiesExpression(init)) init = init.expression;
        if (ts.isObjectLiteralExpression(init)) {
          const arr = asArrayLiteral(propertyOf(init, 'secrets')?.initializer);
          if (arr) optionConstEnvs.set(node.name.text, envsFromSecretsArray(arr));
        }
      }
    });
    fileBinds.set(path, binds);

    const entries: Array<{ name: string | null; binds: Set<string> | null; consumes: Set<string> }> = [];
    walk(sf, (node) => {
      const factory = entryFactoryOf(node);
      if (factory === null) return;
      const call = node as ts.CallExpression;
      let name: string | null = null;
      for (let p = call.parent; p && !ts.isSourceFile(p); p = p.parent) {
        if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) {
          name = p.name.text;
          break;
        }
      }
      let own: Set<string> | null = null;
      const optArg = call.arguments[facts.entryFactories[factory]];
      if (optArg && ts.isObjectLiteralExpression(optArg)) {
        const arr = asArrayLiteral(propertyOf(optArg, 'secrets')?.initializer);
        if (arr) own = envsFromSecretsArray(arr);
        else if (!hasUnseenSecrets(optArg)) own = new Set();
      } else if (optArg && ts.isIdentifier(optArg) && optionConstEnvs.has(optArg.text)) {
        own = optionConstEnvs.get(optArg.text) ?? null;
      }
      entries.push({ name, binds: own, consumes: consumesIn(call) });
      entryPoints.push({ entry: path, name, factory });
    });
    if (!entries.length) continue;

    const moduleConsumes = new Set<string>();
    const collectModule = (node: ts.Node) => {
      if (entryFactoryOf(node) !== null) return;
      const env = consumedEnvOf(node);
      if (env) moduleConsumes.add(env);
      ts.forEachChild(node, collectModule);
    };
    collectModule(sf);

    for (const e of entries) {
      const effective = e.binds ?? binds;
      for (const env of e.consumes) if (!effective.has(env)) violations.push({ kind: 'unbound-direct', entry: path, entryName: e.name, env });
    }
    for (const env of moduleConsumes) if (!binds.has(env)) violations.push({ kind: 'unbound-direct', entry: path, entryName: null, env });

    const reachable = closureConsumes(path);
    for (const e of entries) {
      const key = `${path}#${e.name ?? '(anonymous)'}`;
      const exempt = exemptions.get(key);
      for (const env of e.binds ?? binds) {
        if (reachable.has(env)) continue;
        if (exempt?.has(env)) {
          exemptionsUsed.add(`${key}:${env}`);
          continue;
        }
        violations.push({ kind: 'over-declared', entry: path, entryName: e.name, env });
      }
    }

    for (const env of binds) {
      if (!binderSets.has(env)) binderSets.set(env, new Set());
      binderSets.get(env)!.add(path);
    }
  }

  for (const env of Object.keys(facts.pinnedBinders)) {
    const expected = facts.pinnedBinders[env].map((b) => b.module);
    const actual = binderSets.get(env) ?? new Set<string>();
    for (const module of expected) if (!actual.has(module)) violations.push({ kind: 'lost-pinned-binder', entry: module, env });
    for (const module of actual) if (!expected.includes(module)) violations.push({ kind: 'new-pinned-binder', entry: module, env });
  }

  const staleExemptions: string[] = [];
  for (const e of facts.deliberateOverDeclarations) {
    for (const env of e.secrets) if (!exemptionsUsed.has(`${e.module}#${e.entry}:${env}`)) staleExemptions.push(`${e.module}#${e.entry} ${env}`);
  }

  return { violations, entryPoints, fileBinds, staleExemptions, envNames };
}

/** One line per violation. */
export function formatViolation(v: SecretViolation): string {
  if (v.kind === 'unbound-direct') {
    const where = v.entryName ? `${v.entry} → ${v.entryName}` : `${v.entry} (module scope)`;
    return `${where} consumes ${v.env} but its own secrets: [...] does not bind it`;
  }
  if (v.kind === 'over-declared') {
    const where = v.entryName ? `${v.entry} → ${v.entryName}` : v.entry;
    return `${where} declares ${v.env} but nothing in its import closure consumes it — drop the binding`;
  }
  if (v.kind === 'lost-pinned-binder') return `${v.entry} no longer binds ${v.env}, which the pinned binders name it for`;
  return `${v.entry} now binds ${v.env}, which the pinned binders do not name it for — confirm it needs the secret, then pin it`;
}

// ---------------------------------------------------------------------------------------------
// Indirect hops
// ---------------------------------------------------------------------------------------------

interface RuntimeImport {
  source: string;
  named: string[];
  namespace: boolean;
}

/** Every runtime (not type-only) import or export-from a module makes, with the names it takes. */
export function runtimeImports(file: FileView): RuntimeImport[] {
  const out: RuntimeImport[] = [];
  for (const stmt of file.sourceFile.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteralLike(stmt.moduleSpecifier) && stmt.importClause && !stmt.importClause.isTypeOnly) {
      const bindings = stmt.importClause.namedBindings;
      out.push({
        source: stmt.moduleSpecifier.text,
        named: bindings && ts.isNamedImports(bindings) ? bindings.elements.filter((e) => !e.isTypeOnly).map((e) => (e.propertyName ?? e.name).text) : [],
        namespace: !!bindings && ts.isNamespaceImport(bindings),
      });
    } else if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteralLike(stmt.moduleSpecifier) && !stmt.isTypeOnly) {
      const clause = stmt.exportClause;
      out.push({
        source: stmt.moduleSpecifier.text,
        named: clause && ts.isNamedExports(clause) ? clause.elements.filter((e) => !e.isTypeOnly).map((e) => (e.propertyName ?? e.name).text) : [],
        namespace: !clause || ts.isNamespaceExport(clause),
      });
    }
  }
  return out;
}

const hasExportModifier = (node: ts.Node) =>
  ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** Every value name a module exports by declaration or export list. */
export function exportedValueNames(file: FileView): Set<string> {
  const out = new Set<string>();
  for (const stmt of file.sourceFile.statements) {
    if (ts.isVariableStatement(stmt) && hasExportModifier(stmt)) {
      for (const d of stmt.declarationList.declarations) if (ts.isIdentifier(d.name)) out.add(d.name.text);
    } else if ((ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt) || ts.isEnumDeclaration(stmt)) && hasExportModifier(stmt) && stmt.name) {
      out.add(stmt.name.text);
    } else if (ts.isExportDeclaration(stmt) && !stmt.isTypeOnly && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const el of stmt.exportClause.elements) if (!el.isTypeOnly) out.add(el.name.text);
    }
  }
  return out;
}

const resolveRelativePath = (fromPath: string, spec: string) => {
  const stack = fromPath.split('/').slice(0, -1);
  for (const part of spec.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/').replace(/\.(?:js|mjs|cjs|ts|mts|cts)$/, '');
};
const withoutExtension = (path: string) => path.replace(/\.(?:js|mjs|cjs|ts|mts|cts|tsx)$/, '');

/** Every indirect-hop finding for one registered consumer. */
export function indirectHopFindings(
  files: readonly FileView[],
  entryModules: ReadonlySet<string>,
  fileBinds: ReadonlyMap<string, ReadonlySet<string>>,
  consumer: SecretBindingFacts['indirectConsumers'][number],
): Finding[] {
  const findings: Finding[] = [];
  const chokepoints = new Set(consumer.chokepoints);
  const registered = new Set([...consumer.chokepoints, ...consumer.reachingExports.map((e) => e.name)]);
  const definerBase = withoutExtension(consumer.definer);
  const callPattern = new RegExp(`\\b(?:${consumer.chokepoints.map((n) => n.replace(/[$]/g, '\\$')).join('|')})\\s*\\(`);
  const owners = new Map<string, string[]>();

  for (const file of files) {
    const imports = runtimeImports(file).filter((i) => i.source.startsWith('.'));
    let direct = file.path === consumer.definer;
    let viaHelper = false;
    for (const imp of imports) {
      const target = resolveRelativePath(file.path, imp.source);
      if (imp.namespace && (target === definerBase || target === `${definerBase}/index`)) direct = true;
      for (const name of imp.named) {
        if (chokepoints.has(name)) direct = true;
        else if (registered.has(name)) viaHelper = true;
      }
    }
    const exports = exportedValueNames(file);
    for (const name of exports) if (registered.has(name)) owners.set(name, [...(owners.get(name) ?? []), file.path]);

    if (direct || viaHelper) {
      if (entryModules.has(file.path)) {
        const binds = fileBinds.get(file.path) ?? new Set<string>();
        const missing = consumer.secrets.filter((s) => !binds.has(s));
        if (missing.length) {
          findings.push({ file: file.path, detail: `imports a registered export reaching ${consumer.definer} but its secrets: [...] does not bind ${missing.join(', ')}` });
        }
      } else if (![...exports].some((name) => registered.has(name))) {
        findings.push({ file: file.path, detail: `reaches a chokepoint for ${consumer.secrets.join(', ')} but registers none of its exports — an entry importing it would dodge the binding check` });
      }
    } else if (file.path !== consumer.definer && callPattern.test(file.code)) {
      findings.push({ file: file.path, detail: 'calls a chokepoint without a static import the check can follow' });
    }
  }

  for (const name of registered) {
    const found = owners.get(name) ?? [];
    if (found.length !== 1) {
      findings.push({ file: consumer.definer, detail: `registered export ${name} is exported by ${found.length} modules (${found.join(', ') || 'none'}), not exactly one — stale or ambiguous registry entry` });
    } else if (chokepoints.has(name) && found[0] !== consumer.definer) {
      findings.push({ file: found[0], detail: `chokepoint ${name} is exported here, not by its definer ${consumer.definer}` });
    }
  }
  return findings;
}

/** Each secret name declared (by `defineSecret('NAME')`) in more than one module. */
export function duplicateDeclarations(files: readonly FileView[]): Map<string, string[]> {
  const byEnv = new Map<string, string[]>();
  for (const file of files) {
    const seen = new Set<string>();
    walk(file.sourceFile, (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'defineSecret' &&
        node.arguments.length > 0 &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        seen.add(node.arguments[0].text);
      }
    });
    for (const env of seen) byEnv.set(env, [...(byEnv.get(env) ?? []), file.path]);
  }
  return new Map([...byEnv].filter(([, paths]) => paths.length > 1));
}

const SOURCE_SCOPE: Scope = { roots: ['functions'], kinds: ['code'], tests: false };
const ALL_SCOPE: Scope = { roots: ['functions'], kinds: ['code'], tests: true };
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export const secretBindingGuard: GenericGuardDefinition<SecretBindingFacts> = {
  id: 'secretBindings',
  absentWhen: 'the app has no Cloud Functions tree',
  absentOnlyWithoutRoot: 'functions',
  factProblems(facts) {
    const problems: string[] = [];
    if (!facts || typeof facts !== 'object') return ['the facts are missing'];
    const factories = facts.entryFactories;
    if (!factories || typeof factories !== 'object' || !Object.keys(factories).length) problems.push('entryFactories names no entry-point factory');
    else {
      for (const [name, index] of Object.entries(factories)) {
        if (!IDENTIFIER.test(name)) problems.push(`entry factory ${name} is not a function name`);
        if (!Number.isInteger(index) || index < 0) problems.push(`entry factory ${name}'s options index must be a whole number`);
      }
    }
    if (!facts.pinnedBinders || typeof facts.pinnedBinders !== 'object') problems.push('pinnedBinders is missing (an app that binds no secret declares {})');
    else {
      for (const [env, binders] of Object.entries(facts.pinnedBinders)) {
        if (!Array.isArray(binders) || !binders.length) problems.push(`pinned secret ${env} names no binder (drop the entry instead)`);
        else {
          const seen = new Set<string>();
          for (const b of binders) {
            if (!b?.module) problems.push(`a pinned binder of ${env} names no module`);
            else {
              if (seen.has(b.module)) problems.push(`${b.module} is pinned twice for ${env}`);
              seen.add(b.module);
              if (!b.why?.trim()) problems.push(`pinned binder ${b.module} of ${env} carries no why`);
            }
          }
        }
      }
    }
    if (!Array.isArray(facts.deliberateOverDeclarations)) problems.push('deliberateOverDeclarations is missing (an app with none declares [])');
    else {
      for (const e of facts.deliberateOverDeclarations) {
        if (!e?.module || !e.entry || !Array.isArray(e.secrets) || !e.secrets.length) problems.push('a deliberate over-declaration needs its module, entry and secrets');
        else if (!e.why?.trim()) problems.push(`deliberate over-declaration ${e.module}#${e.entry} carries no why`);
      }
    }
    if (!Array.isArray(facts.indirectConsumers)) problems.push('indirectConsumers is missing (an app with none declares [])');
    else {
      for (const c of facts.indirectConsumers) {
        const label = c?.definer ?? '(no definer)';
        if (!c?.definer) problems.push('an indirect consumer names no definer module');
        if (!Array.isArray(c?.secrets) || !c.secrets.length) problems.push(`indirect consumer ${label} names no secret`);
        if (!Array.isArray(c?.chokepoints) || !c.chokepoints.length) problems.push(`indirect consumer ${label} names no chokepoint`);
        else for (const n of c.chokepoints) if (!IDENTIFIER.test(n)) problems.push(`indirect consumer ${label}: chokepoint ${n} is not a name`);
        if (!Array.isArray(c?.reachingExports)) problems.push(`indirect consumer ${label}: reachingExports is missing (none is [])`);
        else for (const r of c.reachingExports) if (!r?.name || !IDENTIFIER.test(r.name) || !r.why?.trim()) problems.push(`indirect consumer ${label}: a reaching export needs its name and why`);
        if (c && !c.why?.trim()) problems.push(`indirect consumer ${label} carries no why`);
      }
    }
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'every Cloud Function binds exactly the secrets it consumes',
        description:
          'An entry point binds, in its own secrets: [...], every secret its handler or options consume (X.value() or ' +
          'process.env.NAME); each safety-critical secret is bound by exactly the entry modules pinned for it; no entry declares a secret ' +
          'nothing in its import closure consumes unless reviewed; an entry importing a registered helper export binds that ' +
          "helper's secrets, and a helper importing one registers an export of its own; each secret is declared by one " +
          'module. Bind the secret in the entry, pin a reviewed binder, drop an unused binding, or register the helper.',
        timeoutMs: 120_000,
        run(context) {
          const files = context.files(SOURCE_SCOPE);
          const result = analyzeSecretBindings(files, facts);
          const findings: Finding[] = result.violations.map((v) => ({ file: v.entry, detail: formatViolation(v) }));
          for (const stale of result.staleExemptions) {
            findings.push({ file: stale.split('#')[0], detail: `stale over-declaration exception: ${stale} is consumed or no longer declared` });
          }
          const entryModules = new Set(result.entryPoints.map((e) => e.entry));
          for (const consumer of facts.indirectConsumers) {
            if (!files.some((f) => f.path === consumer.definer)) {
              findings.push({ file: consumer.definer, detail: 'the indirect consumer definer is not a Functions source module' });
              continue;
            }
            findings.push(...indirectHopFindings(files, entryModules, result.fileBinds, consumer));
          }
          for (const [env, paths] of duplicateDeclarations(context.files(ALL_SCOPE))) {
            findings.push({ file: paths[0], detail: `${env} is declared by ${paths.length} modules (${paths.join(', ')}); declare it once and import it` });
          }
          return findings;
        },
      },
    ];
  },
};
