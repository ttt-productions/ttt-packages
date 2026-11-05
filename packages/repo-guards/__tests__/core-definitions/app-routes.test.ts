import { afterEach, describe, expect, it } from 'vitest';
import {
  appRouteOwnerGuard,
  type AppRouteOwnerFacts,
} from '../../src/modules/core-definitions/app-routes.js';
import { checkSamples } from '../../src/node/suite/run.js';
import { fixture, lines, type Fixture } from './fixture.js';

let fx: Fixture | undefined;
afterEach(() => fx?.repo.remove());

const OWNER_JS = 'node_modules/@kit/core/dist/paths/routes.js';

const facts = (overrides: Partial<AppRouteOwnerFacts> = {}): AppRouteOwnerFacts => ({
  owner: { module: '@kit/core/paths', name: 'ROUTES' },
  routePrefixes: ['/projects', '/admin'],
  trees: ['src', 'functions/src'],
  exceptions: [{ path: 'src/proxy.ts', why: 'the framework matcher names page roots' }],
  ...overrides,
});

const owner = [
  'export const ROUTES = {',
  '  project: (id) => `/projects/${id}`,',
  "  admin: () => '/admin',",
  '};',
].join('\n');

const clean: Record<string, string> = {
  'node_modules/@kit/core/package.json': JSON.stringify({
    name: '@kit/core',
    exports: {
      '.': { types: './dist/index.d.ts', default: './dist/index.js' },
      './paths': { types: './dist/paths/index.d.ts', default: './dist/paths/index.js' },
    },
  }),
  'node_modules/@kit/core/dist/index.js': "export const VERSION = '1';",
  'node_modules/@kit/core/dist/paths/index.js': "export { ROUTES } from './routes.js';",
  [OWNER_JS]: owner,
  'src/ui/card.tsx': [
    "import { ROUTES } from '@kit/core/paths';",
    '// links to /projects/123 are built by the owner',
    'export const Card = ({ id }) => <Link href={ROUTES.project(id)}>Open</Link>;',
    "export const other = '/administrator';",
    "export const api = '/api/projects';",
  ].join('\n'),
  'src/proxy.ts': "export const config = { matcher: ['/admin/:path*'] };",
  'src/ui/card.test.tsx': "expect(href).toBe('/projects/1');",
  'functions/src/notify.ts': "import { ROUTES } from '@kit/core/paths';\nexport const n = ROUTES;",
};

async function run(files: Record<string, string>, f: AppRouteOwnerFacts = facts()) {
  fx = fixture(files);
  const findings: string[] = [];
  for (const guard of appRouteOwnerGuard.build(f)) findings.push(...lines(await fx.run(guard)));
  return findings;
}

