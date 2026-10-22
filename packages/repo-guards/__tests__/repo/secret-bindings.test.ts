import { afterEach, describe, expect, it } from 'vitest';
import {
  secretBindingGuard,
  type SecretBindingFacts,
} from '../../src/modules/repo/secret-bindings.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

const FACTORIES = {
  onCall: 0,
  onRequest: 0,
  onDocumentCreated: 0,
  onSchedule: 0,
  beforeUserSignedIn: 0,
};
const FACTS: SecretBindingFacts = {
  entryFactories: FACTORIES,
  pinnedBinders: {},
  deliberateOverDeclarations: [],
  indirectConsumers: [],
};

const SECRETS = `
import { defineSecret } from 'firebase-functions/params';
export const alpha = defineSecret('ALPHA');
export const beta = defineSecret('BETA');
export const GROUP = [alpha, beta] as const;
`;

async function run(files: Record<string, string>, facts: Partial<SecretBindingFacts> = {}) {
  repo = tempRepo({ 'src/index.ts': 'export {};', 'functions/src/secrets.ts': SECRETS, ...files });
  const reader = createRepoReader({
    repoRoot: repo.root,
    roots: {
      app: { path: 'src', anchor: 'src/index.ts' },
      functions: { path: 'functions/src', anchor: 'functions/src/secrets.ts' },
    },
  });
  const [guard] = secretBindingGuard.build({ ...FACTS, ...facts });
  return (await guard.run(contextOf(reader))).map((f) => `${f.file} ${f.detail}`);
}

const pin = (env: string, ...modules: string[]) => ({
  [env]: modules.map((module) => ({ module, why: 'reviewed binder' })),
});

describe('direct binding', () => {
  it('passes a consumed secret bound directly, through a spread group, or through an options const', async () => {
    expect(
      await run(
        {
          'functions/src/a.ts':
            "import { onCall } from 'firebase-functions/v2/https';\nimport { alpha } from './secrets.js';\nexport const a = onCall({ secrets: [alpha] }, async () => alpha.value());",
          'functions/src/b.ts':
            "import { GROUP, alpha } from './secrets.js';\nexport const b = onCall({ secrets: [...GROUP] }, async () => { alpha.value(); return process.env.BETA; });",
          'functions/src/c.ts':
            "import { alpha } from './secrets.js';\nconst OPTS = { secrets: [alpha] };\nexport const c = onRequest(OPTS, async (req, res) => res.send(alpha.value()));",
        },
        {
          pinnedBinders: {
            ...pin('ALPHA', 'functions/src/a.ts', 'functions/src/b.ts', 'functions/src/c.ts'),
            ...pin('BETA', 'functions/src/b.ts'),
          },
        },
      ),
    ).toEqual([]);
  });

  it('flags a binding removed from secrets: [], and one imported and used but never listed', async () => {
    expect(
      await run(
        {
          'functions/src/a.ts':
            "import { alpha } from './secrets.js';\nexport const a = onCall({ secrets: [] }, async () => alpha.value());",
          'functions/src/b.ts':
            "import { alpha, beta } from './secrets.js';\n// alpha is named in this comment\nexport const b = onCall({ secrets: [beta] }, async () => { beta.value(); return alpha.value(); });",
        },
        { pinnedBinders: pin('BETA', 'functions/src/b.ts') },
      ),
    ).toEqual([
      'functions/src/a.ts functions/src/a.ts → a consumes ALPHA but its own secrets: [...] does not bind it',
      'functions/src/b.ts functions/src/b.ts → b consumes ALPHA but its own secrets: [...] does not bind it',
    ]);
  });

  it('flags process.env consumption and an Identity Platform blocking function like any entry', async () => {
    expect(
      await run({
        'functions/src/a.ts':
          "export const a = onDocumentCreated({ document: 'x/{id}', secrets: [] }, async () => process.env.BETA);",
        'functions/src/hook.ts':
          "import { alpha } from './secrets.js';\nexport const hook = beforeUserSignedIn({ concurrency: 10 }, async () => { alpha.value(); });",
      }),
    ).toEqual([
      'functions/src/a.ts functions/src/a.ts → a consumes BETA but its own secrets: [...] does not bind it',
      'functions/src/hook.ts functions/src/hook.ts → hook consumes ALPHA but its own secrets: [...] does not bind it',
    ]);
  });

  it("holds each entry to its own secrets, never a sibling entry's", async () => {
    expect(
      await run(
        {
          'functions/src/two.ts':
            "import { alpha, beta } from './secrets.js';\nexport const one = onCall({ secrets: [alpha] }, async () => alpha.value());\nexport const two = onCall({ secrets: [beta] }, async () => { beta.value(); return alpha.value(); });",
        },
        {
          pinnedBinders: {
            ...pin('ALPHA', 'functions/src/two.ts'),
            ...pin('BETA', 'functions/src/two.ts'),
          },
        },
      ),
    ).toEqual([
      'functions/src/two.ts functions/src/two.ts → two consumes ALPHA but its own secrets: [...] does not bind it',
    ]);
  });

  it('holds an entry whose options spread shared options to the module-wide set, not to nothing', async () => {
    expect(
      await run(
        {
          'functions/src/a.ts':
            "import { alpha } from './secrets.js';\nconst BASE = { region: 'r', secrets: [alpha] };\nexport const a = onRequest({ ...BASE, cors: true }, async (q, s) => s.send(alpha.value()));",
        },
        { pinnedBinders: pin('ALPHA', 'functions/src/a.ts') },
      ),
    ).toEqual([]);
  });

  it('leaves a non-entry module that consumes a secret to the entries that reach it', async () => {
    expect(
      await run({
        'functions/src/helper.ts':
          "import { alpha } from './secrets.js';\nexport const key = () => alpha.value();",
      }),
    ).toEqual([]);
  });
});

