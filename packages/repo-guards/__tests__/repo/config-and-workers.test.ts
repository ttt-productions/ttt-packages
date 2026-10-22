import { afterEach, describe, expect, it } from 'vitest';
import type { Guard } from '../../src/guard.js';
import {
  localOnlyVariablesGuard,
  type LocalOnlyVariablesFacts,
} from '../../src/modules/repo/local-only-variables.js';
import {
  workerBoundedBodyGuard,
  type WorkerBoundedBodyFacts,
} from '../../src/modules/repo/worker-bounded-body.js';
import { workerConfigGuard, type WorkerConfigFacts } from '../../src/modules/repo/worker-config.js';
import { readTables } from '../../src/modules/repo/wrangler-toml.js';
import { createRepoReader } from '../../src/node/reader.js';
import { checkSamples } from '../../src/node/suite/run.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

const BASE = {
  'src/index.ts': 'export {};',
  'edge/src/index.ts': 'export {};',
  'edge/wrangler.toml': '[env.dev]\nname = "w-dev"\n',
};

function readerOf(files: Record<string, string>) {
  repo = tempRepo({ ...BASE, ...files });
  return createRepoReader({
    repoRoot: repo.root,
    roots: {
      app: { path: 'src', anchor: 'src/index.ts' },
      workers: { edge: { path: 'edge/src', anchor: 'edge/src/index.ts' } },
    },
  });
}

async function run(guard: Guard, files: Record<string, string>) {
  const findings = await guard.run(contextOf(readerOf(files)));
  return findings.map((f) => `${f.file}${f.line ? `:${f.line}` : ''} ${f.detail}`);
}

const LOCAL: LocalOnlyVariablesFacts = {
  deployedConfigs: ['deploy.yaml', 'deploy.production.yaml'],
  neverDeployed: [
    { name: 'SERVER_USE_EMULATORS', why: 'switches the server onto the emulators' },
    { name: 'PUBLIC_USE_EMULATORS', why: 'emulator wiring for the client build' },
    { name: 'PUBLIC_DEBUG_TOKEN', why: 'an attestation bypass' },
  ],
  readers: [
    {
      owner: 'src/runtime.ts',
      names: ['SERVER_USE_EMULATORS', 'FUNCTIONS_EMULATOR'],
      why: 'the one local predicate',
    },
    {
      owner: 'src/client.ts',
      names: ['PUBLIC_DEBUG_TOKEN'],
      why: 'the client module gates it on the emulators',
    },
  ],
};
const CLEAN_LOCAL = {
  'deploy.yaml':
    'env:\n  # SERVER_USE_EMULATORS is set by the local scripts only, never here.\n  - variable: SITE_KEY\n    value: real\n',
  'deploy.production.yaml': 'env:\n  - variable: SITE_KEY\n    value: real\n',
  'src/runtime.ts':
    "export const local = () => process.env.FUNCTIONS_EMULATOR === 'true' || process.env.SERVER_USE_EMULATORS === 'true';",
  'src/client.ts':
    'export const token = usingEmulators ? process.env.PUBLIC_DEBUG_TOKEN : undefined;',
  'src/__tests__/runtime.test.ts': "vi.stubEnv('SERVER_USE_EMULATORS', 'true');",
};

