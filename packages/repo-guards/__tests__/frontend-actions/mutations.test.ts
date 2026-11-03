import { describe, expect, it } from 'vitest';
import type { ConfiguredGuardDefinition } from '../../src/node/suite/config.js';
import { mutateCalls } from '../../src/modules/frontend-actions/mutate-calls.js';
import {
  mutationCallStyleGuard,
  mutationOwnerGuard,
  type MutationOwnerFacts,
} from '../../src/modules/frontend-actions/mutations.js';
import { rawMutations } from '../../src/modules/frontend-actions/raw-mutations.js';
import { viewOfText } from '../../src/reader/view.js';
import { findingsOf, samplesProve } from './run.js';

const lines = (...l: string[]) => l.join('\n');

describe('the raw useMutation detector', () => {
  const sites = (text: string) => rawMutations(viewOfText('src/hook.ts', text));

  it('finds the raw hook imported by name, aliased, through a namespace, re-exported, or loaded at run time', () => {
    for (const text of [
      "import { useMutation } from '@tanstack/react-query';",
      "import { useMutation as useRaw, useQuery } from '@tanstack/react-query';",
      "import * as RQ from '@tanstack/react-query';\nexport const m = () => RQ.useMutation({});",
      "export { useMutation } from '@tanstack/react-query';",
      "export { useMutation as useRawMutation } from '@tanstack/react-query';",
      "export * from '@tanstack/react-query';",
      "export * as RQ from '@tanstack/react-query';",
      "export const load = async () => (await import('@tanstack/react-query')).useMutation;",
      "const { useMutation: raw } = require('@tanstack/react-query');",
      "import * as RQ from '@tanstack/react-query';\nconst { useMutation } = RQ;",
      "import * as RQ from '@tanstack/react-query';\nconst { useMutation: raw } = RQ;",
      "import * as RQ from '@tanstack/react-query';\nexport const m = () => RQ['useMutation']({});",
      "export const m = async () => { const RQ = await import('@tanstack/react-query'); return RQ.useMutation; };",
    ])
      expect(sites(text), text).not.toEqual([]);
  });

  it('passes type-only use, other TanStack hooks, a namespace that never reaches the hook, the owner hook, and a string', () => {
    for (const text of [
      "import type { useMutation } from '@tanstack/react-query';",
      "import { type useMutation, useQuery } from '@tanstack/react-query';",
      "import type { UseMutationResult } from '@tanstack/react-query';",
      "import * as RQ from '@tanstack/react-query';\nexport const q = () => RQ.useQuery({});",
      "import { useSessionMutation } from '@kit/query/react';",
      'export const example = "import { useMutation } from \'@tanstack/react-query\';";',
      "import * as RQ from '@tanstack/react-query';\nconst { useQuery } = RQ;\nexport const k = RQ['useQuery'];",
      "export const q = async () => (await import('@tanstack/react-query')).useQuery;\nexport const note = 'useMutation';",
    ])
      expect(sites(text), text).toEqual([]);
  });
});

describe('every mutation goes through the mutation owner', () => {
  const facts: MutationOwnerFacts = {
    ownerImport: { module: '@kit/query/react', name: 'useSessionMutation' },
    exceptions: [{ path: 'src/hooks/use-raw.ts', why: 'a reviewed raw mutation' }],
  };
  const owner = lines(
    "import { useSessionMutation } from '@kit/query/react';",
    'export const useSave = () => useSessionMutation({ mutationFn: save });',
  );
  const base = {
    'src/hooks/use-save.ts': owner,
    'src/hooks/use-raw.ts': lines(
      "import { useMutation } from '@tanstack/react-query';",
      'export const useRaw = () => useMutation({ mutationFn: raw });',
    ),
    'src/hooks/use-types.ts':
      "import { useQuery, type UseMutationResult } from '@tanstack/react-query';\nimport type { useMutation } from '@tanstack/react-query';",
    'src/hooks/use-save.test.ts': "import { useMutation } from '@tanstack/react-query';",
  };

  it('passes the owner, type-only imports, tests, and a reviewed exception', async () => {
    expect(await findingsOf(mutationOwnerGuard, facts, base)).toEqual([]);
    samplesProve(mutationOwnerGuard, facts);
  });

  it('flags a raw mutation imported by name, by alias, through a namespace, or re-exported', async () => {
    const files = {
      ...base,
      'src/a.ts': "import { useMutation } from '@tanstack/react-query';",
      'src/b.ts': "import { useMutation as useM } from '@tanstack/react-query';",
      'src/c.ts': lines(
        "import * as RQ from '@tanstack/react-query';",
        'const m = RQ.useMutation({ mutationFn });',
      ),
      'src/d.ts': "export { useMutation } from '@tanstack/react-query';",
    };
    expect(await findingsOf(mutationOwnerGuard, facts, files)).toEqual([
      'src/a.ts:1 not on the reviewed list: useMutation from @tanstack/react-query',
      'src/b.ts:1 not on the reviewed list: useMutation from @tanstack/react-query',
      'src/c.ts:2 not on the reviewed list: RQ.useMutation',
      'src/d.ts:1 not on the reviewed list: useMutation from @tanstack/react-query',
    ]);
  });

  it('flags a whole-module re-export of a TanStack package', async () => {
    const files = {
      ...base,
      'src/f.ts': "export * from '@tanstack/react-query';",
      'src/g.ts': "export * as RQ from '@tanstack/react-query';",
    };
    expect(await findingsOf(mutationOwnerGuard, facts, files)).toEqual([
      'src/f.ts:1 not on the reviewed list: export * from @tanstack/react-query',
      'src/g.ts:1 not on the reviewed list: export * as RQ from @tanstack/react-query',
    ]);
  });

  it('flags a run-time load of a TanStack package whose loaded module is used for the raw hook', async () => {
    const files = {
      ...base,
      'src/h.ts':
        "export const load = async () => (await import('@tanstack/react-query')).useMutation;",
      'src/i.ts': "export const q = async () => (await import('@tanstack/react-query')).useQuery;",
    };
    expect(await findingsOf(mutationOwnerGuard, facts, files)).toEqual([
      'src/h.ts:1 not on the reviewed list: dynamic load of @tanstack/react-query for useMutation',
    ]);
  });

  it("flags a hook of the owner's name from any other module", async () => {
    const files = {
      ...base,
      'src/e.ts': "import { useSessionMutation } from '@/lib/my-mutation';",
    };
    expect(await findingsOf(mutationOwnerGuard, facts, files)).toEqual([
      'src/e.ts:1 not on the reviewed list: useSessionMutation from @/lib/my-mutation, which is not @kit/query/react',
    ]);
  });

  it('flags a stale exception and an owner import nothing uses', async () => {
    const files = {
      'src/hooks/use-raw.ts': 'export const useRaw = () => null;',
    };
    expect(await findingsOf(mutationOwnerGuard, facts, files)).toEqual([
      'src/hooks/use-raw.ts stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)',
      '@kit/query/react no app file imports useSessionMutation from @kit/query/react: the owner import is stale',
    ]);
  });

  it('refuses facts without an owner module and hook name', () => {
    expect(
      mutationOwnerGuard.factProblems({
        ownerImport: { module: '', name: 'use session' },
        exceptions: [],
      }),
    ).toEqual(['ownerImport.module is missing', 'ownerImport.name must be an identifier']);
  });
});

