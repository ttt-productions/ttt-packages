import { describe, expect, it } from 'vitest';
import { rawMutations, viewOfText } from '@ttt-productions/repo-guards';
import { packageSource } from './workspace';

const OWNER = 'packages/query-core/src/react/session-mutation.tsx';
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

const sourceFiles = packageSource(['code']).filter(
  (file) => !file.isTest && !TEST_FILE.test(file.path),
);

const fixtureHits = (text: string) =>
  rawMutations(viewOfText('packages/fixture/src/hook.ts', text));

describe('boundary: every package mutation goes through the session-aware mutation owner', () => {
  it('scans the package sources, the owner among them', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
    expect(sourceFiles.map((file) => file.path)).toContain(OWNER);
  });

  it("uses TanStack's raw useMutation only inside query-core's owner", () => {
    const violations = sourceFiles
      .filter((file) => file.path !== OWNER)
      .flatMap((file) =>
        rawMutations(file).map((hit) => `${file.path}:${file.lineOf(hit.index)}: ${hit.detail}`),
      );
    expect(
      violations,
      `a raw useMutation has no session fence — build the mutation with query-core's useSessionMutation:\n  ${violations.join('\n  ')}`,
    ).toEqual([]);
  });

  it('finds the raw hook imported by name, aliased, through a namespace, re-exported, or loaded at run time', () => {
    const flagged = [
      "import { useMutation } from '@tanstack/react-query';",
      "import { useMutation as useRaw, useQuery } from '@tanstack/react-query';",
      "import * as RQ from '@tanstack/react-query';\nexport const m = () => RQ.useMutation({});",
      "export { useMutation } from '@tanstack/react-query';",
      "export { useMutation as useRawMutation } from '@tanstack/react-query';",
      "export * from '@tanstack/react-query';",
      "export * as RQ from '@tanstack/react-query';",
      "export const load = async () => (await import('@tanstack/react-query')).useMutation;",
      "import * as RQ from '@tanstack/react-query';\nconst { useMutation } = RQ;",
      "import * as RQ from '@tanstack/react-query';\nconst { useMutation: raw } = RQ;",
      "import * as RQ from '@tanstack/react-query';\nexport const m = () => RQ['useMutation']({});",
      "export const m = async () => { const RQ = await import('@tanstack/react-query'); return RQ.useMutation; };",
    ];
    for (const text of flagged) expect(fixtureHits(text), text).not.toEqual([]);
  });

  it('passes type-only use, other TanStack hooks, a namespace that never reaches the hook, and the owner hook', () => {
    const clean = [
      "import type { useMutation } from '@tanstack/react-query';",
      "import { type useMutation, useQuery } from '@tanstack/react-query';",
      "import type { UseMutationResult } from '@tanstack/react-query';",
      "import { useQuery } from '@tanstack/react-query';",
      "import * as RQ from '@tanstack/react-query';\nexport const q = () => RQ.useQuery({});",
      "import { useSessionMutation } from '@ttt-productions/query-core/react';",
      "import * as RQ from '@tanstack/react-query';\nconst { useQuery } = RQ;\nexport const k = RQ['useQuery'];",
      "export const q = async () => (await import('@tanstack/react-query')).useQuery;\nexport const note = 'useMutation';",
      'export const example = "import { useMutation } from \'@tanstack/react-query\';";',
    ];
    for (const text of clean) expect(fixtureHits(text), text).toEqual([]);
  });
});
