// The guards over how the Functions tree is built and loaded: rate-limit surfaces, lazy loaders,
// light-function closures, and the split-codebase manifest.

import { afterEach, describe, expect, it } from 'vitest';
import {
  codebaseManifestGuard,
  lazyLoaderGuard,
  lightFunctionGuard,
  rateLimitGuard,
  type CodebaseManifestFacts,
  type LightFunctionFacts,
  type RateLimitFacts,
} from '../../src/modules/backend/functions-build.js';
import { backendRepo, type BackendRepo } from './repo.js';

let repo: BackendRepo | undefined;
afterEach(() => repo?.remove());

describe('every rate-limit charge names its own preset', () => {
  const facts: RateLimitFacts = {
    owner: 'functions/src/shared/rate-limiter.ts',
    presetMap: 'RATE_LIMITS',
    surfaceMap: 'RATE_LIMIT_SURFACES',
    sharedPresets: 'SHARED_RATE_LIMIT_PRESETS',
    chargeCall: 'checkRateLimit',
    prefixField: 'prefix',
  };
  const owner = (appealPrefix = 'rl:appeal') =>
    [
      'export const RATE_LIMITS = {',
      "  HALL: { prefix: 'rl:hall', max: 1 },",
      `  APPEAL: { prefix: '${appealPrefix}', max: 1 },`,
      "  SENSITIVE: { prefix: 'rl:sensitive', max: 1 },",
      '} as const;',
      "export const SHARED_RATE_LIMIT_PRESETS = ['SENSITIVE'] as const;",
      "export const RATE_LIMIT_SURFACES = { HALL: ['hall/progress'], APPEAL: ['admin/appeal'] } as const;",
    ].join('\n');
  const clean = {
    'functions/src/shared/rate-limiter.ts': owner(),
    'functions/src/hall/progress.ts': 'await checkRateLimit(uid, RATE_LIMITS.HALL);',
    'functions/src/admin/appeal.ts': 'await checkRateLimit(uid, admin ? RATE_LIMITS.APPEAL : RATE_LIMITS.APPEAL);',
    'functions/src/users/name.ts': 'await checkRateLimit(uid, RATE_LIMITS.SENSITIVE);',
  };

  it('passes named presets, each charged by its own surface, and a shared preset from an unlisted module', async () => {
    repo = backendRepo(clean);
    const [guard] = rateLimitGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([]);
  });

  it('FLAGS an inline config, a spread preset, a shared prefix, a charge outside its surface in both directions, and a listed module that charges nothing', async () => {
    repo = backendRepo({
      'functions/src/shared/rate-limiter.ts': owner('rl:hall'),
      'functions/src/hall/progress.ts': 'await checkRateLimit(uid, RATE_LIMITS.HALL);\nawait checkRateLimit(uid, RATE_LIMITS.SENSITIVE);',
      'functions/src/users/name.ts': [
        "await checkRateLimit(uid, { ...RATE_LIMITS.SENSITIVE, prefix: 'rl:other' });",
        "const cfg = { ...RATE_LIMITS.HALL, prefix: 'x' };",
        "await checkRateLimit(uid, { prefix: 'rl:x', max: 1 });",
      ].join('\n'),
    });
    const [guard] = rateLimitGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/users/name.ts', line: 1, detail: 'passes an inline config to checkRateLimit' },
      { file: 'functions/src/users/name.ts', line: 1, detail: 'spreads RATE_LIMITS.SENSITIVE into a new config' },
      { file: 'functions/src/users/name.ts', line: 2, detail: 'spreads RATE_LIMITS.HALL into a new config' },
      { file: 'functions/src/users/name.ts', line: 3, detail: 'passes an inline config to checkRateLimit' },
      { file: 'functions/src/shared/rate-limiter.ts', detail: 'two presets share the prefix rl:hall' },
      { file: 'functions/src/shared/rate-limiter.ts', detail: 'hall/progress charges SENSITIVE' },
      { file: 'functions/src/shared/rate-limiter.ts', detail: 'users/name charges HALL' },
      { file: 'functions/src/shared/rate-limiter.ts', detail: 'APPEAL lists admin/appeal, which does not charge it' },
    ]);
  });

  it('FLAGS an owner that declares none of the maps, and an owner that is gone', async () => {
    repo = backendRepo({ 'functions/src/shared/rate-limiter.ts': 'export const x = 1;' });
    const [guard] = rateLimitGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/shared/rate-limiter.ts', detail: 'no RATE_LIMITS with a prefix found' },
      { file: 'functions/src/shared/rate-limiter.ts', detail: 'no RATE_LIMIT_SURFACES object found' },
      { file: 'functions/src/shared/rate-limiter.ts', detail: 'no SHARED_RATE_LIMIT_PRESETS list found' },
    ]);
    repo.remove();
    repo = backendRepo({});
    expect(await repo.run(guard!)).toEqual([{ file: 'functions/src/shared/rate-limiter.ts', detail: 'the limiter owner is gone or outside the Functions tree' }]);
  });

  it('refuses facts with no charge call', () => {
    expect(rateLimitGuard.factProblems({ ...facts, chargeCall: '' })).toEqual(['chargeCall is missing']);
  });
});