describe('app routes are built by the one route owner', () => {
  it('passes owner-built links, lookalike paths, comments, tests, and a reviewed framework route file', async () => {
    expect(await run(clean)).toEqual([]);
    for (const guard of appRouteOwnerGuard.build(facts())) checkSamples(guard);
  });

  it('flags a hand-built route in every position, in app and Functions code', async () => {
    expect(
      await run({
        ...clean,
        'src/ui/bad.tsx': [
          'export const a = <Link href="/projects">All</Link>;',
          'export const b = () => router.push(`/projects/${id}/edit`);',
          "export const c = () => redirect('/admin?tab=users');",
          "export const d = '/projects/' + id;",
          'export const e = { url: `${origin}/admin/queue` };',
          "export const f = '/admin#top';",
        ].join('\n'),
        'functions/src/email.ts': 'export const link = `${base}/projects/${id}`;',
      }),
    ).toEqual([
      'functions/src/email.ts:1 — not on the reviewed list: /projects/',
      'src/ui/bad.tsx:1 — not on the reviewed list: /projects',
      'src/ui/bad.tsx:2 — not on the reviewed list: /projects/',
      'src/ui/bad.tsx:3 — not on the reviewed list: /admin?tab=users',
      'src/ui/bad.tsx:4 — not on the reviewed list: /projects/',
      'src/ui/bad.tsx:5 — not on the reviewed list: /admin/queue',
      'src/ui/bad.tsx:6 — not on the reviewed list: /admin#top',
    ]);
  });

  it('flags a hand-typed home link in every link position', async () => {
    expect(
      await run({
        ...clean,
        'src/ui/home.tsx': [
          'export const a = <Link href="/">Home</Link>;',
          "export const b = <AppLink to={'/'}>Home</AppLink>;",
          "export const c = () => router.push('/?welcome=1');",
          "export const d = () => void navigate('/', { replace: true });",
          "export const e = () => redirect('/#top');",
          "export const SIGNED_OUT_ROUTE = '/';",
          "export function f(destination = '/', backHref = '/') { return [destination, backHref]; }",
          "export const g = { nextRoute: '/' };",
          "export const h = (route) => (route === '/' ? 1 : 0);",
          "export const i = <Link href={next ?? '/'}>Home</Link>;",
        ].join('\n'),
        'functions/src/email.ts': "export const link = { href: '/' };",
      }),
    ).toEqual([
      'functions/src/email.ts:1 — not on the reviewed list: /',
      'src/ui/home.tsx:1 — not on the reviewed list: /',
      'src/ui/home.tsx:2 — not on the reviewed list: /',
      'src/ui/home.tsx:3 — not on the reviewed list: /?welcome=1',
      'src/ui/home.tsx:4 — not on the reviewed list: /',
      'src/ui/home.tsx:5 — not on the reviewed list: /#top',
      'src/ui/home.tsx:6 — not on the reviewed list: /',
      'src/ui/home.tsx:7 — not on the reviewed list: /',
      'src/ui/home.tsx:7 — not on the reviewed list: /',
      'src/ui/home.tsx:8 — not on the reviewed list: /',
      'src/ui/home.tsx:9 — not on the reviewed list: /',
      'src/ui/home.tsx:10 — not on the reviewed list: /',
    ]);
  });

  it('flags a home link opened with assign, given to a redirect name, or built as a template', async () => {
    expect(
      await run({
        ...clean,
        'src/ui/away.tsx': [
          "export const a = () => window.location.assign('/');",
          "export const callbackUrl = '/';",
          "export const b = (signIn) => signIn({ redirectTo: '/#top', returnTo: '/' });",
          "export function c(destination = '/') { return destination; }",
          'export const d = <Link href={`/?tab=${tab}`}>Home</Link>;',
          'export const e = (router) => router.push(`/#${anchor}`);',
        ].join('\n'),
      }),
    ).toEqual([
      'src/ui/away.tsx:1 — not on the reviewed list: /',
      'src/ui/away.tsx:2 — not on the reviewed list: /',
      'src/ui/away.tsx:3 — not on the reviewed list: /#top',
      'src/ui/away.tsx:3 — not on the reviewed list: /',
      'src/ui/away.tsx:4 — not on the reviewed list: /',
      'src/ui/away.tsx:5 — not on the reviewed list: /?tab=',
      'src/ui/away.tsx:6 — not on the reviewed list: /#',
    ]);
  });

  it('passes a / that is not a page link', async () => {
    expect(
      await run({
        ...clean,
        'src/lib/plain.ts': [
          "export const cookie = { path: '/', httpOnly: true };",
          "export const id = (p) => p.split('/').pop();",
          "export const robots = { allow: '/' };",
          "app.post('/', handler);",
          "export const pathname = usePathname() ?? '/';",
          "export const isRoot = (path) => path === '/';",
          "export const signedPath = '/';",
          'export const dynamic = `/${segment}`;',
          'export const page = <Link href={`/${slug}`}>Open</Link>;',
          "export class RequestFake { url = '/'; }",
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  it('skips the owner module itself when it is a repo file', async () => {
    const repoOwned = facts({ owner: { module: 'src/lib/routes.ts', name: 'ROUTES' } });
    expect(await run({ ...clean, 'src/lib/routes.ts': owner }, repoOwned)).toEqual([]);
  });

  it('flags a stale exception, a stale page root, and a tree with no code', async () => {
    expect(
      await run(
        { ...clean, 'src/proxy.ts': 'export const config = {};' },
        facts({
          routePrefixes: ['/projects', '/admin', '/gone'],
          trees: ['src', 'functions/src', 'src/none'],
        }),
      ),
    ).toEqual([
      'src/proxy.ts — stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)',
      'src/none — the tree holds no production code the guard can read',
      '(routePrefixes) — stale page root: @kit/core/paths no longer builds any path under /gone',
    ]);
  });

  it('flags an owner that no longer exports its name, and one that cannot be read', async () => {
    expect(await run({ ...clean, [OWNER_JS]: owner.replace('ROUTES', 'PATHS') })).toEqual([
      '@kit/core/paths — the route owner no longer exports ROUTES (read from @kit/core/paths)',
    ]);
    fx?.repo.remove();
    expect(
      await run(clean, facts({ owner: { module: '@kit/missing/paths', name: 'ROUTES' } })),
    ).toEqual([
      '@kit/missing/paths — the route owner cannot be read: no such file, and no installed entry for that subpath',
    ]);
  });

  it("reads only the owner's own entry: a name and paths elsewhere in the package do not count", async () => {
    expect(
      await run({
        ...clean,
        'node_modules/@kit/core/dist/paths/index.js': 'export const NAV = {};',
        [OWNER_JS]: 'export const unused = 1;',
        'node_modules/@kit/core/dist/other.js': owner,
      }),
    ).toEqual([
      '@kit/core/paths — the route owner no longer exports ROUTES (read from @kit/core/paths)',
      '(routePrefixes) — stale page root: @kit/core/paths no longer builds any path under /projects',
      '(routePrefixes) — stale page root: @kit/core/paths no longer builds any path under /admin',
    ]);
  });

  it('cannot read an owner whose subpath the package does not export', async () => {
    expect(
      await run(clean, facts({ owner: { module: '@kit/core/routes', name: 'ROUTES' } })),
    ).toEqual([
      '@kit/core/routes — the route owner cannot be read: no such file, and no installed entry for that subpath',
    ]);
  });

  it('refuses a page root that is not a whole leading segment', () => {
    expect(
      appRouteOwnerGuard.factProblems(facts({ routePrefixes: ['projects', '/admin/'] })),
    ).toEqual([
      'routePrefixes entry projects must start with / and name whole segments, with no trailing /',
      'routePrefixes entry /admin/ must start with / and name whole segments, with no trailing /',
    ]);
  });
});
