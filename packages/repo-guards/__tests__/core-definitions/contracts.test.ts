import { afterAll, describe, expect, it } from 'vitest';
import { coreContractsGuard } from '../../src/modules/core-definitions/contracts.js';
import { fixture, lines } from './fixture.js';
import { factProblemsOf } from '../helpers/configured.js';

const [zodBuilds, publishReasons] = coreContractsGuard.build({
  corePackage: '@fx/core',
  backendRoots: ['functions'],
});

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
    'const pretty = z.prettifyError(err);',
    'const tree = z.treeifyError(err);',
    'const flat = z.flattenError(err);',
    'const parsed = z.safeParse(InputSchema, data);',
    'throw new z.ZodError([]);',
  ].join('\n'),
  'functions/src/callables/named.ts': [
    "import { object, string as text, prettifyError, ZodError } from 'zod';",
    "import * as zod from 'zod/v4';",
    "import type { infer as Infer } from 'zod';",
    'const Input = object({ id: text() });',
    'const Name = zod.number();',
    'const message = err instanceof ZodError ? prettifyError(err) : null;',
    'const unrelated = record(1);',
  ].join('\n'),
  'functions/src/callables/groups.ts': [
    "import { coerce } from 'zod';",
    'const Count = z.coerce.number();',
    'const Day = z.iso.date();',
    'const Flag = coerce.boolean();',
  ].join('\n'),
  'functions/src/callables/build.test.ts': 'const Fixture = z.object({});',
  'src/forms/local.ts':
    'const FormSchema = z.object({ draft: z.string() });\n// Declared here to avoid a core publish.',
  'src/lib/limits.ts':
    'const LIMIT = 5; // avoids the publish\n/* Kept local, saving a package release. */\nconst B = 1; // skip a @fx/core release',
  'src/lib/media.ts':
    '// The fixture skips the asset publish step.\nconst note = "The release pipeline publishes after verification.";',
});
afterAll(() => f.repo.remove());

describe('backend zod schemas', () => {
  it('FLAGS every schema a backend module builds or constructs — on z, on any zod namespace, or through a named import — and leaves zod types, error checks and formatters, parses, prose, tests, and the client root alone', async () => {
    expect(lines(await f.run(zodBuilds))).toEqual([
      'functions/src/callables/build.ts:2 — builds a zod schema: z.object(…)',
      'functions/src/callables/build.ts:2 — builds a zod schema: z.string(…)',
      'functions/src/callables/build.ts:3 — builds a zod schema: z.string(…)',
      'functions/src/callables/build.ts:4 — builds a zod schema: z.enum(…)',
      'functions/src/callables/build.ts:5 — constructs a zod schema: new z.ZodObject(…)',
      'functions/src/callables/groups.ts:2 — builds a zod schema: z.coerce.number(…)',
      'functions/src/callables/groups.ts:3 — builds a zod schema: z.iso.date(…)',
      'functions/src/callables/groups.ts:4 — builds a zod schema: coerce.boolean(…)',
      'functions/src/callables/named.ts:4 — builds a zod schema: object(…)',
      'functions/src/callables/named.ts:4 — builds a zod schema: text(…)',
      'functions/src/callables/named.ts:5 — builds a zod schema: zod.number(…)',
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
      'backendRoots is empty',
    ]);
    expect(
      factProblemsOf(coreContractsGuard, {
        corePackage: '@fx/core',
        backendRoots: ['coreDist', 'server'],
      }),
    ).toEqual([
      'backendRoots names coreDist, which is no source root role',
      'backendRoots names server, which is no source root role',
    ]);
  });
});
