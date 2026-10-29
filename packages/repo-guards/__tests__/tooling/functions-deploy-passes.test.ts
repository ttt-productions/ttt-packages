import { describe, expect, it } from 'vitest';
import type { LiveFunction } from '../../src/node/tooling/deployed-functions.js';
import {
  DEPLOY_PASS_ATTEMPTS,
  DEPLOY_PASS_PAUSE_MS,
  planFunctionsDeployPasses,
  runFunctionsDeployPasses,
  type DeployPassEffects,
  type FunctionsManifest,
} from '../../src/node/tooling/functions-deploy-passes.js';

const live = (name: string, codebase: string | null, state = 'ACTIVE'): LiveFunction => ({
  name,
  codebase,
  state,
});

describe('planFunctionsDeployPasses', () => {
  const manifest: FunctionsManifest = { a: ['a1', 'a2'], b: ['b1'], c: ['c1'] };

  it('deploys the targeted codebases in manifest order when nothing moves', () => {
    expect(
      planFunctionsDeployPasses({
        targets: ['a', 'b', 'c'],
        manifest,
        live: [live('a1', 'a'), live('b1', 'b'), live('c1', 'c')],
      }),
    ).toEqual({ passes: ['a', 'b', 'c'], problems: [] });
  });

  it('deploys the codebase a function moves to before the codebase it leaves', () => {
    expect(
      planFunctionsDeployPasses({
        targets: ['a', 'b', 'c'],
        manifest: { a: ['a1'], b: ['b1'], c: ['c1', 'a2'] },
        live: [live('a1', 'a'), live('a2', 'a'), live('b1', 'b'), live('c1', 'c')],
      }).passes,
    ).toEqual(['b', 'c', 'a']);
  });

  it('needs no order for a move out of a codebase that no longer exists', () => {
    expect(
      planFunctionsDeployPasses({
        targets: ['works', 'library'],
        manifest: { works: ['w1'], library: ['l1'] },
        live: [live('w1', 'interactive'), live('l1', 'interactive')],
      }),
    ).toEqual({ passes: ['works', 'library'], problems: [] });
  });

  it('refuses functions that move both ways between two codebases in one release', () => {
    const plan = planFunctionsDeployPasses({
      targets: ['a', 'b'],
      manifest: { a: ['b1'], b: ['a1'] },
      live: [live('a1', 'a'), live('b1', 'b')],
    });
    expect(plan.problems).toEqual([
      'functions move both ways between a, b (a1 a -> b, b1 b -> a); move them in two releases',
    ]);
  });

  it('refuses a move into a codebase this release does not deploy', () => {
    expect(
      planFunctionsDeployPasses({
        targets: ['a'],
        manifest: { a: ['a1'], b: ['a2'] },
        live: [live('a1', 'a'), live('a2', 'a')],
      }).problems,
    ).toEqual(['a2 moves from a to b, but this release does not deploy b']);
  });

  it('refuses a live function no codebase owns, which no pass would delete', () => {
    expect(
      planFunctionsDeployPasses({
        targets: ['a'],
        manifest: { a: ['a1'] },
        live: [live('a1', 'a'), live('ghost', 'retired'), live('bare', null)],
      }).problems,
    ).toEqual([
      'ghost is live under retired, which no codebase deploys, so no pass would delete it',
      'bare is live under no codebase, which no codebase deploys, so no pass would delete it',
    ]);
  });

  it('leaves a removed function of a deployed codebase to that codebase pass', () => {
    expect(
      planFunctionsDeployPasses({
        targets: ['a'],
        manifest: { a: ['a1'] },
        live: [live('a1', 'a'), live('gone', 'a')],
      }),
    ).toEqual({ passes: ['a'], problems: [] });
  });
});

function fakeEffects({
  liveAfter,
  failDeploys = new Map<string, number>(),
}: {
  liveAfter: (deployed: readonly string[]) => LiveFunction[];
  failDeploys?: Map<string, number>;
}) {
  const deployed: string[] = [];
  const events: string[] = [];
  const errors: string[] = [];
  const effects: DeployPassEffects = {
    listLive: () => liveAfter(deployed),
    deploy: (only) => {
      events.push(`deploy ${only}`);
      const failures = failDeploys.get(only) ?? 0;
      if (failures > 0) {
        failDeploys.set(only, failures - 1);
        return false;
      }
      deployed.push(only);
      return true;
    },
    pause: (ms) => events.push(`pause ${ms}`),
    log: () => {},
    error: (line) => errors.push(line),
  };
  return { effects, events, errors };
}

describe('runFunctionsDeployPasses', () => {
  const manifest: FunctionsManifest = { a: ['a1'], b: ['b1'] };
  const allLive = () => [live('a1', 'a'), live('b1', 'b')];

  it('deploys the rules first, then each codebase on its own with a pause between passes', () => {
    const { effects, events } = fakeEffects({ liveAfter: allLive });
    expect(
      runFunctionsDeployPasses(
        { targets: ['a', 'b'], manifest, nonFunctionTargets: ['firestore:rules', 'storage'] },
        effects,
      ),
    ).toBe(true);
    expect(events).toEqual([
      'deploy firestore:rules,storage',
      'deploy functions:a',
      `pause ${DEPLOY_PASS_PAUSE_MS}`,
      'deploy functions:b',
    ]);
  });

  it('retries a pass whose live functions do not match, then moves on once they do', () => {
    let checks = 0;
    const { effects, events } = fakeEffects({
      liveAfter: () => {
        checks += 1;
        return checks === 2 ? [live('b1', 'b')] : allLive();
      },
    });
    expect(
      runFunctionsDeployPasses({ targets: ['a', 'b'], manifest, nonFunctionTargets: [] }, effects),
    ).toBe(true);
    expect(events).toEqual([
      'deploy functions:a',
      `pause ${DEPLOY_PASS_PAUSE_MS}`,
      'deploy functions:a',
      `pause ${DEPLOY_PASS_PAUSE_MS}`,
      'deploy functions:b',
    ]);
  });

  it('stops after a pass fails every attempt, and runs no later pass', () => {
    const { effects, events, errors } = fakeEffects({
      liveAfter: allLive,
      failDeploys: new Map([['functions:a', DEPLOY_PASS_ATTEMPTS]]),
    });
    expect(
      runFunctionsDeployPasses({ targets: ['a', 'b'], manifest, nonFunctionTargets: [] }, effects),
    ).toBe(false);
    expect(events.filter((e) => e.startsWith('deploy'))).toEqual(
      Array.from({ length: DEPLOY_PASS_ATTEMPTS }, () => 'deploy functions:a'),
    );
    expect(errors.at(-1)).toMatch(/functions:a failed 3 attempts; later passes did not run/);
  });

  it('deploys nothing when the plan refuses', () => {
    const { effects, events, errors } = fakeEffects({
      liveAfter: () => [live('ghost', 'retired'), ...allLive()],
    });
    expect(
      runFunctionsDeployPasses(
        { targets: ['a', 'b'], manifest, nonFunctionTargets: ['storage'] },
        effects,
      ),
    ).toBe(false);
    expect(events).toEqual([]);
    expect(errors.at(-1)).toBe('[deploy-functions] Nothing was deployed.');
  });

  it('runs only the non-function pass when no codebase is targeted', () => {
    const { effects, events } = fakeEffects({ liveAfter: allLive });
    expect(
      runFunctionsDeployPasses({ targets: [], manifest, nonFunctionTargets: ['storage'] }, effects),
    ).toBe(true);
    expect(events).toEqual(['deploy storage']);
  });
});
