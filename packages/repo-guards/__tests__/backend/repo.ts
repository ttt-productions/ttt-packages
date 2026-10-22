import type { Guard } from '../../src/guard.js';
import { sampleHits } from '../../src/shapes/shapes.js';
import { createRepoReader, type RepoReader } from '../../src/node/reader.js';
import type { RepoLayout } from '../../src/node/layout.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo } from '../helpers/temp-repo.js';

export interface BackendRepo {
  reader: RepoReader;
  run(guard: Guard): Promise<Array<{ file: string; line?: number; detail: string }>>;
  remove(): void;
}

export function backendRepo(
  files: Record<string, string>,
  layout: Partial<RepoLayout> = {},
): BackendRepo {
  const repo = tempRepo({
    'src/anchor.ts': 'export {};',
    'functions/src/anchor.ts': 'export {};',
    ...files,
  });
  const hasScripts = Object.keys(files).some((p) => p.startsWith('scripts/'));
  const reader = createRepoReader({
    repoRoot: repo.root,
    roots: {
      app: { path: 'src', anchor: 'src/anchor.ts' },
      functions: { path: 'functions/src', anchor: 'functions/src/anchor.ts' },
      ...(hasScripts
        ? {
            scripts: {
              path: 'scripts',
              anchor: Object.keys(files).find((p) => p.startsWith('scripts/'))!,
            },
          }
        : {}),
    },
    ...layout,
  });
  return {
    reader,
    run: async (guard) => guard.run(contextOf(reader)),
    remove: () => repo.remove(),
  };
}

export function samplesHold(guard: Guard): boolean {
  if (!guard.samples) return true;
  return (
    guard.samples.flags.every((s) => sampleHits(guard, s) > 0) &&
    guard.samples.passes.every((s) => sampleHits(guard, s) === 0)
  );
}
