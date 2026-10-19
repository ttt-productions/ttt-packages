import { afterEach, describe, expect, it } from 'vitest';
import { envPublicValuesGuard } from '../../src/modules/repo/env-public-values.js';
import { installedPackagesAgnosticGuard } from '../../src/modules/repo/installed-packages-agnostic.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

function readerOver(files: Record<string, string>) {
  repo = tempRepo({ 'src/index.ts': 'export {};', ...files });
  return createRepoReader({ repoRoot: repo.root, roots: { app: { path: 'src', anchor: 'src/index.ts' } } });
}

describe('the env files a deploy delivers carry public values only', () => {
  const facts = (files = ['temp.env.dev']) => ({
    files,
    publicKeys: [
      { key: 'NEXT_PUBLIC_FIREBASE_API_KEY', why: 'the web config is public by design' },
      { key: 'SENTRY_DSN', why: 'a DSN only accepts events' },
    ],
  });

  it('passes the declared public keys, comments, and blank lines', async () => {
    const reader = readerOver({ 'temp.env.dev': '# Firebase\nNEXT_PUBLIC_FIREBASE_API_KEY=AIzaExample\n\nSENTRY_DSN=https://k@o1.ingest.sentry.io/1\n' });
    const [guard] = envPublicValuesGuard.build(facts());
    expect(await guard.run(contextOf(reader))).toEqual([]);
  });

  it('FLAGS an undeclared key, a credential-shaped value, and a line that is no assignment, never printing a value', async () => {
    const reader = readerOver({
      'temp.env.dev': [
        'NEXT_PUBLIC_FIREBASE_API_KEY=AIzaExample',
        'MAILER_SECRET_KEY=sk_live_abc123',
        'SENTRY_DSN=-----BEGIN PRIVATE KEY-----',
        'just some text',
      ].join('\n'),
    });
    const [guard] = envPublicValuesGuard.build(facts());
    const findings = await guard.run(contextOf(reader));
    expect(findings).toEqual([
      { file: 'temp.env.dev', line: 2, detail: 'MAILER_SECRET_KEY is not a declared public key' },
      { file: 'temp.env.dev', line: 2, detail: 'MAILER_SECRET_KEY holds a value shaped like a credential' },
      { file: 'temp.env.dev', line: 3, detail: 'SENTRY_DSN holds a value shaped like a credential' },
      { file: 'temp.env.dev', line: 4, detail: 'not a KEY=value line' },
    ]);
    expect(JSON.stringify(findings)).not.toContain('sk_live_abc123');
  });

  it('FLAGS a declared key no file holds any more, and fails on a named file that is gone', async () => {
    const reader = readerOver({ 'temp.env.dev': 'NEXT_PUBLIC_FIREBASE_API_KEY=AIzaExample\n' });
    const [guard] = envPublicValuesGuard.build(facts());
    expect(await guard.run(contextOf(reader))).toEqual([{ file: '(publicKeys)', detail: 'stale public key: no env file holds SENTRY_DSN' }]);
    const [missing] = envPublicValuesGuard.build(facts(['temp.env.prod']));
    expect(() => missing.run(contextOf(reader))).toThrow(/temp.env.prod does not exist/);
  });

  it('refuses a public key with no why, and one listed twice', () => {
    expect(envPublicValuesGuard.factProblems({ files: ['temp.env.dev'], publicKeys: [{ key: 'A', why: '' }, { key: 'A', why: 'x' }] })).toEqual([
      'publicKeys entry A carries no why',
      'publicKeys lists A twice',
    ]);
  });
});

describe('no installed generic package reaches the core package or names the product', () => {
  const facts = {
    packageScope: '@acme/',
    corePackage: '@acme/app-core',
    manifestFolders: ['', 'functions'],
    productNames: ['\\bwidgetville\\b'],
    wireTokens: [{ token: 'x-widgetville-trace', why: 'the trace header both runtimes agree on' }],
  };
  const manifest = (deps: Record<string, string>) => JSON.stringify({ dependencies: deps });

  it('passes generic packages, read where each manifest installs them, and leaves the core package alone', async () => {
    const reader = readerOver({
      'package.json': manifest({ '@acme/ui-kit': '*', '@acme/app-core': '*' }),
      'functions/package.json': manifest({ '@acme/server-kit': '*' }),
      'node_modules/@acme/ui-kit/package.json': manifest({}),
      'node_modules/@acme/ui-kit/dist/index.js': "export const header = 'x-widgetville-trace';",
      'node_modules/@acme/app-core/package.json': manifest({}),
      'node_modules/@acme/app-core/dist/index.js': "export const name = 'Widgetville';",
      'functions/node_modules/@acme/server-kit/package.json': manifest({}),
      'functions/node_modules/@acme/server-kit/dist/index.js': 'export const s = 1;',
    });
    const [guard] = installedPackagesAgnosticGuard.build(facts);
    expect(await guard.run(contextOf(reader))).toEqual([]);
  });

  it('FLAGS a manifest naming the core package, an import of it, the product named in code, and a declared package not installed', async () => {
    const reader = readerOver({
      'package.json': manifest({ '@acme/ui-kit': '*', '@acme/gone': '*' }),
      'functions/package.json': manifest({ '@acme/server-kit': '*' }),
      'node_modules/@acme/ui-kit/package.json': JSON.stringify({ peerDependencies: { '@acme/app-core': '*' } }),
      'node_modules/@acme/ui-kit/dist/index.js': "import { x } from '@acme/app-core';",
      'functions/node_modules/@acme/server-kit/package.json': manifest({}),
      'functions/node_modules/@acme/server-kit/dist/copy.d.ts': "export declare const title = 'Welcome to WidgetVille';",
    });
    const [guard] = installedPackagesAgnosticGuard.build(facts);
    expect(await guard.run(contextOf(reader))).toEqual([
      { file: '@acme/ui-kit', detail: 'its peerDependencies names @acme/app-core' },
      { file: 'node_modules/@acme/ui-kit/dist/index.js', detail: 'imports @acme/app-core' },
      { file: '@acme/gone', detail: 'declared but not installed, so it cannot be read' },
      { file: 'functions/node_modules/@acme/server-kit/dist/copy.d.ts', detail: 'names the product' },
    ]);
  });

  it('refuses a scope without its slash, a product name that is no pattern, and a wire token with no why', () => {
    expect(
      installedPackagesAgnosticGuard.factProblems({ ...facts, packageScope: '@acme', productNames: ['('], wireTokens: [{ token: 't', why: '' }] }),
    ).toEqual(['packageScope must end in / (`@acme/`)', 'product name ( is not a regular expression', 'wireTokens entry t carries no why']);
  });
});