describe('over-declaration', () => {
  const CONSUMER =
    "import { alpha } from './secrets.js';\nexport const read = () => alpha.value();";

  it('stays silent when a static or lazy import reaches the consumer', async () => {
    expect(
      await run(
        {
          'functions/src/helper.ts': CONSUMER,
          'functions/src/a.ts':
            "import { alpha } from './secrets.js';\nimport { read } from './helper.js';\nexport const a = onCall({ secrets: [alpha] }, async () => read());",
          'functions/src/b.ts':
            "import { alpha } from './secrets.js';\nexport const b = onCall({ secrets: [alpha] }, async () => (await import('./helper.js')).read());",
        },
        { pinnedBinders: pin('ALPHA', 'functions/src/a.ts', 'functions/src/b.ts') },
      ),
    ).toEqual([]);
  });

  it('flags a declared secret nothing in the closure consumes, unless reviewed — and a stale review', async () => {
    const files = {
      'functions/src/a.ts':
        "import { alpha } from './secrets.js';\nexport const a = onCall({ secrets: [alpha] }, async () => 1);",
    };
    expect(await run(files, { pinnedBinders: pin('ALPHA', 'functions/src/a.ts') })).toEqual([
      'functions/src/a.ts functions/src/a.ts → a declares ALPHA but nothing in its import closure consumes it — drop the binding',
    ]);
    const reviewed = {
      module: 'functions/src/a.ts',
      entry: 'a',
      secrets: ['ALPHA'],
      why: 'an installed package reads it',
    };
    expect(
      await run(files, {
        pinnedBinders: pin('ALPHA', 'functions/src/a.ts'),
        deliberateOverDeclarations: [reviewed],
      }),
    ).toEqual([]);
    expect(
      await run(
        {
          'functions/src/a.ts':
            "import { alpha } from './secrets.js';\nexport const a = onCall({ secrets: [alpha] }, async () => alpha.value());",
        },
        {
          pinnedBinders: pin('ALPHA', 'functions/src/a.ts'),
          deliberateOverDeclarations: [reviewed],
        },
      ),
    ).toEqual([
      'functions/src/a.ts stale over-declaration exception: functions/src/a.ts#a ALPHA is consumed or no longer declared',
    ]);
  });
});