describe('the mutate detector', () => {
  const sites = (text: string) => mutateCalls(viewOfText('src/control.tsx', text));

  it('finds mutate called, passed as a value, read by bracket, optional-chained, or destructured', () => {
    for (const text of [
      'save.mutate(values);',
      'save.mutate(values, { onSuccess: () => toast(saved) });',
      'useSave().mutate(values);',
      'save?.mutate(values);',
      "save['mutate'](values);",
      'export const C = () => <Button onClick={save.mutate} />;',
      'const { mutate } = useSave();',
      'const { mutate: saveNow, mutateAsync } = useSave();',
      'export const run = ({ mutate }: { mutate: () => void }) => mutate;',
    ])
      expect(sites(text), text).not.toEqual([]);
  });

  it('passes mutateAsync, an object key named mutate, a type position, a string, and a comment', () => {
    for (const text of [
      'await save.mutateAsync(values);',
      'const { mutateAsync } = useSave();',
      'const mock = { mutate: vi.fn() };',
      "type Run = UseMutationResult['mutate'];",
      "const note = 'save.mutate(values)';",
      '// save.mutate(values) was the old shape',
      'const { mutated } = result;',
    ])
      expect(sites(text), text).toEqual([]);
  });
});

describe('a control runs a mutation only through await mutateAsync', () => {
  const base = {
    'src/components/save-button.tsx': lines(
      'export const SaveButton = () => {',
      '  const save = useSave();',
      '  const press = async () => {',
      '    try {',
      '      await save.mutateAsync(values);',
      '      toast(saved);',
      '    } catch {',
      '      // The hook has said why.',
      '    }',
      '  };',
      '  return <Button onClick={press} />;',
      '};',
    ),
    'src/components/save-button.test.tsx': lines(
      'const save = { mutate: vi.fn() };',
      'save.mutate(values);',
    ),
    'src/__tests__/helpers/mutations.ts': 'export const idle = (m: Run) => m.mutate;',
  };

  it('passes awaited mutateAsync calls, and leaves tests and test helpers alone', async () => {
    expect(await findingsOf(mutationCallStyleGuard, {}, base)).toEqual([]);
    samplesProve(mutationCallStyleGuard, {});
  });

  it('flags a fire-and-forget press, a passed or bracket-read mutate, and a destructured one', async () => {
    const files = {
      ...base,
      'src/a.tsx': 'save.mutate(values, { onSuccess: close });',
      'src/b.tsx': 'export const B = () => <Button onClick={save.mutate} />;',
      'src/c.ts': "save['mutate'](values);",
      'src/d.ts': 'const { mutate: markSeen } = useMarkSeen();',
    };
    expect(await findingsOf(mutationCallStyleGuard, {}, files)).toEqual([
      'src/a.tsx:1 not on the reviewed list: save.mutate',
      'src/b.tsx:1 not on the reviewed list: save.mutate',
      "src/c.ts:1 not on the reviewed list: save['mutate']",
      'src/d.ts:1 not on the reviewed list: mutate destructured as markSeen',
    ]);
  });

  it('takes no facts', () => {
    const configured: ConfiguredGuardDefinition = mutationCallStyleGuard;
    expect(configured.factProblems({})).toEqual([]);
    expect(configured.factProblems({ exceptions: [] })).toEqual(['unknown facts: exceptions']);
  });
});
