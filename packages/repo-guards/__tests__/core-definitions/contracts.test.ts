// Cross-boundary contracts live in the core: a backend tree builds no zod schema of its own, and no
// source gives avoiding a package publish as its reason.

import { afterAll, describe, expect, it } from 'vitest';
import { coreContractsGuard } from '../../src/modules/core-definitions/contracts.js';
import { fixture, lines } from './fixture.js';

const [zodBuilds, publishReasons] = coreContractsGuard.build({ corePackage: '@fx/core', backendRoots: ['functions'] });

const f = fixture({
  'functions/src/callables/build.ts': [
    "import { z } from 'zod';",
    'const Input = z.object({ id: z.string() });',
    'const Name = z.string().max(40);',
    "const Kind = z.enum(['a', 'b']);",
    'const Any = new z.ZodObject({});',
  ].join('\n'),
  'functions/src/callables/uses.ts': [
    "import { z } from 'zod';",
    "import { InputSchema } from '@fx/core';",
    "const message = err instanceof z.ZodError ? err.issues[0]?.message : 'Invalid request data';",
    'const schema: z.ZodType = InputSchema;',
    'type Input = z.infer<typeof InputSchema>;',
    '// z.object({}) in prose',
  ].join('\n'),
  'functions/src/callables/build.test.ts': 'const Fixture = z.object({});',
  'src/forms/local.ts': "const FormSchema = z.object({ draft: z.string() });\n// Declared here to avoid a core publish.",
  'src/lib/limits.ts': 'const LIMIT = 5; // avoids the publish\n/* Kept local, saving a package release. */\nconst B = 1; // skip a @fx/core release',
  'src/lib/media.ts': '// The fixture skips the asset publish step.\nconst note = "The release pipeline publishes after verification.";',
});
afterAll(() => f.repo.remove());

describe('backend zod schemas', () => {
  it('FLAGS every schema a backend module builds or constructs, and leaves zod types, error checks, prose, tests, and the client root alone', async () => {
    expect(lines(await f.run(zodBuilds))).toEqual([
      'functions/src/callables/build.ts:2 — builds a zod schema: z.object(…)',
      'functions/src/callables/build.ts:2 — builds a zod schema: z.string(…)',
      'functions/src/callables/build.ts:3 — builds a zod schema: z.string(…)',
      'functions/src/callables/build.ts:4 — builds a zod schema: z.enum(…)',
      'functions/src/callables/build.ts:5 — constructs a zod schema: new z.ZodObject(…)',
    ]);
  });
});

describe('publish-avoidance reasons', () => {
  it('FLAGS avoiding, skipping, or saving a publish or release of a package, the core, or the core by name — comments included', async () => {
    expect(lines(await f.run(publishReasons))).toEqual([
      'src/forms/local.ts:2 — names avoiding a publish as a reason: "avoid a core publish"',
      'src/lib/limits.ts:1 — names avoiding a publish as a reason: "avoids the publish"',
      'src/lib/limits.ts:2 — names avoiding a publish as a reason: "saving a package release"',
      'src/lib/limits.ts:3 — names avoiding a publish as a reason: "skip a @fx/core release"',
    ]);
  });
});

describe('the facts', () => {
  it('refuses a missing core package, no backend root, and a role that is no source root', () => {
    expect(coreContractsGuard.factProblems({ corePackage: '', backendRoots: [] })).toEqual([
      'corePackage is missing',
      'backendRoots is missing or empty',
    ]);
    expect(coreContractsGuard.factProblems({ corePackage: '@fx/core', backendRoots: ['coreDist', 'server' as never] })).toEqual([
      'backendRoots names coreDist, which is no source root role',
      'backendRoots names server, which is no source root role',
    ]);
  });
});
