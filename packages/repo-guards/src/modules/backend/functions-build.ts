import { posix } from 'node:path';
import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding, GuardContext } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { ROOT_ROLES, type Reviewed, type RootRole } from '../../node/layout.js';
import { calleeName, forEachNode, lineOfNode } from '../../support/ast.js';
import { namesProblem, reviewedProblems, textProblem, isList } from '../../support/facts.js';
import { moduleImports, namesModule } from '../../support/imports.js';
import { resolveRelative } from '../../support/paths.js';
import { calleePath } from './shared.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';

const FUNCTIONS_CODE: Scope = { roots: ['functions'], kinds: ['code'], tests: false };

const CODE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;

function functionsRoot(context: GuardContext): string {
  const root = context.reader.layout.roots.functions;
  if (!root)
    throw new Error(
      'repo-guards: a Functions guard runs and the layout declares no functions root',
    );
  return root.path;
}

const moduleIdOf = (root: string, file: string) =>
  posix.relative(root, file).replace(CODE_EXTENSION, '');

export interface RateLimitFacts {
  owner: string;
  presetMap: string;
  surfaceMap: string;
  sharedPresets: string;
  chargeCall: string;
  prefixField: string;
}

const isMapAccess = (node: ts.Node, map: string): node is ts.PropertyAccessExpression =>
  ts.isPropertyAccessExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === map;

export function inlineLimiterConfigs(
  file: FileView,
  facts: Pick<RateLimitFacts, 'presetMap' | 'chargeCall'>,
): Array<{ node: ts.Node; detail: string }> {
  const sf = file.sourceFile;
  const out: Array<{ node: ts.Node; detail: string }> = [];
  forEachNode(sf, (node) => {
    if (ts.isSpreadAssignment(node) && isMapAccess(node.expression, facts.presetMap)) {
      out.push({ node, detail: `spreads ${node.expression.getText(sf)} into a new config` });
    }
    if (
      ts.isCallExpression(node) &&
      calleeName(node) === facts.chargeCall &&
      node.arguments.some((a) => ts.isObjectLiteralExpression(a))
    ) {
      out.push({ node, detail: `passes an inline config to ${facts.chargeCall}` });
    }
  });
  return out;
}

export function presetsNamed(file: FileView, presetMap: string): string[] {
  const out = new Set<string>();
  forEachNode(file.sourceFile, (node) => {
    if (isMapAccess(node, presetMap)) out.add(node.name.text);
  });
  return [...out];
}

export function limiterDeclarations(owner: FileView, facts: RateLimitFacts) {
  const prefixes: string[] = [];
  const surfaces = new Map<string, string[]>();
  const shared = new Set<string>();
  let presetMapFound = false;
  let surfaceMapFound = false;
  let sharedFound = false;
  const strings = (node: ts.Expression): string[] =>
    ts.isArrayLiteralExpression(node)
      ? node.elements.filter(ts.isStringLiteralLike).map((e) => e.text)
      : [];
  const bare = (e: ts.Expression) => {
    let out = e;
    while (ts.isAsExpression(out) || ts.isSatisfiesExpression(out)) out = out.expression;
    return out;
  };
  forEachNode(owner.sourceFile, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    const init = bare(node.initializer);
    if (node.name.text === facts.presetMap) {
      presetMapFound = true;
      forEachNode(init, (inner) => {
        if (
          ts.isPropertyAssignment(inner) &&
          inner.name.getText() === facts.prefixField &&
          ts.isStringLiteralLike(inner.initializer)
        ) {
          prefixes.push(inner.initializer.text);
        }
      });
    }
    if (node.name.text === facts.sharedPresets) {
      sharedFound = true;
      strings(init).forEach((name) => shared.add(name));
    }
    if (node.name.text === facts.surfaceMap && ts.isObjectLiteralExpression(init)) {
      surfaceMapFound = true;
      for (const p of init.properties) {
        if (
          ts.isPropertyAssignment(p) &&
          (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name))
        )
          surfaces.set(p.name.text, strings(bare(p.initializer)));
      }
    }
  });
  return { prefixes, surfaces, shared, presetMapFound, surfaceMapFound, sharedFound };
}