describe('pinned binders', () => {
  const BOUND =
    "import { alpha } from './secrets.js';\nexport const x = onCall({ secrets: [alpha] }, async () => alpha.value());";

  it('flags a lost binder and a new binder of a pinned secret', async () => {
    expect(
      await run(
        {
          'functions/src/new.ts': BOUND,
          'functions/src/pinned.ts': 'export const y = onCall({}, async () => 1);',
        },
        { pinnedBinders: pin('ALPHA', 'functions/src/pinned.ts') },
      ),
    ).toEqual([
      'functions/src/pinned.ts functions/src/pinned.ts no longer binds ALPHA, which the pinned binders name it for',
      'functions/src/new.ts functions/src/new.ts now binds ALPHA, which the pinned binders do not name it for — confirm it needs the secret, then pin it',
    ]);
  });

  it('leaves a secret no pin names to the bind-what-you-consume check alone', async () => {
    expect(await run({ 'functions/src/a.ts': BOUND })).toEqual([]);
    expect(await run({ 'functions/src/a.ts': BOUND, 'functions/src/b.ts': BOUND })).toEqual([]);
  });
});

describe('indirect hops', () => {
  const CONSUMER: SecretBindingFacts['indirectConsumers'][number] = {
    secrets: ['ALPHA', 'BETA'],
    definer: 'functions/src/store/finalize.ts',
    chokepoints: ['removeBytes'],
    reachingExports: [{ name: 'runDelete', why: 'drains the removal after its commit' }],
    why: 'removing bytes needs both store credentials',
  };
  const DEFINER =
    "import { alpha, beta } from '../secrets.js';\nexport async function removeBytes(id) { alpha.value(); beta.value(); }\nexport function requestRemoval(id) {}";
  const HELPER =
    "import { removeBytes } from '../store/finalize.js';\nexport async function runDelete(id) { await removeBytes(id); }";
  const BOUND_ENTRY = (body: string) =>
    `import { GROUP } from './secrets.js';\n${body}\nexport const t = onSchedule({ secrets: [...GROUP] }, async () => {});`;
  const both = {
    ...pin('ALPHA', 'functions/src/direct.ts', 'functions/src/hop.ts'),
    ...pin('BETA', 'functions/src/direct.ts', 'functions/src/hop.ts'),
  };
  const base = {
    'functions/src/store/finalize.ts': DEFINER,
    'functions/src/files/delete.ts': HELPER,
  };

  it('passes entries that bind both secrets, directly or through a registered helper, and a removal request', async () => {
    expect(
      await run(
        {
          ...base,
          'functions/src/direct.ts': BOUND_ENTRY(
            "import { removeBytes as nuke } from './store/finalize.js';\nawait nuke('a');",
          ),
          'functions/src/hop.ts': BOUND_ENTRY(
            "import { runDelete as del } from './files/delete.js';\nawait del('a');",
          ),
          'functions/src/request.ts':
            "import { requestRemoval } from './store/finalize.js';\nexport const r = onCall({}, async () => requestRemoval('a'));",
          'functions/src/types.ts':
            "import type { Thing } from './store/finalize.js';\nexport const t = onCall({}, async () => 1);",
        },
        { pinnedBinders: both, indirectConsumers: [CONSUMER] },
      ),
    ).toEqual([]);
  });

  it('flags an entry reaching a chokepoint — aliased, namespaced, or through a helper — that does not bind both', async () => {
    expect(
      await run(
        {
          ...base,
          'functions/src/aliased.ts':
            "import { alpha } from './secrets.js';\nimport { removeBytes as nuke } from './store/finalize.js';\nexport const t = onSchedule({ secrets: [alpha] }, async () => nuke('a'));",
          'functions/src/ns.ts':
            "import * as finalize from './store/finalize.js';\nexport const t = onSchedule({}, async () => finalize.removeBytes ('a'));",
          'functions/src/hop.ts':
            "import { runDelete } from './files/delete.js';\nexport const t = onCall({}, async () => runDelete('a'));",
        },
        { pinnedBinders: pin('ALPHA', 'functions/src/aliased.ts'), indirectConsumers: [CONSUMER] },
      ),
    ).toEqual([
      'functions/src/aliased.ts imports a registered export reaching functions/src/store/finalize.ts but its secrets: [...] does not bind BETA',
      'functions/src/hop.ts imports a registered export reaching functions/src/store/finalize.ts but its secrets: [...] does not bind ALPHA, BETA',
      'functions/src/ns.ts imports a registered export reaching functions/src/store/finalize.ts but its secrets: [...] does not bind ALPHA, BETA',
    ]);
  });

  it('flags an unregistered helper, an untracked call, and a registry entry no module exports', async () => {
    expect(
      await run(
        {
          ...base,
          'functions/src/files/sweep.ts':
            "import { runDelete } from './delete.js';\nexport async function sweep() { await runDelete('a'); }",
          'functions/src/files/sneaky.ts':
            "const m = require('../store/finalize.js');\nexport const go = () => removeBytes('a');",
        },
        {
          indirectConsumers: [
            {
              ...CONSUMER,
              reachingExports: [...CONSUMER.reachingExports, { name: 'runGone', why: 'moved' }],
            },
          ],
        },
      ),
    ).toEqual([
      'functions/src/files/sneaky.ts calls a chokepoint without a static import the check can follow',
      'functions/src/files/sweep.ts reaches a chokepoint for ALPHA, BETA but registers none of its exports — an entry importing it would dodge the binding check',
      'functions/src/store/finalize.ts registered export runGone is exported by 0 modules (none), not exactly one — stale or ambiguous registry entry',
    ]);
  });

  it('flags a definer that is not a Functions source module', async () => {
    expect(
      await run(base, {
        indirectConsumers: [{ ...CONSUMER, definer: 'functions/src/store/gone.ts' }],
      }),
    ).toEqual([
      'functions/src/store/gone.ts the indirect consumer definer is not a Functions source module',
    ]);
  });
});