describe('local-only variables', () => {
  const [configGuard, runtimeReader, tokenReader] = localOnlyVariablesGuard.build(LOCAL);

  it('passes clean deployed configs and readers that are their owners', async () => {
    expect(await run(configGuard, CLEAN_LOCAL)).toEqual([]);
    expect(await run(runtimeReader, CLEAN_LOCAL)).toEqual([]);
    expect(await run(tokenReader, CLEAN_LOCAL)).toEqual([]);
  });

  it('flags every declaration shape in a deployed config, a trailing-comment mention included', async () => {
    const config = [
      'env:',
      '  - variable: SERVER_USE_EMULATORS',
      '    value: "true"',
      '  - variable: "PUBLIC_USE_EMULATORS"',
      '  - {variable: PUBLIC_DEBUG_TOKEN, value: "x"}',
      '  - variable: SITE_KEY   # not SERVER_USE_EMULATORS',
      '  - variable: PUBLIC_DEBUG_TOKEN',
      '    secret: debugToken',
    ].join('\n');
    expect(await run(configGuard, { ...CLEAN_LOCAL, 'deploy.production.yaml': config })).toEqual([
      'deploy.production.yaml:2 names SERVER_USE_EMULATORS',
      'deploy.production.yaml:4 names PUBLIC_USE_EMULATORS',
      'deploy.production.yaml:5 names PUBLIC_DEBUG_TOKEN',
      'deploy.production.yaml:6 names SERVER_USE_EMULATORS',
      'deploy.production.yaml:7 names PUBLIC_DEBUG_TOKEN',
    ]);
  });

  it('flags a deployed config that is gone', async () => {
    const { 'deploy.yaml': _gone, ...rest } = CLEAN_LOCAL;
    expect(await run(configGuard, rest)).toEqual([
      'deploy.yaml the deployed config file does not exist',
    ]);
  });

  it('flags a second reader in the app source, and a stale owner', async () => {
    expect(
      await run(runtimeReader, {
        ...CLEAN_LOCAL,
        'src/runtime.ts': 'export const local = () => false;',
        'src/lib/admin.ts': "const local = process.env['SERVER_USE_EMULATORS'] === 'true';",
      }),
    ).toEqual([
      'src/lib/admin.ts:1 outside its owner: SERVER_USE_EMULATORS',
      'src/runtime.ts stale owner: the pattern no longer appears in it (or it is outside the scope)',
    ]);
  });

  it("proves each reader's matcher on its samples", () => {
    expect(() => checkSamples(runtimeReader)).not.toThrow();
    expect(() => checkSamples(tokenReader)).not.toThrow();
  });

  it('refuses facts with no why, a name given two owners, and no deployed config', () => {
    expect(
      localOnlyVariablesGuard.factProblems({
        deployedConfigs: [],
        neverDeployed: [{ name: 'X', why: ' ' }],
        readers: [
          { owner: 'a.ts', names: ['X'], why: 'a' },
          { owner: 'b.ts', names: ['X'], why: '' },
        ],
      }),
    ).toEqual([
      'deployedConfigs is empty',
      'neverDeployed entry X carries no why',
      'readers entry b.ts carries no why',
      'X is given two owners',
    ]);
  });
});

const WORKER: WorkerConfigFacts = {
  configFiles: ['edge/wrangler.toml'],
  productionEnvironment: 'prod',
  productionDestructiveMigrations: [],
};
const [workerGuard] = workerConfigGuard.build(WORKER);
const toml = (...lines: string[]) => ({ 'edge/wrangler.toml': lines.join('\n') });
const CLEAN_TOML = [
  '[[r2_buckets]]',
  'binding = "B"',
  'bucket_name = "local-only"',
  '',
  '[[migrations]]',
  'tag = "v1"',
  'new_sqlite_classes = ["A"]',
  '',
  '[env.dev]',
  'name = "w-dev"',
  'routes = [',
  '  { pattern = "x" },',
  ']',
  '[[env.dev.r2_buckets]]',
  'binding = "B"',
  'bucket_name = "dev-bucket"',
  '[[env.dev.migrations]]',
  'tag = "v1"',
  'new_sqlite_classes = ["A"]',
  '[[env.dev.migrations]]',
  'tag = "v2"',
  'deleted_classes = ["A"]',
  '',
  '[env.prod]',
  'name = "w-prod"',
  '[[env.prod.r2_buckets]]',
  'binding = "B"',
  'bucket_name = "prod-bucket"',
];