describe('no Functions code can overlap two dynamic imports of one module', () => {
  const facts = {
    loader: 'lazyModule',
    testRunnerConfigs: ['functions/vitest.config.ts'],
    testExceptions: [{ path: 'functions/src/shared/lazy-module.test.ts', why: "the loader's premise test overlaps two imports on purpose" }],
  };
  const clean = {
    'functions/src/a.ts': [
      "const loadSharp = lazyModule(() => import('sharp'));",
      "type S = typeof import('sharp');",
      "let u: import('x').U | null = null;",
      'export async function run() { return (await loadSharp()).default; }',
    ].join('\n'),
    'functions/src/shared/lazy-module.test.ts': "await Promise.all([import('./x.js'), import('./x.js')]);",
    'functions/src/b.test.ts': [
      "it('a', async () => { await import('./a.js'); });",
      "it('b', async () => { await Promise.all([run(), run()]); const { b } = await import('./b.js'); });",
    ].join('\n'),
    'functions/vitest.config.ts': 'export default { test: { globals: true } };',
  };

  it('passes a module-level loader, type-only imports, sequential test imports, and the reviewed premise test', async () => {
    repo = backendRepo(clean);
    const [guard] = lazyLoaderGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([]);
  });

  it('FLAGS a bare import, a loader built in a function, a hand-rolled memo, a computed specifier, a let loader, concurrent tests, an import in a combinator, and a concurrent runner config', async () => {
    repo = backendRepo({
      ...clean,
      'functions/src/a.ts': [
        "export async function run() { const { a } = await import('./a.js'); return a; }",
        "export async function r2() { const load = lazyModule(() => import('./a.js')); return load(); }",
        "let pending; export function load() { return (pending ??= import('./a.js')); }",
        "const name = './a.js'; const l2 = lazyModule(() => import(name));",
        "let l3 = lazyModule(() => import('./a.js'));",
        "const ok = lazyModule(() => import('./ok.js'));",
      ].join('\n'),
      'functions/src/b.test.ts': [
        "describe.concurrent('x', () => {});",
        "it.concurrent('a', async () => {});",
        "test.concurrent.each([1])('a', async () => {});",
        "describe('x', { concurrent: true }, () => {});",
        "await Promise.allSettled(ids.map(async () => (await import('./a.js')).run()));",
      ].join('\n'),
      'functions/vitest.config.ts': 'export default { test: { concurrent: true } };',
    });
    const [guard] = lazyLoaderGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/a.ts', line: 1, detail: "import('./a.js') is not a module-level lazyModule loader" },
      { file: 'functions/src/a.ts', line: 2, detail: "import('./a.js') is not a module-level lazyModule loader" },
      { file: 'functions/src/a.ts', line: 3, detail: "import('./a.js') is not a module-level lazyModule loader" },
      { file: 'functions/src/a.ts', line: 4, detail: 'import(name) is not a module-level lazyModule loader' },
      { file: 'functions/src/a.ts', line: 5, detail: "import('./a.js') is not a module-level lazyModule loader" },
      { file: 'functions/src/b.test.ts', line: 1, detail: 'describe.concurrent runs tests concurrently' },
      { file: 'functions/src/b.test.ts', line: 2, detail: 'it.concurrent runs tests concurrently' },
      { file: 'functions/src/b.test.ts', line: 3, detail: 'test.concurrent runs tests concurrently' },
      { file: 'functions/src/b.test.ts', line: 4, detail: 'a concurrent test option' },
      { file: 'functions/src/b.test.ts', line: 5, detail: "import('./a.js') overlaps the other imports of a Promise combinator" },
      { file: 'functions/vitest.config.ts', line: 1, detail: 'the runner config makes tests concurrent' },
    ]);
  });

  it('FLAGS a tree with no loader, a test exception that no longer overlaps, and a runner config that is gone', async () => {
    repo = backendRepo({ 'functions/src/shared/lazy-module.test.ts': "await import('./x.js');" });
    const [guard] = lazyLoaderGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: '(functions)', detail: 'no lazyModule loader found, so the guard checks nothing' },
      { file: 'functions/src/shared/lazy-module.test.ts', detail: 'stale test exception: the file overlaps no import' },
      { file: 'functions/vitest.config.ts', detail: 'the test runner config no longer exists' },
    ]);
  });

  it('refuses facts with no runner config', () => {
    expect(lazyLoaderGuard.factProblems({ ...facts, testRunnerConfigs: [] })).toEqual(['testRunnerConfigs is empty']);
  });

  it('reads every root the app names: a bare app import and an app test overlap are flagged, a reviewed other loader passes', async () => {
    repo = backendRepo({
      ...clean,
      'src/lib/policy.ts': "const loadFirebase = lazyModule(() => import('./firebase.js'));",
      'src/app/page.tsx': "const Redirector = dynamic(() => import('./redirector.js'));",
      'src/lib/list.ts': "export async function read() { const { getDoc } = await import('firebase/firestore'); return getDoc; }",
      'src/lib/list.test.ts': "await Promise.all([import('./list.js'), import('./list.js')]);",
    });
    const [guard] = lazyLoaderGuard.build({
      ...facts,
      roots: ['app', 'functions'],
      otherLoaders: [{ name: 'dynamic', why: "the framework's memoized component loader" }],
    });
    expect(await repo.run(guard!)).toEqual([
      { file: 'src/lib/list.ts', line: 1, detail: "import('firebase/firestore') is not a module-level lazyModule loader" },
      { file: 'src/lib/list.test.ts', line: 1, detail: "import('./list.js') overlaps the other imports of a Promise combinator" },
      { file: 'src/lib/list.test.ts', line: 1, detail: "import('./list.js') overlaps the other imports of a Promise combinator" },
    ]);
  });

  it("passes an other loader's options argument and its import('…').then(…) projection; the main loader stays one-argument", async () => {
    repo = backendRepo({
      ...clean,
      'src/app/page.tsx': [
        "const Sidebar = dynamic(() => import('./sidebar.js').then((mod) => mod.Sidebar), { ssr: false });",
        "const Redirector = dynamic(() => import('./redirector.js'), { ssr: false, loading: () => null });",
        "const Computed = dynamic(() => import(name).then((mod) => mod.X), { ssr: false });",
        "const Nested = dynamic(() => import('./n.js').then((mod) => mod.X).then((x) => x), { ssr: false });",
      ].join('\n'),
      'src/lib/policy.ts': [
        "const loadA = lazyModule(() => import('./a.js'), { eager: true });",
        "const loadB = lazyModule(() => import('./b.js').then((mod) => mod.B));",
      ].join('\n'),
    });
    const [guard] = lazyLoaderGuard.build({
      ...facts,
      roots: ['app', 'functions'],
      otherLoaders: [{ name: 'dynamic', why: "the framework's memoized component loader" }],
    });
    expect(await repo.run(guard!)).toEqual([
      { file: 'src/app/page.tsx', line: 3, detail: 'import(name) is not a module-level lazyModule loader' },
      { file: 'src/app/page.tsx', line: 4, detail: "import('./n.js') is not a module-level lazyModule loader" },
      { file: 'src/lib/policy.ts', line: 1, detail: "import('./a.js') is not a module-level lazyModule loader" },
      { file: 'src/lib/policy.ts', line: 2, detail: "import('./b.js') is not a module-level lazyModule loader" },
    ]);
  });

  it('FLAGS an other loader that wraps no import, and reads Functions alone when no roots are named', async () => {
    repo = backendRepo({ ...clean, 'src/lib/list.ts': "export const load = () => import('./x.js');" });
    const [guard] = lazyLoaderGuard.build({ ...facts, otherLoaders: [{ name: 'dynamic', why: 'a component loader' }] });
    expect(await repo.run(guard!)).toEqual([{ file: '(otherLoaders)', detail: 'stale other loader: dynamic wraps no import' }]);
  });

  it('refuses a root that is not a root role, an empty root list, and an other loader with no why', () => {
    expect(lazyLoaderGuard.factProblems({ ...facts, roots: [] })).toEqual(['roots is empty']);
    expect(lazyLoaderGuard.factProblems({ ...facts, roots: ['web' as never] })).toEqual(['roots names web, which is not a root role']);
    expect(lazyLoaderGuard.factProblems({ ...facts, otherLoaders: [{ name: 'dynamic', why: '' }] })).not.toEqual([]);
  });
});