export function offendingCharges(
  charges: ReadonlyArray<{ module: string; presets: readonly string[] }>,
  surfaces: ReadonlyMap<string, readonly string[]>,
  shared: ReadonlySet<string>,
): string[] {
  const listed = new Set([...surfaces.values()].flat());
  const out: string[] = [];
  for (const { module, presets } of charges) {
    for (const preset of presets) {
      const owners = surfaces.get(preset);
      const allowed = owners ? owners.includes(module) : shared.has(preset) && !listed.has(module);
      if (!allowed) out.push(`${module} charges ${preset}`);
    }
  }
  return out;
}

export const rateLimitGuard: GenericGuardDefinition<RateLimitFacts> = {
  id: 'rateLimitSurfaces',
  absentWhen: 'the app runs no rate limiter',
  factProblems(facts) {
    const problems: string[] = [];
    for (const key of [
      'owner',
      'presetMap',
      'surfaceMap',
      'sharedPresets',
      'chargeCall',
      'prefixField',
    ] as const)
      textProblem(facts?.[key], key, problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'every rate-limit charge names its own preset',
        description:
          `Every limiter charge passes a named ${facts.presetMap} preset — never an inline config to ${facts.chargeCall}, and ` +
          `never a preset spread into a new one — and every preset owns a distinct ${facts.prefixField}. A dedicated preset ` +
          `is charged only by the modules ${facts.surfaceMap} lists for it, and a listed module charges only its own presets; ` +
          `any other module charges only the ${facts.sharedPresets}. Otherwise two surfaces share one sliding window sized ` +
          `for neither. Every module the map lists must exist and charge its preset. Declare a new preset in ${facts.owner}.`,
        run(context) {
          const root = functionsRoot(context);
          const findings: Finding[] = [];
          const charges: Array<{ module: string; presets: string[] }> = [];
          let ownerFile: FileView | undefined;
          for (const file of context.files(FUNCTIONS_CODE)) {
            if (file.path === facts.owner) {
              ownerFile = file;
              continue;
            }
            for (const { node, detail } of inlineLimiterConfigs(file, facts))
              findings.push({ file: file.path, line: lineOfNode(file, node), detail });
            const presets = presetsNamed(file, facts.presetMap);
            if (presets.length) charges.push({ module: moduleIdOf(root, file.path), presets });
          }
          if (!ownerFile)
            return [
              ...findings,
              {
                file: facts.owner,
                detail: 'the limiter owner is gone or outside the Functions tree',
              },
            ];
          const declared = limiterDeclarations(ownerFile, facts);
          if (!declared.presetMapFound || !declared.prefixes.length)
            findings.push({
              file: facts.owner,
              detail: `no ${facts.presetMap} with a ${facts.prefixField} found`,
            });
          if (!declared.surfaceMapFound)
            findings.push({ file: facts.owner, detail: `no ${facts.surfaceMap} object found` });
          if (!declared.sharedFound)
            findings.push({ file: facts.owner, detail: `no ${facts.sharedPresets} list found` });
          const dup = declared.prefixes.filter((p, i) => declared.prefixes.indexOf(p) !== i);
          for (const p of new Set(dup))
            findings.push({
              file: facts.owner,
              detail: `two presets share the ${facts.prefixField} ${p}`,
            });
          for (const offense of offendingCharges(charges, declared.surfaces, declared.shared))
            findings.push({ file: facts.owner, detail: offense });
          const charged = new Map(charges.map((c) => [c.module, c.presets]));
          for (const [preset, modules] of declared.surfaces) {
            for (const module of modules)
              if (!charged.get(module)?.includes(preset))
                findings.push({
                  file: facts.owner,
                  detail: `${preset} lists ${module}, which does not charge it`,
                });
          }
          return findings;
        },
      },
    ];
  },
};