describe("each Worker's environments keep their bindings and migrations apart", () => {
  it('passes a config whose dev-only destructive migration is scoped to dev', async () => {
    expect(await run(workerGuard, toml(...CLEAN_TOML))).toEqual([]);
  });

  it('flags one storage bound by two environments, and a top-level binding naming real storage', async () => {
    expect(
      await run(
        workerGuard,
        toml(
          '[[r2_buckets]]',
          'bucket_name = "prod-bucket"',
          '[[env."dev".r2_buckets]]',
          'bucket_name = "shared"',
          '[[env.prod.r2_buckets]]',
          'bucket_name = "shared"',
          '[[env.prod.kv_namespaces]]',
          'id = "prod-bucket"',
        ),
      ),
    ).toEqual([
      "edge/wrangler.toml binds 'shared' in both [env.dev] and [env.prod]: one environment would read and write the other's storage",
      "edge/wrangler.toml binds 'prod-bucket' at the top level, where only the local runtime reads it, while a named environment binds the same storage: a deploy with no --env would publish a Worker wired to it",
    ]);
  });

  it('flags a destructive tag production inherits from the top level, in each spelling wrangler accepts', async () => {
    for (const [label, key] of [
      ['bare', 'deleted_classes = ["A"]'],
      ['quoted', '"deleted_classes" = ["A"]'],
      ['escaped', '"\\u0064eleted_classes" = ["A"]'],
      ['literal', '\'deleted_classes\' = ["A"]'],
    ]) {
      expect(
        await run(
          workerGuard,
          toml('[env.prod]', 'name = "w"', '', '[[migrations]]  # a note', 'tag = "v2"', key),
        ),
        label,
      ).toEqual([
        'edge/wrangler.toml migration tag \'v2\' carries deleted_classes = ["A"] in the list [env.prod] deploys with: that destroys or rewrites production Durable Object storage',
      ]);
    }
  });

  it('flags renamed_classes, and a destructive tag under a quoted or escaped production segment', async () => {
    expect(
      await run(
        workerGuard,
        toml(
          '[[migrations]]',
          'tag = "v2"',
          'renamed_classes = [{from = "A", to = "B"}]',
          '[env.prod]',
          'name = "w"',
        ),
      ),
    ).toEqual([
      'edge/wrangler.toml migration tag \'v2\' carries renamed_classes = [{from = "A", to = "B"}] in the list [env.prod] deploys with: that destroys or rewrites production Durable Object storage',
    ]);
    for (const segment of ['"prod"', '"\\u0070rod"']) {
      expect(
        await run(
          workerGuard,
          toml(
            '[env.prod]',
            'name = "w"',
            `[[env.${segment}.migrations]]`,
            'tag = "v2"',
            'deleted_classes = ["A"]',
          ),
        ),
        segment,
      ).toHaveLength(1);
    }
  });

  it('flags an environment list that drops a top-level tag, and a migration with no tag', async () => {
    expect(
      await run(
        workerGuard,
        toml(
          '[[migrations]]',
          'tag = "v1"',
          '[[migrations]]',
          'tag = "v2"',
          '[[migrations]]',
          'new_classes = ["C"]',
          '[env.dev]',
          'name = "d"',
          '[[env.dev.migrations]]',
          'tag = "v1"',
        ),
      ),
    ).toEqual([
      'edge/wrangler.toml declares a migration with no tag',
      "edge/wrangler.toml [env.dev] declares its own migrations but not top-level tag 'v2': that migration never reaches it",
      "edge/wrangler.toml [env.dev] declares its own migrations but not top-level tag '(untagged)': that migration never reaches it",
    ]);
  });

  it('flags a config it cannot read safely, and one with no environment', async () => {
    for (const [label, body, message] of [
      [
        'multi-line migration array',
        ['[[migrations]]', 'tag = "v2"', 'deleted_classes = [', '  "A",', ']'],
        /multi-line array/,
      ],
      [
        'unclassifiable migration line',
        ['[[migrations]]', 'tag = "v2"', 'deleted_classes = { a = 1 }'],
        /cannot read/,
      ],
      [
        'undefined escape',
        ['[[migrations]]', 'tag = "v2"', '"deleted\\qclasses" = ["A"]'],
        /cannot read/,
      ],
      ['short unicode escape', ['[[env."\\u007".migrations]]', 'tag = "v1"'], /cannot normalise/],
      ['dotted quoted segment', ['[[env."a.b".migrations]]', 'tag = "v1"'], /cannot normalise/],
      ['escaped dot', ['[[env."a\\u002Eb".migrations]]', 'tag = "v1"'], /cannot normalise/],
      [
        'broken header',
        ['[env.dev]', 'name = "w"', '[not a header'],
        /unrecognised section header/,
      ],
    ] as const) {
      const findings = await run(workerGuard, toml(...body));
      expect(findings, label).toHaveLength(1);
      expect(findings[0], label).toMatch(message);
    }
    expect(await run(workerGuard, toml('[[r2_buckets]]', 'bucket_name = "b"'))).toEqual([
      'edge/wrangler.toml declares no [env.*] section',
    ]);
  });

  it('allows a reviewed production destructive migration keyed to its contents, and flags it once stale', async () => {
    const [allowed] = workerConfigGuard.build({
      ...WORKER,
      productionDestructiveMigrations: [
        {
          configFile: 'edge/wrangler.toml',
          tag: 'v2',
          key: 'deleted_classes',
          contents: '["A"]',
          why: 'a reviewed removal',
        },
      ],
    });
    const body = ['[env.prod]', 'name = "w"', '[[migrations]]', 'tag = "v2"'];
    expect(await run(allowed, toml(...body, 'deleted_classes = ["A"]'))).toEqual([]);
    expect(await run(allowed, toml(...body, 'deleted_classes = ["A", "B"]'))).toEqual([
      'edge/wrangler.toml migration tag \'v2\' carries deleted_classes = ["A", "B"] in the list [env.prod] deploys with: that destroys or rewrites production Durable Object storage',
      'edge/wrangler.toml stale reviewed migration: tag \'v2\' deleted_classes = ["A"] is no longer in the production list',
    ]);
  });

  it('reads a multi-line array outside a migration table without complaint', () => {
    expect(() =>
      readTables(['[env.dev]', 'routes = [', '  { pattern = "x" },', ']'].join('\n')),
    ).not.toThrow();
  });

  it('refuses facts with no config, no production environment, or an unexplained allowance', () => {
    expect(
      workerConfigGuard.factProblems({
        configFiles: [],
        productionEnvironment: '',
        productionDestructiveMigrations: [
          { configFile: 'x.toml', tag: 'v1', key: 'deleted_classes', contents: '[]', why: '' },
        ],
      }),
    ).toEqual([
      'configFiles is empty',
      'productionEnvironment is missing',
      'productionDestructiveMigrations entry x.toml v1 carries no why',
      'productionDestructiveMigrations entry x.toml v1 names a file that is not a config file',
    ]);
  });
});