describe('light functions never statically reach a heavy module', () => {
  const facts: LightFunctionFacts = {
    entryIndex: 'functions/src/index.ts',
    lightFunctions: ['follow', 'like'],
    heavyPackages: [
      { specifier: 'sharp', lightSubpaths: [], why: 'the native image addon' },
      { specifier: '@pkg/media', lightSubpaths: ['@pkg/media/server'], why: 'its root loads the image addon' },
    ],
    heavyFiles: [{ path: 'functions/src/media/hub.ts', why: 'fans out to every processor' }],
  };
  const clean = {
    'functions/src/index.ts': "export { follow } from './social/follow.js';\nexport { like as like } from './social/like.js';\nexport { process } from './media/hub.js';",
    'functions/src/social/follow.ts': [
      "import { helper } from '../shared/helper.js';",
      "import type { T } from '../media/hub.js';",
      "import { m } from '@pkg/media/server';",
      "const loadSharp = lazyModule(() => import('sharp'));",
      'export const follow = 1;',
    ].join('\n'),
    'functions/src/shared/helper.ts': 'export const helper = 1;',
    'functions/src/media/hub.ts': "import sharp from 'sharp';\nexport const process = 1;",
    'functions/src/social/like.ts': 'export const like = 1;',
  };

  it('passes a closure that reaches a light subpath, a type-only import, and a lazy load', async () => {
    repo = backendRepo(clean);
    const [guard] = lightFunctionGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([]);
  });

  it('FLAGS a heavy package and a heavy module reached through an index, an import it cannot resolve, and a light function the entry does not export', async () => {
    repo = backendRepo({
      ...clean,
      'functions/src/social/follow.ts': `${clean['functions/src/social/follow.ts']}\nimport { z } from './missing.js';`,
      'functions/src/social/like.ts': "import { x } from '../shared/util';\nexport const like = 1;",
      'functions/src/shared/util/index.ts': "import '@pkg/media';\nexport { y } from '../../media/hub.js';\nexport const x = 1;",
    });
    const [guard] = lightFunctionGuard.build({ ...facts, lightFunctions: [...facts.lightFunctions, 'ghost'] });
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/social/follow.ts', detail: 'cannot resolve ./missing.js, so the closure through it is unread' },
      { file: 'functions/src/social/like.ts', detail: 'light function like statically reaches @pkg/media' },
      { file: 'functions/src/social/like.ts', detail: 'light function like statically reaches sharp' },
      { file: 'functions/src/social/like.ts', detail: 'light function like statically reaches functions/src/media/hub.ts' },
      { file: 'functions/src/index.ts', detail: 'light function ghost is not re-exported from a Functions module' },
    ]);
  });

  it('FLAGS a heavy file that is gone', async () => {
    repo = backendRepo(clean);
    const [guard] = lightFunctionGuard.build({ ...facts, heavyFiles: [{ path: 'functions/src/media/gone.ts', why: 'x' }] });
    expect(await repo.run(guard!)).toEqual([{ file: 'functions/src/media/gone.ts', detail: 'stale heavy file: it is not a Functions module' }]);
  });

  it('refuses facts that name nothing heavy', () => {
    expect(lightFunctionGuard.factProblems({ ...facts, heavyPackages: [], heavyFiles: [] })).toEqual([
      'neither heavyPackages nor heavyFiles names anything, so the guard checks nothing',
    ]);
  });
});