export interface LazyLoaderFacts {
  loader: string;
  roots?: readonly RootRole[];
  otherLoaders?: ReadonlyArray<{ name: string; why: string }>;
  testRunnerConfigs: readonly string[];
  testExceptions: readonly Reviewed[];
}

const isDynamicImport = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;

export function strayDynamicImports(
  file: FileView,
  names: string | readonly string[],
): { loaders: number; used: Set<string>; stray: ts.Node[] } {
  const accepted = typeof names === 'string' ? [names] : names;
  const sf = file.sourceFile;
  const stray: ts.Node[] = [];
  const used = new Set<string>();
  let loaders = 0;
  forEachNode(sf, (node) => {
    if (!isDynamicImport(node)) return;
    const name = moduleLevelLoaderName(node, accepted);
    if (name !== null) {
      used.add(name);
      if (name === accepted[0]) loaders += 1;
    } else stray.push(node);
  });
  return { loaders, used, stray };
}

function moduleLevelLoaderName(
  node: ts.CallExpression,
  accepted: readonly string[],
): string | null {
  if (node.arguments.length !== 1 || !ts.isStringLiteralLike(node.arguments[0]!)) return null;
  let body: ts.Node = node;
  const access = node.parent;
  const projected =
    !!access &&
    ts.isPropertyAccessExpression(access) &&
    access.expression === node &&
    access.name.text === 'then' &&
    ts.isCallExpression(access.parent) &&
    access.parent.expression === access &&
    access.parent.arguments.length === 1;
  if (projected) body = access.parent;
  const arrow = body.parent;
  if (!arrow || !ts.isArrowFunction(arrow) || arrow.body !== body || arrow.parameters.length !== 0)
    return null;
  const call = arrow.parent;
  if (
    !call ||
    !ts.isCallExpression(call) ||
    !ts.isIdentifier(call.expression) ||
    call.arguments[0] !== arrow
  )
    return null;
  const name = call.expression.text;
  if (!accepted.includes(name)) return null;
  const isMain = name === accepted[0];
  if (isMain && (projected || call.arguments.length !== 1)) return null;
  const declaration = call.parent;
  if (!declaration || !ts.isVariableDeclaration(declaration) || declaration.initializer !== call)
    return null;
  if ((declaration.parent.flags & ts.NodeFlags.Const) === 0) return null;
  const statement = declaration.parent.parent;
  if (!statement || !ts.isVariableStatement(statement) || statement.parent !== node.getSourceFile())
    return null;
  return name;
}

const COMBINATORS = new Set(['Promise.all', 'Promise.allSettled', 'Promise.race', 'Promise.any']);

export function overlappingTestImports(file: FileView): Array<{ node: ts.Node; detail: string }> {
  const sf = file.sourceFile;
  const out: Array<{ node: ts.Node; detail: string }> = [];
  const visit = (node: ts.Node, inCombinator: boolean) => {
    let combinator = inCombinator;
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'concurrent')
      out.push({ node, detail: `${node.getText(sf)} runs tests concurrently` });
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'concurrent'
    )
      out.push({ node, detail: 'a concurrent test option' });
    if (ts.isCallExpression(node) && COMBINATORS.has(calleePath(node) ?? '')) combinator = true;
    if (inCombinator && isDynamicImport(node))
      out.push({
        node,
        detail: `${node.getText(sf)} overlaps the other imports of a Promise combinator`,
      });
    ts.forEachChild(node, (child) => visit(child, combinator));
  };
  visit(sf, false);
  return out;
}