const BODY: WorkerBoundedBodyFacts = {
  boundedReader: 'readBoundedBody',
  boundedEndpoints: [{ file: 'edge/src/apply.ts', why: 'the signed apply endpoint' }],
  passThroughStreams: [
    {
      file: 'edge/src/proxy.ts',
      statement: "const body = request.method === 'GET' ? undefined : request.body;",
      why: 'handed unread to the upstream fetch',
    },
  ],
};
const CLEAN_BODY = {
  'edge/src/apply.ts': 'const raw = await readBoundedBody(request, { maxBytes: MAX_APPLY_BYTES });',
  'edge/src/proxy.ts':
    "const body = request.method === 'GET' ? undefined : request.body;\nreturn fetch(upstream, { body });",
  'edge/src/store.ts':
    'const text = await obj.text();\nconst parsed = await res.json();\n// request.text() in a comment is not code',
  'edge/src/__tests__/apply.test.ts': 'const body = await request.json();',
};
const [bodyGuard] = workerBoundedBodyGuard.build(BODY);

describe('Worker request bodies are read only through the bounded reader', () => {
  it('passes the bounded reader, the reviewed pass-through, stored-object and response reads, and tests', async () => {
    expect(await run(bodyGuard, CLEAN_BODY)).toEqual([]);
  });

  it('flags every raw read form of the request', async () => {
    expect(
      await run(bodyGuard, {
        ...CLEAN_BODY,
        'edge/src/raw.ts': [
          'const body = await request.text();',
          'const data = await request.json();',
          'const buf = await req.arrayBuffer();',
          'const form = await request.formData();',
          'const b = await request.blob();',
          'const reader = request.body.getReader();',
        ].join('\n'),
      }),
    ).toEqual([
      'edge/src/raw.ts:1 reads the request body directly: const body = await request.text();',
      'edge/src/raw.ts:2 reads the request body directly: const data = await request.json();',
      'edge/src/raw.ts:3 reads the request body directly: const buf = await req.arrayBuffer();',
      'edge/src/raw.ts:4 reads the request body directly: const form = await request.formData();',
      'edge/src/raw.ts:5 reads the request body directly: const b = await request.blob();',
      'edge/src/raw.ts:6 reads the request body directly: const reader = request.body.getReader();',
    ]);
  });

  it('flags a new read beside a reviewed pass-through, a stale pass-through, and an endpoint that lost its bound', async () => {
    expect(
      await run(bodyGuard, {
        ...CLEAN_BODY,
        'edge/src/proxy.ts': 'const copy = request.body;',
        'edge/src/apply.ts': 'const raw = await readBoundedBody(request);',
      }),
    ).toEqual([
      'edge/src/proxy.ts:1 reads the request body directly: const copy = request.body;',
      "edge/src/proxy.ts stale pass-through entry: the statement is no longer in the file — const body = request.method === 'GET' ? undefined : request.body;",
      'edge/src/apply.ts no longer reads its request body through readBoundedBody(request, { maxBytes })',
    ]);
  });

  it('refuses facts with no bounded endpoint or an unexplained pass-through', () => {
    expect(
      workerBoundedBodyGuard.factProblems({
        boundedReader: 'read body',
        boundedEndpoints: [],
        passThroughStreams: [{ file: 'a.ts', statement: 'x', why: '' }],
      }),
    ).toEqual([
      'boundedReader must be an identifier',
      'boundedEndpoints is empty',
      'passThroughStreams entry a.ts x carries no why',
    ]);
  });
});