describe('the codebase manifest deploys every function exactly once', () => {
  const facts: CodebaseManifestFacts = {
    manifest: 'functions/codebases.manifest.json',
    entryIndex: 'functions/src/index.ts',
    deployConfig: 'firebase.json',
    sourceTemplate: 'functions/build/{codebase}',
    predeployTemplate: ['node functions/scripts/build.mjs --only {codebase}'],
  };
  const entry = (cb: string, overrides: Record<string, unknown> = {}) => ({
    source: `functions/build/${cb}`,
    codebase: cb,
    predeploy: [`node functions/scripts/build.mjs --only ${cb}`],
    ...overrides,
  });

  it('passes a manifest that covers every export once and a deploy config that declares each codebase', async () => {
    repo = backendRepo({
      'functions/src/index.ts': "export { a } from './a.js';\nexport { b as bee } from './b.js';",
      'functions/codebases.manifest.json': JSON.stringify({ codebases: { one: ['a'], two: ['bee'] } }),
      'firebase.json': JSON.stringify({ functions: [entry('one'), entry('two')] }),
    });
    const [guard] = codebaseManifestGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([]);
  });

  it('FLAGS export *, an export in two codebases, one in none, a stale entry, undeclared and unknown codebases, a wrong source, and a wrong predeploy', async () => {
    repo = backendRepo({
      'functions/src/index.ts': "export { a } from './a.js';\nexport { b as bee } from './b.js';\nexport * from './c.js';\nexport { d } from './d.js';",
      'functions/codebases.manifest.json': JSON.stringify({ codebases: { one: ['a', 'bee'], two: ['bee', 'gone'], three: [] } }),
      'firebase.json': JSON.stringify({ functions: [entry('one', { source: 'functions/one' }), entry('two', { predeploy: undefined }), entry('four')] }),
    });
    const [guard] = codebaseManifestGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/index.ts', line: 3, detail: 'export * hides which functions the module deploys' },
      { file: 'functions/codebases.manifest.json', detail: 'bee is in two codebases (one and two)' },
      { file: 'functions/codebases.manifest.json', detail: 'd is exported but in no codebase' },
      { file: 'functions/codebases.manifest.json', detail: 'stale entry gone: the entry module does not export it' },
      { file: 'firebase.json', detail: 'codebase three is not declared' },
      { file: 'firebase.json', detail: 'codebase four is not in the manifest' },
      { file: 'firebase.json', detail: 'codebase one deploys from functions/one, not functions/build/one' },
      { file: 'firebase.json', detail: 'codebase two\'s predeploy is not ["node functions/scripts/build.mjs --only two"]' },
    ]);
  });

  it('FLAGS a manifest that is not JSON', async () => {
    repo = backendRepo({
      'functions/src/index.ts': "export { a } from './a.js';",
      'functions/codebases.manifest.json': '{ nope',
      'firebase.json': JSON.stringify({ functions: [] }),
    });
    const [guard] = codebaseManifestGuard.build(facts);
    const findings = await repo.run(guard!);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.file).toBe('functions/codebases.manifest.json');
    expect(findings[0]!.detail.startsWith('cannot be read as JSON')).toBe(true);
  });

  it('refuses a source template that names no codebase', () => {
    expect(codebaseManifestGuard.factProblems({ ...facts, sourceTemplate: 'functions/build' })).toEqual(['sourceTemplate names no {codebase}']);
  });
});