export const lazyLoaderGuard: GenericGuardDefinition<LazyLoaderFacts> = {
  id: 'lazyLoader',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.loader, 'loader', problems);
    if (facts?.roots !== undefined) {
      namesProblem(facts.roots, 'roots', problems);
      if (isList(facts.roots)) {
        for (const root of facts.roots)
          if (!ROOT_ROLES.includes(root))
            problems.push(`roots names ${String(root)}, which is not a root role`);
      }
    }
    if (facts?.otherLoaders !== undefined)
      reviewedProblems(facts.otherLoaders, 'otherLoaders', problems, { key: 'name' });
    namesProblem(facts?.testRunnerConfigs, 'testRunnerConfigs', problems);
    reviewedProblems(facts?.testExceptions, 'testExceptions', problems);
    return problems;
  },
  build(facts) {
    const roots = facts.roots ?? ['functions'];
    const others = (facts.otherLoaders ?? []).map((other) => other.name);
    return [
      {
        title: 'no code can overlap two dynamic imports of one module',
        description:
          `Every dynamic import in production code is a module-level \`const load… = ${facts.loader}(() => import('…'))\` ` +
          '(or a static import when laziness buys nothing): its first call starts the one import and every concurrent call ' +
          'awaits it. A bare `import()` lets two concurrent calls overlap, and the test runner hands the second the REAL ' +
          'module for a mocked one. Tests never overlap their own imports — no concurrent tests, no concurrent runner ' +
          'config, no `import()` inside a Promise combinator; a test that does so on purpose is a reviewed exception with ' +
          'its why, stale once it no longer does.',
        run(context) {
          const findings: Finding[] = [];
          let loaders = 0;
          const used = new Set<string>();
          for (const file of context.files({ roots, kinds: ['code'], tests: false })) {
            const result = strayDynamicImports(file, [facts.loader, ...others]);
            loaders += result.loaders;
            for (const name of result.used) used.add(name);
            for (const node of result.stray) {
              findings.push({
                file: file.path,
                line: lineOfNode(file, node),
                detail: `${node.getText(file.sourceFile).slice(0, 80)} is not a module-level ${facts.loader} loader`,
              });
            }
          }
          if (!loaders)
            findings.push({
              file: `(${roots.join(', ')})`,
              detail: `no ${facts.loader} loader found, so the guard checks nothing`,
            });
          for (const name of others)
            if (!used.has(name))
              findings.push({
                file: '(otherLoaders)',
                detail: `stale other loader: ${name} wraps no import`,
              });
          const exceptions = new Set(facts.testExceptions.map((e) => e.path));
          const overlapping = new Set<string>();
          for (const file of context.files({ roots, kinds: ['code'], tests: 'only' })) {
            const hits = overlappingTestImports(file);
            if (hits.length) overlapping.add(file.path);
            if (exceptions.has(file.path)) continue;
            for (const { node, detail } of hits)
              findings.push({ file: file.path, line: lineOfNode(file, node), detail });
          }
          for (const path of exceptions)
            if (!overlapping.has(path))
              findings.push({
                file: path,
                detail: 'stale test exception: the file overlaps no import',
              });
          for (const config of facts.testRunnerConfigs) {
            if (!context.reader.exists(config))
              findings.push({ file: config, detail: 'the test runner config no longer exists' });
            else {
              const view = context.file(config);
              const m = /\bconcurrent\s*:/.exec(view.code);
              if (m)
                findings.push({
                  file: config,
                  line: view.lineOf(m.index),
                  detail: 'the runner config makes tests concurrent',
                });
            }
          }
          return findings;
        },
      },
    ];
  },
};

export interface LightFunctionFacts {
  entryIndex: string;
  lightFunctions: readonly string[];
  heavyPackages: ReadonlyArray<{
    specifier: string;
    lightSubpaths: readonly string[];
    why: string;
  }>;
  heavyFiles: readonly Reviewed[];
}

export function staticEdges(file: FileView): string[] {
  return moduleImports(file.sourceFile, ['import', 'export'])
    .filter((site) => site.topLevel && !site.typeOnly)
    .map((site) => site.spec);
}

