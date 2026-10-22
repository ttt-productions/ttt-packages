import { describe, it, beforeAll } from 'vitest';
import { buildGenericGuards, configProblems, type GenericGuardDefinition } from './config.js';
import type { Guard } from '../../guard.js';
import { createRepoReader } from '../reader.js';
import type { RepoLayout } from '../layout.js';
import { GENERIC_GUARDS, type GenericGuardFacts } from './registry.js';
import { checkSamples, runGuard } from './run.js';

export interface GuardSuiteConfig {
  layout: RepoLayout;
  generic: GenericGuardFacts;
  business: readonly Guard[];
}

const DEFAULT_TIMEOUT_MS = 60_000;

export function registerGuardSuite(config: GuardSuiteConfig): void {
  registerSuiteOf(
    {
      layout: config.layout,
      generic: config.generic as unknown as Readonly<Record<string, unknown>>,
      business: config.business,
    },
    GENERIC_GUARDS,
  );
}

export function registerSuiteOf(
  config: {
    layout: RepoLayout;
    generic: Readonly<Record<string, unknown>>;
    business: readonly Guard[];
  },
  definitions: ReadonlyArray<GenericGuardDefinition<never>>,
): void {
  const { generic } = config;
  const problems = configProblems(config, definitions);
  if (problems.length)
    throw new Error(`repo-guards: the guard config cannot run:\n  - ${problems.join('\n  - ')}`);
  const reader = createRepoReader(config.layout);
  const guards = [...buildGenericGuards(generic, definitions), ...config.business];

  describe('repository guards', () => {
    it('the reader reaches every declared root', () => {
      const unreached = reader.unreachedAnchors();
      if (unreached.length)
        throw new Error(
          `the walk never reached these root anchors, so their trees go unchecked:\n  ${unreached.join('\n  ')}`,
        );
    });
    for (const guard of guards) {
      describe(guard.title, () => {
        if (guard.prepare) beforeAll(() => guard.prepare!(), guard.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        if (guard.samples)
          it('flags every must-fail sample and passes every must-pass sample', () =>
            checkSamples(guard));
        const skipped = guard.skipReason?.(reader) ?? null;
        if (skipped) it.skip(`holds across the repository — SKIPPED: ${skipped}`, () => {});
        else
          it(
            'holds across the repository',
            () => runGuard(guard, reader),
            guard.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          );
      });
    }
  });
}