describe('one declaration per secret', () => {
  it('flags a secret declared by a second module, a test module included', async () => {
    expect(
      await run({
        'functions/src/other.ts':
          "import { defineSecret } from 'firebase-functions/params';\nexport const again = defineSecret('ALPHA');",
        'functions/src/__tests__/x.test.ts': "const b = defineSecret('BETA');",
      }),
    ).toEqual([
      'functions/src/__tests__/x.test.ts BETA is declared by 2 modules (functions/src/__tests__/x.test.ts, functions/src/secrets.ts); declare it once and import it',
      'functions/src/other.ts ALPHA is declared by 2 modules (functions/src/other.ts, functions/src/secrets.ts); declare it once and import it',
    ]);
  });
});

describe('facts', () => {
  it('refuses no factory, an empty pin, an unexplained binder, and an incomplete indirect consumer', () => {
    expect(
      secretBindingGuard.factProblems({
        entryFactories: {},
        pinnedBinders: { A: [], B: [{ module: 'x.ts', why: '' }] },
        deliberateOverDeclarations: [{ module: 'x.ts', entry: 'e', secrets: ['A'], why: '' }],
        indirectConsumers: [
          { secrets: [], definer: 'd.ts', chokepoints: ['go now'], reachingExports: [], why: 'w' },
        ],
      }),
    ).toEqual([
      'entryFactories is empty',
      'pinnedBinders.A is empty',
      'pinnedBinders.B entry x.ts carries no why',
      'deliberateOverDeclarations entry x.ts#e carries no why',
      "indirectConsumers entry d.ts's secrets is empty",
      "indirectConsumers entry d.ts's chokepoint go now must be an identifier",
    ]);
  });
});