export function resolveModule(
  fromPath: string,
  spec: string,
  known: ReadonlySet<string>,
): string | null {
  const base = resolveRelative(fromPath, spec)?.path;
  if (base === undefined) return null;
  const stem = base.replace(/\.[cm]?jsx?$/, '');
  const candidates = [
    base,
    `${stem}.ts`,
    `${stem}.tsx`,
    `${stem}.mts`,
    `${stem}.cts`,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ];
  return candidates.find((c) => known.has(c)) ?? null;
}

export function exportsOf(file: FileView): {
  names: Map<string, string | null>;
  unreadable: ts.Node[];
} {
  const names = new Map<string, string | null>();
  const unreadable: ts.Node[] = [];
  const exported = (node: ts.Node) =>
    ts.canHaveModifiers(node) &&
    !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const stmt of file.sourceFile.statements) {
    if (ts.isExportDeclaration(stmt)) {
      const from =
        stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)
          ? stmt.moduleSpecifier.text
          : null;
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause))
        for (const e of stmt.exportClause.elements) names.set(e.name.text, from);
      else unreadable.push(stmt);
    } else if (ts.isVariableStatement(stmt) && exported(stmt)) {
      for (const d of stmt.declarationList.declarations)
        if (ts.isIdentifier(d.name)) names.set(d.name.text, null);
    } else if (
      (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) &&
      exported(stmt) &&
      stmt.name
    ) {
      names.set(stmt.name.text, null);
    }
  }
  return { names, unreadable };
}

export const lightFunctionGuard: GenericGuardDefinition<LightFunctionFacts> = {
  id: 'lightFunctions',
  absentWhen: 'the app designates no light functions',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.entryIndex, 'entryIndex', problems);
    namesProblem(facts?.lightFunctions, 'lightFunctions', problems);
    reviewedProblems(facts?.heavyPackages, 'heavyPackages', problems, { key: 'specifier' });
    for (const p of facts?.heavyPackages ?? [])
      if (!isList(p?.lightSubpaths))
        problems.push(
          `heavy package ${String(p?.specifier)} needs lightSubpaths (declare [] when none)`,
        );
    reviewedProblems(facts?.heavyFiles, 'heavyFiles', problems);
    if (!facts?.heavyPackages?.length && !facts?.heavyFiles?.length)
      problems.push(
        'neither heavyPackages nor heavyFiles names anything, so the guard checks nothing',
      );
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'light functions never statically reach a heavy module',
        description:
          `The light functions (${facts.lightFunctions.join(', ')}) are hot interactive paths whose static import closure ` +
          "is small by design: walking the static import graph from each one's module (dynamic `import()` and type-only " +
          'imports are not edges) never reaches a heavy package or a heavy Functions module, which would load on every ' +
          'cold start. Cut the edge — load the heavy module through the module-level lazy loader at its true usage site — ' +
          'instead of relaxing the list. Every relative import must resolve, every light function must be exported by ' +
          'the entry module, and every heavy file must exist.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          const findings: Finding[] = [];
          const files = context.files(FUNCTIONS_CODE);
          const known = new Set(files.map((f) => f.path));
          const graph = new Map<string, { internal: string[]; external: string[] }>();
          for (const file of files) {
            const internal: string[] = [];
            const external: string[] = [];
            for (const spec of staticEdges(file)) {
              if (!spec.startsWith('.')) external.push(spec);
              else {
                const target = resolveModule(file.path, spec, known);
                if (target) internal.push(target);
                else
                  findings.push({
                    file: file.path,
                    detail: `cannot resolve ${spec}, so the closure through it is unread`,
                  });
              }
            }
            graph.set(file.path, { internal, external });
          }
          for (const { path } of facts.heavyFiles)
            if (!known.has(path))
              findings.push({
                file: path,
                detail: 'stale heavy file: it is not a Functions module',
              });
          if (!known.has(facts.entryIndex))
            return [
              ...findings,
              {
                file: facts.entryIndex,
                detail: 'the entry module is gone or outside the Functions tree',
              },
            ];
          const { names } = exportsOf(files.find((f) => f.path === facts.entryIndex)!);
          for (const fn of facts.lightFunctions) {
            const from = names.get(fn);
            const start = from ? resolveModule(facts.entryIndex, from, known) : null;
            if (!start) {
              findings.push({
                file: facts.entryIndex,
                detail: `light function ${fn} is not re-exported from a Functions module`,
              });
              continue;
            }
            const seen = new Set([start]);
            const externals = new Set<string>();
            const stack = [start];
            while (stack.length) {
              const node = graph.get(stack.pop()!);
              if (!node) continue;
              node.external.forEach((e) => externals.add(e));
              for (const next of node.internal) {
                if (seen.has(next)) continue;
                seen.add(next);
                stack.push(next);
              }
            }
            for (const spec of externals) {
              const heavy = facts.heavyPackages.find(
                (p) => namesModule(spec, p.specifier) && !p.lightSubpaths.includes(spec),
              );
              if (heavy)
                findings.push({
                  file: start,
                  detail: `light function ${fn} statically reaches ${spec}`,
                });
            }
            for (const { path } of facts.heavyFiles)
              if (seen.has(path))
                findings.push({
                  file: start,
                  detail: `light function ${fn} statically reaches ${path}`,
                });
          }
          return findings;
        },
      },
    ];
  },
};

// Google allows 60 Cloud Functions mutations per minute per project and region, and a deploy
// changes every function of the codebase it targets; 55 leaves room for that pass's deletions.
export const MAX_FUNCTIONS_PER_CODEBASE = 55;

export interface CodebaseManifestFacts {
  manifest: string;
  entryIndex: string;
  deployConfig: string;
  sourceTemplate: string;
  predeployTemplate: readonly string[];
}

function readJson(context: GuardContext, path: string, findings: Finding[]): unknown {
  if (!context.reader.exists(path)) {
    findings.push({ file: path, detail: 'the file no longer exists' });
    return undefined;
  }
  try {
    return JSON.parse(context.file(path).text);
  } catch (err) {
    findings.push({ file: path, detail: `cannot be read as JSON (${(err as Error).message})` });
    return undefined;
  }
}

export const codebaseManifestGuard: GenericGuardDefinition<CodebaseManifestFacts> = {
  id: 'codebaseManifest',
  absentWhen: 'the app deploys its Functions as one codebase',
  factProblems(facts) {
    const problems: string[] = [];
    for (const key of ['manifest', 'entryIndex', 'deployConfig', 'sourceTemplate'] as const)
      textProblem(facts?.[key], key, problems);
    if (typeof facts?.sourceTemplate === 'string' && !facts.sourceTemplate.includes('{codebase}'))
      problems.push('sourceTemplate names no {codebase}');
    namesProblem(facts?.predeployTemplate, 'predeployTemplate', problems, { nonEmpty: false });
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'the codebase manifest deploys every function exactly once',
        description:
          `${facts.manifest} maps every export of ${facts.entryIndex} to exactly one Functions codebase — none missing, none ` +
          `stale, none in two — and ${facts.deployConfig} declares exactly the manifest's codebases, each from its source ` +
          'folder with its predeploy build. A function in no codebase never deploys; one in two deploys twice; a codebase ' +
          'the deploy config does not declare is never built. The entry module re-exports by name, never `export *`.',
        run(context) {
          const findings: Finding[] = [];
          const manifest = readJson(context, facts.manifest, findings) as
            { codebases?: Record<string, unknown> } | undefined;
          const deploy = readJson(context, facts.deployConfig, findings) as
            { functions?: unknown } | undefined;
          if (!context.reader.exists(facts.entryIndex))
            return [
              ...findings,
              { file: facts.entryIndex, detail: 'the entry module no longer exists' },
            ];
          const index = context.file(facts.entryIndex);
          const { names, unreadable } = exportsOf(index);
          for (const node of unreadable)
            findings.push({
              file: index.path,
              line: lineOfNode(index, node),
              detail: 'export * hides which functions the module deploys',
            });
          if (!names.size)
            findings.push({
              file: index.path,
              detail: 'no export found, so the guard checks nothing',
            });
          if (!manifest || typeof manifest.codebases !== 'object' || !manifest.codebases) {
            if (manifest) findings.push({ file: facts.manifest, detail: 'no codebases object' });
            return findings;
          }
          const seen = new Map<string, string>();
          for (const [codebase, list] of Object.entries(manifest.codebases)) {
            if (!isList(list)) {
              findings.push({
                file: facts.manifest,
                detail: `codebase ${codebase} is not a list of exports`,
              });
              continue;
            }
            for (const name of list as unknown[]) {
              if (typeof name !== 'string') continue;
              if (seen.has(name))
                findings.push({
                  file: facts.manifest,
                  detail: `${name} is in two codebases (${seen.get(name)} and ${codebase})`,
                });
              seen.set(name, codebase);
            }
          }
          for (const name of names.keys())
            if (!seen.has(name))
              findings.push({
                file: facts.manifest,
                detail: `${name} is exported but in no codebase`,
              });
          for (const name of seen.keys())
            if (!names.has(name))
              findings.push({
                file: facts.manifest,
                detail: `stale entry ${name}: the entry module does not export it`,
              });
          if (!deploy) return findings;
          const entries = isList(deploy.functions)
            ? (deploy.functions as Array<Record<string, unknown>>)
            : null;
          if (!entries)
            return [
              ...findings,
              { file: facts.deployConfig, detail: 'functions is not a list of codebase entries' },
            ];
          const declared = entries.map((e) => String(e.codebase));
          const codebases = Object.keys(manifest.codebases);
          for (const cb of codebases)
            if (!declared.includes(cb))
              findings.push({ file: facts.deployConfig, detail: `codebase ${cb} is not declared` });
          for (const cb of declared)
            if (!codebases.includes(cb))
              findings.push({
                file: facts.deployConfig,
                detail: `codebase ${cb} is not in the manifest`,
              });
          for (const entry of entries) {
            const cb = String(entry.codebase);
            const source = facts.sourceTemplate.split('{codebase}').join(cb);
            if (entry.source !== source)
              findings.push({
                file: facts.deployConfig,
                detail: `codebase ${cb} deploys from ${String(entry.source)}, not ${source}`,
              });
            const predeploy = facts.predeployTemplate.map((t) => t.split('{codebase}').join(cb));
            if (JSON.stringify(entry.predeploy ?? []) !== JSON.stringify(predeploy)) {
              findings.push({
                file: facts.deployConfig,
                detail: `codebase ${cb}'s predeploy is not ${JSON.stringify(predeploy)}`,
              });
            }
          }
          return findings;
        },
      },
      {
        title: `no Functions codebase holds more than ${MAX_FUNCTIONS_PER_CODEBASE} functions`,
        description:
          `Each codebase in ${facts.manifest} deploys as one pass that changes every function it holds, ` +
          `so a codebase over ${MAX_FUNCTIONS_PER_CODEBASE} functions outruns the platform's per-minute ` +
          'mutation budget and its creates are dropped. A codebase that grows past the cap is split.',
        run(context) {
          const findings: Finding[] = [];
          const manifest = readJson(context, facts.manifest, findings) as
            { codebases?: Record<string, unknown> } | undefined;
          if (!manifest || typeof manifest.codebases !== 'object' || !manifest.codebases)
            return findings;
          for (const [codebase, list] of Object.entries(manifest.codebases)) {
            if (!isList(list) || list.length <= MAX_FUNCTIONS_PER_CODEBASE) continue;
            findings.push({
              file: facts.manifest,
              detail: `codebase ${codebase} holds ${list.length} functions; split it so each codebase holds at most ${MAX_FUNCTIONS_PER_CODEBASE}`,
            });
          }
          return findings;
        },
      },
    ];
  },
};
